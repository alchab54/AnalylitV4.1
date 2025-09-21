Tu agis comme un assistant de migration frontend. Objectif: synchroniser le frontend AnalyLit v4.1 avec l’API. Applique exactement les opérations suivantes, sans toucher au backend.

Règles générales

Ne change pas la logique métier, seulement les endpoints et identifiants de tâches.

Sauvegarde le dossier web/ avant modifications.

Ajoute seulement les fichiers listés.

N’introduis aucune URL externe.

Étapes

Sauvegarde

Crée un dossier backup_frontend_YYYYMMDD_HHMMSS.

Copie le dossier web/ dedans.

Patches fichiers existants (frontend)

Fichier web/js/api.js: remplace la fonction fetchAPI par la version robuste (préfixe /api, gestion JSON/erreurs).

Fichier web/js/articles.js:

Toutes les occurrences de task_id → job_id côté lecture de réponse.

handleDeleteSelectedArticles: utiliser POST sur /articles/batch-delete avec {article_ids, project_id} et lire response.job_id, puis rafraîchir via un event “articles:refresh”.

Fichier web/js/analyses.js:

Uniformiser les appels d’analyse via /projects/{projectId}/run-analysis.

Pour l’ATN: POST body {type: 'atnscores'}. Afficher le job_id si présent.

Fichier web/js/tasks.js:

Consommer /tasks/status, construire le DOM avec data-job-id, afficher job_id, status, progress, created_at.

Fichier web/js/settings.js:

Charger les profils via /analysis-profiles.

Charger les modèles via /settings/models.

HTML/UI

Fichier web/index.html: harmoniser le widget de monitoring pour “job” (compteur, barre de progression et libellés). Conserver la structure visuelle.

Nouveaux fichiers

Crée web/js/migration-fix.js avec la logique de migration DOM (data-task-id → data-job-id) et mise à jour des listeners d’événements “socket:job_update”.

Crée test_frontend_fixes.js (à la racine du repo ou sous web/js/tests/) qui importe fetchAPI et vérifie /projects, /tasks/status et la présence de job_id.

Documentation

Crée CORRECTIONS_APPLIQUEES.md à la racine, listant:

Désynchronisation job_id/task_id corrigée.

Endpoints corrigés (/analysis-profiles, /settings/models, /projects/{id}/run-analysis).

Fonctions impactées: articles (batch-delete), analyses (ATN), tasks (listing), settings (profils, modèles).

Tests effectués et checklisks de validation.

Validation

Redémarre les services web et worker (compose).

Ouvre l’app localement et vérifie l’absence d’erreurs console.

Exécute le script test_frontend_fixes.js et vérifie les ✓ (endpoints OK, job_id présent).

Cherche encore d’éventuelles occurrences de task_id dans web/js/ et signale-moi les restes.

Fin

Prépare un diff clair des fichiers modifiés/ajoutés.

Ne modifie pas d’autres zones non listées.

Si un endpoint manque côté backend, remonte l’info au lieu d’inventer.

Contexte de référence

Les changements sont motivés par une désynchronisation prouvée dans les logs/tests: le backend utilise job_id, certains modules front lisaient encore task_id. Les endpoints stables sont /analysis-profiles, /settings/models, et les analyses se déclenchent via /projects/{id}/run-analysis avec un champ type (ex.: 'atnscores').

Ces instructions reflètent fidèlement les actions à mener, basées sur le plan de migration documenté. Merci de les exécuter point par point.

Important: Après ces modifications, je veux un rapport final de Gemini listant: fichiers modifiés/créés, diff concis par fichier, et résultats des vérifications (console JS, script test, résiduels task_id).

—

Remarque pair-review

Le cœur de la désynchronisation est bien “task_id” vs “job_id” côté frontend, alors que les logs/tests backend confirment “job_id”. Corriger toutes les références et les points d’entrée API supprime la cause racine des divergences observées, conformément au plan fourni.