/**
 * BUDGETS.JS - Budgets Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, fetchBudgetProgress, fetchCategories } from './volakoApi.js';
import { getCategories, setCategoriesCache, getCategoryIcon, getCategoryName } from './utils.js';
import { SUPABASE_TABLES } from './supabase.js';
import notify from './notifications.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class BudgetsManager {
  constructor() {
    this.budgets = [];
    this.progressRows = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.editingBudgetId = null;
    this.selectedBudgetForExpense = null;
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
    this.populateCategorySelect();
  }

  populateCategorySelect() {
    const select = document.getElementById('budget-category');
    if (!select) return;
    let html = '<option value="">S\u00e9lectionner...</option>';
    getCategories().forEach(cat => {
      html += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
    });
    select.innerHTML = html;
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('budgets-grid', async () => {
      this.budgets = await fetchTable(SUPABASE_TABLES.BUDGETS, { orderBy: 'updated_at', ascending: false });
      this.progressRows = await fetchBudgetProgress();
      this.loadBudgets();
    });
  }

  loadBudgets() {
    const gridElement = document.getElementById('budgets-grid');
    if (!gridElement) return;

    if (this.budgets.length === 0) {
      gridElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary); grid-column: 1/-1;">Aucun budget defini</p>';
      return;
    }

    gridElement.innerHTML = this.budgets.map(budget => this.createBudgetHTML(budget)).join('');
    this.attachEventListeners();
  }

  createBudgetHTML(budget) {
    const progress = this.progressRows.find(row => row.id === budget.id) || {
      spent: 0,
      remaining: budget.amount,
      amount: budget.amount
    };

    const percentage = progress.amount > 0 ? (progress.spent / progress.amount) * 100 : 0;
    const progressBarWidth = Math.min(Math.max(percentage, 0), 100);
    const isOverBudget = percentage > 100;

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

    return `
      <div class="budget-card card">
        <div class="budget-header">
          <div class="budget-content">
            <h3>${icon} ${categoryName}</h3>
            <p>Budget mensuel</p>
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
            <span class="stat-value">${this.formatCurrency(progress.remaining)}</span>
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
      if (categorySelect) categorySelect.value = budget.category;
      if (amountInput) amountInput.value = budget.amount;

      if (budget.category === 'autre') {
        if (otherReferenceGroup) otherReferenceGroup.style.display = 'block';
        if (otherReferenceInput) otherReferenceInput.value = budget.other_reference || '';
      }
    } else if (categorySelect) {
      categorySelect.disabled = false;
    }
  }

  closeModal() {
    const modal = document.getElementById('budget-modal');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');
    const categorySelect = document.getElementById('budget-category');
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

    if (!category || Number.isNaN(amount) || amount < 0) {
      notify.error('Categorie ou montant invalide.');
      return;
    }

    try {
      if (this.editingBudgetId) {
        await updateRow(SUPABASE_TABLES.BUDGETS, this.editingBudgetId, {
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          updated_at: new Date().toISOString()
        }, 'Mise a jour du budget');
      } else {
        const existing = this.budgets.find(b => b.category === category);
        if (existing) {
          const confirmed = await showConfirmModal(
            'Un budget existe deja pour cette categorie. Le remplacer ?',
            {
              title: 'Budget existant',
              confirmText: 'Remplacer',
              cancelText: 'Annuler',
              danger: false
            }
          );

          if (!confirmed) return;

          await updateRow(SUPABASE_TABLES.BUDGETS, existing.id, {
            amount,
            other_reference: otherReference || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
          }, 'Mise a jour du budget');
        } else {
          await insertRow(SUPABASE_TABLES.BUDGETS, {
            id: generateUUID(),
            category,
            amount,
            other_reference: otherReference || null,
            notes: notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, 'Creation du budget');
        }
      }

      await this.refreshData();
      this.closeModal();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la sauvegarde du budget.');
      }
    }
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
