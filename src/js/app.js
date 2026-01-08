/**
 * APP.JS - Main Application Entry Point
 * Point d'entrée principal de l'application
 */

import ThemeManager from './theme.js';
import I18n from './i18n.js';
import Router from './router.js';
import Auth from './auth.js';

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
    try {
      // Initialiser le gestionnaire de thème
      this.themeManager = new ThemeManager();

      // Initialiser l'internationalisation
      this.i18n = new I18n();
      await this.i18n.init();

      // Initialiser l'authentification
      this.auth = new Auth();

      // Initialiser le routeur (si nécessaire)
      // this.router = new Router();
      // this.setupRoutes();
      // this.router.init();

      // Initialiser les composants de la page
      this.initPageComponents();

      console.log('✅ T-Volako initialized successfully');
    } catch (error) {
      console.error('❌ App initialization error:', error);
    }
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
      window.location.href = '/dashboard.html';
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
      window.location.href = '/dashboard.html';
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
