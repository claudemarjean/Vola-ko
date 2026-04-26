/**
 * THEME.JS - Theme Management (Light/Dark Mode)
 * Gestion du thème clair/sombre avec sauvegarde des préférences
 */

import { Storage, STORAGE_KEYS } from './storage.js';

class ThemeManager {
  constructor() {
    this.currentTheme = this.initTheme();
    this.setupThemeToggle();
  }

  /**
   * Initialiser le thème au chargement
   */
  initTheme() {
    // Vérifier la préférence sauvegardée
    const savedTheme = Storage.get(STORAGE_KEYS.THEME);
    
    // Sinon, vérifier la préférence système
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    this.applyTheme(theme);
    return theme;
  }

  /**
   * Appliquer le thème
   */
  applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    this.currentTheme = theme;
    Storage.set(STORAGE_KEYS.THEME, theme);
    
    // Mettre à jour l'icône du bouton toggle
    this.updateToggleIcon();
  }

  /**
   * Basculer entre les thèmes
   */
  toggleTheme() {
    const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }

  /**
   * Configurer le bouton de bascule du thème
   */
  setupThemeToggle() {
    const toggleBtn = document.getElementById('theme-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => this.toggleTheme());
      this.updateToggleIcon();
    }
  }

  /**
   * Mettre à jour l'icône du bouton toggle
   */
  updateToggleIcon() {
    const icon = this.currentTheme === 'light' ? '🌙' : '☀️';
    const text = this.currentTheme === 'light' ? 'Mode sombre' : 'Mode clair';

    ['theme-toggle', 'theme-toggle-mobile', 'theme-toggle-setting'].forEach((buttonId) => {
      const toggleBtn = document.getElementById(buttonId);
      if (!toggleBtn) return;

      toggleBtn.innerHTML = `<span aria-hidden="true">${icon}</span>`;
      toggleBtn.setAttribute('aria-label', text);
      toggleBtn.setAttribute('title', text);
    });
  }

  /**
   * Obtenir le thème actuel
   */
  getTheme() {
    return this.currentTheme;
  }
}

export default ThemeManager;
