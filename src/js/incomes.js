/**
 * INCOMES.JS - Incomes Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, callRpc } from './volakoApi.js';
import { SUPABASE_TABLES } from './supabase.js';
import notify from './notifications.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class IncomesManager {
  constructor() {
    this.incomes = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
  }

  async init() {
    this.checkAuth();
    renderSidebar('incomes');
    renderBottomNav('incomes');
    this.setupEventListeners();
    this.setupForm();

    applySkeleton('incomes-list', 'list');
    await this.refreshData();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('incomes-list', async () => {
      try {
        this.incomes = await fetchTable(SUPABASE_TABLES.INCOMES, { orderBy: 'date', ascending: false });
      } catch (error) {
        this.incomes = [];
        notify.error(error.message || 'Impossible de charger les revenus.');
      }

      await this.updateStats();
      this.loadIncomes();
    });
  }

  async updateStats() {
    let row = { month_total: 0, year_total: 0 };

    try {
      const stats = await callRpc('volako_get_income_stats', {}, 'Chargement des revenus');
      row = stats?.[0] || row;
    } catch {
      const now = new Date();
      const monthKey = this.toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
      const yearKey = `${now.getFullYear()}-01-01`;
      const todayKey = this.toDateInputValue(now);

      const monthTotal = this.incomes.reduce((sum, income) => {
        const dateKey = this.getDateKey(income.date);
        if (dateKey >= monthKey && dateKey <= todayKey) {
          return sum + Number(income.amount || 0);
        }
        return sum;
      }, 0);

      const yearTotal = this.incomes.reduce((sum, income) => {
        const dateKey = this.getDateKey(income.date);
        if (dateKey >= yearKey && dateKey <= todayKey) {
          return sum + Number(income.amount || 0);
        }
        return sum;
      }, 0);

      row = { month_total: monthTotal, year_total: yearTotal };
      notify.warning('Statistiques revenus indisponibles cote serveur. Calcul local applique.');
    }

    const monthEl = document.getElementById('income-month');
    const yearEl = document.getElementById('income-year');

    if (monthEl) monthEl.textContent = this.formatCurrency(row.month_total || 0);
    if (yearEl) yearEl.textContent = this.formatCurrency(row.year_total || 0);
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

  loadIncomes() {
    const listElement = document.getElementById('incomes-list');
    if (!listElement) return;

    if (this.incomes.length === 0) {
      listElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary);">Aucun revenu a afficher</p>';
      return;
    }

    listElement.innerHTML = this.incomes.map(inc => this.createIncomeHTML(inc)).join('');
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
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true, 'Enregistrement...');
        try {
          await this.saveIncome();
        } finally {
          setButtonLoading(submitBtn, false);
        }
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

  async saveIncome() {
    const form = document.getElementById('income-form');
    const editId = form.dataset.editId;

    const payload = {
      source: document.getElementById('income-source').value,
      amount: parseFloat(document.getElementById('income-amount').value),
      date: document.getElementById('income-date').value,
      created_at: new Date().toISOString()
    };

    try {
      if (editId) {
        await updateRow(SUPABASE_TABLES.INCOMES, editId, {
          source: payload.source,
          amount: payload.amount,
          date: payload.date
        }, 'Modification du revenu');
      } else {
        await insertRow(SUPABASE_TABLES.INCOMES, {
          id: generateUUID(),
          ...payload
        }, 'Ajout du revenu');
      }

      await this.refreshData();
      this.closeModal();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la sauvegarde du revenu.');
      }
    }
  }

  editIncome(id) {
    const income = this.incomes.find(inc => inc.id === id);
    if (income) {
      this.openModal(income);
    }
  }

  async deleteIncome(id) {
    const confirmed = await showConfirmModal('Etes-vous sur de vouloir supprimer ce revenu ?', {
      title: 'Confirmation',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) return;

    try {
      await deleteRow(SUPABASE_TABLES.INCOMES, id, 'Suppression du revenu');
      await this.refreshData();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la suppression du revenu.');
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const manager = new IncomesManager();
    try {
      await manager.init();
    } catch (error) {
      notify.error(error.message || 'Erreur lors du chargement des revenus.');
    }
  });
} else {
  const manager = new IncomesManager();
  manager.init().catch((error) => {
    notify.error(error.message || 'Erreur lors du chargement des revenus.');
  });
}

export default IncomesManager;
