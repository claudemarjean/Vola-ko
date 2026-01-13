/**
 * BUDGETS.JS - Budgets Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import { generateUUID } from './sync.js';
import FinanceEngine from './financeEngine.js';

class BudgetsManager {
  constructor() {
    this.budgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.editingBudgetId = null;
  }

  init() {
    this.checkAuth();
    renderSidebar('budgets');
    renderBottomNav('budgets');
    this.loadBudgets();
    this.setupEventListeners();
    this.setupForm();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  loadBudgets() {
    const gridElement = document.getElementById('budgets-grid');
    if (!gridElement) return;

    // Filtrer les budgets supprimés
    const activeBudgets = this.budgets.filter(b => !b.deleted);

    if (activeBudgets.length === 0) {
      gridElement.innerHTML = '<p style="text-align: center; padding: var(--space-2xl); color: var(--text-secondary); grid-column: 1/-1;">Aucun budget défini</p>';
      return;
    }

    gridElement.innerHTML = activeBudgets.map(budget => this.createBudgetHTML(budget)).join('');
    this.attachEventListeners();
  }

  createBudgetHTML(budget) {
    const spent = this.calculateSpent(budget.category);
    const remaining = budget.amount - spent;
    const percentage = Math.min((spent / budget.amount) * 100, 100);
    
    let progressColor = 'var(--color-success)';
    if (percentage > 80) progressColor = 'var(--color-error)';
    else if (percentage > 60) progressColor = 'var(--color-warning)';

    const icon = this.getCategoryIcon(budget.category);
    const safeOtherReference = budget.otherReference ? this.escapeHtml(budget.otherReference) : '';
    const safeNotes = budget.notes ? this.escapeHtml(budget.notes) : '';
    const formattedNotes = safeNotes ? safeNotes.replace(/\n/g, '<br>') : '';
    const categoryName = budget.category === 'autre' && budget.otherReference 
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
            <span>${this.formatCurrency(spent)} / ${this.formatCurrency(budget.amount)}</span>
            <span class="progress-percent">${Math.round(percentage)}%</span>
          </div>
        </div>

        <div class="budget-stats">
          <div>
            <span class="stat-label">Restant</span>
            <span class="stat-value">${this.formatCurrency(remaining)}</span>
          </div>
          <div>
            <span class="stat-label">Dépensé</span>
            <span class="stat-value">${this.formatCurrency(spent)}</span>
          </div>
        </div>

        ${formattedNotes ? `<div class="budget-notes"><span class="stat-label">Détails</span><p>${formattedNotes}</p></div>` : ''}
      </div>
    `;
  }

  calculateSpent(category) {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = this.expenses.filter(exp => {
      const date = new Date(exp.date);
      return exp.category === category && 
             date.getMonth() === currentMonth && 
             date.getFullYear() === currentYear;
    });

    return monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
  }

  getCategoryIcon(category) {
    const icons = {
      'alimentation': '🛒',
      'transport': '🚗',
      'logement': '🏠',
      'sante': '💊',
      'loisirs': '🎮',
      'autre': '📦'
    };
    return icons[category] || '📦';
  }

  getCategoryName(category) {
    const names = {
      'alimentation': 'Alimentation',
      'transport': 'Transport',
      'logement': 'Logement',
      'sante': 'Santé',
      'loisirs': 'Loisirs',
      'autre': 'Autre'
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
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveBudget();
      });
    }

    // Toggle "other" reference field
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
    
    // Réinitialiser le formulaire et masquer le champ "autre"
    if (form) {
      form.reset();
    }
    
    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
    }

    const isEditing = Boolean(budget);

    if (modalTitle) {
      modalTitle.textContent = isEditing ? 'Modifier un budget' : 'Créer un budget';
    }

    if (submitBtn) {
      submitBtn.textContent = isEditing ? 'Mettre à jour' : 'Enregistrer';
    }

    if (categorySelect) {
      categorySelect.disabled = isEditing;
    }

    if (notesInput) {
      notesInput.value = budget?.notes || '';
    }

    if (budget) {
      if (categorySelect) {
        categorySelect.value = budget.category;
      }

      if (amountInput) {
        amountInput.value = budget.amount;
      }

      if (budget.category === 'autre') {
        if (otherReferenceGroup) {
          otherReferenceGroup.style.display = 'block';
        }

        if (otherReferenceInput) {
          otherReferenceInput.value = budget.otherReference || '';
        }
      }
    } else {
      if (categorySelect) {
        categorySelect.disabled = false;
      }
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
    
    // Réinitialiser le champ "autre" lors de la fermeture
    if (otherReferenceGroup) {
      otherReferenceGroup.style.display = 'none';
      const otherReferenceInput = document.getElementById('budget-other-reference');
      if (otherReferenceInput) {
        otherReferenceInput.value = '';
      }
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
      return;
    }

    if (this.editingBudgetId) {
      const budgetIndex = this.budgets.findIndex(b => b.id === this.editingBudgetId);
      if (budgetIndex !== -1) {
        this.budgets[budgetIndex] = {
          ...this.budgets[budgetIndex],
          amount,
          otherReference: otherReference || undefined,
          notes: notes || undefined
        };
      }
    } else {
      // Check if budget already exists for this category
      const existingIndex = this.budgets.findIndex(b => b.category === category);

      if (existingIndex !== -1) {
        const confirmed = await showConfirmModal(
          'Un budget existe déjà pour cette catégorie. Le remplacer ?',
          {
            title: '⚠️ Budget existant',
            confirmText: 'Remplacer',
            cancelText: 'Annuler',
            danger: false
          }
        );

        if (confirmed) {
          this.budgets[existingIndex].amount = amount;
          this.budgets[existingIndex].otherReference = otherReference || undefined;
          this.budgets[existingIndex].notes = notes || undefined;
        } else {
          return;
        }
      } else {
        const budget = {
          id: generateUUID(),
          category,
          amount,
          other_reference: otherReference || null,
          notes: notes || null,
          synced: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.budgets.push(budget);
      }
    }

    Storage.set(STORAGE_KEYS.BUDGETS, this.budgets);
    this.loadBudgets();
    this.closeModal();
  }

  escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value;
    return div.innerHTML;
  }

  async deleteBudget(id) {
    const confirmed = await showConfirmModal(
      'Êtes-vous sûr de vouloir supprimer ce budget ?',
      {
        title: '⚠️ Confirmation',
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        danger: true
      }
    );

    if (confirmed) {
      // Marquer comme supprimé pour synchronisation avec Supabase
      const index = this.budgets.findIndex(b => b.id === id);
      if (index !== -1) {
        this.budgets[index] = { ...this.budgets[index], deleted: true, synced: false };
        Storage.set(STORAGE_KEYS.BUDGETS, this.budgets);
        this.loadBudgets();
      }
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new BudgetsManager();
    manager.init();
  });
} else {
  const manager = new BudgetsManager();
  manager.init();
}

export default BudgetsManager;
