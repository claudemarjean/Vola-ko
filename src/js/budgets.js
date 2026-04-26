/**
 * BUDGETS.JS - Budgets Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import { generateUUID } from './ids.js';
import { fetchTable, insertRow, updateRow, deleteRow, fetchBudgetProgress } from './volakoApi.js';
import { SUPABASE_TABLES } from './supabase.js';
import notify from './notifications.js';
import { withPageLoader, setButtonLoading, applySkeleton } from './loaders.js';

class BudgetsManager {
  constructor() {
    this.budgets = [];
    this.progressRows = [];
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.editingBudgetId = null;
  }

  async init() {
    this.checkAuth();
    renderSidebar('budgets');
    renderBottomNav('budgets');
    this.setupEventListeners();
    this.setupForm();

    applySkeleton('budgets-grid', 'cards');
    await this.refreshData();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async refreshData() {
    await withPageLoader('budgets-grid', async () => {
      this.budgets = await fetchTable(SUPABASE_TABLES.BUDGETS, { orderBy: 'updated_at', ascending: false });
      this.progressRows = await fetchBudgetProgress();
      this.loadBudgets();
    });
  }

  loadBudgets() {
    const gridElement = document.getElementById('budgets-grid');
    if (!gridElement) return;

    if (this.budgets.length === 0) {
      gridElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary); grid-column: 1/-1;">Aucun budget defini</p>';
      return;
    }

    gridElement.innerHTML = this.budgets.map(budget => this.createBudgetHTML(budget)).join('');
    this.attachEventListeners();
  }

  createBudgetHTML(budget) {
    const progress = this.progressRows.find(row => row.id === budget.id) || {
      spent: 0,
      remaining: budget.amount,
      amount: budget.amount
    };

    const percentage = progress.amount > 0 ? Math.min((progress.spent / progress.amount) * 100, 100) : 0;

    let progressColor = 'var(--color-success)';
    if (percentage > 80) progressColor = 'var(--color-error)';
    else if (percentage > 60) progressColor = 'var(--color-warning)';

    const icon = this.getCategoryIcon(budget.category);
    const safeOtherReference = budget.other_reference ? this.escapeHtml(budget.other_reference) : '';
    const safeNotes = budget.notes ? this.escapeHtml(budget.notes) : '';
    const formattedNotes = safeNotes ? safeNotes.replace(/\n/g, '<br>') : '';
    const categoryName = budget.category === 'autre' && budget.other_reference
      ? `${this.getCategoryName(budget.category)} (${safeOtherReference})`
      : this.getCategoryName(budget.category);

    return `
      <div class="budget-card card">
        <div class="budget-header">
          <div>
            <h3>${icon} ${categoryName}</h3>
            <p>Budget mensuel</p>
          </div>
          <div class="budget-actions">
            <button class="btn-icon edit-btn" data-id="${budget.id}" title="Modifier le budget">✏️</button>
            <button class="btn-icon delete-btn" data-id="${budget.id}" title="Supprimer le budget">🗑️</button>
          </div>
        </div>

        <div class="budget-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${percentage}%; background-color: ${progressColor};"></div>
          </div>
          <div class="progress-info">
            <span>${this.formatCurrency(progress.spent)} / ${this.formatCurrency(progress.amount)}</span>
            <span class="progress-percent">${Math.round(percentage)}%</span>
          </div>
        </div>

        <div class="budget-stats">
          <div>
            <span class="stat-label">Restant</span>
            <span class="stat-value">${this.formatCurrency(progress.remaining)}</span>
          </div>
          <div>
            <span class="stat-label">Depense</span>
            <span class="stat-value">${this.formatCurrency(progress.spent)}</span>
          </div>
        </div>

        ${formattedNotes ? `<div class="budget-notes"><span class="stat-label">Details</span><p>${formattedNotes}</p></div>` : ''}
      </div>
    `;
  }

  getCategoryIcon(category) {
    const icons = {
      alimentation: '🛒',
      transport: '🚗',
      logement: '🏠',
      sante: '💊',
      loisirs: '🎮',
      autre: '📦'
    };
    return icons[category] || '📦';
  }

  getCategoryName(category) {
    const names = {
      alimentation: 'Alimentation',
      transport: 'Transport',
      logement: 'Logement',
      sante: 'Sante',
      loisirs: 'Loisirs',
      autre: 'Autre'
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
        const id = e.currentTarget.dataset.id;
        this.deleteBudget(id);
      });
    });

    document.querySelectorAll('.edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const budget = this.budgets.find(b => b.id === id);
        if (budget) {
          this.openModal(budget);
        }
      });
    });
  }

  setupForm() {
    const form = document.getElementById('budget-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');
        setButtonLoading(submitBtn, true, 'Enregistrement...');
        try {
          await this.saveBudget();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }

    const categorySelect = document.getElementById('budget-category');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');

    if (categorySelect && otherReferenceGroup) {
      categorySelect.addEventListener('change', (e) => {
        if (e.target.value === 'autre') {
          otherReferenceGroup.style.display = 'block';
        } else {
          otherReferenceGroup.style.display = 'none';
          document.getElementById('budget-other-reference').value = '';
        }
      });
    }
  }

  openModal(budget = null) {
    const modal = document.getElementById('budget-modal');
    const form = document.getElementById('budget-form');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');
    const otherReferenceInput = document.getElementById('budget-other-reference');
    const categorySelect = document.getElementById('budget-category');
    const amountInput = document.getElementById('budget-amount');
    const notesInput = document.getElementById('budget-notes');
    const modalTitle = document.getElementById('budget-modal-title');
    const submitBtn = document.getElementById('budget-submit');

    this.editingBudgetId = budget?.id || null;

    if (modal) {
      modal.classList.add('active');
    }

    if (form) {
      form.reset();
    }

    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
    }

    const isEditing = Boolean(budget);

    if (modalTitle) {
      modalTitle.textContent = isEditing ? 'Modifier un budget' : 'Creer un budget';
    }

    if (submitBtn) {
      submitBtn.textContent = isEditing ? 'Mettre a jour' : 'Enregistrer';
    }

    if (categorySelect) {
      categorySelect.disabled = isEditing;
    }

    if (notesInput) {
      notesInput.value = budget?.notes || '';
    }

    if (budget) {
      if (categorySelect) categorySelect.value = budget.category;
      if (amountInput) amountInput.value = budget.amount;

      if (budget.category === 'autre') {
        if (otherReferenceGroup) otherReferenceGroup.style.display = 'block';
        if (otherReferenceInput) otherReferenceInput.value = budget.other_reference || '';
      }
    } else if (categorySelect) {
      categorySelect.disabled = false;
    }
  }

  closeModal() {
    const modal = document.getElementById('budget-modal');
    const otherReferenceGroup = document.getElementById('budget-other-reference-group');
    const categorySelect = document.getElementById('budget-category');
    const notesInput = document.getElementById('budget-notes');

    if (modal) {
      modal.classList.remove('active');
    }

    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
      const otherReferenceInput = document.getElementById('budget-other-reference');
      if (otherReferenceInput) otherReferenceInput.value = '';
    }

    if (categorySelect) {
      categorySelect.disabled = false;
      categorySelect.value = '';
    }

    if (notesInput) {
      notesInput.value = '';
    }

    this.editingBudgetId = null;
  }

  async saveBudget() {
    const category = document.getElementById('budget-category').value;
    const amount = parseFloat(document.getElementById('budget-amount').value);
    const otherReference = category === 'autre' ? document.getElementById('budget-other-reference').value : '';
    const notes = document.getElementById('budget-notes')?.value.trim() || '';

    if (!category || Number.isNaN(amount) || amount < 0) {
      notify.error('Categorie ou montant invalide.');
      return;
    }

    try {
      if (this.editingBudgetId) {
        await updateRow(SUPABASE_TABLES.BUDGETS, this.editingBudgetId, {
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          updated_at: new Date().toISOString()
        }, 'Mise a jour du budget');
      } else {
        const existing = this.budgets.find(b => b.category === category);
        if (existing) {
          const confirmed = await showConfirmModal(
            'Un budget existe deja pour cette categorie. Le remplacer ?',
            {
              title: 'Budget existant',
              confirmText: 'Remplacer',
              cancelText: 'Annuler',
              danger: false
            }
          );

          if (!confirmed) return;

          await updateRow(SUPABASE_TABLES.BUDGETS, existing.id, {
            amount,
            other_reference: otherReference || null,
            notes: notes || null,
            updated_at: new Date().toISOString()
          }, 'Mise a jour du budget');
        } else {
          await insertRow(SUPABASE_TABLES.BUDGETS, {
            id: generateUUID(),
            category,
            amount,
            other_reference: otherReference || null,
            notes: notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, 'Creation du budget');
        }
      }

      await this.refreshData();
      this.closeModal();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la sauvegarde du budget.');
      }
    }
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  async deleteBudget(id) {
    const confirmed = await showConfirmModal('Etes-vous sur de vouloir supprimer ce budget ?', {
      title: 'Confirmation',
      confirmText: 'Supprimer',
      cancelText: 'Annuler',
      danger: true
    });

    if (!confirmed) return;

    try {
      await deleteRow(SUPABASE_TABLES.BUDGETS, id, 'Suppression du budget');
      await this.refreshData();
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Erreur lors de la suppression du budget.');
      }
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const manager = new BudgetsManager();
    await manager.init();
  });
} else {
  const manager = new BudgetsManager();
  manager.init();
}

export default BudgetsManager;
