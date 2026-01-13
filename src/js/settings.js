/**
 * SETTINGS.JS - Settings Page Logic
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';
import { renderSidebar, renderBottomNav, showConfirmModal } from './components.js';
import ThemeManager from './theme.js';
import I18n from './i18n.js';
import notify from './notifications.js';
import { supabase, SUPABASE_TABLES, getCurrentUser } from './supabase.js';
import { syncManager } from './sync.js';

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
    // Créer une modal personnalisée avec 3 choix clairs
    const choice = await this.showDeleteDataModal();
    
    if (choice === 'cancel') {
      notify.info('Suppression annulée', 3000);
      return;
    }

    // Si l'utilisateur veut exporter d'abord
    if (choice === 'export-and-delete') {
      try {
        await this.exportData();
        notify.success('Données exportées avec succès !', 3000);
        // Petite pause pour que l'utilisateur voie la notification
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.error('Erreur lors de l\'export:', error);
        notify.error('Erreur lors de l\'export. Voulez-vous continuer la suppression ?');
        
        const continueAnyway = await notify.confirm(
          'L\'export a échoué. Voulez-vous quand même supprimer les données ?',
          '⚠️ Erreur d\'export',
          {
            confirmText: 'Supprimer quand même',
            cancelText: 'Annuler',
            type: 'error',
            danger: true
          }
        );
        
        if (!continueAnyway) {
          notify.info('Suppression annulée', 3000);
          return;
        }
      }
    }

    // Confirmation finale pour les deux cas (avec ou sans export)
    const finalConfirm = await notify.confirm(
      'Cette action est DÉFINITIVE et IRRÉVERSIBLE.\n\n' +
      'Toutes vos données seront supprimées :\n' +
      '• De cet appareil\n' +
      '• Du cloud Supabase\n\n' +
      'Êtes-vous ABSOLUMENT sûr ?',
      '🚨 Confirmation finale',
      {
        confirmText: 'OUI, TOUT SUPPRIMER',
        cancelText: 'Non, annuler',
        type: 'error',
        danger: true
      }
    );

    if (!finalConfirm) {
      notify.info('Suppression annulée', 3000);
      return;
    }

    try {
      // Afficher un message de chargement
      notify.info('Suppression en cours... Veuillez patienter.', 0);

      // Obtenir l'utilisateur actuel
      const user = await getCurrentUser();

      if (user) {
        console.log('🗑️ Suppression de toutes les données de Supabase...');

        // Supprimer toutes les données de Supabase avec gestion d'erreurs
        const deleteResults = await Promise.allSettled([
          supabase.from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS).delete().neq('user_id', '00000000-0000-0000-0000-000000000000').eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.SAVINGS).delete().neq('user_id', '00000000-0000-0000-0000-000000000000').eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.INCOMES).delete().neq('user_id', '00000000-0000-0000-0000-000000000000').eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.EXPENSES).delete().neq('user_id', '00000000-0000-0000-0000-000000000000').eq('user_id', user.id),
          supabase.from(SUPABASE_TABLES.BUDGETS).delete().neq('user_id', '00000000-0000-0000-0000-000000000000').eq('user_id', user.id)
        ]);

        // Vérifier les erreurs
        const errors = deleteResults.filter(r => r.status === 'rejected' || r.value?.error);
        if (errors.length > 0) {
          console.error('❌ Erreurs lors de la suppression:', errors);
          errors.forEach((err, index) => {
            console.error(`Table ${index}:`, err.reason || err.value?.error);
          });
        }

        console.log('✅ Toutes les données ont été supprimées de Supabase');
      } else {
        console.log('⚠️ Utilisateur non connecté, suppression uniquement locale');
      }

      // Supprimer toutes les données locales
      const keysToRemove = [
        STORAGE_KEYS.INCOMES,
        STORAGE_KEYS.EXPENSES,
        STORAGE_KEYS.BUDGETS,
        STORAGE_KEYS.SAVINGS,
        STORAGE_KEYS.SAVINGS_TRANSACTIONS
      ];
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('✅ Données locales supprimées');
      
      // Arrêter la synchronisation automatique
      syncManager.stopAutoSync();

      notify.success('Toutes les données ont été supprimées avec succès.', 3000);
      
      // Rediriger vers la page de connexion après suppression
      setTimeout(() => {
        window.location.href = '/login.html';
      }, 2000);

    } catch (error) {
      console.error('❌ Erreur lors de la suppression des données:', error);
      notify.error('Erreur lors de la suppression des données. Veuillez réessayer.', 5000);
    }
  }

  /**
   * Afficher une modal personnalisée avec 3 choix pour la suppression
   */
  async showDeleteDataModal() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'notification-modal-overlay notification-modal-enter';

      overlay.innerHTML = `
        <div class="notification-modal notification-modal-enter">
          <div class="notification-modal-header">
            <div class="notification-modal-icon" style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);">
              ⚠️
            </div>
            <h3 class="notification-modal-title">Supprimer toutes les données</h3>
          </div>
          <div class="notification-modal-body">
            <p class="notification-modal-message" style="white-space: pre-line;">
⚠️ ATTENTION : Cette action est irréversible !

Toutes vos données (revenus, dépenses, budgets, épargnes) seront définitivement supprimées de votre appareil ET du cloud.

💡 Conseil : Exportez vos données pour en garder une copie de sauvegarde.

Que voulez-vous faire ?
            </p>
          </div>
          <div class="notification-modal-footer" style="flex-direction: column; gap: var(--space-sm);">
            <button class="notification-modal-btn notification-modal-btn-primary" data-action="export-and-delete" style="width: 100%; background: #10b981;">
              📦 Exporter puis supprimer
            </button>
            <button class="notification-modal-btn notification-modal-btn-danger" data-action="delete-only" style="width: 100%;">
              🗑️ Supprimer sans exporter
            </button>
            <button class="notification-modal-btn notification-modal-btn-secondary" data-action="cancel" style="width: 100%;">
              ❌ Annuler
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(overlay);

      // Animation d'entrée
      setTimeout(() => {
        overlay.classList.remove('notification-modal-enter');
        const modal = overlay.querySelector('.notification-modal');
        if (modal) modal.classList.remove('notification-modal-enter');
      }, 10);

      // Gestion des clics sur les boutons
      const buttons = overlay.querySelectorAll('[data-action]');
      buttons.forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          
          // Animation de sortie
          overlay.classList.add('notification-modal-overlay-exit');
          const modal = overlay.querySelector('.notification-modal');
          if (modal) modal.classList.add('notification-modal-exit');
          
          setTimeout(() => {
            document.body.removeChild(overlay);
            resolve(action);
          }, 300);
        });
      });

      // Clic sur l'overlay pour annuler
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.classList.add('notification-modal-overlay-exit');
          const modal = overlay.querySelector('.notification-modal');
          if (modal) modal.classList.add('notification-modal-exit');
          
          setTimeout(() => {
            document.body.removeChild(overlay);
            resolve('cancel');
          }, 300);
        }
      });
    });
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
