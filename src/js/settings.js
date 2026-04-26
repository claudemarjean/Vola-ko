/**
 * SETTINGS.JS - Settings Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav } from './components.js';
import ThemeManager from './theme.js';
import I18n from './i18n.js';
import notify from './notifications.js';
import { supabase, SUPABASE_TABLES } from './supabase.js';
import { fetchTable, upsertUserSettings } from './volakoApi.js';
import { ensureOnlineForCriticalAction } from './network.js';
import { withPageLoader, setButtonLoading, withGlobalLoader } from './loaders.js';

class SettingsManager {
  constructor() {
    this.auth = new Auth();
    this.themeManager = new ThemeManager();
  }

  async init() {
    this.checkAuth();
    renderSidebar('settings');
    renderBottomNav('settings');

    await withPageLoader('sidebar-container', async () => {
      this.loadUserInfo();
      this.setupEventListeners();
    });
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
    const nameInput = document.getElementById('profile-name-input');

    if (nameEl) nameEl.textContent = user.name;
    if (emailEl) emailEl.textContent = user.email;
    if (nameInput) nameInput.value = user.name || '';

    const currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    const currencySelect = document.getElementById('currency-selector');
    if (currencySelect) {
      currencySelect.value = currency;
    }
  }

  setupEventListeners() {
    const themeToggle = document.getElementById('theme-toggle-setting');
    if (themeToggle) {
      themeToggle.addEventListener('click', async () => {
        this.themeManager.toggleTheme();
        this.updateThemeButton(themeToggle);
        await this.persistSettings();
      });
      this.updateThemeButton(themeToggle);
    }

    const langSelect = document.getElementById('language-selector-setting');
    if (langSelect) {
      const currentLang = Storage.get(STORAGE_KEYS.LANGUAGE, 'fr');
      langSelect.value = currentLang;

      langSelect.addEventListener('change', async (e) => {
        const i18n = new I18n();
        await i18n.setLanguage(e.target.value);
        await this.persistSettings();
      });
    }

    const currencySelect = document.getElementById('currency-selector');
    if (currencySelect) {
      currencySelect.addEventListener('change', async (e) => {
        Storage.set(STORAGE_KEYS.CURRENCY, e.target.value);
        await this.persistSettings();
      });
    }

    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', async () => {
        setButtonLoading(exportBtn, true, 'Export...');
        try {
          await this.exportData();
        } finally {
          setButtonLoading(exportBtn, false);
        }
      });
    }

    const clearBtn = document.getElementById('clear-data-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        setButtonLoading(clearBtn, true, 'Suppression...');
        try {
          await this.clearData();
        } finally {
          setButtonLoading(clearBtn, false);
        }
      });
    }

    const logoutBtn = document.getElementById('logout-btn-settings');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        this.auth.logout();
        window.location.href = '/';
      });
    }

    const editNameBtn = document.getElementById('edit-name-btn');
    const cancelNameBtn = document.getElementById('cancel-name-btn');
    const profileNameForm = document.getElementById('profile-name-form');

    if (editNameBtn) {
      editNameBtn.addEventListener('click', () => this.toggleNameForm(true));
    }

    if (cancelNameBtn) {
      cancelNameBtn.addEventListener('click', () => this.toggleNameForm(false));
    }

    if (profileNameForm) {
      profileNameForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-name-btn');
        setButtonLoading(submitBtn, true, 'Enregistrement...');
        try {
          await this.saveProfileName();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }

    const passwordForm = document.getElementById('password-form');
    if (passwordForm) {
      passwordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-password-btn');
        setButtonLoading(submitBtn, true, 'Mise a jour...');
        try {
          await this.changePassword();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }
  }

  toggleNameForm(show) {
    const form = document.getElementById('profile-name-form');
    const input = document.getElementById('profile-name-input');
    if (!form) return;

    form.style.display = show ? 'block' : 'none';

    if (show && input) {
      input.focus();
      input.select();
    }

    if (!show) {
      this.loadUserInfo();
    }
  }

  async saveProfileName() {
    if (!ensureOnlineForCriticalAction('La modification du nom')) {
      return;
    }

    const input = document.getElementById('profile-name-input');
    const nextName = input?.value?.trim() || '';
    const currentName = this.auth.user?.name || '';

    if (nextName === currentName) {
      this.toggleNameForm(false);
      return;
    }

    const result = await withGlobalLoader(async () => {
      return this.auth.updateProfileName(nextName);
    }, { message: 'Mise a jour du profil...' });

    if (!result?.success) {
      return;
    }

    this.loadUserInfo();
    this.toggleNameForm(false);
    notify.success('Nom utilisateur mis a jour.');
  }

  async changePassword() {
    if (!ensureOnlineForCriticalAction('Le changement du mot de passe')) {
      return;
    }

    const currentPasswordInput = document.getElementById('current-password');
    const passwordInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');
    const currentPassword = currentPasswordInput?.value || '';
    const password = passwordInput?.value || '';
    const confirmPassword = confirmInput?.value || '';

    const result = await withGlobalLoader(async () => {
      return this.auth.updatePassword(currentPassword, password, confirmPassword);
    }, { message: 'Mise a jour du mot de passe...' });

    if (!result?.success) {
      return;
    }

    document.getElementById('password-form')?.reset();
  }

  updateThemeButton(button) {
    const currentTheme = Storage.get(STORAGE_KEYS.THEME, 'light');
    button.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  }

  async persistSettings() {
    try {
      await upsertUserSettings({
        theme: Storage.get(STORAGE_KEYS.THEME, 'light'),
        language: Storage.get(STORAGE_KEYS.LANGUAGE, 'fr'),
        currency: Storage.get(STORAGE_KEYS.CURRENCY, 'MGA')
      });
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Impossible de sauvegarder les parametres.');
      }
    }
  }

  async exportData() {
    if (!ensureOnlineForCriticalAction('L\'export des donnees')) {
      return;
    }

    const [incomes, expenses, budgets, savings, savingsTransactions] = await Promise.all([
      fetchTable(SUPABASE_TABLES.INCOMES),
      fetchTable(SUPABASE_TABLES.EXPENSES),
      fetchTable(SUPABASE_TABLES.BUDGETS),
      fetchTable(SUPABASE_TABLES.SAVINGS),
      fetchTable(SUPABASE_TABLES.SAVINGS_TRANSACTIONS)
    ]);

    const data = {
      incomes,
      expenses,
      budgets,
      savings,
      savingsTransactions,
      exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `volako-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    notify.success('Export termine.');
  }

  async clearData() {
    if (!ensureOnlineForCriticalAction('La suppression des donnees')) {
      return;
    }

    const confirmed = await notify.confirm(
      'Cette action est definitive. Voulez-vous supprimer toutes vos donnees ? ',
      'Suppression complete',
      {
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        type: 'error',
        danger: true
      }
    );

    if (!confirmed) {
      return;
    }

    const user = await withGlobalLoader(async () => {
      const { data: userResult } = await supabase.auth.getUser();
      return userResult?.user;
    }, { message: 'Verification du compte...' });

    if (!user) {
      notify.error('Utilisateur non connecte.');
      return;
    }

    try {
      await withGlobalLoader(async () => {
        await Promise.all([
          supabase.from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS).delete().eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.SAVINGS).delete().eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.INCOMES).delete().eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.EXPENSES).delete().eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.BUDGETS).delete().eq('user_id', user.id)
        ]);
      }, { message: 'Suppression des donnees...' });

      notify.success('Toutes les donnees ont ete supprimees.');
      window.location.href = '/dashboard';
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la suppression.');
    }
  }
}

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
