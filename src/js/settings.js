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
import {
  fetchTable,
  upsertUserSettings,
  fetchCategories,
  createCustomCategory,
  deleteCustomCategory
} from './volakoApi.js';
import { ensureOnlineForCriticalAction } from './network.js';
import { withPageLoader, setButtonLoading, withGlobalLoader } from './loaders.js';
import { setCategoriesCache, getCategories } from './utils.js';

class SettingsManager {
  constructor() {
    this.auth = new Auth();
    this.themeManager = new ThemeManager();
    this.categories = [];
  }

  async init() {
    this.checkAuth();
    renderSidebar('settings');
    renderBottomNav('settings');

    await withPageLoader('sidebar-container', async () => {
      this.loadUserInfo();
      await this.loadCategories();
      this.setupEventListeners();
    });
  }

  async loadCategories() {
    try {
      this.categories = await fetchCategories();
      setCategoriesCache(this.categories);
    } catch {
      this.categories = getCategories();
    }

    this.renderCategoryLists();
  }

  renderCategoryLists() {
    const defaultList = document.getElementById('default-categories-list');
    const customList = document.getElementById('custom-categories-list');
    if (!defaultList || !customList) return;

    const defaults = this.categories.filter(cat => cat.is_default);
    const customs = this.categories.filter(cat => !cat.is_default);

    defaultList.innerHTML = defaults
      .map(cat => `<span class="settings-lock-badge" style="display:inline-flex; align-items:center; gap:0.35rem;"><span>${cat.icon}</span><span>${this.escapeHtml(cat.name)}</span></span>`)
      .join('');

    if (customs.length === 0) {
      customList.innerHTML = '<p style="color: var(--text-secondary);">Aucune categorie personnalisee pour le moment.</p>';
      return;
    }

    customList.innerHTML = customs
      .map(cat => `
        <div class="settings-item" style="margin:0; border:1px solid var(--border-color); border-radius: var(--radius-lg); padding:0.6rem 0.8rem;">
          <div class="settings-item-info">
            <span class="settings-icon" style="background:${this.escapeHtml(cat.color)}; color:#fff;">${this.escapeHtml(cat.icon)}</span>
            <div>
              <h4>${this.escapeHtml(cat.name)}</h4>
              <p>${this.escapeHtml(cat.id)}</p>
            </div>
          </div>
          <div class="settings-item-control">
            <button class="btn btn-outline btn-sm danger delete-custom-category-btn" data-db-id="${cat.db_id}">Supprimer</button>
          </div>
        </div>
      `)
      .join('');
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
      logoutBtn.addEventListener('click', async () => {
        logoutBtn.disabled = true;
        await this.auth.logout();
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

    const categoryForm = document.getElementById('custom-category-form');
    if (categoryForm) {
      categoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('save-custom-category-btn');
        setButtonLoading(submitBtn, true, 'Ajout...');
        try {
          await this.addCustomCategory();
        } finally {
          setButtonLoading(submitBtn, false);
        }
      });
    }

    const customList = document.getElementById('custom-categories-list');
    if (customList) {
      customList.addEventListener('click', async (e) => {
        const btn = e.target.closest('.delete-custom-category-btn');
        if (!btn) return;
        const dbId = btn.dataset.dbId;
        if (!dbId) return;
        await this.removeCustomCategory(dbId);
      });
    }
  }

  slugifyCategoryName(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
  }

  async addCustomCategory() {
    if (!ensureOnlineForCriticalAction('Ajout de categorie personnalisee')) {
      return;
    }

    const nameInput = document.getElementById('custom-category-name');
    const iconInput = document.getElementById('custom-category-icon');
    const colorInput = document.getElementById('custom-category-color');

    const name = nameInput?.value?.trim() || '';
    const icon = iconInput?.value?.trim() || '📦';
    const color = colorInput?.value || '#6b7280';
    const slug = this.slugifyCategoryName(name);

    if (!name || slug.length < 2) {
      notify.error('Nom de categorie invalide.');
      return;
    }

    const exists = this.categories.some(cat => cat.id === slug);
    if (exists) {
      notify.error('Cette categorie existe deja.');
      return;
    }

    const nextSortOrder = this.categories.reduce((max, cat) => Math.max(max, Number(cat.sort_order || 0)), 0) + 1;

    try {
      await createCustomCategory({
        slug,
        name,
        icon,
        color,
        sort_order: nextSortOrder
      });

      document.getElementById('custom-category-form')?.reset();
      const iconReset = document.getElementById('custom-category-icon');
      const colorReset = document.getElementById('custom-category-color');
      if (iconReset) iconReset.value = '📦';
      if (colorReset) colorReset.value = '#6b7280';

      await this.loadCategories();
      notify.success('Categorie personnalisee ajoutee.');
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Impossible d ajouter la categorie.');
      }
    }
  }

  async removeCustomCategory(categoryDbId) {
    if (!ensureOnlineForCriticalAction('Suppression de categorie personnalisee')) {
      return;
    }

    const confirmed = await notify.confirm(
      'Supprimer cette categorie personnalisee ? Les depenses existantes garderont leur slug en base.',
      'Suppression categorie',
      {
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        type: 'warning',
        danger: true
      }
    );

    if (!confirmed) return;

    try {
      await deleteCustomCategory(categoryDbId);
      await this.loadCategories();
      notify.success('Categorie personnalisee supprimee.');
    } catch (error) {
      if (error.message !== 'MODE_HORS_LIGNE') {
        notify.error(error.message || 'Impossible de supprimer la categorie.');
      }
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

    const [incomes, expenses, budgets, savings, savingsTransactions, categories] = await Promise.all([
      fetchTable(SUPABASE_TABLES.INCOMES),
      fetchTable(SUPABASE_TABLES.EXPENSES),
      fetchTable(SUPABASE_TABLES.BUDGETS),
      fetchTable(SUPABASE_TABLES.SAVINGS),
      fetchTable(SUPABASE_TABLES.SAVINGS_TRANSACTIONS),
      fetchTable(SUPABASE_TABLES.CATEGORIES)
    ]);

    const data = {
      incomes,
      expenses,
      budgets,
      savings,
      savingsTransactions,
      categories,
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
          supabase.from(SUPABASE_TABLES.BUDGETS).delete().eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.CATEGORIES).delete().eq('user_id', user.id)
        ]);
      }, { message: 'Suppression des donnees...' });

      notify.success('Toutes les donnees ont ete supprimees.');
      window.location.href = '/dashboard';
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la suppression.');
    }
  }

  escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const manager = new SettingsManager();
  manager.init();
});

export default SettingsManager;
