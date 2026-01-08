/**
 * AUTH.JS - Authentication Management
 * Gestion de l'authentification (préparé pour Supabase)
 */

import { Storage, STORAGE_KEYS } from './storage.js';

class Auth {
  constructor() {
    this.user = Storage.get(STORAGE_KEYS.USER);
    this.token = Storage.get(STORAGE_KEYS.TOKEN);
  }

  /**
   * Vérifier si l'utilisateur est connecté
   */
  isAuthenticated() {
    return !!(this.user && this.token);
  }

  /**
   * Valider un email
   */
  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  /**
   * Valider un mot de passe
   */
  validatePassword(password) {
    // Au moins 8 caractères
    if (password.length < 8) {
      return {
        valid: false,
        message: 'Le mot de passe doit contenir au moins 8 caractères'
      };
    }

    // Au moins une lettre majuscule
    if (!/[A-Z]/.test(password)) {
      return {
        valid: false,
        message: 'Le mot de passe doit contenir au moins une lettre majuscule'
      };
    }

    // Au moins une lettre minuscule
    if (!/[a-z]/.test(password)) {
      return {
        valid: false,
        message: 'Le mot de passe doit contenir au moins une lettre minuscule'
      };
    }

    // Au moins un chiffre
    if (!/\d/.test(password)) {
      return {
        valid: false,
        message: 'Le mot de passe doit contenir au moins un chiffre'
      };
    }

    return { valid: true, message: '' };
  }

  /**
   * Connexion (simulation - à connecter avec Supabase)
   */
  async login(email, password) {
    try {
      // Validation
      if (!this.validateEmail(email)) {
        throw new Error('Email invalide');
      }

      if (!password) {
        throw new Error('Mot de passe requis');
      }

      // TODO: Intégration avec Supabase
      // const { data, error } = await supabase.auth.signInWithPassword({
      //   email,
      //   password
      // });

      // Simulation pour le développement
      const mockUser = {
        id: '123',
        email: email,
        name: email.split('@')[0]
      };

      const mockToken = 'mock_token_' + Date.now();

      // Sauvegarder
      this.user = mockUser;
      this.token = mockToken;
      Storage.set(STORAGE_KEYS.USER, mockUser);
      Storage.set(STORAGE_KEYS.TOKEN, mockToken);

      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inscription (simulation - à connecter avec Supabase)
   */
  async register(name, email, password, confirmPassword) {
    try {
      // Validation
      if (!name || name.length < 2) {
        throw new Error('Le nom doit contenir au moins 2 caractères');
      }

      if (!this.validateEmail(email)) {
        throw new Error('Email invalide');
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      if (password !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      // TODO: Intégration avec Supabase
      // const { data, error } = await supabase.auth.signUp({
      //   email,
      //   password,
      //   options: {
      //     data: { name }
      //   }
      // });

      // Simulation pour le développement
      const mockUser = {
        id: '123',
        email: email,
        name: name
      };

      const mockToken = 'mock_token_' + Date.now();

      // Sauvegarder
      this.user = mockUser;
      this.token = mockToken;
      Storage.set(STORAGE_KEYS.USER, mockUser);
      Storage.set(STORAGE_KEYS.TOKEN, mockToken);

      return { success: true, user: mockUser };
    } catch (error) {
      console.error('Register error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Déconnexion
   */
  async logout() {
    try {
      // TODO: Intégration avec Supabase
      // await supabase.auth.signOut();

      this.user = null;
      this.token = null;
      Storage.remove(STORAGE_KEYS.USER);
      Storage.remove(STORAGE_KEYS.TOKEN);

      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtenir l'utilisateur actuel
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * Obtenir le token actuel
   */
  getToken() {
    return this.token;
  }
}

export default Auth;
