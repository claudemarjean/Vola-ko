/**
 * SAVINGS.JS - Savings Page Logic
 * Gestion complète des épargnes et objectifs financiers
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';

class SavingsManager {
  constructor() {
    this.savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    this.transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentSaving = null;
    this.editingId = null;
  }

  init() {
    this.checkAuth();
    renderSidebar('savings');
    renderBottomNav('savings');
    this.processAutoWithdrawals();
    this.updateStats();
    this.loadSavings();
    this.setupEventListeners();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  updateStats() {
    const totalSaved = this.savings.reduce((sum, s) => sum + (parseFloat(s.balance) || 0), 0);
    const activeGoals = this.savings.filter(s => s.type === 'goal').length;
    
    let avgProgress = 0;
    const goalsWithTarget = this.savings.filter(s => s.type === 'goal' && s.targetAmount > 0);
    if (goalsWithTarget.length > 0) {
      const totalProgress = goalsWithTarget.reduce((sum, s) => {
        const balance = parseFloat(s.balance) || 0;
        const target = parseFloat(s.targetAmount) || 1;
        const progress = (balance / target) * 100;
        return sum + Math.min(progress, 100);
      }, 0);
      avgProgress = Math.round(totalProgress / goalsWithTarget.length);
    }

    document.getElementById('total-saved').textContent = this.formatCurrency(totalSaved);
    document.getElementById('active-goals').textContent = activeGoals;
    document.getElementById('goal-progress').textContent = `${avgProgress}%`;
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
    
    // Attach event listeners to buttons
    this.attachCardEventListeners();
  }

  attachCardEventListeners() {
    const container = document.getElementById('savings-list');
    
    container.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        
        switch(action) {
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
    const hasAutoWithdraw = saving.autoWithdraw && saving.autoWithdraw.enabled;
    const targetAmount = parseFloat(saving.targetAmount || 0);
    const progress = isGoal && targetAmount > 0 ? (balance / targetAmount) * 100 : 0;
    const progressClamped = Math.min(progress, 100);

    let statusHTML = '';
    if (isGoal) {
      const daysLeft = saving.targetDate ? this.getDaysUntil(saving.targetDate) : null;
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
                ? `<span>🎯 ${daysLeft} jour(s) restant(s)</span>`
                : daysLeft === 0
                ? `<span>🎯 Aujourd'hui !</span>`
                : `<span>⚠️ Dépassé de ${Math.abs(daysLeft)} jour(s)</span>`
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
                ${hasAutoWithdraw ? `<span class="saving-type-badge" title="Retrait automatique planifié">⏱️ Auto</span>` : ''}
              </div>
            </div>
          </div>
          <div class="saving-actions">
            <button class="btn-icon" data-action="edit" data-id="${saving.id}" title="Modifier">
              ✏️
            </button>
            <button class="btn-icon" data-action="delete" data-id="${saving.id}" title="Supprimer">
              🗑️
            </button>
          </div>
        </div>
        
        <div class="saving-balance">
          <div class="balance-label">Solde actuel</div>
          <div class="balance-amount">${this.formatCurrency(balance)}</div>
        </div>

        ${statusHTML}

        <div class="saving-controls">
          <button class="btn btn-success btn-sm" data-action="add" data-id="${saving.id}">
            <span>➕</span>
            <span>Ajouter</span>
          </button>
          <button class="btn btn-outline btn-sm" data-action="withdraw" data-id="${saving.id}">
            <span>➖</span>
            <span>Retirer</span>
          </button>
          <button class="btn btn-secondary btn-sm" data-action="history" data-id="${saving.id}">
            <span>📋</span>
            <span>Historique</span>
          </button>
        </div>
      </div>
    `;
  }

  setupEventListeners() {
    // Add saving buttons
    document.getElementById('add-saving-btn').addEventListener('click', () => this.openSavingModal());
    document.getElementById('add-saving-empty-btn')?.addEventListener('click', () => this.openSavingModal());

    // Saving modal
    document.getElementById('close-saving-modal').addEventListener('click', () => this.closeSavingModal());
    document.getElementById('saving-form').addEventListener('submit', (e) => this.saveSaving(e));
    document.getElementById('saving-type').addEventListener('change', (e) => {
      const goalFields = document.getElementById('goal-fields');
      goalFields.style.display = e.target.value === 'goal' ? 'block' : 'none';
    });

    // Auto withdraw toggle
    const autoToggle = document.getElementById('auto-withdraw-enabled');
    const autoFields = document.getElementById('auto-withdraw-fields');
    autoToggle.addEventListener('change', () => {
      autoFields.style.display = autoToggle.checked ? 'block' : 'none';
    });

    // Transaction modal
    document.getElementById('close-transaction-modal').addEventListener('click', () => this.closeTransactionModal());
    document.getElementById('transaction-form').addEventListener('submit', (e) => this.saveTransaction(e));

    // Modal close on overlay click
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    });

    // Modal close buttons
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
      title.textContent = 'Modifier l\'épargne';
      document.getElementById('saving-name').value = saving.name;
      document.getElementById('saving-type').value = saving.type;
      document.getElementById('saving-initial').value = saving.balance;
      document.getElementById('saving-target').value = saving.targetAmount || '';
      document.getElementById('saving-target-date').value = saving.targetDate || '';
      
      const goalFields = document.getElementById('goal-fields');
      goalFields.style.display = saving.type === 'goal' ? 'block' : 'none';

      const autoToggle = document.getElementById('auto-withdraw-enabled');
      const autoFields = document.getElementById('auto-withdraw-fields');
      const auto = saving.autoWithdraw || { enabled: false };
      autoToggle.checked = !!auto.enabled;
      autoFields.style.display = autoToggle.checked ? 'block' : 'none';
      document.getElementById('auto-withdraw-amount').value = auto.amount ?? 0;
      document.getElementById('auto-withdraw-date').value = auto.date || '';
    } else {
      title.textContent = 'Créer une épargne';
      form.reset();
      document.getElementById('goal-fields').style.display = 'none';
      document.getElementById('auto-withdraw-enabled').checked = false;
      document.getElementById('auto-withdraw-fields').style.display = 'none';
      document.getElementById('auto-withdraw-amount').value = 0;
      document.getElementById('auto-withdraw-date').value = '';
    }

    modal.classList.add('active');
  }

  closeSavingModal() {
    document.getElementById('saving-modal').classList.remove('active');
    document.getElementById('saving-form').reset();
    this.editingId = null;
  }

  async saveSaving(e) {
    e.preventDefault();

    const name = document.getElementById('saving-name').value.trim();
    const type = document.getElementById('saving-type').value;
    const initialAmount = parseFloat(document.getElementById('saving-initial').value) || 0;
    const targetAmount = type === 'goal' ? parseFloat(document.getElementById('saving-target').value) || 0 : 0;
    const targetDate = type === 'goal' ? document.getElementById('saving-target-date').value : null;
    const autoEnabled = document.getElementById('auto-withdraw-enabled').checked;
    const autoAmount = parseFloat(document.getElementById('auto-withdraw-amount').value) || 0;
    const autoDate = document.getElementById('auto-withdraw-date').value || null;

    if (!name) {
      alert('❌ Le nom de l\'épargne est requis');
      return;
    }

    if (initialAmount < 0) {
      alert('❌ Le montant initial ne peut pas être négatif');
      return;
    }

    if (type === 'goal' && targetAmount > 0 && initialAmount > targetAmount) {
      alert('❌ Le montant initial ne peut pas dépasser l\'objectif');
      return;
    }

    if (autoEnabled) {
      if (!autoDate) {
        alert('❌ La date de retrait automatique est requise');
        return;
      }
      if (autoAmount <= 0) {
        alert('❌ Le montant du retrait automatique doit être supérieur à 0');
        return;
      }
    }

    const buildAutoWithdraw = (previous = null) => {
      if (!autoEnabled) return { enabled: false };

      const base = {
        enabled: true,
        amount: autoAmount,
        date: autoDate
      };

      if (!previous || previous.date !== autoDate) {
        return {
          ...base,
          executed: false,
          status: 'scheduled',
          lastRunAt: null,
          lastError: null
        };
      }

      return {
        ...base,
        executed: previous.executed || false,
        status: previous.status || 'scheduled',
        lastRunAt: previous.lastRunAt || null,
        lastError: previous.lastError || null
      };
    };

    if (this.editingId) {
      // Update existing
      const index = this.savings.findIndex(s => s.id === this.editingId);
      if (index !== -1) {
        const oldBalance = this.savings[index].balance || 0;
        const previousAuto = this.savings[index].autoWithdraw || null;
        this.savings[index] = {
          ...this.savings[index],
          name,
          type,
          targetAmount,
          targetDate,
          autoWithdraw: buildAutoWithdraw(previousAuto),
          updatedAt: new Date().toISOString()
        };
        // Keep the existing balance when editing
        this.savings[index].balance = oldBalance;
      }
    } else {
      // Create new
      const saving = {
        id: Date.now().toString(),
        name,
        type,
        balance: initialAmount,
        targetAmount,
        targetDate,
        autoWithdraw: buildAutoWithdraw(),
        createdAt: new Date().toISOString()
      };

      this.savings.push(saving);

      // Record initial transaction if amount > 0
      if (initialAmount > 0) {
        this.recordTransaction(saving.id, initialAmount, 'add', new Date().toISOString().split('T')[0]);
      }
    }

    Storage.set(STORAGE_KEYS.SAVINGS, this.savings);
    this.closeSavingModal();
    this.updateStats();
    this.loadSavings();
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

    const confirmed = await showConfirmModal(
      `Êtes-vous sûr de vouloir supprimer l'épargne "${saving.name}" ?${
        saving.balance > 0 ? `\n\nSolde actuel : ${this.formatCurrency(saving.balance)}` : ''
      }`,
      {
        title: '⚠️ Supprimer l\'épargne',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (confirmed) {
      this.savings = this.savings.filter(s => s.id !== id);
      this.transactions = this.transactions.filter(t => t.savingsId !== id);
      
      Storage.set(STORAGE_KEYS.SAVINGS, this.savings);
      Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, this.transactions);
      
      this.updateStats();
      this.loadSavings();
    }
  }

  openTransaction(savingId, type) {
    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) return;

    const modal = document.getElementById('transaction-modal');
    const title = document.getElementById('transaction-modal-title');
    const form = document.getElementById('transaction-form');
    
    title.textContent = type === 'add' ? `➕ Ajouter à "${saving.name}"` : `➖ Retirer de "${saving.name}"`;
    
    // Reset form first
    form.reset();
    
    // Set hidden fields
    document.getElementById('transaction-saving-id').value = savingId;
    document.getElementById('transaction-type').value = type;
    
    // Set date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-date').value = today;
    
    // Clear amount field
    document.getElementById('transaction-amount').value = '';

    modal.classList.add('active');
  }

  closeTransactionModal() {
    document.getElementById('transaction-modal').classList.remove('active');
  }

  async saveTransaction(e) {
    e.preventDefault();

    const savingId = document.getElementById('transaction-saving-id').value;
    const type = document.getElementById('transaction-type').value;
    const amount = parseFloat(document.getElementById('transaction-amount').value);
    const date = document.getElementById('transaction-date').value;

    if (!savingId || !type || !amount || !date) {
      alert('❌ Tous les champs sont requis');
      return;
    }

    if (amount <= 0) {
      alert('❌ Le montant doit être supérieur à 0');
      return;
    }

    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) {
      alert('❌ Épargne introuvable');
      return;
    }

    const currentBalance = parseFloat(saving.balance || 0);

    if (type === 'withdraw' && amount > currentBalance) {
      alert(`❌ Montant insuffisant. Solde actuel : ${this.formatCurrency(currentBalance)}`);
      return;
    }

    // Update balance
    if (type === 'add') {
      saving.balance = currentBalance + amount;
    } else {
      saving.balance = currentBalance - amount;
    }

    // Record transaction
    this.recordTransaction(savingId, amount, type, date);

    // Save
    Storage.set(STORAGE_KEYS.SAVINGS, this.savings);

    this.closeTransactionModal();
    this.updateStats();
    this.loadSavings();
  }

  processAutoWithdrawals() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let changed = false;
    const errors = [];

    this.savings.forEach(saving => {
      const auto = saving.autoWithdraw;
      if (!auto || !auto.enabled || !auto.date || auto.executed) {
        return;
      }

      const scheduled = new Date(auto.date);
      scheduled.setHours(0, 0, 0, 0);

      if (scheduled > today) {
        return; // not due yet
      }

      const amount = parseFloat(auto.amount) || 0;
      if (amount <= 0) {
        auto.executed = true;
        auto.status = 'failed';
        auto.lastError = 'Montant invalide';
        auto.lastRunAt = new Date().toISOString();
        changed = true;
        return;
      }

      const balance = parseFloat(saving.balance) || 0;

      if (balance >= amount) {
        // Execute withdrawal
        saving.balance = balance - amount;
        auto.executed = true;
        auto.status = 'done';
        auto.lastError = null;
        auto.lastRunAt = new Date().toISOString();
        this.recordTransaction(saving.id, amount, 'withdraw', auto.date);
        changed = true;
      } else {
        // Insufficient funds
        auto.executed = true;
        auto.status = 'failed';
        auto.lastError = 'Solde insuffisant';
        auto.lastRunAt = new Date().toISOString();
        changed = true;
        errors.push(`❌ Retrait automatique échoué pour "${saving.name}" : solde insuffisant (${this.formatCurrency(balance)} < ${this.formatCurrency(amount)})`);
      }
    });

    if (changed) {
      Storage.set(STORAGE_KEYS.SAVINGS, this.savings);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }
  }

  recordTransaction(savingId, amount, type, date) {
    const transaction = {
      id: Date.now().toString(),
      savingsId: savingId,
      amount,
      type,
      date,
      createdAt: new Date().toISOString()
    };

    this.transactions.push(transaction);
    Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, this.transactions);
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
      .filter(t => t.savingsId === savingId)
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
      <div class="stat-card">
        <div class="stat-label">Solde actuel</div>
        <div class="stat-value">${this.formatCurrency(balance)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total ajouté</div>
        <div class="stat-value">${this.formatCurrency(totalAdded)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total retiré</div>
        <div class="stat-value">${this.formatCurrency(totalWithdrawn)}</div>
      </div>
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
      const dateLabel = new Date(t.date).toLocaleDateString('fr-FR');
      const color = isAdd ? 'var(--success-color, #16a34a)' : 'var(--error-color, #dc2626)';

      return `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-md);">
          <div>
            <div style="font-weight: 700;">${symbol} ${label}</div>
            <div style="font-size: 0.9rem; color: var(--text-muted);">${dateLabel}</div>
          </div>
          <div style="font-weight: 800; color: ${color};">${amount}</div>
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

// Initialize
let savingsManager;
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    savingsManager = new SavingsManager();
    savingsManager.init();
    // Expose globally for debugging (optional)
    window.savingsManager = savingsManager;
  });
} else {
  savingsManager = new SavingsManager();
  savingsManager.init();
  // Expose globally for debugging (optional)
  window.savingsManager = savingsManager;
}

export default SavingsManager;
