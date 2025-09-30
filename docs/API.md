# Documentation API REST

## Authentification

Actuellement, aucune authentification n'est requise. L'API est accessible localement.

## Endpoints Principaux

### Projets

#### GET /api/projects/
Récupère la liste des projets.

**Réponse :**
```
[
  {
    "id": "uuid",
    "name": "Nom du projet",
    "description": "Description",
    "status": "active|completed",
    "created_at": "2025-01-01T00:00:00",
    "analysis_mode": "full|screening"
  }
]
```

#### POST /api/projects/
Crée un nouveau projet.

**Corps de requête :**
```
{
  "name": "Nom du projet",
  "description": "Description optionnelle",
  "analysis_mode": "full"
}
```

#### GET /api/projects/{id}
Récupère les détails d'un projet.

#### DELETE /api/projects/{id}
Supprime un projet.

### Recherche

#### POST /api/projects/{id}/search
Lance une recherche d'articles.

**Corps de requête :**
```
{
  "query": "therapeutic alliance AND digital",
  "databases": ["pubmed", "arxiv"],
  "max_results_per_db": 100
}
```

**Réponse :**
```
{
  "job_id": "task-uuid",
  "status": "queued"
}
```

### Articles

#### GET /api/projects/{id}/articles
Récupère les articles d'un projet avec pagination.

**Paramètres :**
- `page` : Numéro de page (défaut: 1)
- `per_page` : Articles par page (défaut: 20)
- `status` : Filtre par statut (include|exclude|pending)

#### PUT /api/projects/{project_id}/articles/{article_id}/decision
Met à jour la décision de validation.

**Corps de requête :**
```
{
  "decision": "include|exclude",
  "reason": "Raison optionnelle"
}
```

### Analyses

#### POST /api/projects/{id}/run-analysis
Lance une analyse spécialisée.

**Corps de requête :**
```
{
  "type": "rob|meta_analysis|synthesis",
  "parameters": {}
}
```

### Tâches

#### GET /api/tasks/{task_id}/status
Récupère l'état d'une tâche asynchrone.

**Réponse :**
```
{
  "id": "task-uuid",
  "status": "queued|running|completed|failed",
  "progress": 0.75,
  "result": null,
  "created_at": "2025-01-01T00:00:00"
}
```

### Export

#### GET /api/projects/{id}/export/excel
Télécharge un export Excel du projet.

#### GET /api/projects/{id}/export/prisma
Génère un diagramme PRISMA.

## Codes d'Erreur

- `200` : Succès
- `201` : Créé avec succès
- `400` : Requête malformée
- `404` : Ressource introuvable
- `500` : Erreur serveur

## Limites

- Taille maximale des requêtes : 10MB
- Timeout des recherches : 5 minutes
- Nombre maximum d'articles par projet : 10,000
- Taille des exports : 100MB

## Examples d'Usage

### Workflow Complet
```
# 1. Créer un projet
curl -X POST http://localhost:5000/api/projects/ \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Project", "analysis_mode": "full"}'

# 2. Lancer une recherche
curl -X POST http://localhost:5000/api/projects/{id}/search \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "databases": ["pubmed"]}'

# 3. Vérifier le statut
curl http://localhost:5000/api/tasks/{task_id}/status

# 4. Récupérer les résultats
curl http://localhost:5000/api/projects/{id}/articles

# 5. Exporter
curl http://localhost:5000/api/projects/{id}/export/excel > export.xlsx
```