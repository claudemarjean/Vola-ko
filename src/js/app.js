/**
 * APP.JS - Main Application Entry Point
 * Point d'entrée principal de l'application
 */

import ThemeManager from './theme.js';
import I18n from './i18n.js';
import Router from './router.js';
import Auth from './auth.js';
import { registerOfflineCapabilities } from './offline.js';
import { initConnectivityAwareness } from './network.js';
import { showGlobalLoader, hideGlobalLoader } from './loaders.js';

class App {
  constructor() {
    this.themeManager = null;
    this.i18n = null;
    this.router = null;
    this.auth = null;
  }

  /**
   * Initialiser l'application
   */
  async init() {
    showGlobalLoader('Initialisation de Vola-ko...');

    try {
      // Initialiser le gestionnaire de thème
      this.themeManager = new ThemeManager();

      // Activer la surveillance de connectivite
      initConnectivityAwareness();

      // Initialiser l'internationalisation
      this.i18n = new I18n();
      await this.i18n.init();

      // Initialiser l'authentification
      this.auth = new Auth();
      await this.auth.initializeAuth();

      const redirected = this.handleRootRedirect();
      if (redirected) {
        return;
      }

      // Préparer le mode hors ligne si déjà authentifié
      await registerOfflineCapabilities(this.auth.isAuthenticated());

      // Initialiser le routeur (si nécessaire)
      // this.router = new Router();
      // this.setupRoutes();
      // this.router.init();

      // Initialiser les composants de la page
      this.initPageComponents();

      console.log('✅ T-Volako initialized successfully');
    } catch (error) {
      console.error('❌ App initialization error:', error);
    } finally {
      hideGlobalLoader();
    }
  }

  handleRootRedirect() {
    const path = window.location.pathname;
    const isRootPath = path === '/' || path === '/index.html';

    if (!isRootPath) {
      return false;
    }

    if (this.auth?.isAuthenticated()) {
      window.location.replace('/dashboard');
      return true;
    }

    return false;
  }

  /**
   * Configurer les routes (pour SPA)
   */
  setupRoutes() {
    if (!this.router) return;

    this.router.register('/', async () => {
      console.log('Home page');
    });

    this.router.register('/login', async () => {
      console.log('Login page');
    });

    this.router.register('/register', async () => {
      console.log('Register page');
    });
  }

  /**
   * Initialiser les composants de la page
   */
  initPageComponents() {
    // Ajouter des animations aux éléments visibles
    this.setupAnimations();

    // Gérer les formulaires
    this.setupForms();

    // Compacter les filtres sur mobile
    this.setupResponsiveFilters();
  }

  /**
   * Configurer les animations
   */
  setupAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-fade-in-up');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    document.querySelectorAll('.card, .feature-item, .hero-content').forEach(el => {
      observer.observe(el);
    });
  }

  /**
   * Configurer les formulaires
   */
  setupForms() {
    // Formulaire de connexion
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleLogin(e.target);
      });
    }

    // Formulaire d'inscription
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleRegister(e.target);
      });
    }
  }

  setupResponsiveFilters() {
    const cards = document.querySelectorAll('.filters-card');
    if (!cards.length) return;

    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const updateSummary = (card) => {
      const summary = card.querySelector('.filters-toggle-summary');
      const badge = card.querySelector('.filters-toggle-count');
      if (!summary || !badge) return;

      const fields = card.querySelectorAll('select, input[type="text"], input[type="search"], input[type="date"]');
      const activeParts = [];

      fields.forEach((field) => {
        if (field.tagName === 'SELECT') {
          if (field.value) {
            const selectedOption = field.options[field.selectedIndex];
            if (selectedOption && selectedOption.textContent) {
              activeParts.push(selectedOption.textContent.trim());
            }
          }
          return;
        }

        const value = (field.value || '').trim();
        if (value) {
          activeParts.push(value);
        }
      });

      const uniqueParts = [...new Set(activeParts)].slice(0, 2);
      const hiddenCount = Math.max(activeParts.length - uniqueParts.length, 0);
      summary.textContent = uniqueParts.length ? uniqueParts.join(' • ') : 'Aucun filtre actif';
      badge.textContent = String(activeParts.length);
      badge.hidden = activeParts.length === 0;

      if (hiddenCount > 0) {
        summary.textContent += ` +${hiddenCount}`;
      }
    };

    const syncCardMode = (card) => {
      const isMobile = mobileQuery.matches;
      card.classList.toggle('filters-card--mobile', isMobile);

      let toggle = card.querySelector('.filters-toggle');
      if (!toggle) {
        toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'filters-toggle';
        toggle.innerHTML = '<span class="filters-toggle-label">Filtres</span><span class="filters-toggle-summary">Aucun filtre actif</span><span class="filters-toggle-count" hidden>0</span><span class="filters-toggle-icon" aria-hidden="true">▾</span>';
        toggle.addEventListener('click', () => {
          const expanded = card.classList.toggle('filters-card--expanded');
          toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        });
        card.insertBefore(toggle, card.firstChild);
      }

      if (isMobile) {
        if (!card.dataset.mobileFiltersInitialized) {
          card.classList.remove('filters-card--expanded');
          card.dataset.mobileFiltersInitialized = 'true';
        }
        toggle.hidden = false;
        toggle.setAttribute('aria-expanded', card.classList.contains('filters-card--expanded') ? 'true' : 'false');
      } else {
        card.classList.add('filters-card--expanded');
        toggle.hidden = true;
        toggle.setAttribute('aria-expanded', 'true');
      }

      updateSummary(card);
    };

    cards.forEach((card) => {
      const fields = card.querySelectorAll('select, input[type="text"], input[type="search"], input[type="date"]');
      fields.forEach((field) => {
        const eventName = field.tagName === 'SELECT' ? 'change' : 'input';
        field.addEventListener(eventName, () => updateSummary(card));
        if (field.tagName !== 'SELECT' && field.type === 'date') {
          field.addEventListener('change', () => updateSummary(card));
        }
      });

      syncCardMode(card);
    });

    const handleMediaChange = () => {
      cards.forEach(syncCardMode);
    };

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleMediaChange);
    } else if (typeof mobileQuery.addListener === 'function') {
      mobileQuery.addListener(handleMediaChange);
    }
  }

  /**
   * Gérer la connexion
   */
  async handleLogin(form) {
    const email = form.email.value;
    const password = form.password.value;
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Réinitialiser les erreurs
    if (errorEl) errorEl.textContent = '';

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const result = await this.auth.login(email, password);

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;

    if (result.success) {
      // Redirection vers le dashboard (à implémenter)
      await registerOfflineCapabilities(true);
      window.location.href = '/dashboard';
    } else {
      if (errorEl) {
        errorEl.textContent = result.error;
      }
    }
  }

  /**
   * Gérer l'inscription
   */
  async handleRegister(form) {
    const name = form.name.value;
    const email = form.email.value;
    const password = form.password.value;
    const confirmPassword = form.confirmPassword.value;
    const errorEl = form.querySelector('.form-error');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Réinitialiser les erreurs
    if (errorEl) errorEl.textContent = '';

    // Loading state
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    const result = await this.auth.register(name, email, password, confirmPassword);

    submitBtn.classList.remove('loading');
    submitBtn.disabled = false;

    if (result.success) {
      // Redirection vers le dashboard (à implémenter)
      await registerOfflineCapabilities(true);
      window.location.href = '/dashboard';
    } else {
      if (errorEl) {
        errorEl.textContent = result.error;
      }
    }
  }
}

// Initialiser l'application au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
  
  // Exposer l'app globalement pour le débogage
  window.TVolako = app;
});

export default App;
