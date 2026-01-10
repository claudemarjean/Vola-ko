/**
 * DASHBOARD.JS - Dashboard Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { CATEGORIES } from './utils.js';
import { Chart, registerables } from 'chart.js';
import FinanceEngine from './financeEngine.js';

// Register Chart.js components
Chart.register(...registerables);

class Dashboard {
  constructor() {
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    this.budgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
    this.savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.charts = {};
  }

  /**
   * Initialiser le dashboard
   */
  init() {
    this.checkAuth();
    this.updateStats();
    this.loadRecentTransactions();
    this.setupEventListeners();
    this.initCharts();
  }

  /**
   * Vérifier l'authentification
   */
  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  /**
   * Mettre à jour les statistiques
   * Utilise FinanceEngine pour garantir des calculs cohérents
   */
  updateStats() {
    // Utiliser le moteur financier pour calculer tous les soldes
    const balances = FinanceEngine.calculateBalances();

    // Mettre à jour l'affichage des deux soldes principaux
    this.updateElement('balance-available-value', this.formatCurrency(balances.availableBalance));
    this.updateElement('balance-with-savings-value', this.formatCurrency(balances.totalBalanceWithSavings));
    
    // Mettre à jour les autres statistiques
    this.updateElement('income-value', this.formatCurrency(balances.totalIncome));
    this.updateElement('expenses-value', this.formatCurrency(balances.totalExpenses));
    this.updateElement('savings-value', this.formatCurrency(balances.totalSaved));
    this.updateElement('savings-goals-count', balances.savingsCount);

    // Calculer le budget restant
    const totalBudget = this.budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0);
    const budgetRemaining = totalBudget - balances.totalExpenses;
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
    if (listElement) {
      if (recent.length > 0) {
        listElement.innerHTML = recent.map(t => this.createTransactionHTML(t)).join('');
      } else {
        listElement.innerHTML = `
          <li class="transaction-item empty-state">
            <div class="transaction-info">
              <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">
                📝 Aucune transaction récente
              </p>
            </div>
          </li>
        `;
      }
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
        window.location.href = '/';
      });
    }

    // Bouton ajouter transaction
    const addBtn = document.getElementById('add-transaction-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        window.location.href = '/expenses';
      });
    }

    // Listen for theme changes to update charts
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-theme') {
          this.updateCharts();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
  }

  /**
   * Initialize all charts
   */
  initCharts() {
    this.createCategoryChart();
    this.createTrendChart();
    this.createBudgetChart();
    this.createBalanceChart();
  }

  /**
   * Update all charts
   */
  updateCharts() {
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};
    this.initCharts();
  }

  /**
   * Check if dark mode is active
   */
  isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  /**
   * Get chart colors based on theme
   */
  getChartColors() {
    const isDark = this.isDarkMode();
    return {
      textColor: isDark ? '#f1f5f9' : '#1f2937',
      gridColor: isDark ? '#475569' : '#e5e7eb',
      tooltipBg: isDark ? '#334155' : '#ffffff',
      tooltipBorder: isDark ? '#475569' : '#e5e7eb'
    };
  }

  /**
   * Get category color
   */
  getCategoryColor(categoryId) {
    const category = CATEGORIES.find(c => c.id === categoryId);
    return category ? category.color : '#6b7280';
  }

  /**
   * Create category breakdown chart (Doughnut)
   */
  createCategoryChart() {
    const canvas = document.getElementById('dashboard-category-chart');
    if (!canvas) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = this.expenses.filter(exp => {
      const date = new Date(exp.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const categoryTotals = {};
    monthExpenses.forEach(expense => {
      const cat = expense.category || 'autre';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(expense.amount);
    });

    const labels = [];
    const data = [];
    const colors = [];

    Object.entries(categoryTotals).forEach(([catId, total]) => {
      const category = CATEGORIES.find(c => c.id === catId);
      if (category) {
        labels.push(`${category.icon} ${category.name}`);
        data.push(total);
        colors.push(category.color);
      }
    });

    const chartColors = this.getChartColors();

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors.map(c => c + (this.isDarkMode() ? 'DD' : 'E6')),
          borderColor: colors,
          borderWidth: 3,
          hoverOffset: 15,
          hoverBorderWidth: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 12,
              font: { size: 11, weight: '500' },
              color: chartColors.textColor,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            titleColor: chartColors.textColor,
            bodyColor: chartColors.textColor,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return ` ${context.label}: ${this.formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  /**
   * Create 7-day trend chart (Line)
   */
  createTrendChart() {
    const canvas = document.getElementById('dashboard-trend-chart');
    if (!canvas) return;

    const now = new Date();
    const last7Days = [];
    const incomeData = [];
    const expenseData = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      last7Days.push(date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }));

      const dayIncome = this.incomes
        .filter(inc => inc.date === dateStr)
        .reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
      
      const dayExpense = this.expenses
        .filter(exp => exp.date === dateStr)
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      incomeData.push(dayIncome);
      expenseData.push(dayExpense);
    }

    const chartColors = this.getChartColors();

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels: last7Days,
        datasets: [
          {
            label: 'Revenus',
            data: incomeData,
            borderColor: '#10b981',
            backgroundColor: this.isDarkMode() ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#10b981',
            pointBorderColor: this.isDarkMode() ? '#1e293b' : '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: 'Dépenses',
            data: expenseData,
            borderColor: '#ef4444',
            backgroundColor: this.isDarkMode() ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 5,
            pointHoverRadius: 8,
            pointBackgroundColor: '#ef4444',
            pointBorderColor: this.isDarkMode() ? '#1e293b' : '#ffffff',
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 12, weight: '500' },
              color: chartColors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            titleColor: chartColors.textColor,
            bodyColor: chartColors.textColor,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              color: chartColors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          x: {
            ticks: {
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              display: false
            },
            border: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Create budget usage chart (Horizontal Bar)
   */
  createBudgetChart() {
    const canvas = document.getElementById('dashboard-budget-chart');
    if (!canvas) return;

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthExpenses = this.expenses.filter(exp => {
      const date = new Date(exp.date);
      return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
    });

    const categoryExpenses = {};
    monthExpenses.forEach(exp => {
      const cat = exp.category || 'autre';
      categoryExpenses[cat] = (categoryExpenses[cat] || 0) + parseFloat(exp.amount);
    });

    const labels = [];
    const spentData = [];
    const remainingData = [];
    const colors = [];

    this.budgets.forEach(budget => {
      const category = CATEGORIES.find(c => c.id === budget.category);
      if (category) {
        const spent = categoryExpenses[budget.category] || 0;
        const remaining = Math.max(0, parseFloat(budget.amount) - spent);
        
        labels.push(`${category.icon} ${category.name}`);
        spentData.push(spent);
        remainingData.push(remaining);
        colors.push(category.color);
      }
    });

    const chartColors = this.getChartColors();

    this.charts.budget = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Dépensé',
            data: spentData,
            backgroundColor: colors.map(c => c + (this.isDarkMode() ? 'DD' : 'CC')),
            borderColor: colors,
            borderWidth: 2,
            borderRadius: 6
          },
          {
            label: 'Restant',
            data: remainingData,
            backgroundColor: this.isDarkMode() ? 'rgba(148, 163, 184, 0.4)' : 'rgba(229, 231, 235, 0.8)',
            borderColor: this.isDarkMode() ? '#94a3b8' : '#d1d5db',
            borderWidth: 2,
            borderRadius: 6
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 11, weight: '500' },
              color: chartColors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 12
            }
          },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            titleColor: chartColors.textColor,
            bodyColor: chartColors.textColor,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${this.formatCurrency(context.parsed.x)}`
            }
          }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              color: chartColors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          y: {
            stacked: true,
            ticks: {
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              display: false
            },
            border: {
              display: false
            }
          }
        }
      }
    });
  }

  /**
   * Create monthly balance chart (Bar)
   */
  createBalanceChart() {
    const canvas = document.getElementById('dashboard-balance-chart');
    if (!canvas) return;

    const now = new Date();
    const months = [];
    const balanceData = [];

    // Rolling 12 months to include previous year
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIdx = date.getMonth();
      const year = date.getFullYear();
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
      months.push(monthLabel);

      const monthIncome = this.incomes
        .filter(inc => {
          const d = new Date(inc.date);
          return d.getMonth() === monthIdx && d.getFullYear() === year;
        })
        .reduce((sum, inc) => sum + parseFloat(inc.amount), 0);

      const monthExpense = this.expenses
        .filter(exp => {
          const d = new Date(exp.date);
          return d.getMonth() === monthIdx && d.getFullYear() === year;
        })
        .reduce((sum, exp) => sum + parseFloat(exp.amount), 0);

      balanceData.push(monthIncome - monthExpense);
    }

    const chartColors = this.getChartColors();

    this.charts.balance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Balance',
          data: balanceData,
          backgroundColor: balanceData.map(val => 
            val >= 0 
              ? (this.isDarkMode() ? 'rgba(16, 185, 129, 0.8)' : 'rgba(16, 185, 129, 0.7)')
              : (this.isDarkMode() ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.7)')
          ),
          borderColor: balanceData.map(val => val >= 0 ? '#10b981' : '#ef4444'),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: chartColors.tooltipBg,
            titleColor: chartColors.textColor,
            bodyColor: chartColors.textColor,
            borderColor: chartColors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => ` Balance: ${this.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              color: chartColors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          x: {
            ticks: {
              color: chartColors.textColor,
              font: { size: 10 }
            },
            grid: {
              display: false
            },
            border: {
              display: false
            }
          }
        }
      }
    });
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
