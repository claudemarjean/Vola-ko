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
      <a href="/dashboard.html" class="nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-link>
        <span class="icon">🏠</span>
        <span data-i18n="nav.dashboard">Dashboard</span>
      </a>
      <a href="/expenses.html" class="nav-item ${activePage === 'expenses' ? 'active' : ''}" data-link>
        <span class="icon">💸</span>
        <span data-i18n="nav.expenses">Dépenses</span>
      </a>
      <a href="/incomes.html" class="nav-item ${activePage === 'incomes' ? 'active' : ''}" data-link>
        <span class="icon">💰</span>
        <span data-i18n="nav.incomes">Revenus</span>
      </a>
      <a href="/budgets.html" class="nav-item ${activePage === 'budgets' ? 'active' : ''}" data-link>
        <span class="icon">🎯</span>
        <span data-i18n="nav.budgets">Budgets</span>
      </a>
      <a href="/reports.html" class="nav-item ${activePage === 'reports' ? 'active' : ''}" data-link>
        <span class="icon">📊</span>
        <span data-i18n="nav.reports">Rapports</span>
      </a>
      <a href="/settings.html" class="nav-item ${activePage === 'settings' ? 'active' : ''}" data-link>
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
      window.location.href = '/index.html';
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
      <a href="/dashboard.html" class="bottom-nav-item ${activePage === 'dashboard' ? 'active' : ''}" data-link>
        <span class="icon">🏠</span>
        <span data-i18n="nav.dashboard_short">Dashboard</span>
      </a>
      <a href="/expenses.html" class="bottom-nav-item ${activePage === 'expenses' ? 'active' : ''}" data-link>
        <span class="icon">💸</span>
        <span data-i18n="nav.expenses_short">Dépenses</span>
      </a>
      <a href="/budgets.html" class="bottom-nav-item ${activePage === 'budgets' ? 'active' : ''}" data-link>
        <span class="icon">🎯</span>
        <span data-i18n="nav.budgets_short">Budgets</span>
      </a>
      <a href="/reports.html" class="bottom-nav-item ${activePage === 'reports' ? 'active' : ''}" data-link>
        <span class="icon">📊</span>
        <span data-i18n="nav.reports_short">Rapports</span>
      </a>
      <a href="/settings.html" class="bottom-nav-item ${activePage === 'settings' ? 'active' : ''}" data-link>
        <span class="icon">⚙️</span>
        <span data-i18n="nav.settings_short">Plus</span>
      </a>
    </div>
  `;
}
