# Audit Technique Vola-ko (26-04-2026)

## Resume executif
- La logique metier financiere est dupliquee entre frontend et base.
- Le frontend calcule les soldes et les validations critiques depuis localStorage.
- L architecture de sync periodique cree des ecarts entre UI et donnees reelles.
- Les operations CRUD ne garantissent pas toujours un recalcul coherent apres mutation.

## Constat detaille (fichier/fonction -> probleme -> cause -> correction)

1) src/js/financeEngine.js / calculateBalances, validateExpense, addToSaving, withdrawFromSaving
- Probleme: calculs financiers critiques executes dans le navigateur.
- Cause: architecture historique basee cache local + moteur JS.
- Correction: suppression de ces calculs frontend et bascule vers SQL (fonctions/views/triggers).

2) src/js/sync.js / SyncManager (auto-sync, mergeData, syncBeforeLogout)
- Probleme: sync periodique et fusion locale/distante non deterministe.
- Cause: deux sources de verite (localStorage + Supabase).
- Correction: suppression de l auto-sync et ecriture/lecture directe en base.

3) src/js/auth.js / handleSignIn + logout
- Probleme: chargement local + sync demarree automatiquement, sync forcee a la deconnexion.
- Cause: couplage auth <-> pipeline de sync.
- Correction: auth simplifiee; aucune sync periodique; source de verite = base.

4) src/js/dashboard.js / updateStats + charts
- Probleme: stats et series calculees cote client depuis localStorage.
- Cause: absence de jeux de donnees agreges DB exposes au frontend.
- Correction: chargement via RPC SQL pre-calculees.

5) src/js/reports.js / updateStats + charts
- Probleme: sommes et agrégations faites dans le navigateur.
- Cause: logique analytique en JS au lieu de SQL.
- Correction: rapports alimentes exclusivement par fonctions SQL.

6) src/js/expenses.js / saveExpense
- Probleme: validation de solde localement avant insertion.
- Cause: dependance au FinanceEngine local.
- Correction: validation de fond via trigger SQL (rejet si solde insuffisant).

7) src/js/savings.js / saveTransaction + create/delete
- Probleme: transferts epargne creent des revenus/depenses artificiels localement.
- Cause: modelisation metier implantee dans le client.
- Correction: operation atomique SQL sur volako_savings_transactions + recalcul DB.

8) src/js/budgets.js / calculateSpent
- Probleme: consommation budget calculee localement.
- Cause: agrégation cote UI.
- Correction: progression budget servie par RPC SQL dediee.

9) src/js/settings.js / exportData
- Probleme: export depuis localStorage (potentiellement obsolète).
- Cause: persistance locale historique.
- Correction: export direct depuis les tables Supabase.

## Risques identifies
- Incoherences temporelles (delai entre action locale et sync distante).
- Divergence sur cas limites (offline, editions concurrentes, suppressions partielles).
- Regressions de total mensuel lors des transferts epargne.

## Architecture cible validee
- Base Supabase = unique source de verite.
- Frontend = CRUD brut + lecture de valeurs deja calculees.
- Règles metier sensibles enforcees en SQL (functions/triggers).
- Mode hors ligne: actions critiques bloquees avec message explicite.
