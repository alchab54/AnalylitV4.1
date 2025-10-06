# 🏗️ Architecture AnalyLit v4.1 - Documentation Technique Complète

## 📋 Vue d'Ensemble

AnalyLit v4.1 est une application web modulaire pour l'automatisation de revues de littérature scientifique, construite avec une architecture microservices containerisée.

### 🎯 Technologies Principales
- **Backend** : Flask 3.x, SQLAlchemy 2.x, PostgreSQL 15
- **Frontend** : JavaScript Vanilla ES6+, CSS3, HTML5 SPA
- **Cache/Queues** : Redis 7.x, RQ (Redis Queue)
- **Container** : Docker, Docker Compose
- **Proxy** : Nginx 1.25
- **IA/LLM** : Ollama, intégrations cloud
- **Tests** : Pytest, Coverage

## 🏛️ Architecture Système

### Architecture Globale
```
┌─────────────────────────────────────────────────────────────┐
│                    ANALYLIT V4.1                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   Nginx     │    │    Web      │    │  Workers    │     │
│  │  (Proxy)    │◄──►│  (Flask)    │◄──►│    (RQ)     │     │
│  │ Port: 8080  │    │ Port: 80    │    │             │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│         │                   │                   │          │
│         │                   │                   │          │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │  Frontend   │    │ PostgreSQL  │    │   Redis     │     │
│  │  (Static)   │    │  Database   │    │   Cache     │     │
│  │             │    │ Port: 5432  │    │ Port: 6379  │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
│                             │                   │          │
│                             │                   │          │
│                      ┌─────────────┐    ┌─────────────┐     │
│                      │   Ollama    │    │   Volumes   │     │
│                      │   (LLM)     │    │   (Data)    │     │
│                      │Port: 11434  │    │             │     │
│                      └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### Services Docker

#### 🌐 Service Web (Flask)
```yaml
Rôle: API REST et application principale
Port: 80 (interne), 5000 (externe)
Image: analylit-web:latest
Dépendances: database, redis, ollama
Workers Gunicorn: 2-4 (configurable)
Healthcheck: /api/health
```

#### 🔄 Workers RQ
```yaml
worker-fast: Tâches rapides (< 30s)
worker-default: Tâches standard (< 300s)  
worker-ai: Tâches IA/LLM (< 3600s)
Queues: fast_queue, default_queue, ai_queue, analysis_queue
```

#### 🗄️ Base de Données
```yaml
Type: PostgreSQL 15
Schéma: analylit_schema
Port: 5432 (prod), 5434 (dev)
Volumes persistants: postgres_data
Migration: Alembic automatisé
```

#### ⚡ Cache & Queues
```yaml
Service: Redis 7
Configuration: 512MB RAM, policy allkeys-lru
Utilisation: Cache API, RQ jobs, sessions
Port: 6379 (interne)
```

#### 🌐 Proxy Web
```yaml
Service: Nginx 1.25
Configuration: reverse proxy, static files
Port: 8080 (externe)
SSL: Prêt (certificats à configurer)
```

## 📁 Structure des Dossiers

```
analylit-v4/
├── 🏗️ Architecture
│   ├── docker/                    # Configurations Docker
│   │   ├── Dockerfile.base-cpu    # Image de base CPU
│   │   ├── Dockerfile.base-gpu    # Image de base GPU  
│   │   ├── Dockerfile.web         # Service web principal
│   │   ├── Dockerfile.worker      # Services workers
│   │   ├── nginx.prod.conf        # Config Nginx production
│   │   └── nginx.dev.conf         # Config Nginx développement
│   ├── docker-compose.yml         # Orchestration production
│   └── docker-compose.dev.yml     # Orchestration développement
│
├── 🔧 Backend
│   ├── backend/
│   │   ├── server_v4_complete.py  # Application Flask principale
│   │   ├── tasks_v4_complete.py   # Tâches asynchrones RQ
│   │   └── config/
│   │       ├── config_v4.py       # Configuration par environnement
│   │       └── gunicorn.conf.py   # Configuration Gunicorn
│   │
│   ├── api/                       # Modules API REST
│   │   ├── __init__.py
│   │   ├── admin.py              # Administration système
│   │   ├── analysis_profiles.py   # Profils d'analyse IA
│   │   ├── extensions.py         # Extensions et plugins
│   │   ├── files.py              # Gestion fichiers
│   │   ├── projects.py           # Gestion projets
│   │   ├── prompts.py            # Gestion prompts IA
│   │   ├── reporting.py          # Génération rapports
│   │   ├── search.py             # Recherche multi-bases
│   │   ├── selection.py          # Sélection articles
│   │   ├── settings.py           # Paramètres application
│   │   ├── stakeholders.py       # Analyse parties prenantes
│   │   └── tasks.py              # Gestion tâches
│   │
│   └── utils/                     # Utilitaires partagés
│       ├── __init__.py
│       ├── extensions.py         # Extensions Flask (DB, Migration)
│       ├── models.py             # Modèles SQLAlchemy
│       ├── app_globals.py        # Variables globales
│       ├── logging_config.py     # Configuration logging prod
│       └── logging_config_dev.py # Configuration logging dev
│
├── 🎨 Frontend
│   └── web/                      # Application web SPA
│       ├── index.html            # Point d'entrée principal
│       ├── css/
│       │   └── styles.css        # Styles CSS unified
│       └── js/
│           ├── app-improved.js   # Application principale
│           ├── state.js          # Gestion état global
│           ├── core.js           # Fonctions core
│           ├── api.js            # Client API REST
│           ├── ui-improved.js    # Composants UI
│           ├── projects.js       # Module projets
│           ├── search.js         # Module recherche
│           ├── results.js        # Module résultats
│           ├── validation.js     # Module validation
│           ├── analyses.js       # Module analyses
│           ├── settings.js       # Module paramètres
│           └── [...].js          # Autres modules
│
├── 📊 Data & Tests
│   ├── migrations/              # Migrations Alembic
│   ├── tests/                   # Tests automatisés
│   │   ├── conftest.py          # Configuration pytest
│   │   ├── test_*.py            # Tests unitaires
│   │   └── fixtures/            # Données de test
│   ├── logs/                    # Logs application
│   └── projects/                # Projets utilisateurs
│
└── 🔧 Configuration
    ├── .env                     # Variables environnement
    ├── alembic.ini             # Configuration migrations
    ├── pytest.ini             # Configuration tests
    ├── requirements.txt        # Dépendances Python
    ├── Makefile.mk            # Commandes automatisées
    └── scripts/               # Scripts d'administration
        ├── entrypoint.sh      # Point d'entrée containers
        └── wait-for-it.sh     # Attente services
```

## 🔄 Flux de Données

### Workflow Principal
```
1. 🌐 Requête HTTP → Nginx (Port 8080)
2. 🔄 Proxy → Flask Web (Port 80)
3. 🛡️ Auth/Validation → Middleware
4. 📍 Routing → Blueprint API
5. 💾 Database → PostgreSQL
6. ⚡ Cache → Redis (si applicable)
7. 🤖 AI Tasks → RQ Workers
8. 📤 Response → JSON/HTML
```

### Types de Tâches
```
🚀 Fast Queue (< 30s):
- Validation données
- Exports simples
- Recherches basiques

⚙️ Default Queue (< 300s):  
- Imports fichiers
- Analyses statistiques
- Génération rapports

🧠 AI Queue (< 3600s):
- Screening automatique
- Extraction données
- Synthèse résultats
- Analyses ATN
```

## 🗄️ Modèle de Données

### Entités Principales
```sql
-- Projets de recherche
projects (id, name, description, created_at, status)

-- Articles scientifiques
articles (id, title, authors, journal, year, doi)

-- Résultats de recherche  
search_results (id, project_id, article_id, source, relevance_score)

-- Extractions de données
extractions (id, project_id, article_id, grid_id, data, quality_score)

-- Grilles d'extraction
grids (id, name, fields, is_atn_specific)

-- Analyses et synthèses
analyses (id, project_id, type, results, confidence_level)

-- Profils d'analyse IA
analysis_profiles (id, name, models, prompts, is_custom)
```

### Relations Clés
```
Project 1→∞ SearchResults 1→1 Article
Project 1→∞ Extractions ∞→1 Grid  
Project 1→∞ Analyses
Grid 1→∞ GridFields
AnalysisProfile 1→∞ Prompts
```

## 🔐 Sécurité & Performance

### Mesures de Sécurité
```yaml
Rate Limiting: Flask-Limiter (Redis backend)
CORS: Configuré pour domaines autorisés
Input Validation: Marshmallow schemas
SQL Injection: SQLAlchemy ORM protection
XSS: Jinja2 auto-escape
File Upload: Type/size validation
Environment: Variables sensibles externalisées
```

### Optimisations Performance
```yaml
Database:
  - Index sur colonnes fréquentes
  - Connection pooling (5-10 connexions)
  - Query optimization avec EXPLAIN

Cache Redis:
  - TTL adaptatif par type de données
  - Invalidation intelligente
  - Session storage

Workers:
  - Tâches asynchrones pour operations lentes
  - Retry logic avec backoff
  - Job monitoring et cleanup

Frontend:
  - Lazy loading modules
  - API call batching
  - Local state management
```

## 🌍 Environnements

### Développement
```yaml
Base URL: http://localhost:5000
Database: analylit_test_db (port 5434)
Redis: localhost:6380
Debug: True
Workers: Synchronous mode
Volumes: Code bind-mounted
```

### Production  
```yaml
Base URL: https://your-domain.com
Database: analylit_db (port 5432)
Redis: redis:6379 (internal)
Debug: False
Workers: 3x containers
Volumes: Named volumes
SSL: Nginx terminated
```

## 📈 Monitoring & Maintenance

### Health Checks
```yaml
Web: GET /api/health
Database: pg_isready
Redis: PING command
Workers: RQ status
Ollama: ollama list
```

### Logs Structure
```yaml
Application: logs/analylit.log (JSON format)
Workers: logs/workers.log
Nginx: logs/access.log, logs/error.log
Database: PostgreSQL logs
Rotation: Daily, 30 jours retention
```

### Backup Strategy
```yaml
Database: 
  - Daily automated backup
  - Point-in-time recovery ready
  - Test restore mensuel

Projects Data:
  - Rsync vers stockage externe
  - Versioning avec Git LFS

Configuration:
  - Infrastructure as Code (Docker Compose)
  - Environment configs versionnés
```

---

**📝 Note** : Cette architecture est évolutive et modulaire. Chaque composant peut être mis à l'échelle indépendamment selon les besoins.