/**
 * DASHBOARD.JS - Dashboard Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { getCategories, setCategoriesCache, getCategoryName, getCategoryIcon as getDynamicCategoryIcon } from './utils.js';
import { Chart, registerables } from 'chart.js';
import {
  fetchDashboardSnapshot,
  fetchDashboardRecentTransactions,
  fetchDashboardCategoryBreakdown,
  fetchDashboardTrend7,
  fetchDashboardBudgetUsage,
  fetchDashboardBalance12Months,
  fetchCategories
} from './volakoApi.js';
import { withPageLoader } from './loaders.js';
import notify from './notifications.js';

Chart.register(...registerables);

class Dashboard {
  constructor() {
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.charts = {};
    this.snapshot = null;
    this.recentTransactions = [];
    this.categoryBreakdown = [];
    this.trend7 = [];
    this.budgetUsage = [];
    this.balance12m = [];
  }

  async init() {
    this.checkAuth();
    this.centerActiveBottomNavItem();

    try {
      const categories = await fetchCategories();
      setCategoriesCache(categories);
    } catch {
      // Utiliser le fallback statique si la BDD est inaccessible
    }

    await withPageLoader('transactions-list', async () => {
      await this.loadData();
      this.updateStats();
      this.loadRecentTransactions();
      this.setupEventListeners();
      this.initCharts();
    });
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  centerActiveBottomNavItem() {
    if (window.innerWidth > 1024) return;

    const activeItem = document.querySelector('.bottom-nav .bottom-nav-item.active');
    if (!activeItem) return;

    requestAnimationFrame(() => {
      activeItem.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest'
      });
    });
  }

  async loadData() {
    const results = await Promise.allSettled([
      fetchDashboardSnapshot(),
      fetchDashboardRecentTransactions(5),
      fetchDashboardCategoryBreakdown(),
      fetchDashboardTrend7(),
      fetchDashboardBudgetUsage(),
      fetchDashboardBalance12Months()
    ]);

    const [snapshotRes, recentRes, categoryRes, trendRes, budgetRes, balanceRes] = results;

    this.snapshot = snapshotRes.status === 'fulfilled' ? (snapshotRes.value || {}) : {};
    this.recentTransactions = recentRes.status === 'fulfilled' ? (recentRes.value || []) : [];
    this.categoryBreakdown = categoryRes.status === 'fulfilled' ? (categoryRes.value || []) : [];
    this.trend7 = trendRes.status === 'fulfilled' ? (trendRes.value || []) : [];
    this.budgetUsage = budgetRes.status === 'fulfilled' ? (budgetRes.value || []) : [];
    this.balance12m = balanceRes.status === 'fulfilled' ? (balanceRes.value || []) : [];

    const failedCount = results.filter(result => result.status === 'rejected').length;
    if (failedCount > 0) {
      notify.warning('Certaines donnees du dashboard sont indisponibles. Affichage partiel applique.');
    }
  }

  updateStats() {
    const s = this.snapshot || {};

    this.updateElement('balance-available-value', this.formatCurrency(s.available_balance || 0));
    this.updateElement('income-value', this.formatCurrency(s.total_income_month || 0));
    this.updateElement('expenses-value', this.formatCurrency(s.total_expenses_month || 0));
    this.updateElement('savings-value', this.formatCurrency(s.total_saved || 0));
    this.updateElement('savings-goals-count', s.savings_count || 0);
    this.updateElement('budget-value', this.formatCurrency(s.budget_remaining || 0));
  }

  loadRecentTransactions() {
    const listElement = document.getElementById('transactions-list');
    if (!listElement) return;

    const recent = this.recentTransactions || [];

    if (recent.length > 0) {
      listElement.innerHTML = recent.map(t => this.createTransactionHTML(t)).join('');
      return;
    }

    listElement.innerHTML = `
      <li class="transaction-item empty-state">
        <div class="transaction-info">
          <p style="text-align: center; color: var(--text-secondary); padding: 2rem;">Aucune transaction recente</p>
        </div>
      </li>
    `;
  }

  createTransactionHTML(transaction) {
    const icon = this.getCategoryIcon(transaction.category || 'income');
    const isExpense = transaction.tx_type === 'expense';
    const amount = isExpense ? `-${this.formatCurrency(transaction.amount)}` : `+${this.formatCurrency(transaction.amount)}`;
    const amountClass = isExpense ? 'expense' : 'income';
    const description = transaction.label || 'Transaction';
    const date = this.formatDate(transaction.date);
    const categoryLabel = transaction.tx_type === 'expense'
      ? getCategoryName(transaction.category)
      : 'Revenu';

    return `
      <li class="transaction-item">
        <div class="transaction-info">
          <div class="transaction-icon">${icon}</div>
          <div class="transaction-details">
            <h4>${description}</h4>
            <p>${date} • ${categoryLabel}</p>
          </div>
        </div>
        <div class="transaction-amount ${amountClass}">${amount}</div>
      </li>
    `;
  }

  getCategoryIcon(category) {
    if (category === 'income') return '💼';
    return getDynamicCategoryIcon(category);
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Aujourd hui';
    if (diff === 1) return 'Hier';
    if (diff < 7) return `Il y a ${diff} jours`;

    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  setupEventListeners() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        const auth = new Auth();
        auth.logout();
        window.location.href = '/';
      });
    }

    const addBtn = document.getElementById('add-transaction-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        window.location.href = '/expenses';
      });
    }

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

  initCharts() {
    this.createCategoryChart();
    this.createTrendChart();
    this.createBudgetChart();
    this.createBalanceChart();
  }

  updateCharts() {
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};
    this.initCharts();
  }

  isDarkMode() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  getChartColors() {
    const isDark = this.isDarkMode();
    return {
      textColor: isDark ? '#f1f5f9' : '#1f2937',
      gridColor: isDark ? '#475569' : '#e5e7eb',
      tooltipBg: isDark ? '#334155' : '#ffffff',
      tooltipBorder: isDark ? '#475569' : '#e5e7eb'
    };
  }

  createCategoryChart() {
    const canvas = document.getElementById('dashboard-category-chart');
    if (!canvas) return;

    const labels = [];
    const data = [];
    const colors = [];

    this.categoryBreakdown.forEach(row => {
      const category = getCategories().find(c => c.id === row.category);
      const icon = category?.icon || '📦';
      const name = category?.name || row.category || 'Autre';
      const color = category?.color || '#6b7280';
      labels.push(`${icon} ${name}`);
      data.push(Number(row.total || 0));
      colors.push(color);
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
              label: (context) => ` ${context.label}: ${this.formatCurrency(context.parsed)}`
            }
          }
        }
      }
    });
  }

  createTrendChart() {
    const canvas = document.getElementById('dashboard-trend-chart');
    if (!canvas) return;

    const labels = this.trend7.map(x => x.day_label);
    const incomeData = this.trend7.map(x => Number(x.income || 0));
    const expenseData = this.trend7.map(x => Number(x.expense || 0));

    const chartColors = this.getChartColors();

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenus',
            data: incomeData,
            borderColor: '#10b981',
            backgroundColor: this.isDarkMode() ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Depenses',
            data: expenseData,
            borderColor: '#ef4444',
            backgroundColor: this.isDarkMode() ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { labels: { color: chartColors.textColor } }
        },
        scales: {
          y: { ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },
          x: { ticks: { color: chartColors.textColor }, grid: { display: false } }
        }
      }
    });
  }

  createBudgetChart() {
    const canvas = document.getElementById('dashboard-budget-chart');
    if (!canvas) return;

    const labels = [];
    const spentData = [];
    const remainingData = [];
    const colors = [];

    this.budgetUsage.forEach(row => {
      const category = getCategories().find(c => c.id === row.category);
      const icon = category?.icon || '📦';
      const name = category?.name || row.category || 'Autre';
      const color = category?.color || '#6b7280';
      labels.push(`${icon} ${name}`);
      spentData.push(Number(row.spent || 0));
      remainingData.push(Number(row.remaining || 0));
      colors.push(color);
    });

    const chartColors = this.getChartColors();

    this.charts.budget = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Depense',
            data: spentData,
            backgroundColor: colors.map(c => c + (this.isDarkMode() ? 'DD' : 'CC')),
            borderColor: colors,
            borderWidth: 2
          },
          {
            label: 'Restant',
            data: remainingData,
            backgroundColor: this.isDarkMode() ? 'rgba(148, 163, 184, 0.4)' : 'rgba(229, 231, 235, 0.8)',
            borderWidth: 2
          }
        ]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { labels: { color: chartColors.textColor } } },
        scales: {
          x: { stacked: true, ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },
          y: { stacked: true, ticks: { color: chartColors.textColor }, grid: { display: false } }
        }
      }
    });
  }

  createBalanceChart() {
    const canvas = document.getElementById('dashboard-balance-chart');
    if (!canvas) return;

    const months = this.balance12m.map(x => x.month_label);
    const balanceData = this.balance12m.map(x => Number(x.balance || 0));
    const chartColors = this.getChartColors();

    this.charts.balance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: months,
        datasets: [{
          label: 'Balance',
          data: balanceData,
          backgroundColor: balanceData.map(v => v >= 0 ? 'rgba(16,185,129,0.75)' : 'rgba(239,68,68,0.75)'),
          borderColor: balanceData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: chartColors.textColor }, grid: { color: chartColors.gridColor } },
          x: { ticks: { color: chartColors.textColor }, grid: { display: false } }
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const dashboard = new Dashboard();
  await dashboard.init();
});

export default Dashboard;
