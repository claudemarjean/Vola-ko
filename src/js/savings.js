/**
 * SAVINGS.JS - Savings Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import notify from './notifications.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, applySavingsTransaction, fetchSavingsStats } from './volakoApi.js';
import { SUPABASE_TABLES } from './supabase.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class SavingsManager {
  constructor() {
    this.savings = [];
    this.transactions = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.editingId = null;
  }

  async init() {
    this.checkAuth();
    renderSidebar('savings');
    renderBottomNav('savings');
    this.setupEventListeners();

    applySkeleton('savings-list', 'cards');
    await this.refreshData();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('savings-list', async () => {
      const [savingsRes, transactionsRes] = await Promise.allSettled([
        fetchTable(SUPABASE_TABLES.SAVINGS, { orderBy: 'updated_at', ascending: false }),
        fetchTable(SUPABASE_TABLES.SAVINGS_TRANSACTIONS, { orderBy: 'date', ascending: false })
      ]);

      this.savings = savingsRes.status === 'fulfilled' ? savingsRes.value : [];
      this.transactions = transactionsRes.status === 'fulfilled' ? transactionsRes.value : [];

      if (savingsRes.status === 'rejected' || transactionsRes.status === 'rejected') {
        notify.warning('Certaines donnees epargne sont indisponibles. Affichage partiel applique.');
      }

      await this.updateStats();
      this.loadSavings();
    });
  }

  async updateStats() {
    let totalSaved = 0;
    let activeGoals = 0;
    let avgProgress = 0;

    try {
      const stats = await fetchSavingsStats();
      totalSaved = stats?.total_saved || 0;
      activeGoals = stats?.active_goals || 0;
      avgProgress = Math.round(stats?.avg_progress || 0);
    } catch {
      totalSaved = this.savings.reduce((sum, saving) => sum + Number(saving.balance || 0), 0);

      const goalSavings = this.savings.filter((saving) => saving.type === 'goal');
      activeGoals = goalSavings.length;

      if (goalSavings.length > 0) {
        const progressSum = goalSavings.reduce((sum, saving) => {
          const balance = Number(saving.balance || 0);
          const target = Number(saving.target_amount || 0);
          if (target <= 0) {
            return sum;
          }
          return sum + Math.min((balance / target) * 100, 100);
        }, 0);

        avgProgress = Math.round(progressSum / goalSavings.length);
      }

      notify.warning('Statistiques epargne indisponibles cote serveur. Calcul local applique.');
    }

    const totalEl = document.getElementById('total-saved');
    const activeEl = document.getElementById('active-goals');
    const progressEl = document.getElementById('goal-progress');

    if (totalEl) totalEl.textContent = this.formatCurrency(totalSaved);
    if (activeEl) activeEl.textContent = activeGoals;
    if (progressEl) progressEl.textContent = `${avgProgress}%`;
  }

  loadSavings() {
    const container = document.getElementById('savings-list');
    const emptyState = document.getElementById('empty-state');

    if (this.savings.length === 0) {
      container.innerHTML = '';
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = this.savings.map(saving => this.createSavingCard(saving)).join('');
    this.attachCardEventListeners();
  }

  attachCardEventListeners() {
    const container = document.getElementById('savings-list');

    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const id = btn.dataset.id;

        switch (action) {
          case 'edit':
            this.editSaving(id);
            break;
          case 'delete':
            this.deleteSaving(id);
            break;
          case 'add':
            this.openTransaction(id, 'add');
            break;
          case 'withdraw':
            this.openTransaction(id, 'withdraw');
            break;
          case 'history':
            this.viewHistory(id);
            break;
        }
      });
    });
  }

  createSavingCard(saving) {
    const balance = parseFloat(saving.balance || 0);
    const isGoal = saving.type === 'goal';
    const targetAmount = parseFloat(saving.target_amount || 0);
    const progress = isGoal && targetAmount > 0 ? (balance / targetAmount) * 100 : 0;
    const progressClamped = Math.min(progress, 100);

    let statusHTML = '';
    if (isGoal) {
      const daysLeft = saving.target_date ? this.getDaysUntil(saving.target_date) : null;
      const statusClass = progress >= 100 ? 'success' : progress >= 50 ? 'warning' : 'info';

      statusHTML = `
        <div class="saving-progress">
          <div class="progress-bar">
            <div class="progress-fill progress-${statusClass}" style="width: ${progressClamped}%"></div>
          </div>
          <div class="progress-stats">
            <span>${this.formatCurrency(balance)} / ${this.formatCurrency(targetAmount)}</span>
            <span>${progressClamped.toFixed(1)}%</span>
          </div>
          ${daysLeft !== null ? `
            <div class="progress-info">
              ${daysLeft > 0
                ? `<span>${daysLeft} jour(s) restant(s)</span>`
                : daysLeft === 0
                  ? `<span>Aujourd'hui !</span>`
                  : `<span>Depasse de ${Math.abs(daysLeft)} jour(s)</span>`
              }
            </div>
          ` : ''}
        </div>
      `;
    }

    return `
      <div class="saving-card ${isGoal ? 'saving-goal' : 'saving-free'}" data-id="${saving.id}">
        <div class="saving-header">
          <div class="saving-info">
            <div class="saving-icon">${isGoal ? '🎯' : '💰'}</div>
            <div>
              <h3 class="saving-name">${saving.name}</h3>
              <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center; margin-top: 4px;">
                <span class="saving-type-badge">${isGoal ? 'Objectif' : 'Libre'}</span>
              </div>
            </div>
          </div>
          <div class="saving-actions">
            <button class="btn-icon" data-action="edit" data-id="${saving.id}" title="Modifier">✏️</button>
            <button class="btn-icon" data-action="delete" data-id="${saving.id}" title="Supprimer">🗑️</button>
          </div>
        </div>

        <div class="saving-balance">
          <div class="balance-label">Solde actuel</div>
          <div class="balance-amount">${this.formatCurrency(balance)}</div>
        </div>

        ${statusHTML}

        <div class="saving-controls">
          <button class="btn btn-success btn-sm" data-action="add" data-id="${saving.id}"><span>Ajouter</span></button>
          <button class="btn btn-outline btn-sm" data-action="withdraw" data-id="${saving.id}"><span>Retirer</span></button>
          <button class="btn btn-secondary btn-sm" data-action="history" data-id="${saving.id}"><span>Historique</span></button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    document.getElementById('add-saving-btn').addEventListener('click', () => this.openSavingModal());
    document.getElementById('add-saving-empty-btn')?.addEventListener('click', () => this.openSavingModal());

    document.getElementById('close-saving-modal').addEventListener('click', () => this.closeSavingModal());
    document.getElementById('saving-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.currentTarget.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Enregistrement...');
      try {
        await this.saveSaving();
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    document.getElementById('saving-type').addEventListener('change', (e) => {
      const goalFields = document.getElementById('goal-fields');
      goalFields.style.display = e.target.value === 'goal' ? 'block' : 'none';
    });

    document.getElementById('close-transaction-modal').addEventListener('click', () => this.closeTransactionModal());
    document.getElementById('transaction-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = e.currentTarget.querySelector('button[type="submit"]');
      setButtonLoading(submitBtn, true, 'Traitement...');
      try {
        await this.saveTransaction();
      } finally {
        setButtonLoading(submitBtn, false);
      }
    });

    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal').classList.remove('active');
      });
    });
  }

  openSavingModal(saving = null) {
    this.editingId = saving ? saving.id : null;
    const modal = document.getElementById('saving-modal');
    const title = document.getElementById('modal-title');
    const form = document.getElementById('saving-form');

    if (saving) {
      title.textContent = 'Modifier l epargne';
      document.getElementById('saving-name').value = saving.name;
      document.getElementById('saving-type').value = saving.type;
      document.getElementById('saving-initial').value = saving.balance;
      document.getElementById('saving-target').value = saving.target_amount || '';
      document.getElementById('saving-target-date').value = saving.target_date || '';

      const goalFields = document.getElementById('goal-fields');
      goalFields.style.display = saving.type === 'goal' ? 'block' : 'none';
    } else {
      title.textContent = 'Creer une epargne';
      form.reset();
      document.getElementById('goal-fields').style.display = 'none';
      document.getElementById('saving-initial-date').value = new Date().toISOString().split('T')[0];
      document.getElementById('saving-initial').value = 0;
    }

    modal.classList.add('active');
  }

  closeSavingModal() {
    document.getElementById('saving-modal').classList.remove('active');
    document.getElementById('saving-form').reset();
    this.editingId = null;
  }

  async saveSaving() {
    const name = document.getElementById('saving-name').value.trim();
    const type = document.getElementById('saving-type').value;
    const initialAmount = parseFloat(document.getElementById('saving-initial').value) || 0;
    const targetAmount = type === 'goal' ? parseFloat(document.getElementById('saving-target').value) || 0 : 0;
    const targetDate = type === 'goal' ? document.getElementById('saving-target-date').value : null;
    const initialDate = document.getElementById('saving-initial-date').value;

    if (!name) {
      notify.error('Le nom de l epargne est requis');
      return;
    }

    if (initialAmount < 0) {
      notify.error('Le montant initial ne peut pas etre negatif');
      return;
    }

    try {
      if (this.editingId) {
        await updateRow(SUPABASE_TABLES.SAVINGS, this.editingId, {
          name,
          type,
          target_amount: targetAmount,
          target_date: targetDate,
          updated_at: new Date().toISOString()
        }, 'Modification de l epargne');
      } else {
        const id = generateUUID();
        await insertRow(SUPABASE_TABLES.SAVINGS, {
          id,
          name,
          type,
          balance: 0,
          target_amount: targetAmount,
          target_date: targetDate,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, 'Creation de l epargne');

        if (initialAmount > 0) {
          await applySavingsTransaction({
            savings_id: id,
            type: 'add',
            amount: initialAmount,
            description: `Montant initial de ${name}`,
            date: initialDate
          });
        }
      }

      await this.refreshData();
      this.closeSavingModal();
    } catch (error) {
      if (error.message === 'MODE_HORS_LIGNE') {
        return;
      }

      if (error.message.includes('SOLDE_INSUFFISANT')) {
        notify.error('Solde disponible insuffisant pour ce transfert.');
        return;
      }

      notify.error(error.message || 'Erreur lors de la sauvegarde de l epargne.');
    }
  }

  editSaving(id) {
    const saving = this.savings.find(s => s.id === id);
    if (saving) {
      this.openSavingModal(saving);
    }
  }

  async deleteSaving(id) {
    const saving = this.savings.find(s => s.id === id);
    if (!saving) return;

    const balance = parseFloat(saving.balance || 0);

    const confirmed = await showConfirmModal(
      `Etes-vous sur de vouloir supprimer l epargne "${saving.name}" ?`,
      {
        title: 'Supprimer l epargne',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (!confirmed) return;

    try {
      if (balance > 0) {
        await applySavingsTransaction({
          savings_id: id,
          type: 'withdraw',
          amount: balance,
          description: `Restitution suite a suppression de ${saving.name}`
        });
      }

      await deleteRow(SUPABASE_TABLES.SAVINGS, id, 'Suppression de l epargne');
      await this.refreshData();
      notify.success('Epargne supprimee.');
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la suppression de l epargne.');
      }
    }
  }

  openTransaction(savingId, type) {
    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) return;

    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('transaction-modal-title');
    const form = document.getElementById('transaction-form');

    title.textContent = type === 'add' ? `Ajouter a "${saving.name}"` : `Retirer de "${saving.name}"`;
    form.reset();

    document.getElementById('transaction-saving-id').value = savingId;
    document.getElementById('transaction-type').value = type;
    document.getElementById('transaction-amount').value = '';
    const descriptionField = document.getElementById('transaction-description');
    if (descriptionField) {
      descriptionField.value = '';
    }

    modal.classList.add('active');
  }

  closeTransactionModal() {
    document.getElementById('transaction-modal').classList.remove('active');
  }

  async saveTransaction() {
    const savingId = document.getElementById('transaction-saving-id').value;
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const description = document.getElementById('transaction-description')?.value?.trim() || '';

    if (!savingId || !type || !amount) {
      notify.error('Le montant est requis');
      return;
    }

    if (amount <= 0) {
      notify.error('Le montant doit etre superieur a 0');
      return;
    }

    try {
      await applySavingsTransaction({
        savings_id: savingId,
        type,
        amount,
        description
      });

      await this.refreshData();
      this.closeTransactionModal();
      notify.success('Transaction epargne enregistree.');
    } catch (error) {
      if (error.message === 'MODE_HORS_LIGNE') {
        return;
      }

      if (error.message.includes('SOLDE_INSUFFISANT')) {
        notify.error('Solde disponible insuffisant.');
        return;
      }

      if (error.message.includes('EPARGNE_INSUFFISANTE')) {
        notify.error('Solde epargne insuffisant.');
        return;
      }

      notify.error(error.message || 'Erreur lors de la transaction epargne.');
    }
  }

  viewHistory(savingId) {
    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) return;

    const modal = document.getElementById('history-modal');
    const title = document.getElementById('history-modal-title');
    const list = document.getElementById('history-list');
    const empty = document.getElementById('history-empty');
    const summary = document.getElementById('history-summary');

    const savingTransactions = this.transactions
      .filter(t => t.savings_id === savingId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    title.textContent = `Historique - "${saving.name}"`;

    const totalAdded = savingTransactions
      .filter(t => t.type === 'add')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const totalWithdrawn = savingTransactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    const balance = parseFloat(saving.balance) || 0;

    summary.innerHTML = `
      <div class="stat-card"><div class="stat-label">Solde actuel</div><div class="stat-value">${this.formatCurrency(balance)}</div></div>
      <div class="stat-card"><div class="stat-label">Total ajoute</div><div class="stat-value">${this.formatCurrency(totalAdded)}</div></div>
      <div class="stat-card"><div class="stat-label">Total retire</div><div class="stat-value">${this.formatCurrency(totalWithdrawn)}</div></div>
    `;

    if (savingTransactions.length === 0) {
      list.innerHTML = '';
      empty.style.display = 'block';
      modal.classList.add('active');
      return;
    }

    empty.style.display = 'none';

    list.innerHTML = savingTransactions.map(t => {
      const isAdd = t.type === 'add';
      const symbol = isAdd ? '➕' : '➖';
      const label = isAdd ? 'Ajout' : 'Retrait';
      const amount = this.formatCurrency(t.amount);
      const dateLabel = new Date(t.date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      const color = isAdd ? 'var(--success-color, #16a34a)' : 'var(--error-color, #dc2626)';
      const itemDescription = t.description || '';

      return `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-md);">
          <div style="flex: 1;">
            <div style="font-weight: 700;">${symbol} ${label}</div>
            ${itemDescription ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${itemDescription}</div>` : ''}
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 4px;">${dateLabel}</div>
          </div>
          <div style="font-weight: 800; color: ${color}; white-space: nowrap;">${amount}</div>
        </div>
      `;
    }).join('');

    modal.classList.add('active');
  }

  getDaysUntil(dateStr) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }
}

let savingsManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    try {
      savingsManager = new SavingsManager();
      await savingsManager.init();
      window.savingsManager = savingsManager;
    } catch (error) {
      notify.error(error.message || 'Erreur lors du chargement de l epargne.');
    }
  });
} else {
  savingsManager = new SavingsManager();
  savingsManager.init().catch((error) => {
    notify.error(error.message || 'Erreur lors du chargement de l epargne.');
  });
  window.savingsManager = savingsManager;
}

export default SavingsManager;
