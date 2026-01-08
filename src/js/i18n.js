/**
 * I18N.JS - Internationalization
 * Gestion du multilingue (FR/MG)
 */

import { Storage, STORAGE_KEYS } from './storage.js';

class I18n {
  constructor() {
    this.currentLanguage = Storage.get(STORAGE_KEYS.LANGUAGE, 'fr');
    this.translations = {};
    this.fallbackLanguage = 'fr';
  }

  /**
   * Initialiser le système i18n
   */
  async init() {
    await this.loadTranslations(this.currentLanguage);
    this.updatePageContent();
    this.setupLanguageSelector();
  }

  /**
   * Charger les traductions pour une langue
   */
  async loadTranslations(lang) {
    try {
      const response = await fetch(`/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Failed to load ${lang}`);
      
      this.translations = await response.json();
      return true;
    } catch (error) {
      console.error(`Error loading translations for ${lang}:`, error);
      
      // Fallback vers la langue par défaut
      if (lang !== this.fallbackLanguage) {
        return this.loadTranslations(this.fallbackLanguage);
      }
      return false;
    }
  }

  /**
   * Obtenir une traduction par clé
   */
  t(key, params = {}) {
    const keys = key.split('.');
    let value = this.translations;

    // Parcourir les clés imbriquées
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        console.warn(`Translation key not found: ${key}`);
        return key;
      }
    }

    // Remplacer les paramètres
    if (typeof value === 'string') {
      return this.interpolate(value, params);
    }

    return value;
  }

  /**
   * Interpoler les paramètres dans une chaîne
   */
  interpolate(str, params) {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return params[key] !== undefined ? params[key] : match;
    });
  }

  /**
   * Changer de langue
   */
  async changeLanguage(lang) {
    if (lang === this.currentLanguage) return;

    await this.loadTranslations(lang);
    this.currentLanguage = lang;
    Storage.set(STORAGE_KEYS.LANGUAGE, lang);
    this.updatePageContent();
    this.updateLanguageSelector();
  }

  /**
   * Mettre à jour le contenu de la page
   */
  updatePageContent() {
    // Mettre à jour tous les éléments avec data-i18n
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      element.textContent = this.t(key);
    });

    // Mettre à jour les placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      element.placeholder = this.t(key);
    });

    // Mettre à jour les attributs title
    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      element.title = this.t(key);
    });

    // Mettre à jour l'attribut lang du HTML
    document.documentElement.setAttribute('lang', this.currentLanguage);
  }

  /**
   * Configurer le sélecteur de langue
   */
  setupLanguageSelector() {
    const selector = document.getElementById('language-selector');
    if (!selector) return;

    selector.addEventListener('change', (e) => {
      this.changeLanguage(e.target.value);
    });

    this.updateLanguageSelector();
  }

  /**
   * Mettre à jour le sélecteur de langue
   */
  updateLanguageSelector() {
    const selector = document.getElementById('language-selector');
    if (selector) {
      selector.value = this.currentLanguage;
    }
  }

  /**
   * Obtenir la langue actuelle
   */
  getCurrentLanguage() {
    return this.currentLanguage;
  }
}

export default I18n;
