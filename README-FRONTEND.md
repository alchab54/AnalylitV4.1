# README du Frontend AnalyLit V4.1

Ce document fournit un aperçu du frontend de l'application AnalyLit V4.1, de sa structure et des technologies utilisées.

## 1. Introduction

Le frontend d'AnalyLit V4.1 est une application web monopage (SPA) conçue pour interagir avec un backend Python/Flask. Il offre une interface utilisateur riche et dynamique pour la gestion de projets de revue de littérature scientifique, l'analyse de données, la recherche bibliographique et d'autres fonctionnalités basées sur l'IA.

## 2. Technologies Utilisées

- **HTML5** : Structure sémantique de l'application.
- **CSS3** : Stylisation de l'interface, utilisant un système de design basé sur des variables CSS pour une cohérence visuelle et une adaptabilité aux thèmes (clair/sombre).
- **JavaScript (ES Modules)** : Langage de programmation principal pour la logique côté client, la manipulation du DOM, les appels API et la gestion de l'état de l'application.
- **Socket.IO Client** : Pour la communication bidirectionnelle en temps réel avec le backend (notifications, mises à jour de statut).
- **Ace Editor** : Intégré pour l'édition de prompts et de templates.
- **Vis.js Network** : Pour la visualisation interactive des graphes de connaissances.
- **SheetJS (xlsx)** : Pour l'exportation de données au format Excel.

## 3. Architecture Frontend

Le frontend suit une architecture modulaire basée sur les principes des ES Modules, favorisant la maintenabilité et la scalabilité.

- **`web/index.html`** : Le point d'entrée unique de l'application. Il charge les feuilles de style, les bibliothèques externes et le script principal de l'application (`app-improved.js`).
- **`web/css/`** :
    - **`style-improved.css`** : Contient les styles globaux et les styles spécifiques aux composants de l'interface.
    - **`enhanced-design-tokens.css`** : Définit les variables CSS (couleurs, espacements, typographie, etc.) qui constituent le système de design de l'application, permettant une personnalisation facile et une gestion des thèmes.
- **`web/js/app-improved.js`** : Le script principal qui initialise l'application, gère l'état global (`appState`), initialise les écouteurs d'événements et coordonne le chargement des données initiales.
- **`web/js/core.js`** : Gère la délégation d'événements pour les interactions utilisateur (`data-action` attributes) et la navigation entre les différentes sections de l'application.
- **`web/js/api.js`** : Fournit une fonction utilitaire (`fetchAPI`) pour effectuer des requêtes HTTP vers le backend. Cette fonction gère l'ajout automatique du préfixe `/api` aux endpoints et le traitement des réponses/erreurs.
- **`web/js/state.js`** : Centralise la gestion de l'état global de l'application (`appState`), assurant une source unique de vérité pour les données partagées entre les modules.
- **Autres modules (`web/js/*.js`)** : Chaque fonctionnalité majeure de l'application (articles, analyses, chat, import, grilles, projets, rapports, paramètres, tâches, validation, risque de biais, etc.) est encapsulée dans son propre module JavaScript. Ces modules contiennent la logique spécifique à leur domaine, la manipulation du DOM et les appels à `fetchAPI` ou aux fonctions de gestion de l'état.

## 4. Développement et Contribution

### Structure des Fichiers Clés

```
web/
├── css/
│   ├── enhanced-design-tokens.css
│   └── style-improved.css
├── js/
│   ├── api.js
│   ├── app-improved.js
│   ├── articles.js
│   ├── analyses.js
│   ├── chat.js
│   ├── core.js
│   ├── grids.js
│   ├── import.js
│   ├── notifications.js
│   ├── projects.js
│   ├── reporting.js
│   ├── rob.js
│   ├── search.js
│   ├── settings.js
│   ├── stakeholders.js
│   ├── state.js
│   ├── tasks.js
│   ├── theme-manager.js
│   ├── ui-improved.js
│   └── validation.js
└── index.html
```

### Lancement de l'Application

Pour lancer l'application en mode développement, assurez-vous que le backend est en cours d'exécution et utilisez un serveur web statique pour servir les fichiers du dossier `web/`. Si vous utilisez `docker-compose`, l'application devrait être accessible via `http://localhost:8080`.

### Points d'Attention pour les Développeurs

- **Conventions de code** : Respectez les conventions de nommage, de formatage et de structure existantes.
- **Gestion de l'état** : Utilisez toujours les fonctions définies dans `state.js` pour modifier `appState`.
- **Appels API** : Utilisez la fonction `fetchAPI` de `api.js` pour toutes les communications avec le backend. Assurez-vous que les endpoints correspondent aux routes définies dans `server_v4_complete.py`.
- **Sécurité** : Utilisez `escapeHtml` (disponible via `ui-improved.js`) pour tout contenu généré dynamiquement et inséré dans le DOM afin de prévenir les attaques XSS.
- **Accessibilité** : Maintenez les attributs ARIA et la navigation au clavier pour une expérience utilisateur inclusive.
- **Fonctionnalités commentées** : Plusieurs fonctionnalités sont actuellement commentées dans le code JavaScript car leurs routes backend correspondantes ne sont pas encore implémentées. Référez-vous au `CHANGELOG.md` pour la liste complète et les `// TODO:` dans le code pour les emplacements spécifiques.

## 5. Tests

Référez-vous au document `TESTS-FRONTEND.md` pour un guide détaillé sur la façon de tester les fonctionnalités du frontend.

