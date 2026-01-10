# Ajout du champ de date pour le montant initial de l'épargne

## 1. Modifier src/savings.html

### Après la ligne 94 (après le champ saving-initial), AJOUTER:

```html
        <div class="form-group">
          <label for="saving-initial-date">Date du montant initial</label>
          <input type="date" id="saving-initial-date" class="form-input" required>
        </div>
```

Résultat final (lignes 91-100):
```html
        <div class="form-group">
          <label for="saving-initial" data-i18n="savings.initial_amount">Montant initial (MGA)</label>
          <input type="number" id="saving-initial" class="form-input" required min="0" value="0">
        </div>

        <div class="form-group">
          <label for="saving-initial-date">Date du montant initial</label>
          <input type="date" id="saving-initial-date" class="form-input" required>
        </div>

        <div id="goal-fields" style="display: none;">
```

---

## 2. Modifier src/js/savings.js

### A. Dans openSavingModal() - ligne ~241

AJOUTER après `form.reset();`:
```javascript
      // Définir la date du jour par défaut
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('saving-initial-date').value = today;
```

Résultat final (lignes 238-244):
```javascript
    } else {
      title.textContent = 'Créer une épargne';
      form.reset();
      document.getElementById('goal-fields').style.display = 'none';
      // Définir la date du jour par défaut
      const today = new Date().toISOString().split('T')[0];
      document.getElementById('saving-initial-date').value = today;
    }
```

### B. Dans saveSaving() - ligne ~253

AJOUTER après la récupération de targetDate:
```javascript
    const initialDate = document.getElementById('saving-initial-date').value;
```

Résultat final (lignes 252-256):
```javascript
    const initialAmount = parseFloat(document.getElementById('saving-initial').value) || 0;
    const targetAmount = type === 'goal' ? parseFloat(document.getElementById('saving-target').value) || 0 : 0;
    const targetDate = type === 'goal' ? document.getElementById('saving-target-date').value : null;
    const initialDate = document.getElementById('saving-initial-date').value;
```

### C. Dans saveSaving() - ligne ~326

REMPLACER:
```javascript
        const today = new Date().toISOString().split('T')[0];
        const result = FinanceEngine.addToSaving(
          saving.id,
          initialAmount,
          `Montant initial de ${name}`,
          today
        );
```

PAR:
```javascript
        const result = FinanceEngine.addToSaving(
          saving.id,
          initialAmount,
          `Montant initial de ${name}`,
          initialDate
        );
```

---

## Résumé des changements:

1. **savings.html** : Ajout d'un champ `<input type="date" id="saving-initial-date">` après le champ montant initial
2. **savings.js openSavingModal()** : Initialiser le champ de date avec la date du jour lors de la création
3. **savings.js saveSaving()** : Récupérer la date saisie et l'utiliser au lieu de générer automatiquement la date du jour

## Résultat:

- L'utilisateur peut maintenant choisir la date du montant initial lors de la création d'une épargne
- La date par défaut sera la date du jour
- La dépense automatique créée utilisera cette date, permettant d'enregistrer des épargnes datées du passé sans impacter les statistiques du mois en cours
- L'historique affichera la bonne date
