/**
 * ROUTER.JS - Client-Side Router
 * Gestion de la navigation SPA (Single Page Application)
 */

class Router {
  constructor() {
    this.routes = new Map();
    this.currentRoute = null;
  }

  /**
   * Initialiser le routeur
   */
  init() {
    // Gérer les liens de navigation
    document.addEventListener('click', (e) => {
      const link = e.target.closest('a[data-link]');
      if (link) {
        e.preventDefault();
        this.navigateTo(link.getAttribute('href'));
      }
    });

    // Gérer le bouton retour du navigateur
    window.addEventListener('popstate', () => {
      this.loadRoute(window.location.pathname);
    });

    // Charger la route initiale
    this.loadRoute(window.location.pathname);
  }

  /**
   * Enregistrer une route
   */
  register(path, handler) {
    this.routes.set(path, handler);
  }

  /**
   * Naviguer vers une route
   */
  navigateTo(path) {
    window.history.pushState({}, '', path);
    this.loadRoute(path);
  }

  /**
   * Charger une route
   */
  async loadRoute(path) {
    const handler = this.routes.get(path) || this.routes.get('*');
    
    if (handler) {
      this.currentRoute = path;
      await handler();
    } else {
      console.warn(`No route found for: ${path}`);
    }
  }

  /**
   * Obtenir la route actuelle
   */
  getCurrentRoute() {
    return this.currentRoute;
  }
}

export default Router;
