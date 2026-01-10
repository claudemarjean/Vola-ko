/**
 * COMPONENTS.JS - Reusable UI Components
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import Auth from './auth.js';

/**
 * Render Sidebar Navigation
 */
export function renderSidebar(activePage = '') {
  const container = document.getElementById('sidebar-container');
  if (!container) return;

  const auth = new Auth();
  const user = auth.user || { name: 'Utilisateur' };

  container.innerHTML = `
    <div class="sidebar-logo" data-i18n="app.name">Vola-ko</div>
    
    <nav class="sidebar-nav">
      <a href="/dashboard" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-link>
        <span class="icon">🏠</span>
        <span data-i18n="nav.dashboard">Dashboard</span>
      </a>
      <a href="/expenses" class="nav-item ${activePage === 'expenses' ? 'active' : ''}" data-link>
        <span class="icon">💸</span>
        <span data-i18n="nav.expenses">Dépenses</span>
      </a>
      <a href="/incomes" class="nav-item ${activePage === 'incomes' ? 'active' : ''}" data-link>
        <span class="icon">💰</span>
        <span data-i18n="nav.incomes">Revenus</span>
      </a>
      <a href="/budgets" class="nav-item ${activePage === 'budgets' ? 'active' : ''}" data-link>
        <span class="icon">🎯</span>
        <span data-i18n="nav.budgets">Budgets</span>
      </a>
      <a href="/savings" class="nav-item ${activePage === 'savings' ? 'active' : ''}" data-link>
        <span class="icon">💾</span>
        <span data-i18n="nav.savings">Épargne</span>
      </a>
      <a href="/reports" class="nav-item ${activePage === 'reports' ? 'active' : ''}" data-link>
        <span class="icon">📊</span>
        <span data-i18n="nav.reports">Rapports</span>
      </a>
      <a href="/settings" class="nav-item ${activePage === 'settings' ? 'active' : ''}" data-link>
        <span class="icon">⚙️</span>
        <span data-i18n="nav.settings">Paramètres</span>
      </a>
    </nav>

    <div class="sidebar-footer">
      <div class="header-actions">
        <select id="language-selector" aria-label="Choisir la langue">
          <option value="fr">🇫🇷 FR</option>
          <option value="mg">🇲🇬 MG</option>
        </select>
        
        <button id="theme-toggle" class="btn btn-secondary" aria-label="Changer de thème">
          🌙
        </button>
      </div>
      
      <button id="logout-btn" class="btn btn-outline" style="width: 100%; margin-top: var(--space-md);" data-i18n="nav.logout">
        Déconnexion
      </button>
    </div>
  `;

  // Setup logout
  const logoutBtn = container.querySelector('#logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      auth.logout();
      window.location.href = '/';
    });
  }
}

/**
 * Render Bottom Navigation (Mobile)
 */
export function renderBottomNav(activePage = '') {
  const container = document.getElementById('bottom-nav');
  if (!container) return;

  container.innerHTML = `
    <div class="bottom-nav-items">
      <a href="/dashboard" class="bottom-nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-link>
        <span class="icon">🏠</span>
        <span data-i18n="nav.dashboard_short">Dashboard</span>
      </a>
      <a href="/expenses" class="bottom-nav-item ${activePage === 'expenses' ? 'active' : ''}" data-link>
        <span class="icon">💸</span>
        <span data-i18n="nav.expenses_short">Dépenses</span>
      </a>
      <a href="/incomes" class="bottom-nav-item ${activePage === 'incomes' ? 'active' : ''}" data-link>
        <span class="icon">💰</span>
        <span data-i18n="nav.incomes_short">Revenus</span>
      </a>
      <a href="/budgets" class="bottom-nav-item ${activePage === 'budgets' ? 'active' : ''}" data-link>
        <span class="icon">🎯</span>
        <span data-i18n="nav.budgets_short">Budgets</span>
      </a>
      <a href="/savings" class="bottom-nav-item ${activePage === 'savings' ? 'active' : ''}" data-link>
        <span class="icon">💾</span>
        <span data-i18n="nav.savings_short">Épargne</span>
      </a>
      <a href="/reports" class="bottom-nav-item ${activePage === 'reports' ? 'active' : ''}" data-link>
        <span class="icon">📊</span>
        <span data-i18n="nav.reports_short">Rapports</span>
      </a>
      <a href="/settings" class="bottom-nav-item ${activePage === 'settings' ? 'active' : ''}" data-link>
        <span class="icon">⚙️</span>
        <span data-i18n="nav.settings_short">Plus</span>
      </a>
    </div>
  `;
}

/**
 * Show Custom Confirmation Modal
 */
export function showConfirmModal(message, options = {}) {
  return new Promise((resolve) => {
    const {
      title = '⚠️ Confirmation',
      confirmText = 'Confirmer',
      cancelText = 'Annuler',
      confirmClass = 'btn-error',
      danger = false
    } = options;

    // Remove existing modal if any
    const existingModal = document.querySelector('.custom-modal-overlay');
    if (existingModal) {
      existingModal.remove();
    }

    // Create modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
      <div class="custom-modal">
        <div class="custom-modal-header">
          <h3 class="custom-modal-title">${title}</h3>
        </div>
        <div class="custom-modal-body">
          <p>${message}</p>
        </div>
        <div class="custom-modal-actions">
          <button class="btn btn-outline custom-modal-cancel">${cancelText}</button>
          <button class="btn ${danger ? 'btn-error' : confirmClass} custom-modal-confirm">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Add event listeners
    const confirmBtn = overlay.querySelector('.custom-modal-confirm');
    const cancelBtn = overlay.querySelector('.custom-modal-cancel');

    const closeModal = (result) => {
      overlay.classList.add('fade-out');
      setTimeout(() => {
        overlay.remove();
        resolve(result);
      }, 200);
    };

    confirmBtn.addEventListener('click', () => closeModal(true));
    cancelBtn.addEventListener('click', () => closeModal(false));
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal(false);
    });

    // Keyboard support
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        closeModal(false);
        document.removeEventListener('keydown', handleKeydown);
      } else if (e.key === 'Enter') {
        closeModal(true);
        document.removeEventListener('keydown', handleKeydown);
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // Trigger animation
    setTimeout(() => overlay.classList.add('show'), 10);
  });
}
