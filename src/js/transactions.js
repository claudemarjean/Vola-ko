/**
 * TRANSACTIONS.JS - Unified Transactions History
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';
import notify from './notifications.js';
import { fetchTable, fetchCategories } from './volakoApi.js';
import { SUPABASE_TABLES } from './supabase.js';
import { withPageLoader, applySkeleton } from './loaders.js';
import { setCategoriesCache, getCategories, getCategoryName } from './utils.js';

class TransactionsManager {
  constructor() {
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.transactions = [];
    this.savingsById = new Map();
    this.currentFilter = { source: '', period: 'month', search: '' };
  }

  async init() {
    this.checkAuth();
    renderSidebar('transactions');
    renderBottomNav('transactions');
    this.setupEventListeners();

    applySkeleton('transactions-list', 'list');
    await this.refreshData();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('transactions-list', async () => {
      const [incomes, expenses, savingsTx, savings, categories] = await Promise.all([
        fetchTable(SUPABASE_TABLES.INCOMES, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.EXPENSES, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.SAVINGS_TRANSACTIONS, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.SAVINGS, { orderBy: 'updated_at', ascending: false }),
        fetchCategories().catch(() => getCategories())
      ]);

      setCategoriesCache(categories || []);
      this.savingsById = new Map((savings || []).map(s => [s.id, s.name]));
      this.transactions = this.buildUnifiedTransactions(incomes || [], expenses || [], savingsTx || []);
      this.renderTransactions();
    });
  }

  buildUnifiedTransactions(incomes, expenses, savingsTx) {
    const incomeRows = incomes.map(row => ({
      id: `inc-${row.id}`,
      date: row.date,
      label: row.source || 'Revenu',
      details: 'Revenu',
      amount: Number(row.amount || 0),
      source: 'income',
      sourceLabel: 'Revenus',
      txKind: 'income',
      createdAt: row.created_at || row.date
    }));

    const expenseRows = expenses.map(row => ({
      id: `exp-${row.id}`,
      date: row.date,
      label: row.description || 'Depense',
      details: row.category === 'autre' && row.other_reference
        ? `${getCategoryName(row.category)} (${row.other_reference})`
        : getCategoryName(row.category || 'autre'),
      amount: Number(row.amount || 0),
      source: 'expense',
      sourceLabel: 'Depenses',
      txKind: 'expense',
      createdAt: row.created_at || row.date
    }));

    const savingsRows = savingsTx.map(row => {
      const isAdd = row.type === 'add';
      const savingsName = this.savingsById.get(row.savings_id) || 'Epargne';
      return {
        id: `sav-${row.id}`,
        date: row.date,
        label: row.description || (isAdd ? 'Ajout epargne' : 'Retrait epargne'),
        details: savingsName,
        amount: Number(row.amount || 0),
        source: 'savings',
        sourceLabel: 'Epargne',
        txKind: isAdd ? 'savings_add' : 'savings_withdraw',
        createdAt: row.created_at || row.date
      };
    });

    return [...incomeRows, ...expenseRows, ...savingsRows].sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date);
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  setupEventListeners() {
    const sourceFilter = document.getElementById('source-filter');
    if (sourceFilter) {
      sourceFilter.addEventListener('change', (e) => {
        this.currentFilter.source = e.target.value;
        this.renderTransactions();
      });
    }

    const periodFilter = document.getElementById('period-filter');
    if (periodFilter) {
      periodFilter.addEventListener('change', (e) => {
        this.currentFilter.period = e.target.value;
        this.renderTransactions();
      });
    }

    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentFilter.search = e.target.value;
        this.renderTransactions();
      });
    }
  }

  filterTransactions() {
    let filtered = [...this.transactions];

    if (this.currentFilter.source) {
      filtered = filtered.filter(tx => tx.source === this.currentFilter.source);
    }

    const periodRange = this.getPeriodRange(this.currentFilter.period);
    if (periodRange) {
      filtered = filtered.filter(tx => {
        const dateKey = this.getDateKey(tx.date);
        return dateKey >= periodRange.startDate && dateKey <= periodRange.endDate;
      });
    }

    if (this.currentFilter.search.trim()) {
      const term = this.currentFilter.search.trim().toLowerCase();
      filtered = filtered.filter(tx => {
        return (
          (tx.label || '').toLowerCase().includes(term) ||
          (tx.details || '').toLowerCase().includes(term) ||
          (tx.sourceLabel || '').toLowerCase().includes(term)
        );
      });
    }

    return filtered;
  }

  getPeriodRange(period) {
    const today = new Date();
    const todayKey = this.toDateInputValue(today);

    if (period === 'all') {
      return null;
    }

    if (period === 'week') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
      return {
        startDate: this.toDateInputValue(start),
        endDate: todayKey
      };
    }

    if (period === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: this.toDateInputValue(start),
        endDate: todayKey
      };
    }

    if (period === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: this.toDateInputValue(start),
        endDate: this.toDateInputValue(end)
      };
    }

    if (period === 'since_last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        startDate: this.toDateInputValue(start),
        endDate: todayKey
      };
    }

    if (period === 'year') {
      const start = new Date(today.getFullYear() - 1, today.getMonth(), 1);
      return {
        startDate: this.toDateInputValue(start),
        endDate: todayKey
      };
    }

    return null;
  }

  toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  getDateKey(value) {
    if (typeof value === 'string' && value.length >= 10) {
      return value.slice(0, 10);
    }
    const date = new Date(value);
    return this.toDateInputValue(date);
  }

  renderTransactions() {
    const list = document.getElementById('transactions-list');
    if (!list) return;

    const filtered = this.filterTransactions();
    this.updateStats(filtered);

    if (filtered.length === 0) {
      list.innerHTML = '<p style="text-align:center; padding: var(--space-2xl); color: var(--text-secondary);">Aucune transaction a afficher</p>';
      return;
    }

    list.innerHTML = filtered.map(tx => this.createTransactionHTML(tx)).join('');
  }

  createTransactionHTML(tx) {
    const date = this.formatDate(tx.date);
    const direction = this.getDirection(tx);
    const amount = `${direction.sign}${this.formatCurrency(tx.amount)}`;
    const amountClass = direction.className;

    return `
      <div class="list-item" data-id="${tx.id}">
        <div class="item-info">
          <div class="item-icon">${this.getIcon(tx.txKind)}</div>
          <div class="item-details">
            <h4>${this.escapeHtml(tx.label)}</h4>
            <p>${date} • ${this.escapeHtml(tx.sourceLabel)} • ${this.escapeHtml(tx.details)}</p>
            <span class="tx-badge ${this.getBadgeClass(tx.txKind)}">${this.escapeHtml(this.getTypeLabel(tx.txKind))}</span>
          </div>
        </div>
        <div class="item-actions">
          <div class="item-amount ${amountClass}">${amount}</div>
        </div>
      </div>
    `;
  }

  updateStats(items) {
    const inEl = document.getElementById('tx-total-in');
    const outEl = document.getElementById('tx-total-out');
    const countEl = document.getElementById('tx-count');

    const totals = items.reduce((acc, tx) => {
      const signed = this.getSignedAmount(tx);
      if (signed >= 0) {
        acc.totalIn += signed;
      } else {
        acc.totalOut += Math.abs(signed);
      }
      acc.count += 1;
      return acc;
    }, { totalIn: 0, totalOut: 0, count: 0 });

    if (inEl) inEl.textContent = this.formatCurrency(totals.totalIn);
    if (outEl) outEl.textContent = this.formatCurrency(totals.totalOut);
    if (countEl) countEl.textContent = String(totals.count);
  }

  getSignedAmount(tx) {
    if (tx.txKind === 'income' || tx.txKind === 'savings_withdraw') {
      return Number(tx.amount || 0);
    }
    return -Number(tx.amount || 0);
  }

  getDirection(tx) {
    const signed = this.getSignedAmount(tx);
    if (signed >= 0) {
      return { sign: '+', className: 'income' };
    }
    return { sign: '-', className: 'expense' };
  }

  getIcon(txKind) {
    if (txKind === 'income') return '💼';
    if (txKind === 'expense') return '💸';
    if (txKind === 'savings_add') return '🏦';
    if (txKind === 'savings_withdraw') return '🏧';
    return '🔁';
  }

  getTypeLabel(txKind) {
    if (txKind === 'income') return 'Revenu';
    if (txKind === 'expense') return 'Depense';
    if (txKind === 'savings_add') return 'Epargne +';
    if (txKind === 'savings_withdraw') return 'Epargne -';
    return 'Transaction';
  }

  getBadgeClass(txKind) {
    if (txKind === 'income') return 'income';
    if (txKind === 'expense') return 'expense';
    return 'savings';
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('fr-FR');
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(Number(amount || 0)) + ' ' + this.currency;
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const manager = new TransactionsManager();
  try {
    await manager.init();
  } catch (error) {
    notify.error(error.message || 'Erreur lors du chargement des transactions.');
  }
});
