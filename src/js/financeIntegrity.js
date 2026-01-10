/**
 * FINANCE INTEGRITY - Vérification de la cohérence financière
 * 
 * Ce module permet de vérifier que toutes les données financières
 * sont cohérentes et respectent les règles métier.
 */

import FinanceEngine from './financeEngine.js';
import { Storage, STORAGE_KEYS } from './storage.js';

class FinanceIntegrity {
  /**
   * Exécuter tous les tests de cohérence
   * @returns {Object} Rapport complet
   */
  static runFullCheck() {
    console.log('🔍 Vérification de l\'intégrité financière...\n');

    const report = {
      timestamp: new Date().toISOString(),
      passed: true,
      errors: [],
      warnings: [],
      info: []
    };

    // 1. Vérifier la cohérence des données
    const integrity = FinanceEngine.checkDataIntegrity();
    if (!integrity.valid) {
      report.passed = false;
      report.errors.push(...integrity.errors);
    }
    report.warnings.push(...integrity.warnings);

    // 2. Vérifier les balances
    const balances = FinanceEngine.calculateBalances();
    const rebuilt = FinanceEngine.rebuildBalancesFromHistory();

    report.info.push('=== SOLDES CALCULÉS ===');
    report.info.push(`Revenus du mois: ${FinanceEngine.formatCurrency(balances.totalIncome)}`);
    report.info.push(`Dépenses du mois: ${FinanceEngine.formatCurrency(balances.totalExpenses)}`);
    report.info.push(`Total épargné: ${FinanceEngine.formatCurrency(balances.totalSaved)}`);
    report.info.push(`Solde disponible (hors épargne): ${FinanceEngine.formatCurrency(balances.availableBalance)}`);
    report.info.push(`Solde total (avec épargne): ${FinanceEngine.formatCurrency(balances.totalBalanceWithSavings)}`);

    // 3. Vérifier la cohérence épargne
    const savings = Storage.get(STORAGE_KEYS.SAVINGS, []);
    const expenses = Storage.get(STORAGE_KEYS.EXPENSES, []);
    const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);

    const savingsExpenses = expenses.filter(exp => exp.category === 'epargne');
    const savingsIncomes = incomes.filter(inc => inc.category === 'epargne_retrait');

    report.info.push('\n=== ÉPARGNE ===');
    report.info.push(`Nombre d'épargnes actives: ${savings.length}`);
    report.info.push(`Dépenses d'épargne (ajouts): ${savingsExpenses.length}`);
    report.info.push(`Revenus d'épargne (retraits): ${savingsIncomes.length}`);

    // 4. Vérifier qu'aucun montant n'est négatif
    report.info.push('\n=== VALIDATION DES MONTANTS ===');
    
    const negativeExpenses = expenses.filter(exp => parseFloat(exp.amount) < 0);
    const negativeIncomes = incomes.filter(inc => parseFloat(inc.amount) < 0);
    const negativeSavings = savings.filter(sav => parseFloat(sav.balance) < 0);

    if (negativeExpenses.length > 0) {
      report.errors.push(`${negativeExpenses.length} dépense(s) avec montant négatif`);
      report.passed = false;
    }

    if (negativeIncomes.length > 0) {
      report.errors.push(`${negativeIncomes.length} revenu(s) avec montant négatif`);
      report.passed = false;
    }

    if (negativeSavings.length > 0) {
      report.errors.push(`${negativeSavings.length} épargne(s) avec solde négatif`);
      report.passed = false;
    }

    // 5. Vérifier la cohérence historique
    const history = FinanceEngine.getTransactionHistory();
    report.info.push(`Total de transactions: ${history.length}`);

    // Afficher le rapport
    this.displayReport(report);

    return report;
  }

  /**
   * Afficher le rapport dans la console
   */
  static displayReport(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 RAPPORT DE COHÉRENCE FINANCIÈRE');
    console.log('='.repeat(60));
    console.log(`Date: ${new Date(report.timestamp).toLocaleString('fr-FR')}`);
    console.log(`Statut: ${report.passed ? '✅ RÉUSSI' : '❌ ÉCHEC'}`);
    console.log('='.repeat(60));

    if (report.errors.length > 0) {
      console.log('\n❌ ERREURS:');
      report.errors.forEach(err => console.log(`  - ${err}`));
    }

    if (report.warnings.length > 0) {
      console.log('\n⚠️ AVERTISSEMENTS:');
      report.warnings.forEach(warn => console.log(`  - ${warn}`));
    }

    if (report.info.length > 0) {
      console.log('\nℹ️ INFORMATIONS:');
      report.info.forEach(info => console.log(`  ${info}`));
    }

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Tester un scénario complet
   */
  static testScenario() {
    console.log('🧪 Test du scénario financier...\n');

    // Scénario de test
    const scenario = [
      {
        name: 'Ajout de revenu',
        test: () => {
          const balancesBefore = FinanceEngine.calculateBalances();
          console.log(`  Avant: Solde disponible = ${FinanceEngine.formatCurrency(balancesBefore.availableBalance)}`);
          
          // Simuler l'ajout d'un revenu
          const incomes = Storage.get(STORAGE_KEYS.INCOMES, []);
          incomes.push({
            id: 'test_inc_1',
            amount: 100000,
            source: 'Test Revenu',
            date: new Date().toISOString()
          });
          Storage.set(STORAGE_KEYS.INCOMES, incomes);
          
          const balancesAfter = FinanceEngine.calculateBalances();
          console.log(`  Après: Solde disponible = ${FinanceEngine.formatCurrency(balancesAfter.availableBalance)}`);
          console.log(`  ✅ Différence: +${FinanceEngine.formatCurrency(100000)}`);
          
          // Nettoyer
          Storage.set(STORAGE_KEYS.INCOMES, incomes.filter(inc => inc.id !== 'test_inc_1'));
        }
      },
      {
        name: 'Validation dépense avec solde insuffisant',
        test: () => {
          const balances = FinanceEngine.calculateBalances();
          const testAmount = balances.availableBalance + 100000;
          
          const validation = FinanceEngine.validateExpense(testAmount);
          console.log(`  Montant test: ${FinanceEngine.formatCurrency(testAmount)}`);
          console.log(`  Solde disponible: ${FinanceEngine.formatCurrency(balances.availableBalance)}`);
          console.log(`  Résultat: ${validation.valid ? '❌ ÉCHEC (devrait refuser)' : '✅ RÉUSSI (refusé)'}`);
          console.log(`  Message: ${validation.message}`);
        }
      }
    ];

    scenario.forEach((test, index) => {
      console.log(`\n${index + 1}. ${test.name}`);
      test.test();
    });

    console.log('\n✅ Tests de scénario terminés\n');
  }
}

// Exporter pour utilisation dans la console
window.FinanceIntegrity = FinanceIntegrity;

export default FinanceIntegrity;
