/**
 * BUDGETS.JS - Budgets Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';

class BudgetsManager {
  constructor() {
    this.budgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
  }

  init() {
    this.checkAuth();
    renderSidebar('budgets');
    renderBottomNav('budgets');
    this.loadBudgets();
    this.setupEventListeners();
    this.setupForm();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  loadBudgets() {
    const gridElement = document.getElementById('budgets-grid');
    if (!gridElement) return;

    if (this.budgets.length === 0) {
      gridElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary); grid-column: 1/-1;">Aucun budget défini</p>';
      return;
    }

    gridElement.innerHTML = this.budgets.map(budget => this.createBudgetHTML(budget)).join('');
    this.attachEventListeners();
  }

  createBudgetHTML(budget) {
    const spent = this.calculateSpent(budget.category);
    const remaining = budget.amount - spent;
    const percentage = Math.min((spent / budget.amount) * 100, 100);
    
    let progressColor = 'var(--color-success)';
    if (percentage > 80) progressColor = 'var(--color-error)';
    else if (percentage > 60) progressColor = 'var(--color-warning)';

    const icon = this.getCategoryIcon(budget.category);

    return `
      <div class="budget-card card">
        <div class="budget-header">
          <div>
            <h3>${icon} ${this.getCategoryName(budget.category)}</h3>
            <p>Budget mensuel</p>
          </div>
          <button class="btn-icon delete-btn" data-id="${budget.id}">🗑️</button>
        </div>
        
        <div class="budget-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%; background-color: ${progressColor};"></div>
          </div>
          <div class="progress-info">
            <span>${this.formatCurrency(spent)} / ${this.formatCurrency(budget.amount)}</span>
            <span class="progress-percent">${Math.round(percentage)}%</span>
          </div>
        </div>

        <div class="budget-stats">
          <div>
            <span class="stat-label">Restant</span>
            <span class="stat-value">${this.formatCurrency(remaining)}</span>
          </div>
          <div>
            <span class="stat-label">Dépensé</span>
            <span class="stat-value">${this.formatCurrency(spent)}</span>
          </div>
        </div>
      </div>
    `;
  }

  calculateSpent(category) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = this.expenses.filter(exp => {
      const date = new Date(exp.date);
      return exp.category === category && 
             date.getMonth() === currentMonth && 
             date.getFullYear() === currentYear;
    });

    return monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
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

  getCategoryName(category) {
    const names = {
      'alimentation': 'Alimentation',
      'transport': 'Transport',
      'logement': 'Logement',
      'sante': 'Santé',
      'loisirs': 'Loisirs',
      'autre': 'Autre'
    };
    return names[category] || category;
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
  }

  attachEventListeners() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.deleteBudget(id);
      });
    });
  }

  setupForm() {
    const form = document.getElementById('budget-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveBudget();
      });
    }
  }

  openModal() {
    const modal = document.getElementById('budget-modal');
    if (modal) {
      modal.classList.add('active');
    }
  }

  closeModal() {
    const modal = document.getElementById('budget-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  async saveBudget() {
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);

    // Check if budget already exists for this category
    const existingIndex = this.budgets.findIndex(b => b.category === category);
    
    if (existingIndex !== -1) {
      const confirmed = await showConfirmModal(
        'Un budget existe déjà pour cette catégorie. Le remplacer ?',
        {
          title: '⚠️ Budget existant',
          confirmText: 'Remplacer',
          cancelText: 'Annuler',
          danger: false
        }
      );

      if (confirmed) {
        this.budgets[existingIndex].amount = amount;
      } else {
        return;
      }
    } else {
      const budget = {
        id: Date.now().toString(),
        category,
        amount
      };
      this.budgets.push(budget);
    }

    Storage.set(STORAGE_KEYS.BUDGETS, this.budgets);
    this.loadBudgets();
    this.closeModal();
  }

  async deleteBudget(id) {
    const confirmed = await showConfirmModal(
      'Êtes-vous sûr de vouloir supprimer ce budget ?',
      {
        title: '⚠️ Confirmation',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (confirmed) {
      this.budgets = this.budgets.filter(b => b.id !== id);
      Storage.set(STORAGE_KEYS.BUDGETS, this.budgets);
      this.loadBudgets();
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new BudgetsManager();
    manager.init();
  });
} else {
  const manager = new BudgetsManager();
  manager.init();
}

export default BudgetsManager;
