/**
 * BUDGETS.JS - Budgets Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, fetchCategories } from './volakoApi.js';
import { getCategories, setCategoriesCache, getCategoryIcon, getCategoryName } from './utils.js';
import { SUPABASE_TABLES } from './supabase.js';
import notify from './notifications.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class BudgetsManager {
  constructor() {
    const defaultRange = this.getCurrentMonthRange();
    this.budgets = [];
    this.expenses = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.editingBudgetId = null;
    this.selectedBudgetForExpense = null;
    this.currentFilter = {
      category: '',
      period: 'current_month',
      startDate: defaultRange.startDate,
      endDate: defaultRange.endDate
    };
  }

  async init() {
    this.checkAuth();
    renderSidebar('budgets');
    renderBottomNav('budgets');
    await this.loadCategories();
    this.setupEventListeners();
    this.setupForm();
    this.setupExpenseForm();

    applySkeleton('budgets-grid', 'cards');
    await this.refreshData();
  }

  async loadCategories() {
    try {
      const categories = await fetchCategories();
      setCategoriesCache(categories);
    } catch {
      // Utiliser le fallback statique si la BDD est inaccessible
    }
    this.populateCategorySelects();
  }

  populateCategorySelects() {
    const formSelect = document.getElementById('budget-category');
    const filterSelect = document.getElementById('budget-category-filter');

    let formHtml = '<option value="">Selectionner...</option>';
    let filterHtml = '<option value="">Toutes les categories</option>';

    getCategories().forEach(cat => {
      formHtml += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
      filterHtml += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });

    if (formSelect) {
      formSelect.innerHTML = formHtml;
    }

    if (filterSelect) {
      filterSelect.innerHTML = filterHtml;
      filterSelect.value = this.currentFilter.category;
    }
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('budgets-grid', async () => {
      const [budgets, expenses] = await Promise.all([
        fetchTable(SUPABASE_TABLES.BUDGETS, { orderBy: 'updated_at', ascending: false }),
        fetchTable(SUPABASE_TABLES.EXPENSES, { orderBy: 'date', ascending: false })
      ]);

      this.budgets = budgets;
      this.expenses = expenses;
      this.loadBudgets();
    });
  }

  loadBudgets() {
    const filteredBudgets = this.filterBudgets();
    const gridElement = document.getElementById('budgets-grid');
    if (!gridElement) return;

    if (filteredBudgets.length === 0) {
      gridElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary); grid-column: 1/-1;">Aucun budget defini</p>';
      return;
    }

    gridElement.innerHTML = filteredBudgets.map(budget => this.createBudgetHTML(budget)).join('');
    this.attachEventListeners();
  }

  filterBudgets() {
    let filtered = [...this.budgets];

    if (this.currentFilter.category) {
      filtered = filtered.filter(budget => budget.category === this.currentFilter.category);
    }

    const periodRange = this.getFilterRange();
    if (periodRange) {
      filtered = filtered.filter(budget => {
        const budgetRange = this.getBudgetRange(budget);
        return this.rangesOverlap(
          budgetRange.startDate,
          budgetRange.endDate,
          periodRange.startDate,
          periodRange.endDate
        );
      });
    }

    return filtered;
  }

  createBudgetHTML(budget) {
    const range = this.getBudgetRange(budget);
    const spent = this.getSpentForBudget(budget, range.startDate, range.endDate);
    const progress = {
      spent,
      remaining: (parseFloat(budget.amount) || 0) - spent,
      amount: parseFloat(budget.amount) || 0
    };

    const percentage = progress.amount > 0 ? (progress.spent / progress.amount) * 100 : 0;
    const progressBarWidth = Math.min(Math.max(percentage, 0), 100);
    const isOverBudget = percentage > 100;
    const remainingDisplay = isOverBudget
      ? `-${this.formatCurrency(Math.abs(progress.remaining))}`
      : this.formatCurrency(progress.remaining);
    const remainingStyle = isOverBudget ? 'color: var(--color-error); font-weight: 700;' : '';

    let progressColor = 'var(--color-success)';
    if (percentage > 80) progressColor = 'var(--color-error)';
    else if (percentage > 60) progressColor = 'var(--color-warning)';

    const icon = getCategoryIcon(budget.category);
    const safeOtherReference = budget.other_reference ? this.escapeHtml(budget.other_reference) : '';
    const safeNotes = budget.notes ? this.escapeHtml(budget.notes) : '';
    const formattedNotes = safeNotes ? safeNotes.replace(/\n/g, '<br>') : '';
    const categoryName = budget.category === 'autre' && budget.other_reference
      ? `${getCategoryName(budget.category)} (${safeOtherReference})`
      : getCategoryName(budget.category);
    const periodLabel = `Du ${this.formatDateFr(range.startDate)} au ${this.formatDateFr(range.endDate)}`;

    return `
      <div class="budget-card card">
        <div class="budget-header">
          <div class="budget-content">
            <h3>${icon} ${categoryName}</h3>
            <p>${periodLabel}</p>
          </div>
          <div class="budget-actions">
            <button class="btn-icon add-expense-btn" data-id="${budget.id}" title="Ajouter une depense" style="display:inline-flex; align-items:center; justify-content:center; gap:2px; line-height:1;"><span style="font-weight:700; font-size:0.9rem;">+</span><span>💸</span></button>
            <button class="btn-icon edit-btn" data-id="${budget.id}" title="Modifier le budget">✏️</button>
            <button class="btn-icon delete-btn" data-id="${budget.id}" title="Supprimer le budget">🗑️</button>
          </div>
        </div>

        <div class="budget-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progressBarWidth}%; background-color: ${progressColor};"></div>
          </div>
          <div class="progress-info">
            <span>${this.formatCurrency(progress.spent)} / ${this.formatCurrency(progress.amount)}</span>
            <span class="progress-percent">${isOverBudget ? `⚠️ ${Math.round(percentage)}%` : `${Math.round(percentage)}%`}</span>
          </div>
        </div>

        <div class="budget-stats">
          <div>
            <span class="stat-label">Restant</span>
            <span class="stat-value" style="${remainingStyle}">${remainingDisplay}</span>
          </div>
          <div>
            <span class="stat-label">Depense</span>
            <span class="stat-value">${this.formatCurrency(progress.spent)}</span>
          </div>
        </div>

        ${formattedNotes ? `<div class="budget-notes"><span class="stat-label">Details</span><p>${formattedNotes}</p></div>` : ''}
      </div>
    `;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const addBtn = document.getElementById('add-budget-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openModal());
    }

    const modal = document.getElementById('budget-modal');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    closeBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });

    const expenseModal = document.getElementById('budget-expense-modal');
    const expenseCloseBtns = expenseModal?.querySelectorAll('.modal-close');
    expenseCloseBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.closeExpenseModal());
    });

    const categoryFilter = document.getElementById('budget-category-filter');
    if (categoryFilter) {
      categoryFilter.value = this.currentFilter.category;
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilter.category = e.target.value;
        this.loadBudgets();
      });
    }

    const periodFilter = document.getElementById('budget-period-filter');
    if (periodFilter) {
      periodFilter.value = this.currentFilter.period;
      periodFilter.addEventListener('change', (e) => {
        this.currentFilter.period = e.target.value;
        this.syncFilterInputsFromPeriod();
        this.loadBudgets();
      });
    }

    const startFilterInput = document.getElementById('budget-filter-start');
    if (startFilterInput) {
      startFilterInput.value = this.currentFilter.startDate;
      startFilterInput.addEventListener('change', (e) => {
        this.currentFilter.startDate = e.target.value || '';
        this.currentFilter.period = 'custom';
        const periodSelect = document.getElementById('budget-period-filter');
        if (periodSelect) periodSelect.value = 'custom';
        this.loadBudgets();
      });
    }

    const endFilterInput = document.getElementById('budget-filter-end');
    if (endFilterInput) {
      endFilterInput.value = this.currentFilter.endDate;
      endFilterInput.addEventListener('change', (e) => {
        this.currentFilter.endDate = e.target.value || '';
        this.currentFilter.period = 'custom';
        const periodSelect = document.getElementById('budget-period-filter');
        if (periodSelect) periodSelect.value = 'custom';
        this.loadBudgets();
      });
    }

    this.syncFilterInputsFromPeriod();
  }

  attachEventListeners() {
    document.querySelectorAll('.add-expense-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const budget = this.budgets.find(b => b.id === id);
        if (budget) {
          this.openExpenseModal(budget);
        }
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        this.deleteBudget(id);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const budget = this.budgets.find(b => b.id === id);
        if (budget) {
          this.openModal(budget);
        }
      });
    });
  }

  setupForm() {
    const form = document.getElementById('budget-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true, 'Enregistrement...');
        try {
          await this.saveBudget();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }

    const categorySelect = document.getElementById('budget-category');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');

    if (categorySelect && otherReferenceGroup) {
      categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'autre') {
          otherReferenceGroup.style.display = 'block';
        } else {
          otherReferenceGroup.style.display = 'none';
          document.getElementById('budget-other-reference').value = '';
        }
      });
    }
  }

  setupExpenseForm() {
    const form = document.getElementById('budget-expense-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Enregistrement...');
      try {
        await this.saveExpenseFromBudget();
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    const dateInput = document.getElementById('budget-expense-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  openExpenseModal(budget) {
    const modal = document.getElementById('budget-expense-modal');
    const form = document.getElementById('budget-expense-form');
    const categoryLabel = document.getElementById('budget-expense-category-label');
    const descriptionInput = document.getElementById('budget-expense-description');
    const amountInput = document.getElementById('budget-expense-amount');
    const dateInput = document.getElementById('budget-expense-date');

    if (!modal || !form) return;

    this.selectedBudgetForExpense = budget;
    form.reset();

    if (categoryLabel) {
      categoryLabel.textContent = `${getCategoryIcon(budget.category)} ${getCategoryName(budget.category)}`;
    }

    if (descriptionInput) {
      descriptionInput.value = '';
      descriptionInput.focus();
    }

    if (amountInput) {
      amountInput.value = '';
    }

    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
  }

  closeExpenseModal() {
    const modal = document.getElementById('budget-expense-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    this.selectedBudgetForExpense = null;
  }

  async saveExpenseFromBudget() {
    if (!this.selectedBudgetForExpense) {
      notify.error('Aucun budget selectionne.');
      return;
    }

    const description = document.getElementById('budget-expense-description')?.value?.trim() || '';
    const amount = parseFloat(document.getElementById('budget-expense-amount')?.value || '0');
    const date = document.getElementById('budget-expense-date')?.value;

    if (!description || Number.isNaN(amount) || amount <= 0 || !date) {
      notify.error('Description, montant et date sont requis.');
      return;
    }

    const budget = this.selectedBudgetForExpense;
    try {
      await insertRow(SUPABASE_TABLES.EXPENSES, {
        id: generateUUID(),
        description,
        amount,
        category: budget.category,
        date,
        other_reference: budget.category === 'autre' ? (budget.other_reference || null) : null,
        created_at: new Date().toISOString()
      }, 'Ajout de la depense');

      await this.refreshData();
      this.closeExpenseModal();
      notify.success('Depense ajoutee depuis le budget.');
    } catch (error) {
      if (error.message === 'MODE_HORS_LIGNE') {
        return;
      }

      if (error.message?.includes('SOLDE_INSUFFISANT')) {
        notify.error('Solde disponible insuffisant pour enregistrer cette depense.');
        return;
      }

      notify.error(error.message || 'Erreur lors de l ajout de la depense.');
    }
  }

  openModal(budget = null) {
    const modal = document.getElementById('budget-modal');
    const form = document.getElementById('budget-form');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');
    const otherReferenceInput = document.getElementById('budget-other-reference');
    const categorySelect = document.getElementById('budget-category');
    const amountInput = document.getElementById('budget-amount');
    const startDateInput = document.getElementById('budget-start-date');
    const endDateInput = document.getElementById('budget-end-date');
    const notesInput = document.getElementById('budget-notes');
    const modalTitle = document.getElementById('budget-modal-title');
    const submitBtn = document.getElementById('budget-submit');

    this.editingBudgetId = budget?.id || null;

    if (modal) {
      modal.classList.add('active');
    }

    if (form) {
      form.reset();
    }

    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
    }

    const isEditing = Boolean(budget);

    if (modalTitle) {
      modalTitle.textContent = isEditing ? 'Modifier un budget' : 'Creer un budget';
    }

    if (submitBtn) {
      submitBtn.textContent = isEditing ? 'Mettre a jour' : 'Enregistrer';
    }

    if (categorySelect) {
      categorySelect.disabled = isEditing;
    }

    if (notesInput) {
      notesInput.value = budget?.notes || '';
    }

    if (budget) {
      const range = this.getBudgetRange(budget);
      if (categorySelect) categorySelect.value = budget.category;
      if (amountInput) amountInput.value = budget.amount;
      if (startDateInput) startDateInput.value = range.startDate;
      if (endDateInput) endDateInput.value = range.endDate;

      if (budget.category === 'autre') {
        if (otherReferenceGroup) otherReferenceGroup.style.display = 'block';
        if (otherReferenceInput) otherReferenceInput.value = budget.other_reference || '';
      }
    } else if (categorySelect) {
      const defaultRange = this.getCurrentMonthRange();
      categorySelect.disabled = false;
      if (startDateInput) startDateInput.value = defaultRange.startDate;
      if (endDateInput) endDateInput.value = defaultRange.endDate;
    }
  }

  closeModal() {
    const modal = document.getElementById('budget-modal');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');
    const categorySelect = document.getElementById('budget-category');
    const startDateInput = document.getElementById('budget-start-date');
    const endDateInput = document.getElementById('budget-end-date');
    const notesInput = document.getElementById('budget-notes');

    if (modal) {
      modal.classList.remove('active');
    }

    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
      const otherReferenceInput = document.getElementById('budget-other-reference');
      if (otherReferenceInput) otherReferenceInput.value = '';
    }

    if (categorySelect) {
      categorySelect.disabled = false;
      categorySelect.value = '';
    }

    if (startDateInput) {
      startDateInput.value = '';
    }

    if (endDateInput) {
      endDateInput.value = '';
    }

    if (notesInput) {
      notesInput.value = '';
    }

    this.editingBudgetId = null;
  }

  async saveBudget() {
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    const otherReference = category === 'autre' ? document.getElementById('budget-other-reference').value : '';
    const notes = document.getElementById('budget-notes')?.value.trim() || '';
    const startDateInput = document.getElementById('budget-start-date')?.value || '';
    const endDateInput = document.getElementById('budget-end-date')?.value || '';
    const defaultRange = this.getCurrentMonthRange();
    const { startDate, endDate } = this.normalizeRange(startDateInput, endDateInput, defaultRange.startDate, defaultRange.endDate);
    const timestamp = new Date().toISOString();

    if (!category || Number.isNaN(amount) || amount < 0) {
      notify.error('Categorie ou montant invalide.');
      return;
    }

    if (!startDate || !endDate) {
      notify.error('Periode de budget invalide.');
      return;
    }

    if (startDate > endDate) {
      notify.error('La date de debut doit etre inferieure ou egale a la date de fin.');
      return;
    }

    try {
      const overlappingBudget = this.budgets.find(budget => (
        budget.category === category
        && budget.id !== this.editingBudgetId
        && this.isBudgetOverlapping(budget, startDate, endDate)
      ));

      if (overlappingBudget && !this.editingBudgetId) {
        const confirmed = await showConfirmModal(
          'Un budget avec cette categorie existe deja sur une periode qui se chevauche. Le remplacer ?',
          {
            title: 'Budget existant sur la periode',
            confirmText: 'Remplacer',
            cancelText: 'Annuler',
            danger: false
          }
        );

        if (!confirmed) return;

        await updateRow(SUPABASE_TABLES.BUDGETS, overlappingBudget.id, {
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          start_date: startDate,
          end_date: endDate,
          updated_at: timestamp
        }, 'Mise a jour du budget');
      } else if (overlappingBudget && this.editingBudgetId) {
        notify.error('Un autre budget de cette categorie existe deja sur la meme periode.');
        return;
      } else if (this.editingBudgetId) {
        await updateRow(SUPABASE_TABLES.BUDGETS, this.editingBudgetId, {
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          start_date: startDate,
          end_date: endDate,
          updated_at: timestamp
        }, 'Mise a jour du budget');
      } else {
        await insertRow(SUPABASE_TABLES.BUDGETS, {
          id: generateUUID(),
          category,
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          start_date: startDate,
          end_date: endDate,
          created_at: timestamp,
          updated_at: timestamp
        }, 'Creation du budget');
      }

      await this.refreshData();
      this.closeModal();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la sauvegarde du budget.');
      }
    }
  }

  getCurrentMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      startDate: this.toDateInputValue(start),
      endDate: this.toDateInputValue(end)
    };
  }

  getCurrentYearRange() {
    const now = new Date();
    return {
      startDate: `${now.getFullYear()}-01-01`,
      endDate: `${now.getFullYear()}-12-31`
    };
  }

  getLastMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return {
      startDate: this.toDateInputValue(start),
      endDate: this.toDateInputValue(end)
    };
  }

  getSinceLastMonthRange() {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      startDate: this.toDateInputValue(start),
      endDate: this.toDateInputValue(now)
    };
  }

  toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  normalizeRange(startDate, endDate, defaultStartDate, defaultEndDate) {
    const resolvedStart = startDate || defaultStartDate;
    const resolvedEnd = endDate || defaultEndDate;

    if (!resolvedStart || !resolvedEnd) {
      return { startDate: resolvedStart, endDate: resolvedEnd };
    }

    if (resolvedStart <= resolvedEnd) {
      return { startDate: resolvedStart, endDate: resolvedEnd };
    }

    return { startDate: resolvedEnd, endDate: resolvedStart };
  }

  getBudgetRange(budget) {
    if (budget?.start_date && budget?.end_date) {
      return {
        startDate: budget.start_date,
        endDate: budget.end_date
      };
    }

    const baseDate = budget?.created_at ? new Date(budget.created_at) : new Date();
    const fallbackStart = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const fallbackEnd = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
    return {
      startDate: this.toDateInputValue(fallbackStart),
      endDate: this.toDateInputValue(fallbackEnd)
    };
  }

  isBudgetOverlapping(existingBudget, newStartDate, newEndDate) {
    const existingRange = this.getBudgetRange(existingBudget);
    return this.rangesOverlap(
      existingRange.startDate,
      existingRange.endDate,
      newStartDate,
      newEndDate
    );
  }

  rangesOverlap(startA, endA, startB, endB) {
    return startA <= endB && startB <= endA;
  }

  getFilterRange() {
    if (this.currentFilter.period === 'all') {
      return null;
    }

    if (this.currentFilter.period === 'since_last_month') {
      return this.getSinceLastMonthRange();
    }

    if (this.currentFilter.period === 'last_month') {
      return this.getLastMonthRange();
    }

    if (this.currentFilter.period === 'current_year') {
      return this.getCurrentYearRange();
    }

    if (this.currentFilter.period === 'current_month') {
      return this.getCurrentMonthRange();
    }

    const startDate = this.currentFilter.startDate || '';
    const endDate = this.currentFilter.endDate || '';

    if (!startDate && !endDate) {
      return null;
    }

    return this.normalizeRange(startDate, endDate, startDate || endDate, endDate || startDate);
  }

  syncFilterInputsFromPeriod() {
    const startInput = document.getElementById('budget-filter-start');
    const endInput = document.getElementById('budget-filter-end');

    if (this.currentFilter.period === 'current_month') {
      const range = this.getCurrentMonthRange();
      this.currentFilter.startDate = range.startDate;
      this.currentFilter.endDate = range.endDate;
    } else if (this.currentFilter.period === 'last_month') {
      const range = this.getLastMonthRange();
      this.currentFilter.startDate = range.startDate;
      this.currentFilter.endDate = range.endDate;
    } else if (this.currentFilter.period === 'since_last_month') {
      const range = this.getSinceLastMonthRange();
      this.currentFilter.startDate = range.startDate;
      this.currentFilter.endDate = range.endDate;
    } else if (this.currentFilter.period === 'current_year') {
      const range = this.getCurrentYearRange();
      this.currentFilter.startDate = range.startDate;
      this.currentFilter.endDate = range.endDate;
    }

    if (startInput) {
      startInput.value = this.currentFilter.startDate || '';
      startInput.disabled = this.currentFilter.period === 'all';
    }

    if (endInput) {
      endInput.value = this.currentFilter.endDate || '';
      endInput.disabled = this.currentFilter.period === 'all';
    }
  }

  getSpentForBudget(budget, startDate, endDate) {
    return this.expenses
      .filter(expense => {
        if (expense.category !== budget.category) return false;
        const expenseDate = this.getDateOnly(expense.date);
        return expenseDate >= startDate && expenseDate <= endDate;
      })
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
  }

  getDateOnly(value) {
    if (typeof value === 'string') {
      return value.slice(0, 10);
    }

    return this.toDateInputValue(new Date(value));
  }

  formatDateFr(dateString) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  async deleteBudget(id) {
    const confirmed = await showConfirmModal('Etes-vous sur de vouloir supprimer ce budget ?', {
      title: 'Confirmation',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) return;

    try {
      await deleteRow(SUPABASE_TABLES.BUDGETS, id, 'Suppression du budget');
      await this.refreshData();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la suppression du budget.');
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const manager = new BudgetsManager();
    await manager.init();
  });
} else {
  const manager = new BudgetsManager();
  manager.init();
}

export default BudgetsManager;
