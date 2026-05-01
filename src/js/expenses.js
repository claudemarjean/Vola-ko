/**
 * EXPENSES.JS - Expenses Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import notify from './notifications.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, fetchCategories } from './volakoApi.js';
import { getCategories, setCategoriesCache, getCategoryIcon, getCategoryName } from './utils.js';
import { SUPABASE_TABLES } from './supabase.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class ExpensesManager {
  constructor() {
    this.expenses = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentFilter = { category: '', period: 'month', search: '' };
  }

  async init() {
    this.checkAuth();
    renderSidebar('expenses');
    renderBottomNav('expenses');
    await this.loadCategories();
    this.setupEventListeners();
    this.setupForm();

    applySkeleton('expenses-list', 'list');
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
    const categories = getCategories();
    const filterSelect = document.getElementById('category-filter');
    const formSelect = document.getElementById('expense-category');

    const buildOptions = (withAll) => {
      let html = withAll ? '<option value="">Toutes les cat\u00e9gories</option>' : '<option value="">S\u00e9lectionner...</option>';
      categories.forEach(cat => {
        html += `<option value="${cat.id}">${cat.icon} ${cat.name}</option>`;
      });
      return html;
    };

    if (filterSelect) filterSelect.innerHTML = buildOptions(true);
    if (formSelect)   formSelect.innerHTML   = buildOptions(false);
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('expenses-list', async () => {
      this.expenses = await fetchTable(SUPABASE_TABLES.EXPENSES, { orderBy: 'date', ascending: false });
      this.loadExpenses();
    });
  }

  loadExpenses() {
    const filtered = this.filterExpenses();
    const listElement = document.getElementById('expenses-list');

    if (!listElement) return;

    if (filtered.length === 0) {
      listElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary);">Aucune depense a afficher</p>';
      return;
    }

    listElement.innerHTML = filtered.map(exp => this.createExpenseHTML(exp)).join('');
    this.attachItemEventListeners();
  }

  filterExpenses() {
    let filtered = [...this.expenses];

    if (this.currentFilter.category) {
      filtered = filtered.filter(exp => exp.category === this.currentFilter.category);
    }

    const now = new Date();
    if (this.currentFilter.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(exp => new Date(exp.date) >= weekAgo);
    } else if (this.currentFilter.period === 'month') {
      filtered = filtered.filter(exp => {
        const date = new Date(exp.date);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
    } else if (this.currentFilter.period === 'year') {
      const rollingYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      filtered = filtered.filter(exp => new Date(exp.date) >= rollingYearStart);
    }

    if (this.currentFilter.search) {
      const search = this.currentFilter.search.toLowerCase();
      filtered = filtered.filter(exp => (exp.description || '').toLowerCase().includes(search));
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    return filtered;
  }

  createExpenseHTML(expense) {
    const icon = getCategoryIcon(expense.category);
    const date = new Date(expense.date).toLocaleDateString('fr-FR');
    const categoryName = getCategoryName(expense.category);
    const categoryDisplay = expense.category === 'autre' && expense.other_reference
      ? `${categoryName} (${expense.other_reference})`
      : categoryName;

    return `
      <div class="list-item" data-id="${expense.id}">
        <div class="item-info">
          <div class="item-icon">${icon}</div>
          <div class="item-details">
            <h4>${expense.description}</h4>
            <p>${date} • ${categoryDisplay}</p>
          </div>
        </div>
        <div class="item-actions">
          <div class="item-amount expense">${this.formatCurrency(expense.amount)}</div>
          <button class="btn-icon edit-btn" data-id="${expense.id}">✏️</button>
          <button class="btn-icon delete-btn" data-id="${expense.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const addBtn = document.getElementById('add-expense-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openModal());
    }

    const categoryFilter = document.getElementById('category-filter');
    if (categoryFilter) {
      categoryFilter.addEventListener('change', (e) => {
        this.currentFilter.category = e.target.value;
        this.loadExpenses();
      });
    }

    const periodFilter = document.getElementById('period-filter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        this.currentFilter.period = e.target.value;
        this.loadExpenses();
      });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter.search = e.target.value;
        this.loadExpenses();
      });
    }

    const modal = document.getElementById('expense-modal');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    closeBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
  }

  attachItemEventListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.editExpense(id);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.deleteExpense(id);
      });
    });
  }

  setupForm() {
    const form = document.getElementById('expense-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true, 'Enregistrement...');
        try {
          await this.saveExpense();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }

    const dateInput = document.getElementById('expense-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    const categorySelect = document.getElementById('expense-category');
    const otherReferenceGroup = document.getElementById('expense-other-reference-group');

    if (categorySelect && otherReferenceGroup) {
      categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'autre') {
          otherReferenceGroup.style.display = 'block';
        } else {
          otherReferenceGroup.style.display = 'none';
          document.getElementById('expense-other-reference').value = '';
        }
      });
    }
  }

  openModal(expense = null) {
    const modal = document.getElementById('expense-modal');
    const form = document.getElementById('expense-form');
    const otherReferenceGroup = document.getElementById('expense-other-reference-group');
    const otherReferenceInput = document.getElementById('expense-other-reference');

    if (!modal || !form) return;

    if (expense) {
      form.dataset.editId = expense.id;
      document.getElementById('expense-description').value = expense.description;
      document.getElementById('expense-amount').value = expense.amount;
      document.getElementById('expense-category').value = expense.category;
      document.getElementById('expense-date').value = expense.date;

      if (expense.category === 'autre' && otherReferenceGroup) {
        otherReferenceGroup.style.display = 'block';
        if (otherReferenceInput) {
          otherReferenceInput.value = expense.other_reference || '';
        }
      } else if (otherReferenceGroup) {
        otherReferenceGroup.style.display = 'none';
      }
    } else {
      form.reset();
      delete form.dataset.editId;
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];

      if (otherReferenceGroup) {
        otherReferenceGroup.style.display = 'none';
      }
    }

    modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('expense-modal');
    const otherReferenceGroup = document.getElementById('expense-other-reference-group');

    if (modal) {
      modal.classList.remove('active');
    }

    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
      const otherReferenceInput = document.getElementById('expense-other-reference');
      if (otherReferenceInput) {
        otherReferenceInput.value = '';
      }
    }
  }

  async saveExpense() {
    const form = document.getElementById('expense-form');
    const editId = form.dataset.editId;

    const amount = parseFloat(document.getElementById('expense-amount').value);
    const description = document.getElementById('expense-description').value;
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    const otherReference = category === 'autre' ? document.getElementById('expense-other-reference').value : '';

    if (!description || !amount || !category || !date) {
      notify.error('Tous les champs sont requis');
      return;
    }

    try {
      if (editId) {
        await updateRow(SUPABASE_TABLES.EXPENSES, editId, {
          description,
          amount,
          category,
          date,
          other_reference: otherReference || null
        }, 'Modification de la depense');
      } else {
        await insertRow(SUPABASE_TABLES.EXPENSES, {
          id: generateUUID(),
          description,
          amount,
          category,
          date,
          other_reference: otherReference || null,
          created_at: new Date().toISOString()
        }, 'Ajout de la depense');
      }

      await this.refreshData();
      this.closeModal();
    } catch (error) {
      if (error.message === 'MODE_HORS_LIGNE') {
        return;
      }

      if (error.message.includes('SOLDE_INSUFFISANT')) {
        notify.error('Solde disponible insuffisant pour enregistrer cette depense.');
        return;
      }

      notify.error(error.message || 'Erreur lors de la sauvegarde de la depense.');
    }
  }

  editExpense(id) {
    const expense = this.expenses.find(exp => exp.id === id);
    if (expense) {
      this.openModal(expense);
    }
  }

  async deleteExpense(id) {
    const confirmed = await showConfirmModal('Etes-vous sur de vouloir supprimer cette depense ?', {
      title: 'Confirmation',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) return;

    try {
      await deleteRow(SUPABASE_TABLES.EXPENSES, id, 'Suppression de la depense');
      await this.refreshData();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la suppression de la depense.');
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const manager = new ExpensesManager();
    await manager.init();
  });
} else {
  const manager = new ExpensesManager();
  manager.init();
}

export default ExpensesManager;
