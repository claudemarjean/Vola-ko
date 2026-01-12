/**
 * AUTH.JS - Authentication Management
 * Gestion de l'authentification avec Supabase
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import { supabase, getCurrentUser, getCurrentSession } from './supabase.js';
import { syncManager } from './sync.js';
import notify from './notifications.js';

class Auth {
  constructor() {
    this.user = Storage.get(STORAGE_KEYS.USER);
    this.token = Storage.get(STORAGE_KEYS.TOKEN);
    this.initializeAuth();
  }

  /**
   * Initialiser l'authentification Supabase
   */
  async initializeAuth() {
    // Écouter les changements d'état d'authentification
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session) {
        await this.handleSignIn(session);
      } else if (event === 'SIGNED_OUT') {
        await this.handleSignOut();
      }
    });

    // Vérifier si une session existe déjà
    const session = await getCurrentSession();
    if (session) {
      await this.handleSignIn(session);
    }
  }

  /**
   * Gérer la connexion
   */
  async handleSignIn(session) {
    const user = session.user;
    
    this.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split('@')[0]
    };
    
    this.token = session.access_token;
    
    Storage.set(STORAGE_KEYS.USER, this.user);
    Storage.set(STORAGE_KEYS.TOKEN, this.token);

    // Charger les données depuis Supabase
    try {
      await syncManager.loadFromSupabase(user.id);
      // Démarrer la synchronisation automatique
      syncManager.startAutoSync();
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      notify.error('Erreur lors du chargement des données');
    }
  }

  /**
   * Gérer la déconnexion
   */
  async handleSignOut() {
    this.user = null;
    this.token = null;
    
    // Purger toutes les données locales
    await syncManager.clearLocalData();
    
    // Rediriger vers la page d'accueil
    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.location.href = '/';
    }
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
   * Connexion avec Supabase
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

      // Connexion avec Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        throw error;
      }

      // La session sera gérée par onAuthStateChange
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Login error:', error);
      notify.error(error.message || 'Erreur lors de la connexion');
      return { success: false, error: error.message };
    }
  }

  /**
   * Inscription avec Supabase
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

      // Inscription avec Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name }
        }
      });

      if (error) {
        throw error;
      }

      // La session sera gérée par onAuthStateChange
      notify.success('Inscription réussie ! Vérifiez votre email pour confirmer votre compte.');
      return { success: true, user: data.user };
    } catch (error) {
      console.error('Register error:', error);
      notify.error(error.message || 'Erreur lors de l\'inscription');
      return { success: false, error: error.message };
    }
  }

  /**
   * Déconnexion avec Supabase
   */
  async logout() {
    try {
      // Synchroniser toutes les données avant de se déconnecter
      notify.info('Synchronisation des données avant déconnexion...');
      await syncManager.syncBeforeLogout();
      
      // Déconnexion de Supabase
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // La purge des données sera gérée par handleSignOut via onAuthStateChange
      notify.success('Déconnexion réussie');
      return { success: true };
    } catch (error) {
      console.error('Logout error:', error);
      notify.error(error.message || 'Erreur lors de la déconnexion');
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
