/**
 * SAVINGS.JS - Savings Page Logic
 * Gestion complète des épargnes et objectifs financiers
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import notify from './notifications.js';
import FinanceEngine from './financeEngine.js';

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
    } else {
      title.textContent = 'Créer une épargne';
      form.reset();
      document.getElementById('goal-fields').style.display = 'none';
      // Définir la date du jour par défaut
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('saving-initial-date').value = today;
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
    const initialDate = document.getElementById('saving-initial-date').value;

    if (!name) {
      notify.error('Le nom de l\'épargne est requis');
      return;
    }

    if (initialAmount < 0) {
      notify.error('Le montant initial ne peut pas être négatif');
      return;
    }

    if (type === 'goal' && targetAmount > 0 && initialAmount > targetAmount) {
      notify.error('Le montant initial ne peut pas dépasser l\'objectif');
      return;
    }

    if (this.editingId) {
      // Update existing
      const index = this.savings.findIndex(s => s.id === this.editingId);
      if (index !== -1) {
        const oldBalance = this.savings[index].balance || 0;
        this.savings[index] = {
          ...this.savings[index],
          name,
          type,
          targetAmount,
          targetDate,
          updatedAt: new Date().toISOString()
        };
        // Keep the existing balance when editing
        this.savings[index].balance = oldBalance;
      }
    } else {
      // Create new
      // VALIDATION: Si montant initial > 0, vérifier le solde disponible
      if (initialAmount > 0) {
        const validation = FinanceEngine.validateSavingAddition(initialAmount);
        if (!validation.valid) {
          notify.alert(
            `${validation.message}\n\nSolde disponible: ${FinanceEngine.formatCurrency(validation.availableBalance)}`,
            '❌ Solde insuffisant',
            'error'
          );
          return;
        }
      }

      // Créer l'épargne avec balance à 0 d'abord
      const saving = {
        id: Date.now().toString(),
        name,
        type,
        balance: 0,
        targetAmount,
        targetDate,
        createdAt: new Date().toISOString()
      };

      this.savings.push(saving);
      Storage.set(STORAGE_KEYS.SAVINGS, this.savings);

      // Si montant initial > 0, utiliser le moteur financier pour l'ajouter
      // Cela créera automatiquement la dépense correspondante
      if (initialAmount > 0) {
        const result = FinanceEngine.addToSaving(
          saving.id,
          initialAmount,
          `Montant initial de ${name}`,
          initialDate
        );

        if (!result.success) {
          // Si l'ajout échoue, supprimer l'épargne créée
          this.savings = this.savings.filter(s => s.id !== saving.id);
          Storage.set(STORAGE_KEYS.SAVINGS, this.savings);
          notify.error(result.message);
          return;
        }
      }
    }

    // Recharger les données après les modifications
    this.savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    this.transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
    
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

    const balance = parseFloat(saving.balance || 0);
    
    const confirmed = await showConfirmModal(
      `Êtes-vous sûr de vouloir supprimer l'épargne "${saving.name}" ?${
        balance > 0 ? `\n\nSolde actuel : ${this.formatCurrency(balance)}\nCe montant sera restitué à votre solde disponible.` : ''
      }`,
      {
        title: '⚠️ Supprimer l\'épargne',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (confirmed) {
      // Si l'épargne a un solde > 0, retirer tout le montant pour créer un revenu
      // Cela restitue l'argent au solde disponible
      if (balance > 0) {
        const today = new Date().toISOString().split('T')[0];
        const result = FinanceEngine.withdrawFromSaving(
          id,
          balance,
          `Restitution suite à suppression de l'épargne: ${saving.name}`,
          today
        );

        if (!result.success) {
          notify.error(`Erreur lors de la restitution du solde: ${result.message}`);
          return;
        }
      }

      // Recharger les données après le retrait
      this.savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
      this.transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);

      // Supprimer l'épargne et ses transactions
      this.savings = this.savings.filter(s => s.id !== id);
      this.transactions = this.transactions.filter(t => t.savingsId !== id);
      
      Storage.set(STORAGE_KEYS.SAVINGS, this.savings);
      Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, this.transactions);
      
      notify.success(
        balance > 0 
          ? `Épargne supprimée. ${this.formatCurrency(balance)} restitué au solde disponible.`
          : 'Épargne supprimée.'
      );

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
    const description = document.getElementById('transaction-description')?.value || '';

    // Validation basique
    if (!savingId || !type || !amount || !date) {
      notify.error('Tous les champs sont requis');
      return;
    }

    if (amount <= 0) {
      notify.error('Le montant doit être supérieur à 0');
      return;
    }

    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) {
      notify.error('Épargne introuvable');
      return;
    }

    /**
     * UTILISATION DU MOTEUR FINANCIER
     * Toutes les validations et opérations passent par FinanceEngine
     */
    if (type === 'add') {
      // AJOUT À L'ÉPARGNE
      // Valider que le solde disponible est suffisant
      const validation = FinanceEngine.validateSavingAddition(amount);
      
      if (!validation.valid) {
        notify.error(validation.message);
        return;
      }

      // Effectuer l'opération via le moteur financier
      const result = FinanceEngine.addToSaving(
        savingId,
        amount,
        description || `Ajout à ${saving.name}`,
        date
      );

      if (!result.success) {
        notify.error(result.message);
        return;
      }

      notify.success(result.message);

    } else if (type === 'withdraw') {
      // RETRAIT DE L'ÉPARGNE
      // Valider que l'épargne a suffisamment de solde
      const validation = FinanceEngine.validateSavingWithdrawal(savingId, amount);
      
      if (!validation.valid) {
        notify.error(validation.message);
        return;
      }

      // Effectuer l'opération via le moteur financier
      const result = FinanceEngine.withdrawFromSaving(
        savingId,
        amount,
        description || `Retrait de ${saving.name}`,
        date
      );

      if (!result.success) {
        notify.error(result.message);
        return;
      }

      notify.success(result.message);
    }

    // Recharger les données
    this.savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    this.transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);

    this.closeTransactionModal();
    this.updateStats();
    this.loadSavings();
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
      const dateLabel = new Date(t.date).toLocaleDateString('fr-FR', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const color = isAdd ? 'var(--success-color, #16a34a)' : 'var(--error-color, #dc2626)';
      const description = t.description || '';

      return `
        <div class="card" style="display: flex; justify-content: space-between; align-items: center; gap: var(--space-md);">
          <div style="flex: 1;">
            <div style="font-weight: 700;">${symbol} ${label}</div>
            ${description ? `<div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${description}</div>` : ''}
            <div style="font-size: 0.9rem; color: var(--text-muted); margin-top: 4px;">📅 ${dateLabel}</div>
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
