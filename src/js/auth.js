/**
 * AUTH.JS - Authentication Management
 * Auth only. Financial data is always read/write directly from Supabase per page.
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import { supabase, getCurrentSession } from './supabase.js';
import { fetchUserSettings } from './volakoApi.js';
import notify from './notifications.js';

class Auth {
  constructor() {
    this.user = Storage.get(STORAGE_KEYS.USER);
    this.token = Storage.get(STORAGE_KEYS.TOKEN);
    this.isInitialized = false;
    this.initializeAuth();
  }

  async initializeAuth() {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        await this.handleSignIn(session);
      } else if (event === 'SIGNED_OUT') {
        await this.handleSignOut();
      }
    });

    const session = await getCurrentSession();
    if (session) {
      await this.handleSignIn(session);
    }
  }

  async handleSignIn(session) {
    const user = session.user;

    if (this.isInitialized && this.user && this.user.id === user.id) {
      return;
    }

    this.user = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email.split('@')[0]
    };

    this.token = session.access_token;

    Storage.set(STORAGE_KEYS.USER, this.user);
    Storage.set(STORAGE_KEYS.TOKEN, this.token);

    try {
      const settings = await fetchUserSettings();
      if (settings) {
        Storage.set(STORAGE_KEYS.THEME, settings.theme || 'light');
        Storage.set(STORAGE_KEYS.LANGUAGE, settings.language || 'fr');
        Storage.set(STORAGE_KEYS.CURRENCY, settings.currency || 'MGA');
      }
    } catch (error) {
      console.error('Settings load error:', error);
    }

    this.isInitialized = true;
  }

  async handleSignOut() {
    this.user = null;
    this.token = null;
    this.isInitialized = false;

    Storage.remove(STORAGE_KEYS.USER);
    Storage.remove(STORAGE_KEYS.TOKEN);

    if (window.location.pathname !== '/' && window.location.pathname !== '/index.html') {
      window.location.href = '/';
    }
  }

  isAuthenticated() {
    return !!(this.user && this.token);
  }

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  validatePassword(password) {
    if (password.length < 8) {
      return { valid: false, message: 'Le mot de passe doit contenir au moins 8 caracteres' };
    }

    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Le mot de passe doit contenir au moins une lettre majuscule' };
    }

    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Le mot de passe doit contenir au moins une lettre minuscule' };
    }

    if (!/\d/.test(password)) {
      return { valid: false, message: 'Le mot de passe doit contenir au moins un chiffre' };
    }

    return { valid: true, message: '' };
  }

  async login(email, password) {
    try {
      if (!this.validateEmail(email)) {
        throw new Error('Email invalide');
      }

      if (!password) {
        throw new Error('Mot de passe requis');
      }

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      return { success: true, user: data.user };
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la connexion');
      return { success: false, error: error.message };
    }
  }

  async register(name, email, password, confirmPassword) {
    try {
      if (!name || name.length < 2) {
        throw new Error('Le nom doit contenir au moins 2 caracteres');
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

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } }
      });

      if (error) throw error;

      notify.success('Inscription reussie ! Verifiez votre email pour confirmer votre compte.');
      return { success: true, user: data.user };
    } catch (error) {
      notify.error(error.message || 'Erreur lors de l\'inscription');
      return { success: false, error: error.message };
    }
  }

  async logout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      notify.success('Deconnexion reussie');
      return { success: true };
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la deconnexion');
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }
}

export default Auth;
