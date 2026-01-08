/**
 * STORAGE.JS - LocalStorage Management
 * Gestion centralisée du stockage local
 */

const STORAGE_KEYS = {
  THEME: 'tvolako_theme',
  LANGUAGE: 'tvolako_language',
  USER: 'tvolako_user',
  TOKEN: 'tvolako_token',
  EXPENSES: 'volako_expenses',
  INCOMES: 'volako_incomes',
  BUDGETS: 'volako_budgets',
  CURRENCY: 'volako_currency'
};

class Storage {
  /**
   * Sauvegarder une valeur dans localStorage
   */
  static set(key, value) {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  /**
   * Récupérer une valeur depuis localStorage
   */
  static get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  /**
   * Supprimer une valeur du localStorage
   */
  static remove(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  /**
   * Vider tout le localStorage de l'application
   */
  static clear() {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }
}

export { Storage, STORAGE_KEYS };
