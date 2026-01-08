/**
 * DASHBOARD.JS - Dashboard Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';

class Dashboard {
  constructor() {
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    this.budgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
  }

  /**
   * Initialiser le dashboard
   */
  init() {
    this.checkAuth();
    this.updateStats();
    this.loadRecentTransactions();
    this.setupEventListeners();
  }

  /**
   * Vérifier l'authentification
   */
  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login.html';
    }
  }

  /**
   * Mettre à jour les statistiques
   */
  updateStats() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Filtrer les transactions du mois en cours
    const monthExpenses = this.expenses.filter(exp => {
      const date = new Date(exp.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const monthIncomes = this.incomes.filter(inc => {
      const date = new Date(inc.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    // Calculer les totaux
    const totalExpenses = monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const totalIncome = monthIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const balance = totalIncome - totalExpenses;

    // Calculer le budget total et utilisé
    const totalBudget = this.budgets.reduce((sum, budget) => sum + parseFloat(budget.amount), 0);
    const budgetRemaining = totalBudget - totalExpenses;

    // Mettre à jour l'affichage
    this.updateElement('balance-value', this.formatCurrency(balance));
    this.updateElement('income-value', this.formatCurrency(totalIncome));
    this.updateElement('expenses-value', this.formatCurrency(totalExpenses));
    this.updateElement('budget-value', this.formatCurrency(budgetRemaining));
  }

  /**
   * Charger les transactions récentes
   */
  loadRecentTransactions() {
    const allTransactions = [
      ...this.expenses.map(exp => ({ ...exp, type: 'expense' })),
      ...this.incomes.map(inc => ({ ...inc, type: 'income' }))
    ];

    // Trier par date (plus récent en premier)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Prendre les 5 plus récentes
    const recent = allTransactions.slice(0, 5);

    // Afficher
    const listElement = document.getElementById('transactions-list');
    if (listElement && recent.length > 0) {
      listElement.innerHTML = recent.map(t => this.createTransactionHTML(t)).join('');
    }
  }

  /**
   * Créer le HTML d'une transaction
   */
  createTransactionHTML(transaction) {
    const icon = this.getCategoryIcon(transaction.category || 'income');
    const amount = transaction.type === 'expense' ? 
      `-${this.formatCurrency(transaction.amount)}` : 
      `+${this.formatCurrency(transaction.amount)}`;
    const amountClass = transaction.type === 'expense' ? 'expense' : 'income';
    const description = transaction.description || transaction.source || 'Transaction';
    const date = this.formatDate(transaction.date);

    return `
      <li class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-icon">${icon}</div>
          <div class="transaction-details">
            <h4>${description}</h4>
            <p>${date} • ${transaction.category || 'Revenu'}</p>
          </div>
        </div>
        <div class="transaction-amount ${amountClass}">${amount}</div>
      </li>
    `;
  }

  /**
   * Obtenir l'icône de catégorie
   */
  getCategoryIcon(category) {
    const icons = {
      'alimentation': '🛒',
      'transport': '🚗',
      'logement': '🏠',
      'sante': '💊',
      'loisirs': '🎮',
      'income': '💼',
      'autre': '📦'
    };
    return icons[category] || '📦';
  }

  /**
   * Formater une devise
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  /**
   * Formater une date
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Aujourd\'hui';
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} jours`;
    
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  /**
   * Mettre à jour un élément du DOM
   */
  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  /**
   * Configurer les écouteurs d'événements
   */
  setupEventListeners() {
    // Bouton déconnexion
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const auth = new Auth();
        auth.logout();
        window.location.href = '/index.html';
      });
    }

    // Bouton ajouter transaction
    const addBtn = document.getElementById('add-transaction-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        window.location.href = '/expenses.html';
      });
    }
  }
}

// Initialiser au chargement de la page
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new Dashboard();
    dashboard.init();
  });
} else {
  const dashboard = new Dashboard();
  dashboard.init();
}

export default Dashboard;
