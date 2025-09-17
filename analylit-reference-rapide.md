**AnalyLit v4.1 \- Guide de Référence Rapide**

**Fonctions, API et Utilisation Pratique**

**📚 Table des Matières**

1. [Référence des Fonctions](#bookmark=id.ao9qz6yqerf8)

2. [Guide API REST](#bookmark=id.8p4u041o9zrs)

3. [Workflows d'utilisation](#bookmark=id.trfrj0m0gpym)

4. [Commandes utiles](#bookmark=id.vqhz3jcqqw8e)

5. [Dépannage courant](#bookmark=id.22ve3k6cpjyc)

**Référence des Fonctions**

**🔍 Module fetchers.py \- Recherche Externe**

**Classe DatabaseManager**

`# Initialisation`  
`db_manager = DatabaseManager()`

`# Recherche PubMed`  
`results = db_manager.search_pubmed(`  
    `query="alliance thérapeutique numérique",`   
    `max_results=100`  
`)`

`# Recherche arXiv`    
`results = db_manager.search_arxiv(`  
    `query="therapeutic alliance AI chatbot",`  
    `max_results=50`  
`)`

`# Recherche CrossRef`  
`results = db_manager.search_crossref(`  
    `query="digital therapeutic relationship",`  
    `max_results=75`  
`)`

`# Bases disponibles`  
`databases = db_manager.get_available_databases()`  
`# Retourne: [{"id": "pubmed", "name": "PubMed", "enabled": True}, ...]`

**Fonctions utilitaires**

`# Récupération détails article`  
`details = fetch_article_details("12345678")  # PMID`  
`details = fetch_article_details("10.1000/123")  # DOI`  
`details = fetch_article_details("arxiv:2304.01234")  # arXiv`

`# URL PDF Open Access`  
`pdf_url = fetch_unpaywall_pdf_url("10.1000/journal.2024.123")`

**🤖 Module ai\_processors.py \- Interface IA**

`# Appel Ollama basique (texte)`  
`response = call_ollama_api(`  
    `prompt="Analysez ce résumé scientifique...",`  
    `model="llama3.1:8b",`  
    `output_format="text",`  
    `temperature=0.7`  
`)`

`# Appel Ollama structuré (JSON)`  
`response = call_ollama_api(`  
    `prompt="Extrayez les données selon cette grille...",`  
    `model="mixtral:8x7b",`   
    `output_format="json",`  
    `temperature=0.2`  
`)`  
`# Retourne: {"population": "500 patients", "intervention": "chatbot", ...}`

`# Gestion des erreurs`  
`try:`  
    `result = call_ollama_api(prompt, model)`  
`except AIResponseError as e:`  
    `logger.error(f"Erreur IA: {e}")`

**📊 Module analysis.py \- Analyses Statistiques**

`# Génération brouillon discussion`  
`draft = generate_discussion_draft(`  
    `df=extractions_dataframe,`  
    `call_ollama_func=call_ollama_api,`  
    `model="llama3.1:8b",`  
    `max_prompt_length=8000`  
`)`

`# Graphe de connaissances`  
`graph_data = generate_knowledge_graph_data(`  
    `df=articles_dataframe,`  
    `call_ollama_func=call_ollama_api,`  
    `model="mixtral:8x7b"`  
`)`  
`# Retourne: {"nodes": [...], "edges": [...]}`

`# Analyse thématique`  
`themes = analyze_themes(`  
    `abstracts=list_of_abstracts,`  
    `call_ollama_func=call_ollama_api,`  
    `model="llama3.1:8b"`  
`)`

**💾 Module database.py \- Base de Données**

`# Initialisation base`  
`init_db()  # Utilise config par défaut`  
`init_db(db_url="sqlite:///test.db")  # Config custom`

`# Données par défaut`  
`seed_default_data(engine)`

`# Session context manager (déjà géré par décorateurs)`  
`with db_session() as session:`  
    `project = session.get(Project, project_id)`

**📁 Module file\_handlers.py \- Fichiers**

`# Nettoyage nom fichier`  
`safe_name = sanitize_filename("Article: Test & Données (2024).pdf")`  
`# Retourne: "Article_Test_Données_2024.pdf"`

`# Extraction texte PDF`  
`text = extract_text_from_pdf("/path/to/article.pdf")`  
`if text:`  
    `print(f"Extrait {len(text)} caractères")`

`# Vérifications`  
`if is_valid_pdf("/path/to/file.pdf"):`  
    `size = get_file_size("/path/to/file.pdf")`  
    `print(f"PDF valide, {size} bytes")`

`# Création répertoire`  
`if ensure_directory_exists("/app/projects/new_project"):`  
    `print("Répertoire créé avec succès")`

**📥 Module importers.py \- Import Zotero**

`# Extraction données Zotero`  
`extractor = ZoteroAbstractExtractor("/path/to/zotero_export.json")`

`# Traitement complet`  
`records = extractor.process()`  
`print(f"Traité {len(records)} références uniques")`

`# Statistiques détaillées`  
`stats = extractor.stats`  
`print(f"""`  
`Total: {stats['total']}`  
`Avec résumé: {stats['with_abstract']}`   
`Avec PMID: {stats['with_pmid']}`  
`Doublons supprimés: {stats['duplicates']}`  
`Erreurs: {stats['errors']}`  
`""")`

`# Accès à une référence`  
`for record in records:`  
    `print(f"ID: {record['article_id']}")`  
    `print(f"Titre: {record['title']}")`  
    `print(f"DOI: {record['doi']}")`

**🔔 Module notifications.py \- Notifications**

`# Notification projet`  
`send_project_notification(`  
    `project_id="uuid-project-id",`  
    `notification_type="search_completed",`   
    `message="Recherche terminée: 150 articles trouvés",`  
    `data={"total_results": 150, "databases": ["pubmed", "arxiv"]}`  
`)`

`# Notification globale`  
`send_global_notification(`  
    `notification_type="system_maintenance",`  
    `message="Maintenance programmée dans 1h",`  
    `data={"scheduled_time": "2024-01-15T20:00:00Z"}`  
`)`

`# Gestion connexion Redis`  
`redis_conn = get_redis_connection()`  
`if redis_conn:`  
    `print("Redis connecté")`

**Guide API REST**

**🌐 Authentification et Headers**

`Content-Type: application/json`  
`Accept: application/json`

**📋 Gestion des Projets**

**Créer un projet**

`POST /api/projects`  
`Content-Type: application/json`

`{`  
  `"name": "Alliance Thérapeutique Numérique 2024",`  
  `"description": "Scoping review sur l'ATN dans les soins de santé mentale",`  
  `"mode": "screening"`  
`}`

**Réponse** :

`{`  
  `"id": "550e8400-e29b-41d4-a716-446655440000",`  
  `"name": "Alliance Thérapeutique Numérique 2024",`  
  `"description": "Scoping review sur l'ATN...",`  
  `"analysis_mode": "screening",`  
  `"status": "pending",`  
  `"created_at": "2024-01-15T10:30:00Z",`  
  `"updated_at": "2024-01-15T10:30:00Z"`  
`}`

**Lister les projets**

`GET /api/projects`

**Récupérer un projet**

`GET /api/projects/550e8400-e29b-41d4-a716-446655440000`

**🔍 Recherche Multi-bases**

`POST /api/search`  
`Content-Type: application/json`

`{`  
  `"project_id": "550e8400-e29b-41d4-a716-446655440000",`  
  `"query": "therapeutic alliance artificial intelligence",`  
  `"databases": ["pubmed", "arxiv", "crossref"],`  
  `"max_results_per_db": 100`  
`}`

**Réponse** :

`{`  
  `"message": "Recherche lancée dans 3 base(s)",`  
  `"task_id": "task-uuid-12345",`  
  `"status": 202`  
`}`

**🤖 Pipeline IA**

**Lancer screening IA**

`POST /api/projects/{project_id}/run`  
`Content-Type: application/json`

`{`  
  `"articles": ["pmid1", "pmid2", "pmid3"],`  
  `"profile": "standard",`  
  `"analysis_mode": "screening",`  
  `"custom_grid_id": null`  
`}`

**Extraction complète**

`POST /api/projects/{project_id}/run`  
`Content-Type: application/json`

`{`  
  `"articles": ["pmid1", "pmid2"],`  
  `"profile": "deep",`   
  `"analysis_mode": "full_extraction",`  
  `"custom_grid_id": "grid-uuid-789"`  
`}`

**📊 Analyses Avancées**

**Méta-analyse**

`POST /api/projects/{project_id}/run-analysis`  
`Content-Type: application/json`

`{`  
  `"type": "meta_analysis"`  
`}`

**Scores ATN**

`POST /api/projects/{project_id}/run-analysis`  
`Content-Type: application/json`

`{`  
  `"type": "atn_scores"`  
`}`

**Graphe de connaissances**

`POST /api/projects/{project_id}/run-analysis`  
`Content-Type: application/json`

`{`  
  `"type": "knowledge_graph"`  
`}`

**💬 Chat RAG**

**Indexer les PDFs**

`POST /api/projects/{project_id}/index-pdfs`

**Poser une question**

`POST /api/projects/{project_id}/chat`  
`Content-Type: application/json`

`{`  
  `"question": "Quels sont les principaux types d'IA utilisés dans les études sur l'alliance thérapeutique?"`  
`}`

**Réponse** :

`{`  
  `"message": "Question soumise au système RAG",`  
  `"job_id": "chat-task-uuid"`  
`}`

**📤 Export**

**Export complet**

`GET /api/projects/{project_id}/export`

**Export spécialisé thèse**

`GET /api/projects/{project_id}/export/thesis`

**Workflows d'Utilisation**

**🎯 Workflow Scoping Review Complet**

**1\. Création et Configuration**

`# Via API`  
`curl -X POST http://localhost:8080/api/projects \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"name": "ATN Scoping Review",`  
    `"description": "Alliance thérapeutique numérique",`    
    `"mode": "screening"`  
  `}'`

**2\. Recherche Multi-bases**

`# Lancer recherche`  
`curl -X POST http://localhost:8080/api/search \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"project_id": "PROJECT_ID",`  
    `"query": "therapeutic alliance AI chatbot",`  
    `"databases": ["pubmed", "arxiv"],`  
    `"max_results_per_db": 200`  
  `}'`

`# Vérifier statut`  
`curl http://localhost:8080/api/tasks/TASK_ID/status`

**3\. Screening Automatisé**

`# Récupérer articles trouvés`  
`curl http://localhost:8080/api/projects/PROJECT_ID/search-results`

`# Lancer screening IA`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/run \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"articles": ["pmid1", "pmid2", "pmid3"],`  
    `"profile": "standard",`  
    `"analysis_mode": "screening"`  
  `}'`

**4\. Extraction Structurée**

`# Articles pertinents (score ≥ 7)`  
`curl http://localhost:8080/api/projects/PROJECT_ID/extractions`

`# Extraction détaillée avec grille ATN`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/run \`  
  `-H "Content-Type: application/json" \`  
  `-d '{`  
    `"articles": ["pmid_relevant_1", "pmid_relevant_2"],`  
    `"profile": "deep",`  
    `"analysis_mode": "full_extraction",`  
    `"custom_grid_id": "atn-grid-id"`  
  `}'`

**5\. Analyses et Synthèses**

`# Génération discussion`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/run-discussion-draft`

`# Diagramme PRISMA`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/run-analysis \`  
  `-d '{"type": "prisma_flow"}'`

`# Méta-analyse`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/run-analysis \`  
  `-d '{"type": "meta_analysis"}'`

**6\. Export Final**

`# Export complet pour analyse`  
`curl -o export_complet.zip \`  
  `http://localhost:8080/api/projects/PROJECT_ID/export`

`# Export spécialisé thèse ATN`  
`curl -o export_these.zip \`  
  `http://localhost:8080/api/projects/PROJECT_ID/export/thesis`

**🔍 Workflow Chat RAG**

**1\. Upload et Indexation PDFs**

`# Upload PDFs en masse`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/upload-pdfs-bulk \`  
  `-F "files=@article1.pdf" \`  
  `-F "files=@article2.pdf" \`  
  `-F "files=@article3.pdf"`

`# Indexer pour RAG`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/index-pdfs`

**2\. Questions Interactives**

`# Poser questions contextuelles`  
`curl -X POST http://localhost:8080/api/projects/PROJECT_ID/chat \`  
  `-H "Content-Type: application/json" \`  
  `-d '{"question": "Quels instruments de mesure sont utilisés pour évaluer l alliance thérapeutique avec l IA?"}'`

`# Historique conversation`  
`curl http://localhost:8080/api/projects/PROJECT_ID/chat-messages`

**Commandes Utiles**

**🐳 Docker Management**

`# Démarrage complet`  
`docker-compose -f docker-compose-complete.yml up --build -d`

`# Vérification services`  
`docker-compose ps`  
`docker-compose logs -f web worker`

`# Redémarrage service spécifique`  
`docker-compose restart web`  
`docker-compose restart worker`

`# Nettoyage`  
`docker-compose down -v  # Supprime volumes`  
`docker system prune -a  # Nettoyage complet`

**📊 Monitoring**

`# État général`  
`curl http://localhost:8080/api/health`

`# Files de tâches`  
`curl http://localhost:8080/api/queues/info`

`# Statut des tâches actives`  
`curl http://localhost:8080/api/tasks/status`

`# Logs en temps réel`  
`docker-compose logs -f --tail=100 worker`

**🗃️ Base de Données**

`# Connexion PostgreSQL`  
`docker exec -it analylit-db-v4 psql -U analylit_user -d analylit_db`

`# Commandes SQL utiles`  
`SELECT COUNT(*) FROM projects;`  
`SELECT COUNT(*) FROM search_results WHERE project_id = 'PROJECT_ID';`  
`SELECT status, COUNT(*) FROM extractions GROUP BY status;`

`# Sauvegarde`  
`docker exec analylit-db-v4 pg_dump -U analylit_user analylit_db > backup.sql`

`# Restauration`  
`docker exec -i analylit-db-v4 psql -U analylit_user analylit_db < backup.sql`

**🤖 Ollama Management**

`# Modèles disponibles`  
`curl http://localhost:11434/api/tags`

`# Télécharger modèle`  
`curl -X POST http://localhost:11434/api/pull \`  
  `-d '{"name": "llama3.1:8b"}'`

`# Test direct Ollama`  
`curl -X POST http://localhost:11434/api/generate \`  
  `-d '{`  
    `"model": "phi3:mini",`  
    `"prompt": "Explain therapeutic alliance briefly",`  
    `"stream": false`  
  `}'`

**Dépannage Courant**

**🚨 Problèmes Fréquents**

**1\. Services ne démarrent pas**

`# Vérifier ports`  
`netstat -tulpn | grep :8080`  
`netstat -tulpn | grep :5432`

`# Logs détaillés`  
`docker-compose logs web`  
`docker-compose logs db`

`# Recréer conteneurs`  
`docker-compose down`  
`docker-compose up --build --force-recreate`

**2\. Tâches RQ bloquées**

`# Vérifier worker`  
`docker-compose logs worker`

`# Vider files de tâches`  
`curl -X POST http://localhost:8080/api/queues/processing/clear`  
`curl -X POST http://localhost:8080/api/queues/background/clear`

`# Redémarrer worker`  
`docker-compose restart worker`

**3\. IA/Ollama inaccessible**

`# Vérifier Ollama`  
`curl http://localhost:11434/api/tags`

`# Redémarrer service`  
`docker-compose restart ollama`

`# Vérifier GPU (si disponible)`  
`docker exec analylit-ollama-v4 nvidia-smi`

**4\. Base de données corrompue**

`# Recréer schema`  
`docker exec -it analylit-db-v4 psql -U analylit_user -d analylit_db`  
`DROP SCHEMA public CASCADE;`  
`CREATE SCHEMA public;`

`# Redémarrer web pour migration`  
`docker-compose restart web`

**📝 Logs Debugging**

**Niveaux de logs**

`# Dans config_v4.py`  
`LOG_LEVEL = 'DEBUG'  # Pour développement`  
`LOG_LEVEL = 'INFO'   # Pour production`    
`LOG_LEVEL = 'ERROR'  # Pour minimal`

**Logs spécialisés**

`# Tâches RQ`  
`docker exec analylit-worker-v4 rq info`

`# Flask debugging`  
`docker exec analylit-web-v4 flask routes`

`# Base données queries`  
`# Ajouter à config SQLAlchemy : echo=True`

**🔧 Maintenance**

**Nettoyage périodique**

`# Nettoyage Redis`  
`docker exec analylit-redis-v4 redis-cli FLUSHALL`

`# Nettoyage logs Docker`  
`docker system prune --volumes`

`# Nettoyage PDFs anciens`  
`find ./projects -name "*.pdf" -mtime +30 -delete`

**Mise à jour**

`# Backup avant mise à jour`  
`docker exec analylit-db-v4 pg_dump -U analylit_user analylit_db > backup.sql`

`# Pull nouvelles images`  
`docker-compose pull`

`# Redéploiement`  
`docker-compose up --build -d`

*Guide de référence AnalyLit v4.1 \- Pour utilisation quotidienne et dépannage*