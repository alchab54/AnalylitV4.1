# Changelog AnalyLit V4.1 Frontend

## Version 4.1.0 (Septembre 2025)

### Améliorations et Corrections

- **Correction des appels API:**
    - Mise à jour des URLs `fetchAPI` pour correspondre aux routes backend existantes (ajout du préfixe `/api` manquant).
    - Correction des endpoints spécifiques pour les analyses (ATN, PRISMA Flow, Méta-analyse, Statistiques descriptives) afin d'utiliser la route générique `/projects/{project_id}/run-analysis` avec le type d'analyse approprié.
    - Correction des endpoints pour la gestion des profils d'analyse (`/api/analysis-profiles` au lieu de `/api/profiles`).
    - Correction de l'endpoint pour les modèles Ollama (`/api/settings/models` au lieu de `/api/ollama/models`).
    - Correction de l'endpoint pour la gestion des grilles (`/projects/{project_id}/grids/{grid_id}` pour les opérations PUT).
- **Gestion des Grilles (`grids.js`):**
    - La fonction `handleDeleteGrid` est maintenant pleinement fonctionnelle et appelle la route backend `DELETE /api/projects/{id}/grids/{grid_id}`.
    - Le rafraîchissement de la liste des grilles après suppression est assuré.

- **Fonctionnalités en attente (commentées):**
    - Les appels API pour les fonctionnalités backend non implémentées ont été commentés dans le code JavaScript avec un `// TODO:` pour une implémentation future. Cela inclut:
        - Téléchargement en masse de PDFs (`import.js`)
        - Sauvegarde des paramètres Zotero (`import.js`)
        - Réessai de tâches (`core.js`)
        - Récupération des fichiers de projet (`projects.js`)
        - Rapports (bibliographie, tableau de synthèse, export Excel) (`reporting.js`)
        - Gestion du risque de biais (récupération et sauvegarde) (`rob.js`)
        - Décisions de screening (`screening.js`)
        - Gestion des parties prenantes (`stakeholders.js`)
- **Analyse du Risque de Biais (`rob.js`):**
    - Réactivation complète du module RoB.
    - `handleRunRobAnalysis` lance l'analyse sur les articles sélectionnés via `POST /api/projects/{id}/run-rob-analysis`.
    - `fetchAndDisplayRob` et `handleSaveRobAssessment` permettent de récupérer et de sauvegarder les évaluations via les routes `GET` et `POST` sur `/api/projects/{id}/risk-of-bias/{article_id}`.

- **Modernisation de l'interface:**
    - Mise à jour du titre de la page dans `index.html` pour une meilleure clarté.
    - Vérification de la structure HTML et des styles CSS existants, confirmant l'utilisation d'un système de design moderne et accessible.

### Infrastructure de Tests & Réorganisation de l'Espace de Travail

- **Configuration des Tests Frontend:**
    - Implémentation complète d'une suite de tests automatisés pour le frontend avec Jest (tests unitaires) et Cypress (tests End-to-End).
    - Création et configuration des fichiers `package.json`, `jest.config.js`, et `cypress.config.js` à la racine du projet.
    - Installation des dépendances npm nécessaires (`jest`, `jest-environment-jsdom`, `cypress`, `@testing-library/jest-dom`).
    - Définition des scripts npm pour l'exécution des tests unitaires (`test:unit`, `test:unit:watch`), des tests E2E (`test:e2e`, `test:e2e:open`), et de tous les tests (`test:all`).
- **Réorganisation de l'Espace de Travail:**
    - Déplacement des fichiers de test Jest (`toast.test.js`, `constants.test.js`) de `tests/` vers `web/js/`.
    - Création de fichiers de test Jest (`projects.test.js`, `articles.test.js`) dans `web/js/`.
    - Création de la structure de répertoires `cypress/e2e/`.
    - Déplacement des fichiers de test Cypress E2E (`smoke-test.cy.js`, `projects-workflow.cy.js`, `articles-workflow.cy.js`) de `tests/` vers `cypress/e2e/`.
    - Création d'un fichier de test Cypress E2E (`analyses-workflow.cy.js`) dans `cypress/e2e/`.
    - Création de la structure de répertoires pour les rapports de tests (`reports/coverage-frontend/`, `reports/cypress/screenshots/`, `reports/cypress/videos/`).
    - Nettoyage du répertoire `tests/` en supprimant les fichiers de test déplacés et les configurations Jest/Cypress redondantes.
    - Déplacement de divers fichiers du répertoire racine vers des sous-répertoires appropriés (`database/sql/`, `scripts/`, `config/`, `backend/`, `web/`, `web/js/`) pour une meilleure organisation.
    - Suppression du répertoire vide et redondant `server_v4_complete/`.
- **Correction de Configuration:**
    - Résolution du conflit de configuration Jest en supprimant le bloc `jest` du `package.json` racine, assurant que `jest.config.js` est la source unique de configuration Jest.

- **Chat RAG & Indexation (`chat.js`, `import.js`):**
    - La fonction `handleIndexPdfs` est réactivée et fonctionnelle, appelant la route `POST /api/projects/{id}/index-pdfs` pour permettre au chat de lire le contenu des documents.
    - La fonctionnalité de chat est maintenant pleinement opérationnelle.

- **Import & Export (`import.js`):**
    - L'upload de PDFs en masse via `handleUploadPdfs` est corrigé et utilise la bonne route backend `POST /api/projects/{id}/upload-pdfs-bulk`.
    - La fonction `exportForThesis` est réactivée pour permettre le téléchargement du package de thèse.

- **Gestion des Articles (`articles.js`):**
    - La fonction `handleDeleteSelectedArticles` a été réactivée. Elle utilise la route `/articles/batch-delete` comme spécifié dans les instructions initiales.

- **Parties Prenantes (`stakeholders.js`):**
    - Implémentation complète du module de gestion des parties prenantes, incluant les opérations CRUD via les routes API dédiées.

- **Rapports (`reporting.js`):**
    - Implémentation des fonctions de génération de bibliographie, de tableau de synthèse et d'export Excel, utilisant les routes API dédiées pour enfiler les tâches de fond.



### Fichiers Modifiés

- `web/index.html`
- `web/js/app-improved.js`
- `web/js/articles.js`
- `web/js/analyses.js`
- `web/js/chat.js`
- `web/js/core.js`
- `web/js/grids.js`
- `web/js/import.js`
- `web/js/projects.js`
- `web/js/reporting.js`
- `web/js/rob.js`
- `web/js/screening.js`
- `web/js/settings.js`
- `web/js/stakeholders.js`