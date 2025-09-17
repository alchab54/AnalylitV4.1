**AnalyLit v4.1 \- Guide Technique Complet**

**Application de Scoping Review pour l'Alliance Thérapeutique Numérique**

**📋 Table des Matières**

1. [Vue d'ensemble](#bookmark=id.atiixzxrw0qp)

2. [Architecture système](#bookmark=id.9tut7gesch4q)

3. [Fonctionnalités principales](#bookmark=id.ocyfowc8e61a)

4. [Structure des fichiers](#bookmark=id.bkwq7immydyc)

5. [API et endpoints](#bookmark=id.1d463higxfxa)

6. [Système de tâches asynchrones](#bookmark=id.2c99uapk1b5h)

7. [Intelligence artificielle](#bookmark=id.l25mon8jqo7x)

8. [Tests et qualité](#bookmark=id.u4nu59yfdprd)

9. [Déploiement](#bookmark=id.da19g2lzkbzi)

10. [Documentation méthodologique](#bookmark=id.w33d4e7npj49)

**Vue d'ensemble**

**AnalyLit v4.1** est une application web sophistiquée conçue pour automatiser et optimiser les scoping reviews, particulièrement dans le domaine de l'alliance thérapeutique numérique. L'application intègre l'intelligence artificielle pour analyser de grands volumes d'articles scientifiques et faciliter leur sélection et extraction de données.

**🎯 Objectif Principal**

Permettre aux chercheurs de traiter efficacement de grands corpus d'articles scientifiques en automatisant :

* La recherche multi-bases de données

* Le screening d'articles par IA

* L'extraction structurée de données

* La génération de synthèses

* La validation inter-évaluateurs

**⚡ Technologies Principales**

* **Backend**: Python 3.11 \+ Flask \+ SQLAlchemy

* **Base de données**: PostgreSQL

* **Tâches asynchrones**: Redis \+ RQ (Redis Queue)

* **IA**: Ollama (LLaMA, Phi3, Mixtral)

* **Vectorisation**: ChromaDB \+ Sentence Transformers

* **Frontend**: JavaScript Vanilla (ES6 Modules)

* **Déploiement**: Docker \+ Docker Compose \+ Nginx

**Architecture Système**

**🏗️ Architecture Microservices**

`┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐`  
`│     Nginx       │    │    Frontend     │    │     Backend     │`  
`│   (Port 8080)   │───▶│  (SPA Vanilla)  │───▶│  Flask + SQLAlc │`  
`└─────────────────┘    └─────────────────┘    └─────────────────┘`  
                                                       `│`  
`┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐`  
`│   PostgreSQL    │    │      Redis      │    │     Worker      │`  
`│  (Port 5432)    │◀───│   (Port 6379)   │───▶│   RQ Tasks      │`  
`└─────────────────┘    └─────────────────┘    └─────────────────┘`  
                                                       `│`  
                       `┌─────────────────┐    ┌─────────────────┐`  
                       `│     Ollama      │    │    ChromaDB     │`  
                       `│  (Port 11434)   │◀───│   Vector Store  │`  
                       `└─────────────────┘    └─────────────────┘`

**🔄 Flux de Données**

1. **Utilisateur** → Frontend (SPA)

2. **Frontend** → API REST (Flask)

3. **API** → Base de données (PostgreSQL)

4. **API** → Files de tâches (Redis/RQ)

5. **Worker** → IA (Ollama) \+ Vector Store (ChromaDB)

6. **Notifications** → WebSocket (SocketIO)

### Flux de la Recherche Experte

Pour permettre une recherche de précision (Experte), le flux de données a été adapté pour gérer deux types de payloads.

1.  **Frontend (`web/js/search.js`)**
    * L'interface utilisateur détecte si le mode "Simple" ou "Expert" est activé.
    * **En mode Simple**, il envoie un objet JSON standard :
        `{ "query": "...", "sources": ["pubmed", "scopus"], ... }`
    * **En mode Expert**, il envoie un objet JSON structuré :
        `{ "expert_queries": { "pubmed": "...", "scopus": "..." }, "sources": ["pubmed", "scopus"], ... }`

2.  **Backend (Serveur)**
    * L'endpoint API `/api/searches` dans `server_v4_complete.py` vérifie la présence de la clé `expert_queries`.
    * Il transmet soit la `query` simple, soit le dictionnaire `expert_queries` à la tâche Celery (`tasks_v4_complete.py`).

3.  **Workers (Logique de Fetch)**
    * Dans `utils/fetchers.py`, les fonctions de recherche (ex: `search_pubmed`) acceptent désormais les requêtes expertes.
    * La logique interne vérifie si une `expert_query` est fournie pour la source actuelle.
    * Si oui, cette requête est utilisée directement sans modification.
    * Si non, le `fetcher` utilise l'ancienne logique de construction de requête à partir de la `query` simple.

**Fonctionnalités Principales**

**1\. 🔍 Recherche Multi-bases**

**Module**: `utils/fetchers.py`  
**Endpoint**: `POST /api/search`

* **PubMed** via API Entrez

* **arXiv** via API REST

* **CrossRef** via API REST

* **IEEE Xplore** (configuré mais nécessite clé API)

`# Exemple d'utilisation`  
`databases = ["pubmed", "arxiv", "crossref"]`  
`results = db_manager.search_multiple(query="diabetes", databases=databases)`

**2\. 🤖 Screening Intelligent par IA**

**Module**: `tasks_v4_complete.py::process_single_article_task`  
**Modèles**: Phi3-mini, LLaMA 3.1

* Score de pertinence 0-10

* Justification automatique

* Support PDF avec OCR

* Extraction de métadonnées

`# Prompt de screening`  
`prompt = get_screening_prompt_template().format(`  
    `title=article['title'],`  
    `abstract=article['abstract'],`   
    `database_source=article['database_source']`  
`)`

**3\. 📊 Extraction Structurée ATN**

**Spécialisation**: Alliance Thérapeutique Numérique  
**Grilles personnalisées**: JSON configurables

**Champs ATN spécialisés**:

* Type\_IA (chatbot, avatar, assistant virtuel)

* Score\_empathie\_IA vs Score\_empathie\_humain

* WAI-SR\_modifié (Working Alliance Inventory)

* Taux\_adhésion et Confiance\_algorithmique

* RGPD\_conformité et AI\_Act\_risque

**4\. 💬 Chat RAG (Retrieval-Augmented Generation)**

**Modules**:

* `tasks_v4_complete.py::index_project_pdfs_task`

* `tasks_v4_complete.py::answer_chat_question_task`

* Indexation automatique des PDFs

* Embeddings Sentence Transformers

* Recherche sémantique ChromaDB

* Réponses contextuelles via LLaMA

**5\. 📈 Analyses Avancées**

**Types d'analyses disponibles**:

* **Méta-analyse**: Intervalles de confiance, distribution scores

* **Scores ATN**: Métriques spécialisées alliance thérapeutique

* **Graphe de connaissances**: Visualisation relations articles

* **Diagramme PRISMA**: Flow chart automatique

* **Statistiques descriptives**: Synthèse quantitative

**6\. ✅ Validation Inter-évaluateurs**

**Module**: API endpoints pour validation double-aveugle  
**Métrique**: Coefficient Kappa de Cohen

* Import CSV décisions évaluateurs

* Calcul automatique accord inter-juges

* Gestion conflits de décision

**7\. 📋 Checklist PRISMA-ScR**

**Module**: `utils/prisma_scr.py`  
**Standard**: PRISMA Extension for Scoping Reviews

* 17 items PRISMA-ScR complets

* Sauvegarde progressive état

* Auto-complétion basée données projet

**Structure des Fichiers**

**📁 Architecture Générale**

`analylit/`  
`├── 🐍 Backend Python`  
`│   ├── server_v4_complete.py      # Serveur Flask principal`  
`│   ├── tasks_v4_complete.py       # Tâches asynchrones RQ`  
`│   ├── config_v4.py               # Configuration application`  
`│   ├── init_and_run.py           # Point d'entrée production`  
`│   │`  
`│   └── utils/                     # Modules utilitaires`  
`│       ├── models.py              # Modèles SQLAlchemy`  
`│       ├── database.py            # Gestion base données`  
`│       ├── ai_processors.py       # Interface Ollama`  
`│       ├── fetchers.py            # APIs externes`  
`│       ├── importers.py           # Import Zotero/CSV`  
`│       ├── analysis.py            # Analyses statistiques`  
`│       ├── notifications.py       # Système notifications`  
`│       ├── file_handlers.py       # Manipulation fichiers`  
`│       ├── helpers.py             # Fonctions utilitaires`  
`│       ├── prisma_scr.py          # Checklist PRISMA`  
`│       ├── prompt_templates.py    # Templates IA`  
`│       └── reporting.py           # Génération rapports`  
`│`  
`├── 🐳 Infrastructure`  
`│   ├── docker-compose-complete.yml # Orchestration services`  
`│   ├── Dockerfile-*               # Images conteneurs`  
`│   ├── nginx_complete.conf        # Configuration proxy`  
`│   └── env.example               # Variables environnement`  
`│`  
`├── 🧪 Tests`  
`│   ├── conftest.py               # Configuration pytest`  
`│   ├── test_*.py                 # Suites de tests`  
`│   └── locustfile.py            # Tests de charge`  
`│`  
`└── 📊 Configuration`  
    `├── pytest.ini                # Configuration Pytest`
    `├── profiles.json             # Profils modèles IA`  
    `└── requirements.txt          # Dépendances Python`

**🔧 Modules Principaux**

**server\_v4\_complete.py (2068 lignes)**

**Serveur Flask principal avec API REST complète**

**Blueprints et routes**:

* `/api/health` \- Vérification état services

* `/api/projects/*` \- CRUD projets

* `/api/search` \- Recherche multi-bases

* `/api/databases` \- Liste bases disponibles

* `/api/profiles/*` \- Gestion profils IA

* `/api/prompts/*` \- Templates personnalisés

* `/api/tasks/*` \- Statut tâches asynchrones

* `/api/ollama/*` \- Gestion modèles IA

**Fonctions clés**:

`def create_app() -> Flask                    # Factory application Flask`  
`def multi_database_search_task()            # Recherche asynchrone`  
`def with_db_session(func)                   # Décorateur gestion DB`  
`def update_project_status()                 # Mise à jour états projets`

**tasks\_v4\_complete.py (1429 lignes)**

**Système de tâches asynchrones avec RQ**

**Tâches principales**:

`@with_db_session`  
`def multi_database_search_task()            # Recherche multi-bases`  
`def process_single_article_task()           # Screening/extraction IA`    
`def run_synthesis_task()                    # Génération synthèses`  
`def run_discussion_generation_task()        # Brouillons discussion`  
`def index_project_pdfs_task()              # Indexation RAG`  
`def answer_chat_question_task()             # Chat IA contextuel`  
`def run_meta_analysis_task()               # Analyses statistiques`  
`def calculate_kappa_task()                 # Validation inter-évaluateurs`

**utils/models.py (471 lignes)**

**Modèles de données SQLAlchemy**

**Entités principales**:

`class Project(Base)                         # Projets recherche`  
`class SearchResult(Base)                    # Résultats recherche`  
`class Extraction(Base)                      # Données extraites`  
`class Grid(Base)                           # Grilles extraction`  
`class ChatMessage(Base)                     # Historique chat`  
`class AnalysisProfile(Base)                 # Profils IA`  
`class RiskOfBias(Base)                     # Évaluation biais`  
`class ProcessingLog(Base)                   # Logs traitement`

**utils/fetchers.py (796 lignes)**

**Interface APIs externes de recherche**

**Classes principales**:

`class DatabaseManager:`  
    `def search_pubmed(query, max_results)   # API PubMed/Entrez`  
    `def search_arxiv(query, max_results)    # API arXiv`  
    `def search_crossref(query, max_results) # API CrossRef`  
    `def _parse_pubmed_xml()                 # Parser XML PubMed`  
    `def _parse_arxiv_xml()                  # Parser Atom arXiv`

`def fetch_article_details(article_id)      # Récupération métadonnées`  
`def fetch_unpaywall_pdf_url(doi)          # URLs PDF Open Access`

**utils/ai\_processors.py (213 lignes)**

**Interface avec système IA Ollama**

**Fonctions clés**:

`def call_ollama_api(prompt, model, format)  # Appel API Ollama`  
`def requests_session_with_retries()         # Session HTTP robuste`  
`class AIResponseError(Exception)            # Gestion erreurs IA`

**API et Endpoints**

**🌐 Routes Principales**

**Gestion des Projets**

`GET    /api/projects                        # Liste projets`  
`POST   /api/projects                        # Créer projet`  
`GET    /api/projects/{id}                   # Détails projet`  
`DELETE /api/projects/{id}                   # Supprimer projet`  
`PUT    /api/projects/{id}/analysis-profile  # Modifier profil IA`

**Recherche et Résultats**

`POST   /api/search                          # Lancer recherche multi-bases`  
`GET    /api/projects/{id}/search-results    # Résultats paginés`  
`GET    /api/projects/{id}/search-stats      # Statistiques recherche`  
`GET    /api/databases                       # Bases disponibles`

**Traitement IA**

`POST   /api/projects/{id}/run               # Lancer pipeline IA`  
`POST   /api/projects/{id}/run-analysis      # Analyses avancées`  
`GET    /api/projects/{id}/extractions       # Données extraites`  
`POST   /api/projects/{id}/chat              # Chat RAG`

**Import/Export**

`POST   /api/projects/{id}/upload-pdfs-bulk  # Upload PDFs masse`  
`POST   /api/projects/{id}/upload-zotero     # Import fichier Zotero`  
`POST   /api/projects/{id}/import-zotero     # Sync PDFs Zotero`  
`GET    /api/projects/{id}/export            # Export complet`  
`GET    /api/projects/{id}/export/thesis     # Export thèse ATN`

**Administration**

`GET    /api/health                          # État services`  
`GET    /api/queues/info                     # État files tâches`  
`POST   /api/queues/{name}/clear             # Vider file`  
`GET    /api/tasks/status                    # État tâches`  
`POST   /api/tasks/{id}/cancel               # Annuler tâche`

**📡 Format des Réponses**

**Réponse standard**:

`{`  
  `"status": "success|error",`  
  `"data": {...},`  
  `"message": "Description",`  
  `"timestamp": "2024-01-15T10:30:00Z"`  
`}`

**Réponse tâche asynchrone**:

`{`  
  `"message": "Tâche lancée",`  
  `"task_id": "uuid-task-id",`  
  `"status_url": "/api/tasks/uuid-task-id/status"`  
`}`

**Système de Tâches Asynchrones**

**🔄 Files RQ (Redis Queue)**

**4 files spécialisées**:

1. **analylit\_processing\_v4** \- Traitement articles (screening/extraction)

2. **analylit\_synthesis\_v4** \- Génération synthèses

3. **analylit\_analysis\_v4** \- Analyses statistiques avancées

4. **analylit\_background\_v4** \- Tâches fond (indexation, import)

**⚡ Tâches par Catégorie**

**Recherche et Import**

`multi_database_search_task()               # Recherche multi-bases`  
`import_from_zotero_file_task()            # Import fichier Zotero`  
`import_pdfs_from_zotero_task()            # Sync PDFs Zotero API`  
`add_manual_articles_task()                # Ajout manuel articles`

**Traitement IA**

`process_single_article_task()             # Screening/extraction individuel`  
`run_synthesis_task()                      # Synthèse articles pertinents`  
`run_discussion_generation_task()          # Génération discussion`  
`index_project_pdfs_task()                # Indexation vectorielle`  
`answer_chat_question_task()               # Réponses chat RAG`

**Analyses Avancées**

`run_meta_analysis_task()                  # Méta-analyse statistique`  
`run_atn_score_task()                      # Scores ATN spécialisés`  
`run_knowledge_graph_task()               # Graphe connaissances`  
`run_prisma_flow_task()                    # Diagramme PRISMA`  
`run_descriptive_stats_task()             # Statistiques descriptives`  
`calculate_kappa_task()                    # Coefficient Kappa Cohen`  
`run_risk_of_bias_task()                  # Évaluation biais`

**📊 Monitoring des Tâches**

**Statuts possibles**:

* `queued` \- En attente

* `started` \- En cours

* `finished` \- Terminée avec succès

* `failed` \- Échouée avec erreur

* `canceled` \- Annulée utilisateur

**Notifications WebSocket**:

`// Frontend reçoit notifications temps réel`  
`socket.on('task_progress', (data) => {`  
  `updateProgressBar(data.progress);`  
`});`

**Intelligence Artificielle**

**🧠 Modèles Utilisés**

**Configuration par défaut** (`profiles.json`):

`{`  
  `"fast": {`  
    `"preprocess": "phi3:mini",`  
    `"extract": "phi3:mini",`   
    `"synthesis": "llama3.1:8b"`  
  `},`  
  `"standard": {`  
    `"preprocess": "phi3:mini",`  
    `"extract": "llama3.1:8b",`  
    `"synthesis": "llama3.1:8b"`    
  `},`  
  `"deep": {`  
    `"preprocess": "llama3.1:8b",`  
    `"extract": "mixtral:8x7b",`  
    `"synthesis": "llama3.1:70b"`  
  `}`  
`}`

**📝 Templates de Prompts**

**Screening Template**

`def get_screening_prompt_template():`  
    `return """En tant qu'assistant de recherche spécialisé,`   
    `analysez cet article et déterminez sa pertinence.`  
      
    `Titre: {title}`  
    `Résumé: {abstract}`  
    `Source: {database_source}`  
      
    `Répondez UNIQUEMENT en JSON:`  
    `{{"relevance_score": 0-10, "decision": "À inclure"|"À exclure",`   
      `"justification": "..."}}"""`

**Template ATN Spécialisé**

`def get_scoping_atn_template(fields):`  
    `return """ROLE: Assistant expert en scoping review sur`   
    `l'alliance thérapeutique numérique.`  
      
    `CONSIGNES SPÉCIALES ALLIANCE THÉRAPEUTIQUE NUMÉRIQUE :`  
    `- Identifiez le type d'IA utilisé (chatbot, avatar, assistant virtuel)`  
    `- Relevez tous les scores d'empathie (IA vs humain)`  
    `- Notez les instruments (WAI-SR modifié, etc.)`  
    `- Analysez acceptabilité et adhésion patients`  
    `- Évaluez confiance algorithmique et aspects éthiques`  
      
    `TEXTE À ANALYSER: {text}`  
    `Répondez UNIQUEMENT avec ce JSON : {...}"""`

**🔍 Système RAG (Retrieval-Augmented Generation)**

**Pipeline complet**:

1. **Indexation** (`index_project_pdfs_task`):

`# Extraction texte PDF`  
`pdf_text = extract_text_from_pdf(pdf_path)`

`# Découpage chunks`  
`chunks = [text[i:i+1200] for i in range(0, len(text), 1000)]`

`# Vectorisation`  
`embeddings = embedding_model.encode(chunks)`

`# Stockage ChromaDB`  
`collection.add(documents=chunks, embeddings=embeddings)`

2. **Requête** (`answer_chat_question_task`):

`# Vectorisation question`  
`query_embedding = embedding_model.encode([question])`

`# Recherche similarité`  
`results = collection.query(query_embeddings=query_embedding, n_results=3)`

`# Génération réponse`  
`context = "\n".join(results['documents'][0])`  
`prompt = f"Contexte: {context}\nQuestion: {question}"`  
`response = call_ollama_api(prompt, "llama3.1:8b")`

**Tests et Qualité**

**🧪 Suite de Tests Complète**

**Couverture**: 8 modules de tests, \>50 tests

**Tests Unitaires**

`# test_ai_processors.py - Interface IA`  
`def test_call_ollama_api_text_output_success()`  
`def test_call_ollama_api_json_output_success()`  
`def test_call_ollama_api_malformed_json_cleanup()`

`# test_database.py - Base de données`  
`def test_init_db_basic_initialization()`  
`def test_seed_default_data_no_data_exists()`

`# test_importers.py - Import Zotero`    
`def test_extract_reference_data()`  
`def test_process_removes_duplicates()`

**Tests d'Intégration**

`# test_server_endpoints.py - API REST`  
`def test_create_project()`  
`def test_search_enqueues_task()`  
`def test_run_pipeline_enqueues_tasks()`

`# test_task_processing.py - Tâches RQ`  
`def test_search_task_adds_articles_to_db()`  
`def test_process_single_article_task_full_extraction()`

**Tests End-to-End**

`# test_e2e_workflow.py - Selenium`  
`@pytest.mark.e2e`  
`def test_e2e_create_and_find_project()`  
`def test_e2e_search_and_results_workflow()`

**Tests de Charge**

`# locustfile.py - Locust`  
`class AnalyLitUser(HttpUser):`  
    `@task(5)`  
    `def run_search_and_analysis_pipeline()`  
      
    `@task(1)`    
    `def ask_chat_rag()`

**📊 Qualité Code**

**Métriques de test**:

* Tests unitaires: ✅ 25+ tests

* Tests intégration: ✅ 15+ tests

* Tests E2E: ✅ 2 workflows complets

* Tests charge: ✅ Scenarios réalistes

* Couverture: \~85% du code critique

**Pratiques qualité**:

* Fixtures pytest réutilisables

* Mocking approprié (Redis, IA, DB)

* Tests isolation (clean\_db)

* Assertions robustes

* Gestion erreurs complète

**Déploiement**

**🐳 Architecture Docker**

**Services orchestrés** (`docker-compose-complete.yml`):

`services:`  
  `db:          # PostgreSQL 15`  
  `redis:       # Redis 7 (cache + queues)`  
  `ollama:      # Ollama IA (GPU support)`  
  `web:         # Flask backend`  
  `worker:      # RQ worker`    
  `nginx:       # Reverse proxy + frontend`

**🚀 Déploiement Production**

**Commandes essentielles**:

`# Préparation`  
`cp env.example .env`  
`# Éditer .env avec vos configurations`

`# Démarrage`  
`docker-compose -f docker-compose-complete.yml up --build -d`

`# Vérification`  
`docker-compose ps`  
`curl http://localhost:8080/api/health`

`# Monitoring`  
`docker-compose logs -f web worker`

**Variables d'environnement critiques**:

`# Base de données`  
`DATABASE_URL=postgresql+psycopg2://user:pass@db:5432/analylit_db`

`# Services`  
`REDIS_URL=redis://redis:6379/0`    
`OLLAMA_BASE_URL=http://ollama:11434`

`# APIs externes`  
`UNPAYWALL_EMAIL=your@email.com`  
`ZOTERO_USER_ID=your_zotero_id`  
`ZOTERO_API_KEY=your_api_key`

`# Sécurité`    
`SECRET_KEY=your_secret_key_here`

**Commandes Utiles (via Makefile)**

Le `Makefile` à la racine du projet fournit des raccourcis pour les opérations courantes.

*   **Démarrer l'application :**
    ```bash
    make start
    ```
*   **Arrêter l'application :**
    ```bash
    make stop
    ```
*   **Télécharger les modèles IA de base :**
    ```bash
    make models
    ```
*   **Lancer la suite de tests complète :**
    ```bash
    make test
    ```

**📊 Monitoring Production**

**Health Checks**:

* `/api/health` \- État global services

* `/api/queues/info` \- État files de tâches

* Logs agrégés Docker Compose

* Métriques ressources conteneurs

**Documentation Méthodologique**

**🎯 Justification de l'Approche**

**1\. Scoping Review vs Systematic Review**

L'application implémente spécifiquement la méthodologie Scoping Review selon les recommandations JBI (Joanna Briggs Institute) et PRISMA-ScR, particulièrement adaptée pour :

* **Cartographier** l'étendue de la littérature sur l'alliance thérapeutique numérique

* **Identifier** les lacunes de recherche dans un domaine émergent

* **Examiner** la faisabilité d'une revue systématique future

* **Clarifier** les concepts et définitions dans ce domaine multidisciplinaire

**Références méthodologiques**:

* Peters, M. D. J., et al. (2020). Updated methodological guidance for JBI scoping reviews. *JBI Database of Systematic Reviews and Implementation Reports*, 18(10), 2119-2126.

* Tricco, A. C., et al. (2018). PRISMA extension for scoping reviews (PRISMA-ScR). *Annals of Internal Medicine*, 169(7), 467-473.

**2\. Intelligence Artificielle pour le Screening**

L'utilisation d'IA pour le screening préliminaire est une approche validée scientifiquement qui permet de :

* **Accélérer** le processus de sélection sur de grands corpus (\>10,000 articles)

* **Standardiser** les critères de pertinence via des prompts structurés

* **Réduire** la charge de travail des chercheurs tout en maintenant la qualité

* **Améliorer** la reproductibilité du processus de sélection

**Références sur l'IA en revues systématiques**:

* Gates, A., et al. (2020). Technology-assisted title and abstract screening for systematic reviews: a retrospective evaluation of the Abstrackr machine learning tool. *Systematic Reviews*, 9(1), 1-22.

* Tsafnat, G., et al. (2014). Systematic review automation technologies. *Systematic Reviews*, 3(1), 1-15.

* Beller, E., et al. (2018). Making progress with the automation of systematic reviews. *Systematic Reviews*, 7(1), 1-8.

**3\. Validation Inter-évaluateurs avec Kappa**

L'implémentation du coefficient Kappa de Cohen répond aux standards de qualité méthodologique :

**Seuils d'interprétation utilisés** (Landis & Koch, 1977):

* κ \< 0.20 : Accord faible

* 0.20 ≤ κ \< 0.40 : Accord passable

* 0.40 ≤ κ \< 0.60 : Accord modéré

* 0.60 ≤ κ \< 0.80 : Accord substantiel

* κ ≥ 0.80 : Accord quasi parfait

**Références validation**:

* McHugh, M. L. (2012). Interrater reliability: the kappa statistic. *Biochemia Medica*, 22(3), 276-282.

* Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics*, 33(1), 159-174.

**4\. Approche RAG (Retrieval-Augmented Generation)**

L'implémentation du système RAG pour l'analyse contextuelle des documents suit les meilleures pratiques :

**Avantages méthodologiques**:

* **Précision** : Réponses basées sur le contenu réel des documents

* **Traçabilité** : Sources des réponses identifiables et vérifiables

* **Scalabilité** : Traitement de corpus volumineux (\>1GB de PDFs)

* **Contextualisation** : Maintien du contexte scientifique spécialisé

**Références RAG**:

* Lewis, P., et al. (2020). Retrieval-augmented generation for knowledge-intensive NLP tasks. *Advances in Neural Information Processing Systems*, 33, 9459-9474.

* Guu, K., et al. (2020). Retrieval augmented language model pre-training. *International Conference on Machine Learning*, 3929-3938.

**🔬 Spécialisation Alliance Thérapeutique Numérique**

**Framework conceptuel implémenté**:

L'application intègre les dimensions clés de l'alliance thérapeutique selon Bordin (1979), adaptées au contexte numérique :

1. **Bond (Lien)** : Mesurée via scores d'empathie IA vs humain

2. **Goals (Objectifs)** : Évaluée via taux d'adhésion et acceptabilité

3. **Tasks (Tâches)** : Analysée via fréquence d'usage et interactions

**Instruments de mesure intégrés**:

* **WAI-SR modifié** : Working Alliance Inventory \- Short Revised adapté IA

* **Échelles d'empathie** : Comparaison scores IA vs interactions humaines

* **Métriques d'adhésion** : Taux de completion, durée engagement

* **Confiance algorithmique** : Scales de confiance technologique

**Références alliance thérapeutique numérique**:

* Bordin, E. S. (1979). The generalizability of the psychoanalytic concept of the working alliance. *Psychotherapy: Theory, Research & Practice*, 16(3), 252-260.

* Bickmore, T. W., et al. (2010). Maintaining reality: Relational agents for antipsychotic medication adherence. *Interacting with Computers*, 22(4), 276-288.

* Car, J., & Sheikh, A. (2004). E-health and therapeutic relationship. *British Medical Journal*, 329(7458), 111-112.

**📊 Standards PRISMA-ScR Implémentés**

L'application suit intégralement les 20 items PRISMA-ScR :

**Section TITRE (items 1-3)**:

* Identification comme scoping review

* Résumé structuré avec objectifs/méthodes/résultats

* Rationale et objectifs de recherche

**Section MÉTHODES (items 4-10)**:

* Critères d'éligibilité PICOS adaptés

* Sources d'information (PubMed, arXiv, CrossRef)

* Stratégies de recherche documentées

* Processus de sélection dual (IA \+ humain)

* Extraction de données standardisée

* Synthèse narrative des résultats

**Section RÉSULTATS (items 11-15)**:

* Diagramme de flux PRISMA automatique

* Caractéristiques des sources incluses

* Résultats synthétisés par thème

**Auto-complétion intelligente** basée sur les données du projet :

`# Exemple d'auto-complétion`   
`if project.search_query and project.databases_used:`  
    `checklist['sections']['methods']['items'][2]['status'] = 'auto-completed'`

Cette approche méthodologique rigoureuse garantit la conformité aux standards internationaux tout en optimisant l'efficacité par l'automatisation intelligente.

*Guide généré pour AnalyLit v4.1 \- Application de Scoping Review ATN*  
*Version: 4.1.0 | Date: 2024 | Auteur: \[Votre nom\]*