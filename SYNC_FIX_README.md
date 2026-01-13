# Correctif de Synchronisation Supabase

## Problème identifié

Les données créées dans l'application n'étaient pas synchronisées avec Supabase, bien que l'interface indiquait que la synchronisation était réussie.

### Causes principales :

1. **Écrasement des données lors du chargement** : La fonction `loadFromSupabase()` écrasait complètement toutes les données locales par les données distantes, ce qui supprimait les nouvelles données locales non encore synchronisées.

2. **Absence de marqueur de synchronisation** : Les données chargées depuis Supabase n'avaient pas la propriété `synced: true`, ce qui empêchait le système de différencier les données déjà synchronisées des nouvelles données.

3. **Logs insuffisants** : Il était difficile de diagnostiquer le problème car les logs ne montraient pas en détail quelles données étaient filtrées ou ignorées.

## Solutions appliquées

### 1. Fusion intelligente des données (mergeData)

**Fichier modifié** : `src/js/sync.js`

Ajout d'une nouvelle fonction `mergeData()` qui :
- Marque toutes les données distantes comme `synced: true`
- Conserve les données locales non-synchronisées (`synced: false`)
- Déduplique les données par ID en privilégiant les données locales

```javascript
mergeData(remoteData, localUnsyncedData) {
  // Marquer toutes les données distantes comme synchronisées
  const remoteMarked = remoteData.map(item => ({ ...item, synced: true }));
  
  // Combiner les données
  const merged = [...localUnsyncedData, ...remoteMarked];
  
  // Dédupliquer par ID
  const uniqueIds = new Set();
  return merged.filter(item => {
    if (uniqueIds.has(item.id)) return false;
    uniqueIds.add(item.id);
    return true;
  });
}
```

### 2. Modification de loadFromSupabase()

Au lieu d'écraser les données :
```javascript
Storage.set(STORAGE_KEYS.INCOMES, incomes || []);
```

On fusionne maintenant :
```javascript
const localIncomes = Storage.get(STORAGE_KEYS.INCOMES, []);
const unsyncedIncomes = localIncomes.filter(item => !item.synced);
const mergedIncomes = this.mergeData(remoteIncomes || [], unsyncedIncomes);
Storage.set(STORAGE_KEYS.INCOMES, mergedIncomes);
```

Ceci est appliqué pour :
- Revenus (incomes)
- Dépenses (expenses)
- Budgets
- Économies (savings)
- Transactions d'économies

### 3. Logs améliorés

Ajout de logs détaillés pour chaque type de données :

```javascript
console.log(`📊 Revenus: ${remoteIncomes?.length || 0} distant(s), ${unsyncedIncomes.length} non-synchronisé(s)`);
console.log(`🔍 Synchronisation des revenus: ${localIncomes.length} revenu(s) local/locaux`);
console.log(`📝 ${toInsert.length} revenu(s) à insérer, ${localIncomes.filter(i => i.synced).length} déjà synchronisé(s)`);
```

Ces logs permettent de :
- Voir combien de données sont chargées depuis Supabase
- Voir combien de données locales ne sont pas encore synchronisées
- Voir combien de données vont être insérées lors de la prochaine synchronisation

## Flux de synchronisation corrigé

### 1. Connexion de l'utilisateur
```
handleSignIn() 
  ↓
loadFromSupabase()
  ↓
Fusion des données (mergeData)
  ↓
Données distantes marquées synced: true
Données locales non-sync conservées
```

### 2. Création de nouvelles données
```
Utilisateur crée un revenu
  ↓
{ id: UUID, ..., synced: false, created_at: ... }
  ↓
Sauvegardé dans localStorage
```

### 3. Synchronisation automatique (toutes les 60s)
```
sync()
  ↓
syncIncomes(), syncExpenses(), etc.
  ↓
Filtrer les données avec synced: false
  ↓
Insérer dans Supabase
  ↓
Marquer comme synced: true localement
```

## Test et vérification

Pour tester la correction :

1. **Ouvrir la console du navigateur** (F12)
2. **Se connecter à l'application**
3. **Observer les logs** :
   - `📥 Chargement des données depuis Supabase...`
   - `📊 Revenus: X distant(s), Y non-synchronisé(s)`
4. **Créer un nouveau revenu/dépense**
5. **Attendre 60 secondes** (ou forcer une sync)
6. **Observer les logs** :
   - `🔍 Synchronisation des revenus: X revenu(s) local/locaux`
   - `📝 Y revenu(s) à insérer, Z déjà synchronisé(s)`
   - `💾 Insertion de Y revenu(s)...`
   - `✅ Y revenu(s) synchronisé(s)`
7. **Vérifier dans Supabase** que les données apparaissent

## Vérification dans Supabase

1. Aller sur https://supabase.com
2. Sélectionner votre projet
3. Aller dans "Table Editor"
4. Vérifier les tables :
   - `volako_incomes`
   - `volako_expenses`
   - `volako_budgets`
   - `volako_savings`
   - `volako_savings_transactions`

Les nouvelles données devraient maintenant apparaître dans les tables correspondantes.

## Fichiers modifiés

- `src/js/sync.js` : Fonction principale de synchronisation
  - Ajout de `mergeData()`
  - Modification de `loadFromSupabase()`
  - Amélioration des logs dans toutes les fonctions `sync*()`

## Notes importantes

- Les données locales non-synchronisées sont toujours prioritaires lors de la fusion
- La synchronisation automatique s'exécute toutes les 60 secondes
- Les données sont également synchronisées lors de la déconnexion (`syncBeforeLogout()`)
- La propriété `synced: true/false` est maintenant cruciale pour le bon fonctionnement
