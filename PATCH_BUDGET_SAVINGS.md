# Correctif: Exclure les transferts d'épargne des calculs de budget

## Modifications à effectuer:

### 1. src/js/financeEngine.js (lignes ~63-65)

**Avant:**
```javascript
const totalIncome = periodIncomes.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
const totalExpenses = periodExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
```

**Après:**
```javascript
// Exclure les transferts d'épargne des statistiques
const totalIncome = periodIncomes
  .filter(inc => inc.category !== 'epargne_retrait')
  .reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);
const totalExpenses = periodExpenses
  .filter(exp => exp.category !== 'epargne')
  .reduce((sum, exp) => sum + parseFloat(exp.amount || 0), 0);
```

### 2. src/js/budgets.js (lignes ~94-107)

**Avant:**
```javascript
calculateSpent(category) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthExpenses = this.expenses.filter(exp => {
    const date = new Date(exp.date);
    return exp.category === category && 
           date.getMonth() === currentMonth && 
           date.getFullYear() === currentYear;
  });

  return monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
}
```

**Après:**
```javascript
calculateSpent(category) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const monthExpenses = this.expenses.filter(exp => {
    const date = new Date(exp.date);
    // Exclure les dépenses d'épargne (transferts internes)
    return exp.category === category && 
           exp.category !== 'epargne' &&
           date.getMonth() === currentMonth && 
           date.getFullYear() === currentYear;
  });

  return monthExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
}
```

### 3. src/js/dashboard.js (lignes ~62-66)

**Avant:**
```javascript
// Calculer le budget restant
const totalBudget = this.budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0);
const budgetRemaining = totalBudget - balances.totalExpenses;
this.updateElement('budget-value', this.formatCurrency(budgetRemaining));
```

**Après:**
```javascript
// Calculer le budget restant (exclure les transferts d'épargne)
const totalBudget = this.budgets.reduce((sum, budget) => sum + parseFloat(budget.amount || 0), 0);
// totalExpenses du FinanceEngine exclut déjà les dépenses 'epargne'
const budgetRemaining = totalBudget - balances.totalExpenses;
this.updateElement('budget-value', this.formatCurrency(budgetRemaining));
```

## Explication:

Les transferts d'épargne (ajout/retrait) sont des mouvements internes qui ne doivent pas impacter:
- Les statistiques de dépenses/revenus mensuels
- Les calculs de budget

Catégories concernées:
- `epargne` - Dépense créée lors d'un ajout à l'épargne
- `epargne_retrait` - Revenu créé lors d'un retrait de l'épargne

Ces transferts restent tracés dans l'historique mais n'affectent plus les budgets.
