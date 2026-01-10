/**
 * REPORTS.JS - Reports Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';
import { CATEGORIES } from './utils.js';
import { Chart, registerables } from 'chart.js';

// Register Chart.js components
Chart.register(...registerables);

class ReportsManager {
  constructor() {
    this.expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    this.incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    this.currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    this.currentPeriod = 'month';
    this.charts = {};
  }

  init() {
    this.checkAuth();
    renderSidebar('reports');
    renderBottomNav('reports');
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

  updateStats() {
    const { incomes, expenses } = this.getFilteredData();

    const totalIncome = incomes.reduce((sum, inc) => sum + parseFloat(inc.amount), 0);
    const totalExpenses = expenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
    const balance = totalIncome - totalExpenses;

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

  getFilteredData() {
    const now = new Date();
    let startDate;

    if (this.currentPeriod === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (this.currentPeriod === 'quarter') {
      // Rolling 3 months to include a quarter spanning last year if applicable
      startDate = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    } else if (this.currentPeriod === 'last12' || this.currentPeriod === 'year') {
      // Rolling 12 months so l'année dernière est incluse
      startDate = new Date(now.getFullYear() - 1, now.getMonth(), 1);
    }

    const filterByDate = (item) => new Date(item.date) >= startDate;

    return {
      incomes: this.incomes.filter(filterByDate),
      expenses: this.expenses.filter(filterByDate)
    };
  }

  formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR').format(amount) + ' ' + this.currency;
  }

  setupEventListeners() {
    const periodSelect = document.getElementById('report-period');
    if (periodSelect) {
      periodSelect.addEventListener('change', (e) => {
        this.currentPeriod = e.target.value;
        this.updateStats();
        this.updateCharts();
      });
    }

    // Listen for theme changes
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
    // Destroy existing charts
    Object.values(this.charts).forEach(chart => chart?.destroy());
    this.charts = {};
    
    // Recreate charts with new data
    this.initCharts();
  }

  getCategoryColor(categoryId) {
    const category = CATEGORIES.find(c => c.id === categoryId);
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

    const { expenses } = this.getFilteredData();
    const colors = this.getChartColors();
    
    // Group expenses by category
    const categoryTotals = {};
    expenses.forEach(expense => {
      const cat = expense.category || 'autre';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + parseFloat(expense.amount);
    });

    const labels = [];
    const data = [];
    const bgColors = [];

    Object.entries(categoryTotals).forEach(([catId, total]) => {
      const category = CATEGORIES.find(c => c.id === catId);
      if (category) {
        labels.push(`${category.icon} ${category.name}`);
        data.push(total);
        bgColors.push(category.color);
      }
    });

    this.charts.category = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: bgColors,
          borderWidth: 3,
          borderColor: this.isDarkMode() ? '#1e293b' : '#ffffff',
          hoverOffset: 10,
          hoverBorderWidth: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 15,
              font: { size: 12, weight: '500' },
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            callbacks: {
              label: (context) => {
                const value = context.parsed;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${this.formatCurrency(value)} (${percentage}%)`;
              }
            }
          }
        }
      }
    });
  }

  createComparisonChart() {
    const canvas = document.getElementById('comparison-chart');
    if (!canvas) return;

    const { incomes, expenses } = this.getFilteredData();
    const colors = this.getChartColors();
    
    // Group by month+year to avoid merging months across different years
    const monthlyData = {};
    
    incomes.forEach(income => {
      const d = new Date(income.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
      monthlyData[key].income += parseFloat(income.amount);
    });

    expenses.forEach(expense => {
      const d = new Date(expense.date);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!monthlyData[key]) monthlyData[key] = { income: 0, expense: 0, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }) };
      monthlyData[key].expense += parseFloat(expense.amount);
    });

    const sortedKeys = Object.keys(monthlyData).sort((a, b) => {
      const [ay, am] = a.split('-').map(Number);
      const [by, bm] = b.split('-').map(Number);
      return new Date(ay, am, 1) - new Date(by, bm, 1);
    });

    const labels = sortedKeys.map(key => monthlyData[key].label);
    const incomeData = sortedKeys.map(key => monthlyData[key].income);
    const expenseData = sortedKeys.map(key => monthlyData[key].expense);

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
            borderWidth: 2,
            borderRadius: 8
          },
          {
            label: 'Dépenses',
            data: expenseData,
            backgroundColor: 'rgba(239, 68, 68, 0.85)',
            borderColor: '#ef4444',
            borderWidth: 2,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              font: { size: 12, weight: '500' },
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: colors.textColor,
              font: { size: 11 }
            },
            grid: {
              color: colors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          x: {
            ticks: {
              color: colors.textColor,
              font: { size: 11 }
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

  createTrendChart() {
    const canvas = document.getElementById('trend-chart');
    if (!canvas) return;

    const { expenses } = this.getFilteredData();
    const colors = this.getChartColors();
    
    // Sort by date
    const sortedExpenses = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Group by date
    const dailyTotals = {};
    sortedExpenses.forEach(expense => {
      const date = new Date(expense.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: '2-digit' });
      dailyTotals[date] = (dailyTotals[date] || 0) + parseFloat(expense.amount);
    });

    const labels = Object.keys(dailyTotals);
    const data = Object.values(dailyTotals);

    // Calculate cumulative
    const cumulative = [];
    let sum = 0;
    data.forEach(value => {
      sum += value;
      cumulative.push(sum);
    });

    this.charts.trend = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Dépenses quotidiennes',
            data,
            borderColor: '#3b82f6',
            backgroundColor: this.isDarkMode() ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#3b82f6',
            pointBorderColor: this.isDarkMode() ? '#1e293b' : '#ffffff',
            pointBorderWidth: 2
          },
          {
            label: 'Cumulatif',
            data: cumulative,
            borderColor: '#8b5cf6',
            backgroundColor: this.isDarkMode() ? 'rgba(139, 92, 246, 0.2)' : 'rgba(139, 92, 246, 0.1)',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 7,
            pointBackgroundColor: '#8b5cf6',
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
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle',
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => `${context.dataset.label}: ${this.formatCurrency(context.parsed.y)}`
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: colors.textColor,
              font: { size: 11 }
            },
            grid: {
              color: colors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
              color: colors.textColor,
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

  createTopExpensesChart() {
    const canvas = document.getElementById('top-expenses-chart');
    if (!canvas) return;

    const { expenses } = this.getFilteredData();
    const colors = this.getChartColors();
    
    // Get top 5 expenses
    const top5 = [...expenses]
      .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
      .slice(0, 5);

    const labels = top5.map(exp => {
      const category = CATEGORIES.find(c => c.id === exp.category);
      return `${category?.icon || '📦'} ${exp.description}`;
    });
    const data = top5.map(exp => parseFloat(exp.amount));
    const bgColors = top5.map(exp => this.getCategoryColor(exp.category));

    this.charts.topExpenses = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Montant',
          data,
          backgroundColor: bgColors.map(c => c + (this.isDarkMode() ? 'DD' : 'CC')),
          borderColor: bgColors,
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => this.formatCurrency(context.parsed.x)
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => new Intl.NumberFormat('fr-FR', { notation: 'compact' }).format(value),
              color: colors.textColor,
              font: { size: 11 }
            },
            grid: {
              color: colors.gridColor,
              drawBorder: false
            },
            border: {
              display: false
            }
          },
          y: {
            ticks: {
              color: colors.textColor,
              font: { size: 11 }
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

  createWeeklyChart() {
    const canvas = document.getElementById('weekly-chart');
    if (!canvas) return;

    const { expenses } = this.getFilteredData();
    const colors = this.getChartColors();
    
    // Group by day of week
    const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const weeklyData = new Array(7).fill(0);

    expenses.forEach(expense => {
      const dayIndex = new Date(expense.date).getDay();
      weeklyData[dayIndex] += parseFloat(expense.amount);
    });

    const gradientColors = [
      '#ef4444', '#f59e0b', '#10b981', '#3b82f6', 
      '#8b5cf6', '#ec4899', '#f97316'
    ];

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
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 10,
              font: { size: 11, weight: '500' },
              color: colors.textColor,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            backgroundColor: colors.tooltipBg,
            titleColor: colors.textColor,
            bodyColor: colors.textColor,
            borderColor: colors.tooltipBorder,
            borderWidth: 1,
            padding: 12,
            boxPadding: 6,
            callbacks: {
              label: (context) => `${context.label}: ${this.formatCurrency(context.parsed.r)}`
            }
          }
        },
        scales: {
          r: {
            ticks: {
              display: false
            },
            grid: {
              color: colors.gridColor
            },
            angleLines: {
              color: colors.gridColor
            },
            pointLabels: {
              color: colors.textColor,
              font: { size: 11 }
            }
          }
        }
      }
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new ReportsManager();
    manager.init();
  });
} else {
  const manager = new ReportsManager();
  manager.init();
}

export default ReportsManager;
