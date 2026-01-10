# 🏦 Moteur Financier Vola-ko - Documentation

## Vue d'ensemble

Le **Finance Engine** est le cœur de la logique financière de Vola-ko. Il centralise tous les calculs, validations et règles métier pour garantir la cohérence et la fiabilité des données financières.

---

## 📐 Règles Financières Officielles

### Définitions des Soldes

```
Solde Total = Revenus - Dépenses + Retraits épargne - Ajouts épargne

Solde Disponible (hors épargne) = Solde Total - Total Épargné
→ C'est l'argent RÉELLEMENT disponible pour dépenser

Solde avec Épargne = Solde Total
→ C'est le patrimoine total incluant l'épargne
```

### Flux Financiers

1. **Revenus** → Augmentent le solde disponible
2. **Dépenses** → Diminuent le solde disponible
3. **Ajout à l'épargne** → Transfère de l'argent du solde disponible vers l'épargne
4. **Retrait de l'épargne** → Transfère de l'argent de l'épargne vers le solde disponible

---

## 🔒 Validations Strictes

### Règle 1 : Dépenses

```javascript
// Une dépense NE PEUT ÊTRE ajoutée QUE SI :
soldeDisponibleHorsEpargne >= montantDépense

// Si le solde disponible = 0 :
- Bloquer l'ajout
- Afficher un message clair
```

**Exemple :**
```javascript
const validation = FinanceEngine.validateExpense(50000);

if (!validation.valid) {
  // Afficher: "Solde insuffisant. Disponible : 0 MGA"
  alert(validation.message);
}
```

### Règle 2 : Ajout à l'Épargne

```javascript
// Un ajout à l'épargne NE PEUT ÊTRE effectué QUE SI :
soldeDisponibleHorsEpargne >= montantÀÉpargner

// Si le solde disponible = 0 :
- Bloquer l'ajout
- Afficher une alerte
```

**Exemple :**
```javascript
const validation = FinanceEngine.validateSavingAddition(100000);

if (!validation.valid) {
  // Afficher: "Solde disponible insuffisant. Vous avez : 0 MGA"
  alert(validation.message);
}
```

### Règle 3 : Retrait de l'Épargne

```javascript
// Un retrait d'épargne :
- Diminue le solde de l'épargne
- AUGMENTE le solde disponible (via un revenu automatique)
- N'est PAS une dépense
```

**Exemple :**
```javascript
const result = FinanceEngine.withdrawFromSaving(savingId, 50000);

if (result.success) {
  // L'épargne diminue de 50 000 MGA
  // Le solde disponible augmente de 50 000 MGA
}
```

---

## 🎯 API du Moteur Financier

### Calcul des Soldes

```javascript
const balances = FinanceEngine.calculateBalances();

console.log(balances);
// {
//   totalIncome: 1000000,
//   totalExpenses: 500000,
//   totalSaved: 300000,
//   periodBalance: 500000,
//   availableBalance: 500000,    // Solde hors épargne
//   totalBalanceWithSavings: 800000,  // Solde avec épargne
//   ...
// }
```

### Validation de Dépense

```javascript
const validation = FinanceEngine.validateExpense(50000);

if (validation.valid) {
  // Dépense autorisée
  addExpense(50000);
} else {
  // Solde insuffisant
  alert(validation.message);
}
```

### Ajout à l'Épargne

```javascript
const result = FinanceEngine.addToSaving(
  savingId,
  100000,
  'Épargne vacances'
);

if (result.success) {
  // ✅ L'épargne augmente de 100 000 MGA
  // ✅ Une dépense automatique est créée
  // ✅ Le solde disponible diminue de 100 000 MGA
  alert(result.message);
}
```

### Retrait de l'Épargne

```javascript
const result = FinanceEngine.withdrawFromSaving(
  savingId,
  50000,
  'Utilisation épargne'
);

if (result.success) {
  // ✅ L'épargne diminue de 50 000 MGA
  // ✅ Un revenu automatique est créé
  // ✅ Le solde disponible augmente de 50 000 MGA
  alert(result.message);
}
```

### Vérification d'Intégrité

```javascript
const integrity = FinanceEngine.checkDataIntegrity();

if (!integrity.valid) {
  console.error('Erreurs détectées:', integrity.errors);
}

console.log('Soldes calculés:', integrity.balances);
console.log('Soldes reconstruits:', integrity.rebuilt);
```

---

## 📊 Historique et Traçabilité

### Récupération de l'Historique

```javascript
const history = FinanceEngine.getTransactionHistory();

// Retourne toutes les transactions triées (plus récent en premier)
history.forEach(tx => {
  console.log(`${tx.date}: ${tx.type} - ${tx.amount} MGA`);
});
```

### Reconstruction des Soldes

```javascript
const rebuilt = FinanceEngine.rebuildBalancesFromHistory();

// Recalcule tous les soldes depuis l'historique
console.log('Total revenus:', rebuilt.totalIncome);
console.log('Total dépenses:', rebuilt.totalExpenses);
console.log('Solde disponible:', rebuilt.availableBalance);
```

---

## 🔄 Flux de Données

### Ajout d'une Dépense

```
1. Utilisateur clique "Ajouter dépense"
2. Entre le montant: 50 000 MGA
3. FinanceEngine.validateExpense(50000)
   └─ Vérifie: soldeDisponible >= 50000
   └─ Si NON: Retourne { valid: false, message: "..." }
   └─ Si OUI: Retourne { valid: true }
4. Si valide: Enregistrer la dépense
5. Dashboard se met à jour automatiquement
```

### Ajout à l'Épargne

```
1. Utilisateur clique "Ajouter à l'épargne"
2. Entre le montant: 100 000 MGA
3. FinanceEngine.validateSavingAddition(100000)
   └─ Vérifie: soldeDisponible >= 100000
4. Si valide:
   ├─ Augmente le solde de l'épargne: +100 000 MGA
   ├─ Crée une dépense (catégorie "epargne"): 100 000 MGA
   └─ Le solde disponible diminue: -100 000 MGA
5. Dashboard affiche:
   ├─ Solde disponible: X - 100 000 MGA
   └─ Total épargné: Y + 100 000 MGA
```

### Retrait de l'Épargne

```
1. Utilisateur clique "Retirer de l'épargne"
2. Entre le montant: 50 000 MGA
3. FinanceEngine.validateSavingWithdrawal(savingId, 50000)
   └─ Vérifie: soldeEpargne >= 50000
4. Si valide:
   ├─ Diminue le solde de l'épargne: -50 000 MGA
   ├─ Crée un revenu (catégorie "epargne_retrait"): 50 000 MGA
   └─ Le solde disponible augmente: +50 000 MGA
5. Dashboard affiche:
   ├─ Solde disponible: X + 50 000 MGA
   └─ Total épargné: Y - 50 000 MGA
```

---

## 🧪 Tests et Vérification

### Console de Test

Dans la console du navigateur, vous pouvez tester le moteur :

```javascript
// Vérifier l'intégrité complète
FinanceIntegrity.runFullCheck();

// Tester des scénarios
FinanceIntegrity.testScenario();

// Calculer les soldes
const balances = FinanceEngine.calculateBalances();
console.table(balances);

// Valider une dépense
const validation = FinanceEngine.validateExpense(50000);
console.log(validation);
```

---

## ⚠️ Points Importants

1. **TOUJOURS utiliser FinanceEngine** pour les opérations financières
2. **JAMAIS modifier** directement les soldes sans passer par le moteur
3. **VALIDER avant d'enregistrer** (dépenses, ajouts épargne)
4. **L'historique est la source de vérité** - ne jamais recalculer a posteriori
5. **Aucun montant négatif** n'est autorisé

---

## 📝 Exemple Complet

### Scénario : Utilisateur avec 1 000 000 MGA

```javascript
// État initial
const balances = FinanceEngine.calculateBalances();
// availableBalance: 1 000 000 MGA
// totalSaved: 0 MGA

// 1. Ajouter 500 000 MGA à l'épargne "Vacances"
const result1 = FinanceEngine.addToSaving('saving_1', 500000, 'Vacances');
// ✅ success: true
// → Épargne Vacances: 500 000 MGA
// → Dépense créée: 500 000 MGA (catégorie "epargne")
// → Solde disponible: 500 000 MGA

// 2. Essayer d'ajouter 600 000 MGA (devrait échouer)
const result2 = FinanceEngine.addToSaving('saving_2', 600000);
// ❌ success: false
// message: "Solde disponible insuffisant. Vous avez : 500 000 MGA"

// 3. Retirer 100 000 MGA de l'épargne
const result3 = FinanceEngine.withdrawFromSaving('saving_1', 100000);
// ✅ success: true
// → Épargne Vacances: 400 000 MGA
// → Revenu créé: 100 000 MGA (catégorie "epargne_retrait")
// → Solde disponible: 600 000 MGA

// État final
const finalBalances = FinanceEngine.calculateBalances();
// availableBalance: 600 000 MGA
// totalSaved: 400 000 MGA
// totalBalanceWithSavings: 1 000 000 MGA
```

---

## 🚀 Intégration dans les Modules

### Dashboard

```javascript
import FinanceEngine from './financeEngine.js';

updateStats() {
  const balances = FinanceEngine.calculateBalances();
  
  this.updateElement('balance-available-value', 
    FinanceEngine.formatCurrency(balances.availableBalance));
  
  this.updateElement('balance-with-savings-value',
    FinanceEngine.formatCurrency(balances.totalBalanceWithSavings));
}
```

### Expenses

```javascript
import FinanceEngine from './financeEngine.js';

saveExpense() {
  const amount = parseFloat(document.getElementById('expense-amount').value);
  
  // VALIDATION via FinanceEngine
  const validation = FinanceEngine.validateExpense(amount);
  
  if (!validation.valid) {
    alert(validation.message);
    return;
  }
  
  // Enregistrer la dépense
  this.expenses.push({ amount, ... });
}
```

### Savings

```javascript
import FinanceEngine from './financeEngine.js';

addToSaving() {
  const result = FinanceEngine.addToSaving(savingId, amount, description);
  
  if (!result.success) {
    notify.error(result.message);
    return;
  }
  
  notify.success(result.message);
  this.reload();
}
```

---

## 📞 Support

Pour toute question sur le moteur financier, consultez ce document ou vérifiez les commentaires dans `financeEngine.js`.

**Règle d'or :** Toujours passer par FinanceEngine pour garantir la cohérence ! ✅
