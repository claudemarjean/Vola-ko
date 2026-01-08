/**
 * REPORTS.JS - Reports Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';

class ReportsManager {
  constructor() {
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentPeriod = 'month';
  }

  init() {
    this.checkAuth();
    renderSidebar('reports');
    renderBottomNav('reports');
    this.updateStats();
    this.setupEventListeners();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  updateStats() {
    const { incomes, expenses } = this.getFilteredData();

    const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const balance = totalIncome - totalExpenses;

    const incomeEl = document.getElementById('report-income');
    const expensesEl = document.getElementById('report-expenses');
    const balanceEl = document.getElementById('report-balance');

    if (incomeEl) incomeEl.textContent = this.formatCurrency(totalIncome);
    if (expensesEl) expensesEl.textContent = this.formatCurrency(totalExpenses);
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(balance);
      balanceEl.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-error)';
    }
  }

  getFilteredData() {
    const now = new Date();
    let startDate;

    if (this.currentPeriod === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (this.currentPeriod === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
    } else if (this.currentPeriod === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    const filterByDate = (item) => new Date(item.date) >= startDate;

    return {
      incomes: this.incomes.filter(filterByDate),
      expenses: this.expenses.filter(filterByDate)
    };
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const periodSelect = document.getElementById('report-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.updateStats();
      });
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new ReportsManager();
    manager.init();
  });
} else {
  const manager = new ReportsManager();
  manager.init();
}

export default ReportsManager;
