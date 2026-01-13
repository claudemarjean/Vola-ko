/**
 * SYNC.JS - Supabase Synchronization
 * Gestion de la synchronisation bidirectionnelle entre le cache local et Supabase
 */

import { supabase, SUPABASE_TABLES, getCurrentUser } from './supabase.js';
import { Storage, STORAGE_KEYS } from './storage.js';
import notify from './notifications.js';

/**
 * Générer un UUID valide pour Supabase
 */
export function generateUUID() {
  // Utiliser crypto.randomUUID si disponible (navigateurs modernes)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback pour anciens navigateurs
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

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
      console.log(`📊 État avant synchronisation:`);
      console.log(`  - Revenus: ${Storage.get(STORAGE_KEYS.INCOMES, []).length}`);
      console.log(`  - Dépenses: ${Storage.get(STORAGE_KEYS.EXPENSES, []).length}`);
      console.log(`  - Budgets: ${Storage.get(STORAGE_KEYS.BUDGETS, []).length}`);
      console.log(`  - Économies: ${Storage.get(STORAGE_KEYS.SAVINGS, []).length}`);
      console.log(`  - Transactions: ${Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []).length}`);

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

      // Charger les revenus et fusionner avec les données locales non-synchronisées
      const { data: remoteIncomes } = await supabase
        .from(SUPABASE_TABLES.INCOMES)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      const localIncomes = Storage.get(STORAGE_KEYS.INCOMES, []);
      const unsyncedIncomes = localIncomes.filter(item => !item.synced);
      const mergedIncomes = this.mergeData(remoteIncomes || [], unsyncedIncomes);
      Storage.set(STORAGE_KEYS.INCOMES, mergedIncomes);
      console.log(`📊 Revenus: ${remoteIncomes?.length || 0} distant(s), ${unsyncedIncomes.length} non-synchronisé(s)`);

      // Charger les dépenses et fusionner avec les données locales non-synchronisées
      const { data: remoteExpenses } = await supabase
        .from(SUPABASE_TABLES.EXPENSES)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      const localExpenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
      const unsyncedExpenses = localExpenses.filter(item => !item.synced);
      const mergedExpenses = this.mergeData(remoteExpenses || [], unsyncedExpenses);
      Storage.set(STORAGE_KEYS.EXPENSES, mergedExpenses);
      console.log(`📊 Dépenses: ${remoteExpenses?.length || 0} distant(s), ${unsyncedExpenses.length} non-synchronisé(s)`);

      // Charger les budgets et fusionner avec les données locales non-synchronisées
      const { data: remoteBudgets } = await supabase
        .from(SUPABASE_TABLES.BUDGETS)
        .select('*')
        .eq('user_id', userId);

      const localBudgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
      const unsyncedBudgets = localBudgets.filter(item => !item.synced);
      const mergedBudgets = this.mergeData(remoteBudgets || [], unsyncedBudgets);
      Storage.set(STORAGE_KEYS.BUDGETS, mergedBudgets);
      console.log(`📊 Budgets: ${remoteBudgets?.length || 0} distant(s), ${unsyncedBudgets.length} non-synchronisé(s)`);

      // Charger les économies et fusionner avec les données locales non-synchronisées
      const { data: remoteSavings } = await supabase
        .from(SUPABASE_TABLES.SAVINGS)
        .select('*')
        .eq('user_id', userId);

      const localSavings = Storage.get(STORAGE_KEYS.SAVINGS, []);
      const unsyncedSavings = localSavings.filter(item => !item.synced);
      const mergedSavings = this.mergeData(remoteSavings || [], unsyncedSavings);
      Storage.set(STORAGE_KEYS.SAVINGS, mergedSavings);
      console.log(`📊 Économies: ${remoteSavings?.length || 0} distant(s), ${unsyncedSavings.length} non-synchronisé(s)`);

      // Charger les transactions d'économies et fusionner avec les données locales non-synchronisées
      const { data: remoteSavingsTransactions } = await supabase
        .from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS)
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      const localTransactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
      const unsyncedTransactions = localTransactions.filter(item => !item.synced);
      const mergedTransactions = this.mergeData(remoteSavingsTransactions || [], unsyncedTransactions);
      Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, mergedTransactions);
      console.log(`📊 Transactions: ${remoteSavingsTransactions?.length || 0} distant(s), ${unsyncedTransactions.length} non-synchronisé(s)`);

      // Afficher un résumé du chargement
      const totalRemote = (remoteIncomes?.length || 0) + 
                         (remoteExpenses?.length || 0) + 
                         (remoteBudgets?.length || 0) + 
                         (remoteSavings?.length || 0) + 
                         (remoteSavingsTransactions?.length || 0);
      
      const totalUnsynced = unsyncedIncomes.length + 
                           unsyncedExpenses.length + 
                           unsyncedBudgets.length + 
                           unsyncedSavings.length + 
                           unsyncedTransactions.length;

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`✅ Données chargées depuis Supabase`);
      console.log(`   📦 ${totalRemote} donnée(s) récupérée(s)`);
      if (totalUnsynced > 0) {
        console.log(`   ⏳ ${totalUnsynced} donnée(s) locale(s) en attente de synchronisation`);
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      notify.success(`${totalRemote} donnée(s) chargée(s) avec succès`);
    } catch (error) {
      console.error('❌ Erreur lors du chargement depuis Supabase:', error);
      throw error;
    }
  }

  /**
   * Fusionner les données distantes avec les données locales non-synchronisées
   * Les données distantes sont marquées comme synced: true
   * Les données locales non-synchronisées sont conservées
   */
  mergeData(remoteData, localUnsyncedData) {
    // Marquer toutes les données distantes comme synchronisées
    const remoteMarked = remoteData.map(item => ({ ...item, synced: true }));
    
    // Combiner les données distantes avec les données locales non-synchronisées
    // Les données locales non-synchronisées sont ajoutées en premier pour être prioritaires
    const merged = [...localUnsyncedData, ...remoteMarked];
    
    // Dédupliquer par ID (garder le premier, qui sera le local non-synchronisé si doublon)
    const uniqueIds = new Set();
    return merged.filter(item => {
      if (uniqueIds.has(item.id)) {
        return false;
      }
      uniqueIds.add(item.id);
      return true;
    });
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
    console.log(`🔍 Synchronisation des revenus: ${localIncomes.length} revenu(s) local/locaux`);
    
    if (localIncomes.length === 0) {
      console.log('Aucun revenu local à synchroniser');
      return;
    }

    // Récupérer les revenus existants dans Supabase
    const { data: remoteIncomes, error: fetchError } = await supabase
      .from(SUPABASE_TABLES.INCOMES)
      .select('*')
      .eq('user_id', userId);

    if (fetchError) {
      console.error('Erreur lors de la récupération des revenus:', fetchError);
      throw fetchError;
    }

    const remoteIds = new Set(remoteIncomes?.map(i => i.id) || []);

    // Insérer les nouveaux revenus locaux
    const toInsert = localIncomes.filter(income => {
      const shouldInsert = income.id && !remoteIds.has(income.id) && !income.synced;
      if (!shouldInsert && !income.synced) {
        console.log(`⏭️ Revenu ignoré: id=${income.id}, existe=${remoteIds.has(income.id)}, synced=${income.synced}`);
      }
      return shouldInsert;
    });

    console.log(`📝 ${toInsert.length} revenu(s) à insérer, ${localIncomes.filter(i => i.synced).length} déjà synchronisé(s)`);
    if (toInsert.length > 0) {
      console.log(`💾 Insertion de ${toInsert.length} revenu(s)...`);  
      
      const insertData = toInsert.map(income => ({
        id: income.id,
        user_id: userId,
        source: income.source,
        amount: parseFloat(income.amount),
        date: income.date,
        created_at: income.created_at || new Date().toISOString()
      }));

      const { error: insertError } = await supabase
        .from(SUPABASE_TABLES.INCOMES)
        .insert(insertData);

      if (insertError) {
        console.error('Erreur lors de l\'insertion des revenus:', insertError);
        throw insertError;
      }

      // Marquer comme synchronisés
      localIncomes.forEach(income => {
        if (toInsert.find(i => i.id === income.id)) {
          income.synced = true;
        }
      });
      Storage.set(STORAGE_KEYS.INCOMES, localIncomes);
      console.log(`✅ ${toInsert.length} revenu(s) synchronisé(s)`);
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
    console.log(`🔍 Synchronisation des dépenses: ${localExpenses.length} dépense(s) locale(s)`);

    const { data: remoteExpenses } = await supabase
      .from(SUPABASE_TABLES.EXPENSES)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteExpenses?.map(e => e.id) || []);

    // Insérer les nouvelles dépenses
    const toInsert = localExpenses.filter(expense => {
      return expense.id && !remoteIds.has(expense.id) && !expense.synced;
    });

    console.log(`📝 ${toInsert.length} dépense(s) à insérer, ${localExpenses.filter(e => e.synced).length} déjà synchronisée(s)`);
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
    console.log(`🔍 Synchronisation des budgets: ${localBudgets.length} budget(s) local/locaux`);

    const { data: remoteBudgets } = await supabase
      .from(SUPABASE_TABLES.BUDGETS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteBudgets?.map(b => b.id) || []);

    // Insérer les nouveaux budgets
    const toInsert = localBudgets.filter(budget => {
      return budget.id && !remoteIds.has(budget.id) && !budget.synced;
    });

    console.log(`📝 ${toInsert.length} budget(s) à insérer, ${localBudgets.filter(b => b.synced).length} déjà synchronisé(s)`);
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
    console.log(`🔍 Synchronisation des économies: ${localSavings.length} économie(s) locale(s)`);

    const { data: remoteSavings } = await supabase
      .from(SUPABASE_TABLES.SAVINGS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteSavings?.map(s => s.id) || []);

    // Insérer les nouvelles économies
    const toInsert = localSavings.filter(saving => {
      return saving.id && !remoteIds.has(saving.id) && !saving.synced;
    });

    console.log(`📝 ${toInsert.length} économie(s) à insérer, ${localSavings.filter(s => s.synced).length} déjà synchronisée(s)`);
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
    console.log(`🔍 Synchronisation des transactions: ${localTransactions.length} transaction(s) locale(s)`);

    const { data: remoteTransactions } = await supabase
      .from(SUPABASE_TABLES.SAVINGS_TRANSACTIONS)
      .select('*')
      .eq('user_id', userId);

    const remoteIds = new Set(remoteTransactions?.map(t => t.id) || []);

    // Insérer les nouvelles transactions
    const toInsert = localTransactions.filter(transaction => {
      return transaction.id && !remoteIds.has(transaction.id) && !transaction.synced;
    });

    console.log(`📝 ${toInsert.length} transaction(s) à insérer, ${localTransactions.filter(t => t.synced).length} déjà synchronisée(s)`);
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
   * Synchroniser toutes les données avant déconnexion
   */
  async syncBeforeLogout() {
    const user = await getCurrentUser();
    if (!user) {
      console.log('Utilisateur non authentifié - synchronisation ignorée');
      return { success: true, message: 'Pas de données à synchroniser' };
    }

    // Vérifier la connexion
    const isOnline = await this.checkOnlineStatus();
    if (!isOnline) {
      console.log('⚠️ Hors ligne - impossible de synchroniser avant déconnexion');
      notify.warning('Vous êtes hors ligne. Certaines données pourraient ne pas être synchronisées.');
      return { success: false, message: 'Hors ligne' };
    }

    // Arrêter la synchronisation automatique pendant la sync finale
    const wasAutoSyncRunning = !!this.syncInterval;
    if (wasAutoSyncRunning) {
      this.stopAutoSync();
    }

    // Notifier le début de la synchronisation
    this.notifySyncStatus({
      online: true,
      syncing: true,
      lastSync: this.lastSyncTime,
      finalSync: true
    });

    try {
      console.log('🔄 Synchronisation finale avant déconnexion...');
      console.log(`📊 Données à synchroniser:`);
      
      // Compter les données non-synchronisées
      const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
      const expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
      const budgets = Storage.get(STORAGE_KEYS.BUDGETS, []);
      const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
      const transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
      
      const unsyncedCount = {
        incomes: incomes.filter(i => !i.synced).length,
        expenses: expenses.filter(e => !e.synced).length,
        budgets: budgets.filter(b => !b.synced).length,
        savings: savings.filter(s => !s.synced).length,
        transactions: transactions.filter(t => !t.synced).length
      };
      
      const totalUnsynced = Object.values(unsyncedCount).reduce((sum, count) => sum + count, 0);
      
      console.log(`  - Revenus non-synchronisés: ${unsyncedCount.incomes}`);
      console.log(`  - Dépenses non-synchronisées: ${unsyncedCount.expenses}`);
      console.log(`  - Budgets non-synchronisés: ${unsyncedCount.budgets}`);
      console.log(`  - Économies non-synchronisées: ${unsyncedCount.savings}`);
      console.log(`  - Transactions non-synchronisées: ${unsyncedCount.transactions}`);
      console.log(`  📌 TOTAL: ${totalUnsynced} élément(s) à synchroniser`);

      if (totalUnsynced === 0) {
        console.log('✅ Aucune donnée à synchroniser');
        notify.success('Toutes les données sont déjà synchronisées');
        return { success: true, message: 'Aucune donnée à synchroniser' };
      }

      // Synchroniser chaque type de données
      await this.syncUserSettings(user.id);
      await this.syncIncomes(user.id);
      await this.syncExpenses(user.id);
      await this.syncBudgets(user.id);
      await this.syncSavings(user.id);
      await this.syncSavingsTransactions(user.id);

      console.log('✅ Synchronisation finale terminée avec succès');
      notify.success(`${totalUnsynced} donnée(s) synchronisée(s) avec succès`);
      
      this.notifySyncStatus({
        online: true,
        syncing: false,
        lastSync: new Date().toISOString(),
        finalSync: false
      });

      return { success: true, message: `${totalUnsynced} données synchronisées` };
    } catch (error) {
      console.error('❌ Erreur lors de la synchronisation finale:', error);
      notify.error('Erreur lors de la synchronisation finale');
      
      this.notifySyncStatus({
        online: true,
        syncing: false,
        lastSync: this.lastSyncTime,
        error: error.message
      });
      
      // Ne pas bloquer la déconnexion en cas d'erreur
      return { success: false, message: error.message };
    }
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
