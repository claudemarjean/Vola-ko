/**
 * FINANCE ENGINE - Moteur de calcul financier centralisé
 * 
 * Ce module contient TOUTE la logique financière de l'application.
 * Aucun calcul financier ne doit être effectué ailleurs.
 * 
 * RÈGLES FINANCIÈRES STRICTES :
 * ==============================
 * 
 * 1. DÉFINITIONS :
 *    - Solde total = Revenus - Dépenses + Retraits épargne - Ajouts épargne
 *    - Solde disponible hors épargne = Solde total - Total épargné
 *    - Solde avec épargne = Solde total
 * 
 * 2. FLUX FINANCIERS :
 *    - Revenus → augmentent le solde disponible hors épargne
 *    - Dépenses → diminuent le solde disponible hors épargne
 *    - Ajout épargne → transfère du solde hors épargne vers épargne
 *    - Retrait épargne → transfère de l'épargne vers solde hors épargne
 * 
 * 3. VALIDATIONS :
 *    - Dépense possible UNIQUEMENT SI solde hors épargne >= montant
 *    - Ajout épargne possible UNIQUEMENT SI solde hors épargne >= montant
 *    - Retrait épargne possible UNIQUEMENT SI solde épargne >= montant
 *    - AUCUN montant négatif autorisé
 */

import { Storage, STORAGE_KEYS } from './storage.js';

class FinanceEngine {
  /**
   * Calculer tous les soldes financiers
   * @param {Date} periodStart - Début de période (optionnel, par défaut: mois en cours)
   * @param {Date} periodEnd - Fin de période (optionnel, par défaut: fin du mois)
   * @returns {Object} Tous les soldes et statistiques
   */
  static calculateBalances(periodStart = null, periodEnd = null) {
    // Définir la période par défaut (mois en cours)
    const now = new Date();
    const start = periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = periodEnd || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Charger les données
    const allIncomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    const allExpenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);

    // Filtrer les transactions de la période pour les STATISTIQUES
    const periodIncomes = allIncomes.filter(inc => {
      const date = new Date(inc.date);
      return date >= start && date <= end;
    });

    const periodExpenses = allExpenses.filter(exp => {
      const date = new Date(exp.date);
      return date >= start && date <= end;
    });

    // Calculer les totaux de la période (pour affichage dashboard)
    const totalIncome = periodIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
    const totalExpenses = periodExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    // CALCUL DU SOLDE DISPONIBLE RÉEL (TOUS LES TEMPS)
    // Prendre TOUS les revenus et TOUTES les dépenses peu importe la date
    const allTimeIncome = allIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
    const allTimeExpenses = allExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    // Calculer le total épargné (toutes périodes confondues)
    const totalSaved = savings.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0);

    // Calculer les montants ajoutés et retirés de l'épargne durant la période
    const periodSavingsAdded = periodExpenses
      .filter(exp => exp.category === 'epargne')
      .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);

    const periodSavingsWithdrawn = periodIncomes
      .filter(inc => inc.category === 'epargne_retrait')
      .reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);

    // CALCULS FINANCIERS OFFICIELS
    // =============================
    
    // Solde de la période = Revenus - Dépenses (pour statistiques du mois)
    const periodBalance = totalIncome - totalExpenses;

    // Solde disponible HORS épargne = TOUS les revenus - TOUTES les dépenses
    // C'est l'argent RÉELLEMENT disponible pour dépenser (cumul depuis toujours)
    const availableBalance = allTimeIncome - allTimeExpenses;

    // Solde AVEC épargne = Solde disponible + Total épargné
    const totalBalanceWithSavings = availableBalance + totalSaved;

    return {
      // Période
      periodStart: start,
      periodEnd: end,

      // Revenus et dépenses DE LA PÉRIODE (pour affichage)
      totalIncome,
      totalExpenses,
      periodBalance,

      // Revenus et dépenses GLOBAUX (tous les temps)
      allTimeIncome,
      allTimeExpenses,

      // Épargne
      totalSaved,
      periodSavingsAdded,
      periodSavingsWithdrawn,

      // Soldes principaux
      availableBalance,           // SOLDE HORS ÉPARGNE (cumul de tous les temps)
      totalBalanceWithSavings,    // SOLDE AVEC ÉPARGNE (patrimoine total)

      // Détails
      incomeCount: periodIncomes.length,
      expenseCount: periodExpenses.length,
      savingsCount: savings.length
    };
  }

  /**
   * Valider si une dépense peut être ajoutée
   * @param {number} amount - Montant de la dépense
   * @returns {Object} { valid: boolean, message: string, availableBalance: number }
   */
  static validateExpense(amount) {
    const balances = this.calculateBalances();
    const parsedAmount = parseFloat(amount);

    // Validation basique
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return {
        valid: false,
        message: 'Le montant doit être un nombre positif',
        availableBalance: balances.availableBalance
      };
    }

    // Validation du solde disponible
    if (balances.availableBalance < parsedAmount) {
      return {
        valid: false,
        message: `Solde insuffisant. Disponible : ${this.formatCurrency(balances.availableBalance)}`,
        availableBalance: balances.availableBalance
      };
    }

    return {
      valid: true,
      message: 'Dépense autorisée',
      availableBalance: balances.availableBalance
    };
  }

  /**
   * Valider si un ajout à l'épargne peut être effectué
   * @param {number} amount - Montant à épargner
   * @returns {Object} { valid: boolean, message: string, availableBalance: number }
   */
  static validateSavingAddition(amount) {
    const balances = this.calculateBalances();
    const parsedAmount = parseFloat(amount);

    // Validation basique
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return {
        valid: false,
        message: 'Le montant doit être un nombre positif',
        availableBalance: balances.availableBalance
      };
    }

    // Validation du solde disponible hors épargne
    if (balances.availableBalance < parsedAmount) {
      return {
        valid: false,
        message: `Solde disponible insuffisant. Vous avez : ${this.formatCurrency(balances.availableBalance)}`,
        availableBalance: balances.availableBalance
      };
    }

    return {
      valid: true,
      message: 'Ajout à l\'épargne autorisé',
      availableBalance: balances.availableBalance
    };
  }

  /**
   * Valider si un retrait d'épargne peut être effectué
   * @param {string} savingId - ID de l'épargne
   * @param {number} amount - Montant à retirer
   * @returns {Object} { valid: boolean, message: string, savingBalance: number }
   */
  static validateSavingWithdrawal(savingId, amount) {
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    const saving = savings.find(s => s.id === savingId);

    if (!saving) {
      return {
        valid: false,
        message: 'Épargne non trouvée',
        savingBalance: 0
      };
    }

    const parsedAmount = parseFloat(amount);
    const savingBalance = parseFloat(saving.balance || 0);

    // Validation basique
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return {
        valid: false,
        message: 'Le montant doit être un nombre positif',
        savingBalance
      };
    }

    // Validation du solde de l'épargne
    if (savingBalance < parsedAmount) {
      return {
        valid: false,
        message: `Solde de l'épargne insuffisant. Disponible : ${this.formatCurrency(savingBalance)}`,
        savingBalance
      };
    }

    return {
      valid: true,
      message: 'Retrait autorisé',
      savingBalance
    };
  }

  /**
   * Enregistrer une transaction d'épargne (ajout)
   * Crée automatiquement une dépense correspondante
   * @param {string} savingId - ID de l'épargne
   * @param {number} amount - Montant à ajouter
   * @param {string} description - Description
   * @returns {Object} { success: boolean, message: string }
   */
  static addToSaving(savingId, amount, description = '') {
    // Valider l'opération
    const validation = this.validateSavingAddition(amount);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }

    // Mettre à jour l'épargne
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    const saving = savings.find(s => s.id === savingId);

    if (!saving) {
      return {
        success: false,
        message: 'Épargne non trouvée'
      };
    }

    // Augmenter le solde de l'épargne
    saving.balance = (parseFloat(saving.balance || 0) + parseFloat(amount)).toFixed(2);
    Storage.set(STORAGE_KEYS.SAVINGS, savings);

    // Créer une DÉPENSE automatique (catégorie 'epargne')
    const expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    const expenseId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const expense = {
      id: expenseId,
      amount: parseFloat(amount),
      category: 'epargne',
      description: description || `Ajout à l'épargne: ${saving.name}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    expenses.push(expense);
    Storage.set(STORAGE_KEYS.EXPENSES, expenses);

    // Historiser dans les transactions d'épargne
    const transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
    transactions.push({
      id: 'tx_' + Date.now(),
      savingId,
      type: 'add',
      amount: parseFloat(amount),
      description: description || `Ajout à l'épargne: ${saving.name}`,
      date: new Date().toISOString(),
      balanceAfter: saving.balance
    });
    Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, transactions);

    return {
      success: true,
      message: `${this.formatCurrency(amount)} ajouté à l'épargne`
    };
  }

  /**
   * Retirer de l'épargne
   * Crée automatiquement un revenu correspondant
   * @param {string} savingId - ID de l'épargne
   * @param {number} amount - Montant à retirer
   * @param {string} description - Description
   * @returns {Object} { success: boolean, message: string }
   */
  static withdrawFromSaving(savingId, amount, description = '') {
    // Valider l'opération
    const validation = this.validateSavingWithdrawal(savingId, amount);
    if (!validation.valid) {
      return {
        success: false,
        message: validation.message
      };
    }

    // Mettre à jour l'épargne
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    const saving = savings.find(s => s.id === savingId);

    if (!saving) {
      return {
        success: false,
        message: 'Épargne non trouvée'
      };
    }

    // Diminuer le solde de l'épargne
    saving.balance = (parseFloat(saving.balance || 0) - parseFloat(amount)).toFixed(2);
    Storage.set(STORAGE_KEYS.SAVINGS, savings);

    // Créer un REVENU automatique (catégorie 'epargne_retrait')
    const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    const incomeId = 'inc_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    const income = {
      id: incomeId,
      amount: parseFloat(amount),
      category: 'epargne_retrait',
      description: description || `Retrait de l'épargne: ${saving.name}`,
      date: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    incomes.push(income);
    Storage.set(STORAGE_KEYS.INCOMES, incomes);

    // Historiser dans les transactions d'épargne
    const transactions = Storage.get(STORAGE_KEYS.SAVINGS_TRANSACTIONS, []);
    transactions.push({
      id: 'tx_' + Date.now(),
      savingId,
      type: 'withdraw',
      amount: parseFloat(amount),
      description: description || `Retrait de l'épargne: ${saving.name}`,
      date: new Date().toISOString(),
      balanceAfter: saving.balance
    });
    Storage.set(STORAGE_KEYS.SAVINGS_TRANSACTIONS, transactions);

    return {
      success: true,
      message: `${this.formatCurrency(amount)} retiré de l'épargne et ajouté au solde disponible`
    };
  }

  /**
   * Obtenir l'historique complet des transactions
   * @returns {Array} Historique trié par date (plus récent en premier)
   */
  static getTransactionHistory() {
    const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    const expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);

    const allTransactions = [
      ...incomes.map(inc => ({
        ...inc,
        type: 'income',
        impact: parseFloat(inc.amount)
      })),
      ...expenses.map(exp => ({
        ...exp,
        type: 'expense',
        impact: -parseFloat(exp.amount)
      }))
    ];

    // Trier par date (plus récent en premier)
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    return allTransactions;
  }

  /**
   * Reconstruire les soldes depuis l'historique (pour vérification)
   * @returns {Object} Soldes reconstruits
   */
  static rebuildBalancesFromHistory() {
    const history = this.getTransactionHistory();
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);

    let totalIncome = 0;
    let totalExpenses = 0;

    history.forEach(tx => {
      if (tx.type === 'income') {
        totalIncome += parseFloat(tx.amount || 0);
      } else if (tx.type === 'expense') {
        totalExpenses += parseFloat(tx.amount || 0);
      }
    });

    const totalSaved = savings.reduce((sum, s) => sum + parseFloat(s.balance || 0), 0);
    const periodBalance = totalIncome - totalExpenses;
    const availableBalance = periodBalance;
    const totalBalanceWithSavings = availableBalance + totalSaved;

    return {
      totalIncome,
      totalExpenses,
      totalSaved,
      periodBalance,
      availableBalance,
      totalBalanceWithSavings,
      transactionCount: history.length
    };
  }

  /**
   * Formater un montant en devise
   * @param {number} amount - Montant à formater
   * @returns {string} Montant formaté
   */
  static formatCurrency(amount) {
    const currency = Storage.get(STORAGE_KEYS.CURRENCY, 'MGA');
    const parsedAmount = parseFloat(amount || 0);
    
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(parsedAmount) + ' ' + currency;
  }

  /**
   * Vérifier la cohérence des données
   * @returns {Object} Rapport de cohérence
   */
  static checkDataIntegrity() {
    const balances = this.calculateBalances();
    const rebuilt = this.rebuildBalancesFromHistory();

    const errors = [];
    const warnings = [];

    // Vérifier que les montants sont cohérents
    if (Math.abs(balances.totalIncome - rebuilt.totalIncome) > 0.01) {
      errors.push(`Incohérence revenus: ${balances.totalIncome} vs ${rebuilt.totalIncome}`);
    }

    if (Math.abs(balances.totalExpenses - rebuilt.totalExpenses) > 0.01) {
      errors.push(`Incohérence dépenses: ${balances.totalExpenses} vs ${rebuilt.totalExpenses}`);
    }

    // Vérifier les montants négatifs
    const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
    const expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);

    incomes.forEach(inc => {
      if (parseFloat(inc.amount) < 0) {
        errors.push(`Revenu négatif détecté: ${inc.id}`);
      }
    });

    expenses.forEach(exp => {
      if (parseFloat(exp.amount) < 0) {
        errors.push(`Dépense négative détectée: ${exp.id}`);
      }
    });

    savings.forEach(sav => {
      if (parseFloat(sav.balance) < 0) {
        errors.push(`Épargne négative détectée: ${sav.id}`);
      }
    });

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      balances,
      rebuilt
    };
  }
}

export default FinanceEngine;
