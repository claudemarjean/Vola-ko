# 📊 Documentation des Calculs - Vola-ko

## Vue d'ensemble

Ce document explique la logique de tous les calculs financiers dans l'application Vola-ko pour éviter toute ambiguïté.

---

## 💰 Solde Disponible

### Définition
Le **Solde Disponible** représente l'argent que vous pouvez réellement dépenser.

### Formule
```
Solde Disponible = Revenus du mois - Dépenses du mois
```

### Important
- ✅ L'épargne **N'EST PAS** déduite du solde disponible
- ✅ Le solde disponible affiche uniquement le flux de trésorerie mensuel
- ✅ C'est l'argent "libre" à votre disposition

### Exemple
```
Revenus du mois:     1 000 000 MGA
Dépenses du mois:      600 000 MGA
--------------------------------
Solde Disponible:      400 000 MGA
```

---

## 💾 Épargne

### Définition
L'**Épargne** représente l'argent mis de côté, non disponible pour les dépenses quotidiennes.

### Calcul
```
Épargne Totale = Somme de tous les soldes d'épargne
```

### Affichage
- 💾 Affiché comme **indicateur séparé** sur le dashboard
- 💾 N'affecte pas le solde disponible
- 💾 Visible sous le solde disponible avec l'icône 💾

### Exemple
```
Épargne Vacances:    500 000 MGA
Épargne Urgence:     300 000 MGA
Épargne Projet:      200 000 MGA
--------------------------------
Épargne Totale:    1 000 000 MGA
```

---

## 🔄 Transactions d'Épargne

### Ajout à l'Épargne (Add)
Quand vous **ajoutez** de l'argent à une épargne :

1. ✅ Le solde de l'épargne augmente
2. ✅ Une **dépense automatique** est créée (catégorie "Épargne")
3. ✅ Le solde disponible **DIMINUE** du montant ajouté
4. 💡 L'argent est "gelé" dans l'épargne et n'est plus disponible

**Exemple:**
```
Avant ajout:
- Revenus du mois:     1 000 000 MGA
- Dépenses du mois:      300 000 MGA
- Solde Disponible:      700 000 MGA
- Épargne Vacances:      100 000 MGA

Ajout de 500 000 MGA à Épargne Vacances:
- Nouvelle dépense créée: "Épargne: Vacances" - 500 000 MGA
- Dépenses du mois:      800 000 MGA (+500 000)
- Solde Disponible:      200 000 MGA (-500 000) ← DIMINUE
- Épargne Vacances:      600 000 MGA (+500 000)
```

### Retrait d'Épargne (Withdraw)
Quand vous **retirez** de l'argent d'une épargne :

1. ✅ Le solde de l'épargne diminue
2. ✅ Un **revenu automatique** est créé avec le montant retiré
3. ✅ Le solde disponible **AUGMENTE** du montant retiré
4. 💡 L'argent redevient disponible à dépenser

**Exemple:**
```
Avant retrait:
- Revenus du mois:     1 000 000 MGA
- Dépenses du mois:      800 000 MGA
- Solde Disponible:      200 000 MGA
- Épargne Vacances:      600 000 MGA

Retrait de 100 000 MGA de Épargne Vacances:
- Nouveau revenu créé: "Retrait épargne: Vacances" - 100 000 MGA
- Revenus du mois:     1 100 000 MGA (+100 000)
- Solde Disponible:      300 000 MGA (+100 000) ← AUGMENTE
- Épargne Vacances:      500 000 MGA (-100 000)
```

---

## 📊 Autres Calculs

### Budget Restant
```
Budget Restant = Budget Total - Dépenses du mois
```

### Balance (dans Rapports)
```
Balance = Revenus (période) - Dépenses (période)
```
Note: Utilisé uniquement pour l'analyse et les rapports.

---

## 🎯 Scénario Complet

Voici un exemple complet pour illustrer tous les calculs :

### Situation Initiale
```
Revenus du mois:          1 500 000 MGA
Dépenses du mois:           300 000 MGA
Épargne Vacances:                 0 MGA
Épargne Urgence:                  0 MGA
```

### Calculs
```
Solde Disponible = 1 500 000 - 300 000 = 1 200 000 MGA
Épargne Totale   = 0 MGA
```

### Action 1: Ajout de 500 000 MGA à Épargne Vacances
```
Nouvelle dépense créée:    "Épargne: Vacances" - 500 000 MGA
Dépenses du mois:          300 000 + 500 000 = 800 000 MGA
Solde Disponible:          1 500 000 - 800 000 = 700 000 MGA ← DIMINUE
Épargne Vacances:          0 + 500 000 = 500 000 MGA
Épargne Totale:            500 000 MGA
```

### Action 2: Ajout de 200 000 MGA à Épargne Urgence
```
Nouvelle dépense créée:    "Épargne: Urgence" - 200 000 MGA
Dépenses du mois:          800 000 + 200 000 = 1 000 000 MGA
Solde Disponible:          1 500 000 - 1 000 000 = 500 000 MGA ← DIMINUE
Épargne Urgence:           0 + 200 000 = 200 000 MGA
Épargne Totale:            700 000 MGA
```

### Action 3: Retrait de 100 000 MGA de Épargne Vacances
```
Nouveau revenu créé:       "Retrait épargne: Vacances" - 100 000 MGA
Revenus du mois:           1 500 000 + 100 000 = 1 600 000 MGA
Solde Disponible:          1 600 000 - 1 000 000 = 600 000 MGA ← AUGMENTE
Épargne Vacances:          500 000 - 100 000 = 400 000 MGA
Épargne Totale:            600 000 MGA
```

### Résumé Final
```
Revenus du mois:           1 600 000 MGA (1.5M initial + 100K retrait)
Dépenses du mois:          1 000 000 MGA (300K + 500K épargne + 200K épargne)
Solde Disponible:            600 000 MGA (à dépenser)
Épargne Totale:              600 000 MGA (mis de côté)
```

---

## 🔍 Fichiers Concernés

### `src/js/dashboard.js`
- Calcul du solde disponible
- Affichage de l'indicateur d'épargne
- Statistiques principales

### `src/js/savings.js`
- Gestion des transactions d'épargne
- Création de revenus lors des retraits
- Retraits automatiques

### `src/js/reports.js`
- Calculs de balance pour les rapports
- Analyses de période

---

## ✅ Règles Importantes

1. **Solde Disponible** = Argent dépensable (Revenus - Dépenses)
2. **Épargne** = Argent mis de côté (séparé, affiché à part)
3. **Ajout à l'Épargne** = Crée une dépense automatique (réduit le solde disponible)
4. **Retrait d'Épargne** = Crée un revenu automatique (augmente le solde disponible)
5. **Cohérence** = Solde et Épargne sont **toujours équilibrés**

---

## 📝 Notes pour les Développeurs

Lors de modifications futures, veillez à :

- ✅ Toujours créer une dépense lors d'un ajout à l'épargne
- ✅ Toujours créer un revenu lors d'un retrait d'épargne
- ✅ Maintenir l'indicateur visuel d'épargne sur le dashboard
- ✅ Utiliser la catégorie "Épargne" pour les dépenses d'épargne
- ✅ Documenter tout nouveau calcul dans ce fichier

---

**Date de dernière mise à jour:** 10 janvier 2026
**Version:** 1.0.0
