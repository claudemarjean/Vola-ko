/**
 * REPORTS.JS - Reports Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';
import { getCategories, setCategoriesCache } from './utils.js';
import { Chart, registerables } from 'chart.js';
import {
  fetchReportsSummary,
  fetchReportsCategoryBreakdown,
  fetchReportsMonthlyComparison,
  fetchReportsExpenseTrend,
  fetchReportsTopExpenses,
  fetchReportsWeekly,
  fetchCategories
} from './volakoApi.js';
import { withPageLoader } from './loaders.js';
import notify from './notifications.js';

Chart.register(...registerables);

class ReportsManager {
  constructor() {
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentPeriod = 'month';
    this.charts = {};

    this.summary = null;
    this.categoryRows = [];
    this.comparisonRows = [];
    this.trendRows = [];
    this.topRows = [];
    this.weeklyRows = [];
  }

  async init() {
    this.checkAuth();
    renderSidebar('reports');
    renderBottomNav('reports');

    try {
      const categories = await fetchCategories();
      setCategoriesCache(categories);
    } catch {
      // Utiliser le fallback statique si la BDD est inaccessible
    }

    await this.loadData();
    this.updateStats();
    this.setupEventListeners();
    this.initCharts();
  }

  checkAuth() {
    const auth = new Auth();
    if (!auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  async loadData() {
    await withPageLoader('category-chart', async () => {
      try {
        const [summary, category, comparison, trend, top, weekly] = await Promise.all([
          fetchReportsSummary(this.currentPeriod),
          fetchReportsCategoryBreakdown(this.currentPeriod),
          fetchReportsMonthlyComparison(this.currentPeriod),
          fetchReportsExpenseTrend(this.currentPeriod),
          fetchReportsTopExpenses(this.currentPeriod),
          fetchReportsWeekly(this.currentPeriod)
        ]);

        this.summary = summary;
        this.categoryRows = category || [];
        this.comparisonRows = comparison || [];
        this.trendRows = trend || [];
        this.topRows = top || [];
        this.weeklyRows = weekly || [];
      } catch (error) {
        notify.error(error.message || 'Erreur de chargement des rapports.');
      }
    });
  }

  updateStats() {
    const totalIncome = Number(this.summary?.total_income || 0);
    const totalExpenses = Number(this.summary?.total_expenses || 0);
    const balance = Number(this.summary?.balance || 0);

    const incomeEl = document.getElementById('report-income');
    const expensesEl = document.getElementById('report-expenses');
    const balanceEl = document.getElementById('report-balance');

    if (incomeEl) incomeEl.textContent = this.formatCurrency(totalIncome);
    if (expensesEl) expensesEl.textContent = this.formatCurrency(totalExpenses);
    if (balanceEl) {
      balanceEl.textContent = this.formatCurrency(balance);
      balanceEl.style.color = balance >= 0 ? 'var(--color-success)' : 'var(--color-error)';
    }
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const periodSelect = document.getElementById('report-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', async (e) => {
        this.currentPeriod = e.target.value;
        await this.loadData();
        this.updateStats();
        this.updateCharts();
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
    this.createComparisonChart();
    this.createTrendChart();
    this.createTopExpensesChart();
    this.createWeeklyChart();
  }

  updateCharts() {
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};
    this.initCharts();
  }

  getCategoryColor(categoryId) {
    const category = getCategories().find(c => c.id === categoryId);
    return category ? category.color : '#6b7280';
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
    const canvas = document.getElementById('category-chart');
    if (!canvas) return;

    const colors = this.getChartColors();
    const labels = [];
    const data = [];
    const bgColors = [];

    this.categoryRows.forEach(row => {
      const category = getCategories().find(c => c.id === row.category);
      const icon = category?.icon || '📦';
      const name = category?.name || row.category || 'Autre';
      const color = category?.color || '#6b7280';
      labels.push(`${icon} ${name}`);
      data.push(Number(row.total || 0));
      bgColors.push(color);
    });

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 3,
          borderColor: this.isDarkMode() ? '#1e293b' : '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: colors.textColor }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1
          }
        }
      }
    });
  }

  createComparisonChart() {
    const canvas = document.getElementById('comparison-chart');
    if (!canvas) return;

    const colors = this.getChartColors();
    const labels = this.comparisonRows.map(r => r.month_label);
    const incomeData = this.comparisonRows.map(r => Number(r.income || 0));
    const expenseData = this.comparisonRows.map(r => Number(r.expense || 0));

    this.charts.comparison = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenus',
            data: incomeData,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#10b981',
            borderWidth: 2
          },
          {
            label: 'Depenses',
            data: expenseData,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderColor: '#ef4444',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colors.textColor } } },
        scales: {
          y: { ticks: { color: colors.textColor }, grid: { color: colors.gridColor } },
          x: { ticks: { color: colors.textColor }, grid: { display: false } }
        }
      }
    });
  }

  createTrendChart() {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    const colors = this.getChartColors();
    const labels = this.trendRows.map(r => r.day_label);
    const data = this.trendRows.map(r => Number(r.amount || 0));
    const cumulative = this.trendRows.map(r => Number(r.cumulative || 0));

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Depenses quotidiennes',
            data,
            borderColor: '#3b82f6',
            backgroundColor: this.isDarkMode() ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          },
          {
            label: 'Cumulatif',
            data: cumulative,
            borderColor: '#8b5cf6',
            backgroundColor: this.isDarkMode() ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colors.textColor } } },
        scales: {
          y: { ticks: { color: colors.textColor }, grid: { color: colors.gridColor } },
          x: { ticks: { color: colors.textColor }, grid: { display: false } }
        }
      }
    });
  }

  createTopExpensesChart() {
    const canvas = document.getElementById('top-expenses-chart');
    if (!canvas) return;

    const colors = this.getChartColors();
    const labels = this.topRows.map(exp => {
      const category = getCategories().find(c => c.id === exp.category);
      return `${category?.icon || '📦'} ${exp.description}`;
    });
    const data = this.topRows.map(exp => Number(exp.amount || 0));
    const bgColors = this.topRows.map(exp => this.getCategoryColor(exp.category));

    this.charts.topExpenses = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors.map(c => c + (this.isDarkMode() ? 'DD' : 'CC')),
          borderColor: bgColors,
          borderWidth: 2
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: colors.textColor }, grid: { color: colors.gridColor } },
          y: { ticks: { color: colors.textColor }, grid: { display: false } }
        }
      }
    });
  }

  createWeeklyChart() {
    const canvas = document.getElementById('weekly-chart');
    if (!canvas) return;

    const colors = this.getChartColors();
    const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const weeklyData = new Array(7).fill(0);

    this.weeklyRows.forEach(row => {
      const index = Number(row.weekday || 0);
      weeklyData[index] = Number(row.total || 0);
    });

    const gradientColors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316'];

    this.charts.weekly = new Chart(canvas, {
      type: 'polarArea',
      data: {
        labels: daysOfWeek,
        datasets: [{
          data: weeklyData,
          backgroundColor: gradientColors.map(c => c + (this.isDarkMode() ? '99' : '80')),
          borderColor: gradientColors,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: colors.textColor } } },
        scales: {
          r: {
            grid: { color: colors.gridColor },
            angleLines: { color: colors.gridColor },
            pointLabels: { color: colors.textColor }
          }
        }
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    const manager = new ReportsManager();
    await manager.init();
  });
} else {
  const manager = new ReportsManager();
  manager.init();
}

export default ReportsManager;
