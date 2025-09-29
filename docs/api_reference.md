# 📊 API Reference - AnalyLit v4.1

## 🎯 **Vue d'Ensemble**
L'API REST d'AnalyLit v4.1 offre un accès programmatique complet à toutes les fonctionnalités de l'application. Base URL: `http://localhost:8080/api`

---

## 📋 **Gestion des Projets**

### **Lister les Projets**
```http
GET /api/projects/
```

### **Créer un Projet**
```http
POST /api/projects
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Mon Projet ATN",
  "description": "Revue systématique Alliance Thérapeutique Numérique",
  "mode": "full",
  "extraction_grid": "atn"
}
```

### **Récupérer un Projet**
```http
GET /api/projects/{project_id}
Authorization: Bearer {token}
```

---

## 🔍 **Recherche Multi-Bases**

### **Lancer une Recherche**
```http
POST /api/projects/{project_id}/search
Content-Type: application/json
Authorization: Bearer {token}

{
  "query": "artificial intelligence AND empathy AND healthcare",
  "databases": ["pubmed", "arxiv", "crossref"],
  "filters": {
    "date_start": "2020-01-01",
    "date_end": "2024-12-31",
    "language": ["en", "fr"]
  }
}
```

**Réponse:**
```json
{
  "task_id": "search_123456",
  "status": "queued",
  "message": "Recherche lancée sur 3 bases de données"
}
```

### **Statut de Recherche**
```http
GET /api/projects/{project_id}/search/{task_id}/status
Authorization: Bearer {token}
```

---

## 🤖 **Screening par IA**

### **Lancer le Screening Automatique**
```http
POST /api/projects/{project_id}/screening
Content-Type: application/json
Authorization: Bearer {token}

{
  "criteria": "atn",
  "model": "llama3:8b",
  "threshold": 0.7,
  "double_screening": true
}
```

### **Résultats de Screening**
```http
GET /api/projects/{project_id}/screening/results
Authorization: Bearer {token}
```

**Réponse:**
```json
{
  "total_articles": 1250,
  "included": 89,
  "excluded": 1161,
  "pending_review": 15,
  "screening_metrics": {
    "precision": 0.84,
    "recall": 0.91,
    "f1_score": 0.87
  }
}
```

---

## 📊 **Extraction de Données**

### **Lancer l'Extraction ATN**
```http
POST /api/projects/{project_id}/extraction
Content-Type: application/json
Authorization: Bearer {token}

{
  "articles": [125, 126, 127],
  "extraction_grid": "atn_29_fields",
  "ai_model": "mistral:7b-instruct"
}
```

### **Récupérer les Extractions**
```http
GET /api/projects/{project_id}/extractions
Authorization: Bearer {token}
```

---

## 📈 **Analyses Avancées**

### **Score ATN**
```http
POST /api/projects/{project_id}/analyses/atn-score
Authorization: Bearer {token}
```

### **Analyse des Biais**
```http
POST /api/projects/{project_id}/analyses/bias-assessment
Content-Type: application/json
Authorization: Bearer {token}

{
  "rob_version": "2.0",
  "domains": ["selection", "performance", "detection", "attrition", "reporting"]
}
```

### **Génération Diagramme PRISMA**
```http
POST /api/projects/{project_id}/analyses/prisma-diagram
Authorization: Bearer {token}
```

---

## 💬 **Chat RAG**

### **Interroger le Corpus**
```http
POST /api/projects/{project_id}/chat
Content-Type: application/json
Authorization: Bearer {token}

{
  "question": "Quelles sont les principales métriques d'empathie utilisées dans les études analysées ?",
  "context": "atn",
  "max_tokens": 500
}
```

**Réponse:**
```json
{
  "answer": "Selon les études analysées...",
  "sources": [
    {
      "article_id": 125,
      "title": "Digital Empathy in Healthcare",
      "relevance_score": 0.92
    }
  ],
  "confidence": 0.85
}
```

---

## 📤 **Export et Synthèse**

### **Export Excel Complet**
```http
GET /api/projects/{project_id}/export/excel
Authorization: Bearer {token}
```

### **Export PRISMA-ScR**
```http
GET /api/projects/{project_id}/export/prisma-scr
Authorization: Bearer {token}
```

### **Génération Synthèse Narrative**
```http
POST /api/projects/{project_id}/synthesis
Content-Type: application/json
Authorization: Bearer {token}

{
  "style": "academic",
  "sections": ["introduction", "methods", "results", "discussion"],
  "format": "word"
}
```

---

## 📊 **Monitoring et Métriques**

### **Statut Système**
```http
GET /api/status
```

**Réponse:**
```json
{
  "status": "healthy",
  "version": "4.1.0",
  "services": {
    "database": "connected",
    "redis": "connected", 
    "ollama": "available",
    "workers": 4
  },
  "uptime": "2h 35m 12s"
}
```

### **Métriques d'Usage**
```http
GET /api/projects/{project_id}/metrics
Authorization: Bearer {token}
```

---

## 🔧 **Gestion des Tâches**

### **Liste des Tâches**
```http
GET /api/tasks
Authorization: Bearer {token}
```

### **Statut d'une Tâche**
```http
GET /api/tasks/{task_id}
Authorization: Bearer {token}
```

**Réponse:**
```json
{
  "task_id": "search_123456",
  "status": "success",
  "progress": 100,
  "result": {
    "articles_found": 1250,
    "databases_searched": 3,
    "duration": "2m 34s"
  },
  "started_at": "2024-09-21T02:30:00Z",
  "completed_at": "2024-09-21T02:32:34Z"
}
```

---

## ⚠️ **Gestion d'Erreurs**

### **Codes de Statut Standard**
- `200` - Succès
- `201` - Créé avec succès  
- `400` - Erreur de requête
- `401` - Non authentifié
- `403` - Accès refusé
- `404` - Ressource non trouvée
- `429` - Trop de requêtes
- `500` - Erreur serveur

### **Format des Erreurs**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le champ 'query' est requis",
    "details": {
      "field": "query",
      "expected": "string",
      "received": null
    }
  }
}
```

---

## 📊 **Limites et Quotas**

- **Rate limiting**: 100 requêtes/minute par utilisateur
- **Taille upload**: 50MB maximum par fichier
- **Timeout**: 30 secondes pour les requêtes standard, 30 minutes pour l'IA
- **Parallélisme**: 4 tâches simultanées par projet

---

## 🧪 **Environnement de Test**

### **Base URL Test**
```
http://localhost:8080/api
```

### **Utilisateur de Test**
```json
{
  "email": "test@analylit.dev",
  "password": "test123"
}
```

### **Postman Collection**
Téléchargez la [collection Postman](./assets/AnalyLit-v4.1.postman_collection.json) pour tester l'API.

---

## 🔧 **SDK et Clients**

### **Python (Recommandé)**
```python
import requests

class AnalyLitClient:
    def __init__(self, base_url="http://localhost:8080/api", token=None):
        self.base_url = base_url
        self.token = token
        self.headers = {"Authorization": f"Bearer {token}"} if token else {}
    
    def create_project(self, name, description=""):
        return requests.post(
            f"{self.base_url}/projects",
            json={"name": name, "description": description},
            headers=self.headers
        ).json()
```

### **JavaScript**
```javascript
class AnalyLitAPI {
  constructor(baseURL = 'http://localhost:8080/api', token = null) {
    this.baseURL = baseURL;
    this.token = token;
  }
  
  async createProject(name, description = '') {
    const response = await fetch(`${this.baseURL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({ name, description })
    });
    return response.json();
  }
}
```

---

## 📚 **Ressources Supplémentaires**

- **[Guide Technique](./TECHNICAL_GUIDE.md)** - Architecture et développement
- **[Guide Tests](./TESTING.md)** - Validation et tests automatisés  
- **[Démarrage Rapide](./QUICK_START.md)** - Installation et premier usage
- **[Dépannage](./TROUBLESHOOTING.md)** - Solutions aux problèmes courants

---

*Documentation générée automatiquement - Version 4.1.0*