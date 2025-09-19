# Changelog AnalyLit V4.1 Frontend

## Version 4.1.0 (Septembre 2025)

### Améliorations et Corrections

- **Correction des appels API:**
    - Mise à jour des URLs `fetchAPI` pour correspondre aux routes backend existantes (ajout du préfixe `/api` manquant).
    - Correction des endpoints spécifiques pour les analyses (ATN, PRISMA Flow, Méta-analyse, Statistiques descriptives) afin d'utiliser la route générique `/projects/{project_id}/run-analysis` avec le type d'analyse approprié.
    - Correction des endpoints pour la gestion des profils d'analyse (`/api/analysis-profiles` au lieu de `/api/profiles`).
    - Correction de l'endpoint pour les modèles Ollama (`/api/settings/models` au lieu de `/api/ollama/models`).
    - Correction de l'endpoint pour la gestion des grilles (`/projects/{project_id}/grids/{grid_id}` pour les opérations PUT).

- **Fonctionnalités en attente (commentées):**
    - Les appels API pour les fonctionnalités backend non implémentées ont été commentés dans le code JavaScript avec un `// TODO:` pour une implémentation future. Cela inclut:
        - Suppression par lot d'articles (`articles.js`)
        - Téléchargement en masse de PDFs (`import.js`)
        - Indexation de PDFs (`import.js`, `chat.js`)
        - Sauvegarde des paramètres Zotero (`import.js`)
        - Réessai de tâches (`core.js`)
        - Suppression de grilles (`grids.js`)
        - Récupération des fichiers de projet (`projects.js`)
        - Rapports (bibliographie, tableau de synthèse, export Excel) (`reporting.js`)
        - Gestion du risque de biais (récupération et sauvegarde) (`rob.js`)
        - Décisions de screening (`screening.js`)
        - Gestion des parties prenantes (`stakeholders.js`)

- **Modernisation de l'interface:**
    - Mise à jour du titre de la page dans `index.html` pour une meilleure clarté.
    - Vérification de la structure HTML et des styles CSS existants, confirmant l'utilisation d'un système de design moderne et accessible.

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
