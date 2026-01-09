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
    this.updateStats();
    this.loadSavings();
    this.setupEventListeners();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  updateStats() {
    const totalSaved = this.savings.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0);
    const activeGoals = this.savings.filter(s => s.type === 'goal').length;
    
    let avgProgress = 0;
    const goalsWithTarget = this.savings.filter(s => s.type === 'goal' && s.targetAmount);
    if (goalsWithTarget.length > 0) {
      const totalProgress = goalsWithTarget.reduce((sum, s) => {
        const progress = (parseFloat(s.balance) / parseFloat(s.targetAmount)) * 100;
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
              <span class="saving-type-badge">${isGoal ? 'Objectif' : 'Libre'}</span>
            </div>
          </div>
          <div class="saving-actions">
            <button class="btn-icon" onclick="savingsManager.editSaving('${saving.id}')" title="Modifier">
              ✏️
            </button>
            <button class="btn-icon" onclick="savingsManager.deleteSaving('${saving.id}')" title="Supprimer">
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
          <button class="btn btn-success btn-sm" onclick="savingsManager.openTransaction('${saving.id}', 'add')">
            <span>➕</span>
            <span>Ajouter</span>
          </button>
          <button class="btn btn-outline btn-sm" onclick="savingsManager.openTransaction('${saving.id}', 'withdraw')">
            <span>➖</span>
            <span>Retirer</span>
          </button>
          <button class="btn btn-secondary btn-sm" onclick="savingsManager.viewHistory('${saving.id}')">
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

    if (this.editingId) {
      // Update existing
      const index = this.savings.findIndex(s => s.id === this.editingId);
      if (index !== -1) {
        this.savings[index] = {
          ...this.savings[index],
          name,
          type,
          targetAmount,
          targetDate
        };
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
    
    title.textContent = type === 'add' ? `➕ Ajouter à "${saving.name}"` : `➖ Retirer de "${saving.name}"`;
    
    document.getElementById('transaction-saving-id').value = savingId;
    document.getElementById('transaction-type').value = type;
    document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('transaction-form').reset();

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

    const saving = this.savings.find(s => s.id === savingId);
    if (!saving) return;

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
    // Navigate to a detailed view or show modal with history
    // For now, we'll use a simple alert
    const saving = this.savings.find(s => s.id === savingId);
    const savingTransactions = this.transactions
      .filter(t => t.savingsId === savingId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    if (savingTransactions.length === 0) {
      alert(`Aucun historique pour "${saving.name}"`);
      return;
    }

    let history = `📋 Historique de "${saving.name}"\n\n`;
    savingTransactions.forEach(t => {
      const symbol = t.type === 'add' ? '➕' : '➖';
      history += `${symbol} ${this.formatCurrency(t.amount)} - ${new Date(t.date).toLocaleDateString('fr-FR')}\n`;
    });

    alert(history);
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
  });
} else {
  savingsManager = new SavingsManager();
  savingsManager.init();
}

export default SavingsManager;
