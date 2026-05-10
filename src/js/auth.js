/**
 * AUTH.JS - Authentication Management
 * Auth only. Financial data is always read/write directly from Supabase per page.
 */

import { Storage, STORAGE_KEYS } from './storage.js';
import { supabase, getCurrentSession } from './supabase.js';
import { fetchUserSettings } from './volakoApi.js';
import notify from './notifications.js';

let authInstance = null;
let authSubscription = null;
let initPromise = null;

class Auth {
  constructor() {
    if (authInstance) {
      return authInstance;
    }

    this.user = Storage.get(STORAGE_KEYS.USER);
    this.token = Storage.get(STORAGE_KEYS.TOKEN);
    this.isInitialized = false;

    authInstance = this;
    this.initializeAuth();
  }

  async initializeAuth() {
    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      if (!authSubscription) {
        const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_IN' && session) {
            await this.handleSignIn(session);
          } else if (event === 'SIGNED_OUT') {
            await this.handleSignOut();
          }
        });

        authSubscription = data?.subscription || null;
      }

      const session = await getCurrentSession();
      if (session) {
        await this.handleSignIn(session);
      }
    })();

    return initPromise;
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
    // Clear the Supabase session key directly to prevent re-authentication on next page load
    localStorage.removeItem('volako-auth-token');

    window.location.replace('/');
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
      // 1. Effacer IMMÉDIATEMENT toutes les données locales (synchrone)
      //    avant toute opération async pour éviter la race condition
      this.user = null;
      this.token = null;
      this.isInitialized = false;

      Storage.remove(STORAGE_KEYS.USER);
      Storage.remove(STORAGE_KEYS.TOKEN);
      // Supprimer la clé de session Supabase directement pour que
      // getCurrentSession() renvoie null au prochain chargement de page
      localStorage.removeItem('volako-auth-token');

      // 2. Appeler signOut() côté serveur (best-effort, non bloquant)
      supabase.auth.signOut().catch(() => {});

      // 3. Rediriger via replace() pour empêcher le retour arrière vers une page protégée
      window.location.replace('/');

      return { success: true };
    } catch (error) {
      // En cas d'erreur inattendue, forcer quand même la déconnexion
      window.location.replace('/');
      return { success: false, error: error.message };
    }
  }

  getCurrentUser() {
    return this.user;
  }

  getToken() {
    return this.token;
  }

  async updateProfileName(name) {
    try {
      if (!name || name.trim().length < 2) {
        throw new Error('Le nom doit contenir au moins 2 caracteres');
      }

      const cleanName = name.trim();
      const { data, error } = await supabase.auth.updateUser({
        data: { name: cleanName }
      });

      if (error) throw error;

      this.user = {
        ...this.user,
        name: data.user?.user_metadata?.name || cleanName
      };

      Storage.set(STORAGE_KEYS.USER, this.user);
      return { success: true, user: this.user };
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la mise a jour du profil');
      return { success: false, error: error.message };
    }
  }

  async updatePassword(currentPassword, password, confirmPassword) {
    try {
      if (!currentPassword) {
        throw new Error('Le mot de passe actuel est requis');
      }

      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.valid) {
        throw new Error(passwordValidation.message);
      }

      if (password !== confirmPassword) {
        throw new Error('Les mots de passe ne correspondent pas');
      }

      if (!this.user?.email) {
        throw new Error('Impossible de verifier le compte utilisateur');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: this.user.email,
        password: currentPassword
      });

      if (signInError) {
        throw new Error('Mot de passe actuel incorrect');
      }

      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      notify.success('Mot de passe mis a jour avec succes');
      return { success: true };
    } catch (error) {
      notify.error(error.message || 'Erreur lors de la mise a jour du mot de passe');
      return { success: false, error: error.message };
    }
  }
}

export default Auth;
