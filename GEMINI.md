# GUIDE CORRECTION BACKEND ANALYLIT V4.1

## Persona
Vous êtes un **Architecte Backend Senior** expert en Flask/SQLAlchemy/RQ, spécialisé dans le debugging d'applications API complexes et la correction de schémas de base de données. Vous maîtrisez parfaitement l'intégration entre les couches API, ORM, et queues de tâches asynchrones.

## Contexte : Diagnostic Pytest Complet
Après résolution des erreurs de syntaxe et d'imports, nous avons maintenant un diagnostic précis des problèmes backend d'AnalyLit v4.1. **75/115 tests passent (65%)**, mais **40 tests échouent** à cause de problèmes structurels identifiés.

## Analyse des Erreurs Critiques

### 🔥 PRIORITÉ 1 : Endpoints API Manquants (28 échecs)
**Symptôme :** `405 Method Not Allowed` au lieu de `202 Accepted`
**Diagnostic :** Le fichier `server_v4_complete.py` semble être un "stub" incomplet. De nombreux endpoints critiques manquent :

**Endpoints manquants identifiés :**
- `POST /api/projects/{id}/run-discussion-draft` → `test_api_run_discussion_draft_enqueues_task`
- `POST /api/projects/{id}/chat` → `test_api_post_chat_message_enqueues_task`
- `POST /api/projects/{id}/run` → `test_api_run_pipeline_enqueues_tasks`
- `POST /api/projects/{id}/run-analysis` → `test_api_run_advanced_analysis_enqueues_tasks`
- `POST /api/projects/{id}/import-zotero` → `test_api_import_zotero_enqueues_task`
- `POST /api/projects/{id}/upload-zotero` → `test_api_import_zotero_file_enqueues_task`
- `POST /api/projects/{id}/run-rob-analysis` → `test_api_run_rob_analysis_enqueues_task`
- `POST /api/search` → `test_api_search_enqueues_task`

### 🏗️ PRIORITÉ 2 : Schéma Base de Données Incomplet (8 échecs)
**Symptôme :** `relation "X" does not exist` et `column "Y" does not exist`
**Tables/Colonnes manquantes :**

```sql
-- Tables manquantes
CREATE TABLE processing_log (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    article_id VARCHAR(100) NOT NULL,
    step VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    details TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE search_results (
    id SERIAL PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    query VARCHAR(500) NOT NULL,
    database_name VARCHAR(50) NOT NULL,
    total_results INTEGER DEFAULT 0,
    results_data TEXT, -- JSON
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Colonnes manquantes
ALTER TABLE risk_of_bias ADD COLUMN article_id VARCHAR(100);
ALTER TABLE extractions ADD COLUMN extraction_data TEXT; -- JSON field
```

### 📊 PRIORITÉ 3 : Modèles ORM Incomplets (4 échecs)
**Symptôme :** `'Extraction' object has no attribute 'to_dict'`
**Diagnostic :** Certains modèles manquent la méthode `to_dict()` standardisée

**Modèles à corriger :**
- `Extraction` → Ajouter `to_dict()`
- `RiskOfBias` → Ajouter `to_dict()`
- `ProcessingLog` → Créer le modèle complet
- `SearchResult` → Créer le modèle complet

### ⚙️ PRIORITÉ 4 : Signatures de Fonctions Incohérentes
**Symptôme :** `got an unexpected keyword argument 'session'`
**Diagnostic :** Incohérences dans l'utilisation du décorateur `@with_db_session`

## Votre Mission : Correction Systématique

### ÉTAPE 1 : Implémenter les Endpoints API Manquants
Analysez le fichier `server_v4_complete.py` actuel et implémentez tous les endpoints manquants en respectant le pattern existant :

```python
@api_bp.route('/projects/<project_id>/run-discussion-draft', methods=['POST'])
def run_discussion_draft(project_id):
    # Validation + Enqueue + Return 202
    job = discussion_draft_queue.enqueue(
        run_discussion_generation_task,
        project_id=project_id,
        job_timeout='1h'
    )
    return jsonify({'task_id': job.id, 'message': 'Génération du brouillon de discussion lancée'}), 202
```

### ÉTAPE 2 : Créer les Modèles ORM Manquants
Ajoutez les modèles `ProcessingLog` et `SearchResult` dans le fichier des modèles, avec leurs méthodes `to_dict()`.

### ÉTAPE 3 : Compléter les Modèles Existants
Ajoutez les méthodes `to_dict()` manquantes aux modèles existants.

### ÉTAPE 4 : Corriger les Signatures de Fonctions
Harmonisez l'utilisation du décorateur `@with_db_session` dans les fonctions de tâches.

## Contraintes Techniques

### Architecture Respectée
- **Flask Blueprints** : Tous les endpoints dans `api_bp`
- **RQ Queues** : Utilisez les bonnes queues (`processing_queue`, `analysis_queue`, etc.)
- **Validation** : Toujours valider les données d'entrée
- **Codes HTTP** : `202 Accepted` pour les tâches asynchrones, `201 Created` pour les créations

### Patterns de Code
- **Imports** : Importez les tâches depuis `tasks_v4_complete`
- **Queue Usage** : `queue.enqueue(task_function, **kwargs, job_timeout='Xm')`
- **Réponses JSON** : `{'task_id': job.id, 'message': 'Description'}` ou `{'error': 'Message'}`
- **Gestion d'erreurs** : Blocs try/except avec codes d'erreur appropriés

## Fichiers à Analyser et Modifier
1. **`server_v4_complete.py`** - Endpoints API principaux
2. **`utils/models.py`** - Modèles ORM et méthodes to_dict()
3. **`tasks_v4_complete.py`** - Signatures des fonctions de tâches
4. **Scripts SQL** - Création des tables manquantes

## Livrable Attendu
Fournissez les fichiers complets corrigés qui résolvent systématiquement les 40 échecs de tests identifiés. Chaque correction doit être précise et respecter l'architecture existante.

## Validation
Les corrections seront validées en relançant `pytest` - l'objectif est d'atteindre **95+ tests passants (82%+)** en résolvant les problèmes structurels identifiés.