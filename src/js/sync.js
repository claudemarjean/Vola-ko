/**
 * SYNC.JS - Supabase Synchronization
 * Gestion de la synchronisation bidirectionnelle entre le cache local et Supabase
 */

import { supabase, SUPABASE_TABLES, getCurrentUser } from './supabase.js';
import { Storage, STORAGE_KEYS } from './storage.js';
import notify from './notifications.js';

class SyncManager {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalTime = 60000; // 60 secondes
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.isOnline = navigator.onLine;
    this.syncStatusCallbacks = [];

    // Écouter les changements de connexion
    window.addEventListener('online', () => this.handleOnlineStatus(true));
    window.addEventListener('offline', () => this.handleOnlineStatus(false));
  }

  /**
   * Ajouter un callback pour les mises à jour du statut de synchronisation
   */
  onSyncStatusChange(callback) {
    this.syncStatusCallbacks.push(callback);
  }

  /**
   * Notifier tous les callbacks du changement de statut
   */
  notifySyncStatus(status) {
    this.syncStatusCallbacks.forEach(callback => callback(status));
  }

  /**
   * Gérer le changement de statut de connexion
   */
  handleOnlineStatus(isOnline) {
    this.isOnline = isOnline;
    this.notifySyncStatus({
      online: isOnline,
      syncing: false,
      lastSync: this.lastSyncTime
    });

    if (isOnline) {
      notify.success('Connexion rétablie');
      // Synchroniser immédiatement quand on revient en ligne
      this.sync();
    } else {
      notify.warning('Vous êtes hors ligne. Les modifications seront synchronisées lors de la reconnexion.');
    }
  }

  /**
   * Démarrer la synchronisation automatique
   */
  startAutoSync() {
    if (this.syncInterval) {
      this.stopAutoSync();
    }

    // Synchroniser immédiatement
    this.sync();

    // Puis toutes les 60 secondes
    this.syncInterval = setInterval(() => {
      this.sync();
    }, this.syncIntervalTime);

    console.log('Auto-sync démarré (toutes les 60 secondes)');
  }

  /**
   * Arrêter la synchronisation automatique
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('Auto-sync arrêté');
    }
  }

  /**
   * Vérifier si l'utilisateur est en ligne
   */
  async checkOnlineStatus() {
    if (!navigator.onLine) {
      return false;
    }

    try {
      // Tester la connexion avec Supabase
      const { error } = await supabase.from(SUPABASE_TABLES.USER_SETTINGS).select('id').limit(1);
      return !error;
    } catch (error) {
      console.error('Erreur lors du test de connexion:', error);
      return false;
    }
  }

  /**
   * Synchroniser toutes les données
   */
  async sync() {
    // Éviter les synchronisations simultanées
    if (this.isSyncing) {
      console.log('Synchronisation déjà en cours, ignorée');
      return;
    }

    // Vérifier la connexion
    const isOnline = await this.checkOnlineStatus();
    if (!isOnline) {
      console.log('Hors ligne - synchronisation impossible');
      this.notifySyncStatus({
        online: false,
        syncing: false,
        lastSync: this.lastSyncTime
      });
      return;
    }

    // Vérifier l'authentification
    const user = await getCurrentUser();
    if (!user) {
      console.log('Utilisateur non authentifié - synchronisation ignorée');
      return;
    }

    this.isSyncing = true;
    this.notifySyncStatus({
      online: true,
      syncing: true,
      lastSync: this.lastSyncTime
    });

    try {
      console.log('🔄 Début de la synchronisation...');

      // Synchroniser chaque type de données
      await this.syncUserSettings(user.id);
      await this.syncIncomes(user.id);
      await this.syncExpenses(user.id);
      await this.syncBudgets(user.id);
      await this.syncSavings(user.id);
      await this.syncSavingsTransactions(user.id);

      this.lastSyncTime = new Date().toISOString();
      console.log('✅ Synchronisation terminée avec succès');
      
      this.notifySyncStatus({
        online: true,
        syncing: false,
        lastSync: this.lastSyncTime
      });
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation:', error);
      notify.error('Erreur lors de la synchronisation');
      
      this.notifySyncStatus({
        online: true,
        syncing: false,
        lastSync: this.lastSyncTime,
        error: error.message
      });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Charger toutes les données depuis Supabase vers le cache local
   */
  async loadFromSupabase(userId) {
    try {
      console.log('📥 Chargement des données depuis Supabase...');

      // Charger les paramètres utilisateur
      const { data: settings } = await supabase
        .from(SUPABASE_TABLES.USER_SETTINGS)
        .select('*')
        .eq('user_id', userId)
        .single();

      if (settings) {
        Storage.set(STORAGE_KEYS.THEME, settings.theme || 'light');
        Storage.set(STORAGE_KEYS.LANGUAGE, settings.language || 'fr');
        Storage.set(STORAGE_KEYS.CURRENCY, settings.currency || 'MGA');
      }

      // Charger les revenus
      const { data: incomes } = await supabase
        .from(SUPABASE_TABLES.INCOMES)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      Storage.set(STORAGE_KEYS.INCOMES, incomes || []);

      // Charger les dépenses
      const { data: expenses } = await supabase
        .from(SUPABASE_TABLES.EXPENSES)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      Storage.set(STORAGE_KEYS.EXPENSES, expenses || []);

      // Charger les budgets
      const { data: budgets } = await supabase
        .from(SUPABASE_TABLES.BUDGETS)
        .select('*')
        .eq('user_id', userId);

      Storage.set(STORAGE_KEYS.BUDGETS, budgets || []);

      // Charger les économies
      const { data: savings } = await supabase
        .from(SUPABASE_TABLES.SAVINGS)
        .select('*')
        .eq('user_id', userId);

      Storage.set(STORAGE_KEYS.SAVINGS, savings || []);

      // Charger les transactions d'économies
      const { data: savingsTransactions } = await supabase
        .from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, savingsTransactions || []);

      console.log('✅ Données chargées depuis Supabase');
      notify.success('Données synchronisées avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du chargement depuis Supabase:', error);
      throw error;
    }
  }

  /**
   * Synchroniser les paramètres utilisateur
   */
  async syncUserSettings(userId) {
    const theme = Storage.get(STORAGE_KEYS.THEME, 'light');
    const language = Storage.get(STORAGE_KEYS.LANGUAGE, 'fr');
    const currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');

    // Vérifier si l'enregistrement existe
    const { data: existing } = await supabase
      .from(SUPABASE_TABLES.USER_SETTINGS)
      .select('id')
      .eq('user_id', userId)
      .single();

    const settingsData = {
      user_id: userId,
      theme,
      language,
      currency,
      updated_at: new Date().toISOString()
    };

    if (existing) {
      // Mise à jour
      await supabase
        .from(SUPABASE_TABLES.USER_SETTINGS)
        .update(settingsData)
        .eq('user_id', userId);
    } else {
      // Insertion
      await supabase
        .from(SUPABASE_TABLES.USER_SETTINGS)
        .insert([settingsData]);
    }
  }

  /**
   * Synchroniser les revenus
   */
  async syncIncomes(userId) {
    const localIncomes = Storage.get(STORAGE_KEYS.INCOMES, []);

    // Récupérer les revenus existants dans Supabase
    const { data: remoteIncomes } = await supabase
      .from(SUPABASE_TABLES.INCOMES)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteIncomes?.map(i => i.id) || []);
    const localIds = new Set(localIncomes.map(i => i.id));

    // Insérer les nouveaux revenus locaux
    const toInsert = localIncomes.filter(income => {
      return income.id && !remoteIds.has(income.id) && !income.synced;
    });

    if (toInsert.length > 0) {
      const insertData = toInsert.map(income => ({
        id: income.id,
        user_id: userId,
        source: income.source,
        amount: parseFloat(income.amount),
        date: income.date,
        created_at: income.created_at || new Date().toISOString()
      }));

      await supabase.from(SUPABASE_TABLES.INCOMES).insert(insertData);

      // Marquer comme synchronisés
      localIncomes.forEach(income => {
        if (toInsert.find(i => i.id === income.id)) {
          income.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.INCOMES, localIncomes);
    }

    // Mettre à jour les revenus modifiés
    const toUpdate = localIncomes.filter(income => {
      return income.id && remoteIds.has(income.id) && income.modified && !income.synced;
    });

    for (const income of toUpdate) {
      await supabase
        .from(SUPABASE_TABLES.INCOMES)
        .update({
          source: income.source,
          amount: parseFloat(income.amount),
          date: income.date
        })
        .eq('id', income.id)
        .eq('user_id', userId);

      income.synced = true;
      income.modified = false;
    }

    if (toUpdate.length > 0) {
      Storage.set(STORAGE_KEYS.INCOMES, localIncomes);
    }
  }

  /**
   * Synchroniser les dépenses
   */
  async syncExpenses(userId) {
    const localExpenses = Storage.get(STORAGE_KEYS.EXPENSES, []);

    const { data: remoteExpenses } = await supabase
      .from(SUPABASE_TABLES.EXPENSES)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteExpenses?.map(e => e.id) || []);

    // Insérer les nouvelles dépenses
    const toInsert = localExpenses.filter(expense => {
      return expense.id && !remoteIds.has(expense.id) && !expense.synced;
    });

    if (toInsert.length > 0) {
      const insertData = toInsert.map(expense => ({
        id: expense.id,
        user_id: userId,
        description: expense.description,
        amount: parseFloat(expense.amount),
        category: expense.category,
        other_reference: expense.other_reference || null,
        date: expense.date,
        created_at: expense.created_at || new Date().toISOString()
      }));

      await supabase.from(SUPABASE_TABLES.EXPENSES).insert(insertData);

      localExpenses.forEach(expense => {
        if (toInsert.find(e => e.id === expense.id)) {
          expense.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.EXPENSES, localExpenses);
    }

    // Mettre à jour les dépenses modifiées
    const toUpdate = localExpenses.filter(expense => {
      return expense.id && remoteIds.has(expense.id) && expense.modified && !expense.synced;
    });

    for (const expense of toUpdate) {
      await supabase
        .from(SUPABASE_TABLES.EXPENSES)
        .update({
          description: expense.description,
          amount: parseFloat(expense.amount),
          category: expense.category,
          other_reference: expense.other_reference || null,
          date: expense.date
        })
        .eq('id', expense.id)
        .eq('user_id', userId);

      expense.synced = true;
      expense.modified = false;
    }

    if (toUpdate.length > 0) {
      Storage.set(STORAGE_KEYS.EXPENSES, localExpenses);
    }
  }

  /**
   * Synchroniser les budgets
   */
  async syncBudgets(userId) {
    const localBudgets = Storage.get(STORAGE_KEYS.BUDGETS, []);

    const { data: remoteBudgets } = await supabase
      .from(SUPABASE_TABLES.BUDGETS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteBudgets?.map(b => b.id) || []);

    // Insérer les nouveaux budgets
    const toInsert = localBudgets.filter(budget => {
      return budget.id && !remoteIds.has(budget.id) && !budget.synced;
    });

    if (toInsert.length > 0) {
      const insertData = toInsert.map(budget => ({
        id: budget.id,
        user_id: userId,
        category: budget.category,
        amount: parseFloat(budget.amount),
        other_reference: budget.other_reference || null,
        notes: budget.notes || null,
        created_at: budget.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      await supabase.from(SUPABASE_TABLES.BUDGETS).insert(insertData);

      localBudgets.forEach(budget => {
        if (toInsert.find(b => b.id === budget.id)) {
          budget.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.BUDGETS, localBudgets);
    }

    // Mettre à jour les budgets modifiés
    const toUpdate = localBudgets.filter(budget => {
      return budget.id && remoteIds.has(budget.id) && budget.modified && !budget.synced;
    });

    for (const budget of toUpdate) {
      await supabase
        .from(SUPABASE_TABLES.BUDGETS)
        .update({
          category: budget.category,
          amount: parseFloat(budget.amount),
          other_reference: budget.other_reference || null,
          notes: budget.notes || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', budget.id)
        .eq('user_id', userId);

      budget.synced = true;
      budget.modified = false;
    }

    if (toUpdate.length > 0) {
      Storage.set(STORAGE_KEYS.BUDGETS, localBudgets);
    }
  }

  /**
   * Synchroniser les économies
   */
  async syncSavings(userId) {
    const localSavings = Storage.get(STORAGE_KEYS.SAVINGS, []);

    const { data: remoteSavings } = await supabase
      .from(SUPABASE_TABLES.SAVINGS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteSavings?.map(s => s.id) || []);

    // Insérer les nouvelles économies
    const toInsert = localSavings.filter(saving => {
      return saving.id && !remoteIds.has(saving.id) && !saving.synced;
    });

    if (toInsert.length > 0) {
      const insertData = toInsert.map(saving => ({
        id: saving.id,
        user_id: userId,
        name: saving.name,
        type: saving.type,
        balance: parseFloat(saving.balance || 0),
        target_amount: parseFloat(saving.target_amount || 0),
        target_date: saving.target_date || null,
        created_at: saving.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      await supabase.from(SUPABASE_TABLES.SAVINGS).insert(insertData);

      localSavings.forEach(saving => {
        if (toInsert.find(s => s.id === saving.id)) {
          saving.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.SAVINGS, localSavings);
    }

    // Mettre à jour les économies modifiées
    const toUpdate = localSavings.filter(saving => {
      return saving.id && remoteIds.has(saving.id) && saving.modified && !saving.synced;
    });

    for (const saving of toUpdate) {
      await supabase
        .from(SUPABASE_TABLES.SAVINGS)
        .update({
          name: saving.name,
          type: saving.type,
          balance: parseFloat(saving.balance || 0),
          target_amount: parseFloat(saving.target_amount || 0),
          target_date: saving.target_date || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', saving.id)
        .eq('user_id', userId);

      saving.synced = true;
      saving.modified = false;
    }

    if (toUpdate.length > 0) {
      Storage.set(STORAGE_KEYS.SAVINGS, localSavings);
    }
  }

  /**
   * Synchroniser les transactions d'économies
   */
  async syncSavingsTransactions(userId) {
    const localTransactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);

    const { data: remoteTransactions } = await supabase
      .from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteTransactions?.map(t => t.id) || []);

    // Insérer les nouvelles transactions
    const toInsert = localTransactions.filter(transaction => {
      return transaction.id && !remoteIds.has(transaction.id) && !transaction.synced;
    });

    if (toInsert.length > 0) {
      const insertData = toInsert.map(transaction => ({
        id: transaction.id,
        savings_id: transaction.savings_id,
        user_id: userId,
        amount: parseFloat(transaction.amount),
        type: transaction.type,
        description: transaction.description || null,
        date: transaction.date,
        created_at: transaction.created_at || new Date().toISOString()
      }));

      await supabase.from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS).insert(insertData);

      localTransactions.forEach(transaction => {
        if (toInsert.find(t => t.id === transaction.id)) {
          transaction.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, localTransactions);
    }

    // Les transactions ne sont généralement pas modifiées, seulement ajoutées
  }

  /**
   * Purger toutes les données locales
   */
  async clearLocalData() {
    console.log('🗑️ Purge des données locales...');
    Storage.clear();
    this.stopAutoSync();
    this.lastSyncTime = null;
    console.log('✅ Données locales purgées');
  }
}

// Instance singleton
export const syncManager = new SyncManager();
