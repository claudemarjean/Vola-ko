/**
 * SETTINGS.JS - Settings Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import ThemeManager from './theme.js';
import I18n from './i18n.js';
import notify from './notifications.js';

class SettingsManager {
  constructor() {
    this.auth = new Auth();
    this.themeManager = new ThemeManager();
  }

  async init() {
    this.checkAuth();
    renderSidebar('settings');
    renderBottomNav('settings');
    this.loadUserInfo();
    this.setupEventListeners();
  }

  checkAuth() {
    if (!this.auth.isAuthenticated()) {
      window.location.href = '/login';
    }
  }

  loadUserInfo() {
    const user = this.auth.user || { name: 'Utilisateur', email: 'user@example.com' };
    
    const nameEl = document.getElementById('user-name');
    const emailEl = document.getElementById('user-email');

    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;

    // Load currency
    const currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    const currencySelect = document.getElementById('currency-selector');
    if (currencySelect) {
      currencySelect.value = currency;
    }
  }

  setupEventListeners() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle-setting');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        this.themeManager.toggleTheme();
        this.updateThemeButton(themeToggle);
      });
      this.updateThemeButton(themeToggle);
    }

    // Language selector
    const langSelect = document.getElementById('language-selector-setting');
    if (langSelect) {
      const currentLang = Storage.get(STORAGE_KEYS.LANGUAGE, 'fr');
      langSelect.value = currentLang;
      
      langSelect.addEventListener('change', async (e) => {
        const i18n = new I18n();
        await i18n.setLanguage(e.target.value);
      });
    }

    // Currency selector
    const currencySelect = document.getElementById('currency-selector');
    if (currencySelect) {
      currencySelect.addEventListener('change', (e) => {
        Storage.set(STORAGE_KEYS.CURRENCY, e.target.value);
      });
    }

    // Export data
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportData());
    }

    // Clear data
    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearData());
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn-settings');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.auth.logout();
        window.location.href = '/';
      });
    }
  }

  updateThemeButton(button) {
    const currentTheme = Storage.get(STORAGE_KEYS.THEME, 'light');
    button.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  }

  exportData() {
    const data = {
      expenses: Storage.get(STORAGE_KEYS.EXPENSES, []),
      incomes: Storage.get(STORAGE_KEYS.INCOMES, []),
      budgets: Storage.get(STORAGE_KEYS.BUDGETS, []),
      savings: Storage.get(STORAGE_KEYS.SAVINGS, []),
      savingsTransactions: Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []),
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volako-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async clearData() {
    const firstConfirm = await notify.confirm(
      'Cette action supprimera toutes vos données locales (dépenses, revenus, budgets, épargnes). Êtes-vous sûr ?',
      '⚠️ Attention !',
      {
        confirmText: 'Continuer',
        cancelText: 'Annuler',
        type: 'warning',
        danger: true
      }
    );

    if (firstConfirm) {
      const secondConfirm = await notify.confirm(
        'Voulez-vous vraiment supprimer toutes les données ?',
        '⚠️ Dernière confirmation',
        {
          confirmText: 'Supprimer',
          cancelText: 'Annuler',
          type: 'error',
          danger: true
        }
      );

      if (secondConfirm) {
        // Supprimer toutes les données de l'application
        Storage.clear();
        notify.success('Toutes les données ont été supprimées.');
        // Rediriger vers la page de connexion après suppression
        setTimeout(() => window.location.href = '/login', 1500);
      }
    }
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const manager = new SettingsManager();
    manager.init();
  });
} else {
  const manager = new SettingsManager();
  manager.init();
}

export default SettingsManager;
