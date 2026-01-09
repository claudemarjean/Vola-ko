/**
 * INCOMES.JS - Incomes Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';

class IncomesManager {
  constructor() {
    this.incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
  }

  init() {
    this.checkAuth();
    renderSidebar('incomes');
    renderBottomNav('incomes');
    this.updateStats();
    this.loadIncomes();
    this.setupEventListeners();
    this.setupForm();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  updateStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const rollingYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);

    const monthIncomes = this.incomes.filter(inc => {
      const date = new Date(inc.date);
      return date.getMonth() === currentMonth && date.getFullYear() === now.getFullYear();
    });

    const rollingYearIncomes = this.incomes.filter(inc => new Date(inc.date) >= rollingYearStart);

    const monthTotal = monthIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const yearTotal = rollingYearIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);

    const monthEl = document.getElementById('income-month');
    const yearEl = document.getElementById('income-year');

    if (monthEl) monthEl.textContent = this.formatCurrency(monthTotal);
    if (yearEl) yearEl.textContent = this.formatCurrency(yearTotal);
  }

  loadIncomes() {
    const listElement = document.getElementById('incomes-list');
    if (!listElement) return;

    const sorted = [...this.incomes].sort((a, b) => new Date(b.date) - new Date(a.date));

    if (sorted.length === 0) {
      listElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary);">Aucun revenu à afficher</p>';
      return;
    }

    listElement.innerHTML = sorted.map(inc => this.createIncomeHTML(inc)).join('');
    this.attachItemEventListeners();
  }

  createIncomeHTML(income) {
    const date = new Date(income.date).toLocaleDateString('fr-FR');
    
    return `
      <div class="list-item" data-id="${income.id}">
        <div class="item-info">
          <div class="item-icon">💼</div>
          <div class="item-details">
            <h4>${income.source}</h4>
            <p>${date}</p>
          </div>
        </div>
        <div class="item-actions">
          <div class="item-amount income">${this.formatCurrency(income.amount)}</div>
          <button class="btn-icon edit-btn" data-id="${income.id}">✏️</button>
          <button class="btn-icon delete-btn" data-id="${income.id}">🗑️</button>
        </div>
      </div>
    `;
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const addBtn = document.getElementById('add-income-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.openModal());
    }

    const modal = document.getElementById('income-modal');
    const closeBtns = modal?.querySelectorAll('.modal-close');
    closeBtns?.forEach(btn => {
      btn.addEventListener('click', () => this.closeModal());
    });
  }

  attachItemEventListeners() {
    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.editIncome(id);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.deleteIncome(id);
      });
    });
  }

  setupForm() {
    const form = document.getElementById('income-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveIncome();
      });
    }

    const dateInput = document.getElementById('income-date');
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }

  openModal(income = null) {
    const modal = document.getElementById('income-modal');
    const form = document.getElementById('income-form');
    
    if (!modal || !form) return;

    if (income) {
      form.dataset.editId = income.id;
      document.getElementById('income-source').value = income.source;
      document.getElementById('income-amount').value = income.amount;
      document.getElementById('income-date').value = income.date;
    } else {
      form.reset();
      delete form.dataset.editId;
      document.getElementById('income-date').value = new Date().toISOString().split('T')[0];
    }

    modal.classList.add('active');
  }

  closeModal() {
    const modal = document.getElementById('income-modal');
    if (modal) {
      modal.classList.remove('active');
    }
  }

  saveIncome() {
    const form = document.getElementById('income-form');
    const editId = form.dataset.editId;

    const income = {
      id: editId || Date.now().toString(),
      source: document.getElementById('income-source').value,
      amount: parseFloat(document.getElementById('income-amount').value),
      date: document.getElementById('income-date').value
    };

    if (editId) {
      const index = this.incomes.findIndex(inc => inc.id === editId);
      if (index !== -1) {
        this.incomes[index] = income;
      }
    } else {
      this.incomes.unshift(income);
    }

    Storage.set(STORAGE_KEYS.INCOMES, this.incomes);
    this.updateStats();
    this.loadIncomes();
    this.closeModal();
  }

  editIncome(id) {
    const income = this.incomes.find(inc => inc.id === id);
    if (income) {
      this.openModal(income);
    }
  }

  async deleteIncome(id) {
    const confirmed = await showConfirmModal(
      'Êtes-vous sûr de vouloir supprimer ce revenu ?',
      {
        title: '⚠️ Confirmation',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (confirmed) {
      this.incomes = this.incomes.filter(inc => inc.id !== id);
      Storage.set(STORAGE_KEYS.INCOMES, this.incomes);
      this.updateStats();
      this.loadIncomes();
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new IncomesManager();
    manager.init();
  });
} else {
  const manager = new IncomesManager();
  manager.init();
}

export default IncomesManager;
