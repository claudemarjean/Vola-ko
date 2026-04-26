/**
 * TRANSACTIONS.JS - Unified Transactions History
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';
import notify from './notifications.js';
import { fetchTable } from './volakoApi.js';
import { SUPABASE_TABLES } from './supabase.js';
import { withPageLoader, applySkeleton } from './loaders.js';

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
      const [incomes, expenses, savingsTx, savings] = await Promise.all([
        fetchTable(SUPABASE_TABLES.INCOMES, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.EXPENSES, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.SAVINGS_TRANSACTIONS, { orderBy: 'date', ascending: false }),
        fetchTable(SUPABASE_TABLES.SAVINGS, { orderBy: 'updated_at', ascending: false })
      ]);

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
        ? `${row.category} (${row.other_reference})`
        : (row.category || 'Depense'),
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
    const now = new Date();
    let filtered = [...this.transactions];

    if (this.currentFilter.source) {
      filtered = filtered.filter(tx => tx.source === this.currentFilter.source);
    }

    if (this.currentFilter.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter(tx => new Date(tx.date) >= weekAgo);
    } else if (this.currentFilter.period === 'month') {
      filtered = filtered.filter(tx => {
        const date = new Date(tx.date);
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
      });
    } else if (this.currentFilter.period === 'year') {
      const rollingYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      filtered = filtered.filter(tx => new Date(tx.date) >= rollingYearStart);
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
