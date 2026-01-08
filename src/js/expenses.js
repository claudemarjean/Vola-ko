/**
 * EXPENSES.JS - Expenses Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';

class ExpensesManager {
  constructor() {
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentFilter = { category: '', period: 'month', search: '' };
  }

  init() {
    this.checkAuth();
    renderSidebar('expenses');
    renderBottomNav('expenses');
    this.loadExpenses();
    this.setupEventListeners();
    this.setupForm();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  loadExpenses() {
    const filtered = this.filterExpenses();
    const listElement = document.getElementById('expenses-list');
    
    if (!listElement) return;

    if (filtered.length === 0) {
      listElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary);">Aucune dépense à afficher</p>';
      return;
    }

    listElement.innerHTML = filtered.map(exp => this.createExpenseHTML(exp)).join('');
    this.attachItemEventListeners();
  }

  filterExpenses() {
    let filtered = [...this.expenses];

    // Filtre par catégorie
    if (this.currentFilter.category) {
      filtered = filtered.filter(exp => exp.category === this.currentFilter.category);
    }

    // Filtre par période
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
      filtered = filtered.filter(exp => new Date(exp.date).getFullYear() === now.getFullYear());
    }

    // Filtre par recherche
    if (this.currentFilter.search) {
      const search = this.currentFilter.search.toLowerCase();
      filtered = filtered.filter(exp => 
        exp.description.toLowerCase().includes(search)
      );
    }

    // Trier par date (plus récent en premier)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

    return filtered;
  }

  createExpenseHTML(expense) {
    const icon = this.getCategoryIcon(expense.category);
    const date = new Date(expense.date).toLocaleDateString('fr-FR');
    
    return `
      <div class="list-item" data-id="${expense.id}">
        <div class="item-info">
          <div class="item-icon">${icon}</div>
          <div class="item-details">
            <h4>${expense.description}</h4>
            <p>${date} • ${expense.category}</p>
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

  getCategoryIcon(category) {
    const icons = {
      'alimentation': '🛒',
      'transport': '🚗',
      'logement': '🏠',
      'sante': '💊',
      'loisirs': '🎮',
      'autre': '📦'
    };
    return icons[category] || '📦';
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    // Bouton ajouter
    const addBtn = document.getElementById('add-expense-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openModal());
    }

    // Filtres
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

    // Modal close
    const modal = document.getElementById('expense-modal');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    closeBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
  }

  attachItemEventListeners() {
    // Edit buttons
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.editExpense(id);
      });
    });

    // Delete buttons
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
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveExpense();
      });
    }

    // Set default date to today
    const dateInput = document.getElementById('expense-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  openModal(expense = null) {
    const modal = document.getElementById('expense-modal');
    const form = document.getElementById('expense-form');
    
    if (!modal || !form) return;

    if (expense) {
      // Edit mode
      form.dataset.editId = expense.id;
      document.getElementById('expense-description').value = expense.description;
      document.getElementById('expense-amount').value = expense.amount;
      document.getElementById('expense-category').value = expense.category;
      document.getElementById('expense-date').value = expense.date;
    } else {
      // Add mode
      form.reset();
      delete form.dataset.editId;
      document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('expense-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  saveExpense() {
    const form = document.getElementById('expense-form');
    const editId = form.dataset.editId;

    const expense = {
      id: editId || Date.now().toString(),
      description: document.getElementById('expense-description').value,
      amount: parseFloat(document.getElementById('expense-amount').value),
      category: document.getElementById('expense-category').value,
      date: document.getElementById('expense-date').value
    };

    if (editId) {
      // Update existing
      const index = this.expenses.findIndex(exp => exp.id === editId);
      if (index !== -1) {
        this.expenses[index] = expense;
      }
    } else {
      // Add new
      this.expenses.unshift(expense);
    }

    Storage.set(STORAGE_KEYS.EXPENSES, this.expenses);
    this.loadExpenses();
    this.closeModal();
  }

  editExpense(id) {
    const expense = this.expenses.find(exp => exp.id === id);
    if (expense) {
      this.openModal(expense);
    }
  }

  deleteExpense(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
      this.expenses = this.expenses.filter(exp => exp.id !== id);
      Storage.set(STORAGE_KEYS.EXPENSES, this.expenses);
      this.loadExpenses();
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new ExpensesManager();
    manager.init();
  });
} else {
  const manager = new ExpensesManager();
  manager.init();
}

export default ExpensesManager;
