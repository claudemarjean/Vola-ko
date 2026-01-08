# Vola-ko 💰

Application de gestion de budget personnel 100% frontend, moderne et multilingue (FR/MG).

## 📋 Description

**Vola-ko** (qui signifie "mon argent") est une application web frontend destinée à la gestion de budget personnel. Construite avec du Vanilla JavaScript, CSS moderne et HTML5, elle offre une expérience utilisateur fluide et attractive sans dépendre d'un backend serveur. L'application est préparée pour une future intégration avec Supabase.

## ✨ Fonctionnalités

- 🌍 **Multilingue** : Français et Malagasy
- 🌙 **Mode clair/sombre** : Thème adaptatif avec préférence sauvegardée
- 📱 **Responsive** : Compatible mobile, tablette et desktop
- 🔐 **Authentification** : Système préparé pour Supabase Auth
- 🎨 **Design moderne** : Interface premium avec animations CSS
- ⚡ **Performance** : Code minifié et obfusqué en production

## 🚀 Démarrage rapide

### Prérequis

- Node.js 16+ et npm

### Installation

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev

# Build pour la production
npm run build

# Prévisualiser le build
npm run preview
```

## 📁 Structure du projet

```
Vola-ko/
├── src/
│   ├── assets/
│   │   ├── icons/
│   │   └── images/
│   ├── css/
│   │   ├── base.css          # Reset et styles de base
│   │   ├── theme.css         # Thème clair (défaut)
│   │   ├── dark.css          # Thème sombre
│   │   ├── animations.css    # Animations et transitions
│   │   └── app-layout.css    # Layout de l'application
│   ├── js/
│   │   ├── app.js            # Point d'entrée principal
│   │   ├── auth.js           # Gestion authentification
│   │   ├── i18n.js           # Internationalisation
│   │   ├── router.js         # Routage client
│   │   ├── storage.js        # LocalStorage management
│   │   ├── theme.js          # Gestion du thème
│   │   ├── components.js     # Composants réutilisables
│   │   ├── dashboard.js      # Logique Dashboard
│   │   ├── expenses.js       # Logique Dépenses
│   │   ├── incomes.js        # Logique Revenus
│   │   ├── budgets.js        # Logique Budgets
│   │   ├── reports.js        # Logique Rapports
│   │   └── settings.js       # Logique Paramètres
│   ├── locales/
│   │   ├── fr.json           # Traductions françaises
│   │   └── mg.json           # Traductions malgaches
│   ├── index.html            # Page d'accueil
│   ├── login.html            # Page connexion
│   ├── register.html         # Page inscription
│   ├── dashboard.html        # Dashboard principal
│   ├── expenses.html         # Gestion des dépenses
│   ├── incomes.html          # Gestion des revenus
│   ├── budgets.html          # Gestion des budgets
│   ├── reports.html          # Rapports financiers
│   └── settings.html         # Paramètres
├── dist/                      # Build de production (généré)
├── package.json
├── vite.config.js            # Configuration Vite
└── README.md
```

## 🛠️ Technologies

- **Frontend** : Vanilla JavaScript (ES6+), HTML5, CSS3
- **Build Tool** : Vite
- **Obfuscation** : vite-plugin-javascript-obfuscator
- **Storage** : LocalStorage
- **Future Backend** : Supabase (préparé)

## 🎨 Caractéristiques techniques

### CSS Moderne

- Variables CSS pour la personnalisation
- Dark mode avec `data-theme` attribute
- Animations fluides et performantes
- Design system cohérent

### JavaScript Modulaire

- Architecture en modules ES6
- Séparation des responsabilités
- Code commenté et maintenable
- Prêt pour l'extension

### Internationalisation

- Système i18n avec fichiers JSON
- Changement de langue dynamique
- Support FR et MG
- Facilement extensible

### Build System

- Minification JS/CSS automatique
- Obfuscation du code JavaScript
- Optimisation des assets
- Source maps pour le debugging

## 📝 Utilisation

### Changer de thème

Le bouton de thème en haut à droite permet de basculer entre mode clair et sombre. La préférence est sauvegardée automatiquement.

### Changer de langue

Le sélecteur de langue permet de basculer entre français (FR) et malgache (MG). La langue choisie est persistée.

### Authentification

Les pages de connexion et d'inscription sont fonctionnelles en mode simulation. Pour connecter à Supabase :

1. Installer Supabase client : `npm install @supabase/supabase-js`
2. Créer un fichier `.env` avec vos clés Supabase
3. Décommenter et adapter le code dans `src/js/auth.js`

## 🔒 Sécurité

- Validation des données côté client
- Mots de passe sécurisés (8+ caractères, majuscule, minuscule, chiffre)
- Code obfusqué en production
- Préparé pour l'authentification sécurisée via Supabase

## 🚀 Déploiement

Le dossier `dist/` généré par `npm run build` peut être déployé sur n'importe quel hébergement statique :

- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting
- Cloudflare Pages

## 📄 Licence

MIT

## 👨‍💻 Développement

Ce projet a été créé avec une approche frontend-first, permettant un développement rapide et une intégration backend future sans refactoring majeur.

---

Créé avec ❤️ pour une gestion de budget simple et efficace