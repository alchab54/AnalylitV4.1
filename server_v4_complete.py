# AnalyLit V4.0 - Serveur Flask COMPLET avec toutes les fonctionnalités

import os
import uuid
import json
import sqlite3
import logging
import io
import zipfile
import pandas as pd
from pathlib import Path
from datetime import datetime
from flask import Flask, jsonify, request, Blueprint, send_from_directory, Response, make_response
from flask_cors import CORS
from rq import Queue
from rq.job import Job
import redis
from flask_socketio import SocketIO
from config_v4 import get_config
from tasks_v4_complete import (
    multi_database_search_task,
    process_single_article_task,
    run_synthesis_task,
    run_discussion_generation_task,
    run_knowledge_graph_task,
    run_prisma_flow_task,
    run_meta_analysis_task,
    run_descriptive_stats_task,
    pull_ollama_model_task,
    run_atn_score_task,
    import_pdfs_from_zotero_task,
    index_project_pdfs_task,
    answer_chat_question_task,
    fetch_online_pdf_task,
    db_manager
)

# Configuration
config = get_config()
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

# Flask app
app = Flask(__name__, static_folder='web', static_url_path='/')
api_bp = Blueprint('api', __name__, url_prefix='/api')
CORS(app, resources={r"/api/*": {"origins": "*"}})

# WebSocket
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    async_mode='gevent',
    path='/socket.io/',  
    message_queue=config.REDIS_URL,
    ping_interval=config.WEBSOCKET_PING_INTERVAL,
    ping_timeout=config.WEBSOCKET_PING_TIMEOUT
)

# Redis et files
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)

PROJECTS_DIR = config.PROJECTS_DIR
DATABASE_FILE = PROJECTS_DIR / "database.db"

def init_db():
    """Initialise la base de données avec toutes les tables nécessaires."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        c = conn.cursor()
        c.execute("PRAGMA journal_mode=WAL;")
        
        # --- DÉBUT DE LA CORRECTION ---
        # Table des projets (avec les colonnes manquantes ajoutées)
        c.execute("""
            CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'pending',
                profile_used TEXT,
                job_id TEXT,
                created_at TEXT,
                updated_at TEXT,
                synthesis_result TEXT,
                discussion_draft TEXT,
                knowledge_graph TEXT,
                prisma_flow_path TEXT,
                analysis_mode TEXT DEFAULT 'screening',
                analysis_result TEXT,
                analysis_plot_path TEXT,
                pmids_count INTEGER DEFAULT 0,
                processed_count INTEGER DEFAULT 0,
                total_processing_time REAL DEFAULT 0,
                indexed_at TEXT,
                search_query TEXT,         -- Ajouté
                databases_used TEXT        -- Ajouté
            )
        """)
        
        # Table des résultats de recherche multi-bases
        c.execute("""
            CREATE TABLE IF NOT EXISTS search_results (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                article_id TEXT NOT NULL,
                title TEXT,
                abstract TEXT,
                authors TEXT,
                publication_date TEXT,
                journal TEXT,
                doi TEXT,
                url TEXT,
                database_source TEXT NOT NULL,
                created_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Table des extractions
        c.execute("""
            CREATE TABLE IF NOT EXISTS extractions (
                id TEXT PRIMARY KEY,
                project_id TEXT,
                pmid TEXT,
                title TEXT,
                validation_score REAL,
                created_at TEXT,
                extracted_data TEXT,
                relevance_score REAL DEFAULT 0,
                relevance_justification TEXT,
                user_validation_status TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Table des logs de traitement
        c.execute("""
            CREATE TABLE IF NOT EXISTS processing_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id TEXT,
                pmid TEXT,
                status TEXT,
                details TEXT,
                timestamp TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Table des profils d'analyse
        c.execute("""
            CREATE TABLE IF NOT EXISTS analysis_profiles (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                is_custom BOOLEAN DEFAULT 1,
                preprocess_model TEXT NOT NULL,
                extract_model TEXT NOT NULL,
                synthesis_model TEXT NOT NULL
            )
        """)
        
        # Table des prompts
        c.execute("""
            CREATE TABLE IF NOT EXISTS prompts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                template TEXT NOT NULL
            )
        """)
        
        # Table des grilles d'extraction
        c.execute("""
            CREATE TABLE IF NOT EXISTS extraction_grids (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                name TEXT NOT NULL,
                fields TEXT NOT NULL,
                created_at TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Table des messages de chat
        c.execute("""
            CREATE TABLE IF NOT EXISTS chat_messages (
                id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sources TEXT,
                timestamp TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id)
            )
        """)
        
        # Insérer les profils par défaut
        if c.execute("SELECT COUNT(*) FROM analysis_profiles").fetchone()[0] == 0:
            default_profiles = [
                ('fast', 'Rapide', 0, 'gemma:2b', 'phi3:mini', 'llama3.1:8b'),
                ('standard', 'Standard', 0, 'phi3:mini', 'llama3.1:8b', 'llama3.1:8b'),
                ('deep', 'Approfondi', 0, 'llama3.1:8b', 'mixtral:8x7b', 'llama3.1:70b')
            ]
            c.executemany("INSERT INTO analysis_profiles VALUES (?, ?, ?, ?, ?, ?)", default_profiles)
            logger.info("✅ Profils par défaut insérés.")
        
        # Insérer les prompts par défaut
        if c.execute("SELECT COUNT(*) FROM prompts").fetchone()[0] == 0:
            default_prompts = [
                ('screening_prompt', 'Prompt pour la pré-sélection des articles.',
                 """En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence pour une revue systématique.

Titre: {title}
Résumé: {abstract}
Source: {database_source}

Veuillez évaluer la pertinence de cet article sur une échelle de 1 à 10 et fournir une justification concise.

Répondez UNIQUEMENT avec un objet JSON contenant :
- "relevance_score": score numérique de 0 à 10
- "decision": "À inclure" si score >= 7, sinon "À exclure" 
- "justification": phrase courte (max 30 mots) expliquant le score"""),
                
                ('full_extraction_prompt', 'Prompt pour l\'extraction détaillée (grille).',
                 """En tant qu'expert en revue systématique, extrayez les données importantes de cet article selon une grille d'extraction structurée.

Texte à analyser: "{text}"
Source: {database_source}

Extrayez les informations suivantes au format JSON:
{{
  "type_etude": "...",
  "population": "...",
  "intervention": "...",
  "resultats_principaux": "...",
  "limites": "...",
  "methodologie": "..."
}}""")
            ]
            c.executemany("INSERT INTO prompts (name, description, template) VALUES (?, ?, ?)", default_prompts)
            logger.info("✅ Prompts par défaut insérés.")
        
        conn.commit()
        logger.info("✅ Base de données initialisée.")

def get_project_by_id(project_id: str):
    """Récupère un projet par son ID."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        return conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()

def update_project_status(project_id: str, status: str):
    """Met à jour le statut d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute(
            "UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
            (status, datetime.now().isoformat(), project_id)
        )
        conn.commit()

# --- API ENDPOINTS ---

@api_bp.route('/health', methods=['GET'])
def health_check():
    """Vérifie l'état de santé du serveur."""
    try:
        redis_status = "connected" if redis_conn.ping() else "disconnected"
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.execute("SELECT 1").fetchone()
        db_status = "connected"
    except Exception as e:
        logger.error(f"Erreur health check: {e}")
        db_status = "error"
        redis_status = "error"
    
    return jsonify({
        "status": "ok",
        "version": config.ANALYLIT_VERSION,
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": db_status,
            "redis": redis_status,
            "ollama": "unknown"
        }
    })

@api_bp.route('/databases', methods=['GET'])
def get_available_databases():
    """Récupère la liste des bases de données disponibles."""
    return jsonify(db_manager.get_available_databases())

@api_bp.route('/search', methods=['POST'])
def search_multiple_databases():
    """Lance une recherche dans plusieurs bases de données."""
    data = request.get_json()
    
    project_id = data.get('project_id')
    query = data.get('query')
    databases = data.get('databases', ['pubmed'])
    max_results_per_db = data.get('max_results_per_db', 50)
    
    if not project_id or not query:
        return jsonify({'error': 'project_id et query requis'}), 400
    
    # Sauvegarder les paramètres de recherche
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("""
            UPDATE projects SET 
            search_query = ?,
            databases_used = ?,
            status = 'searching',
            updated_at = ?
            WHERE id = ?
        """, (query, json.dumps(databases), datetime.now().isoformat(), project_id))
        conn.commit()
    
    # Lancer la tâche de recherche
    job = background_queue.enqueue(
        multi_database_search_task,
        project_id=project_id,
        query=query,
        databases=databases,
        max_results_per_db=max_results_per_db,
        job_timeout='30m'
    )
    
    return jsonify({
        'message': f'Recherche lancée dans {len(databases)} base(s) de données',
        'job_id': job.id,
        'databases': databases
    }), 202

@api_bp.route('/projects/<project_id>/search-results', methods=['GET'])
def get_project_search_results(project_id):
    """Récupère les résultats de recherche d'un projet."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 50, type=int)
    database_filter = request.args.get('database')
    
    offset = (page - 1) * per_page
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        
        # Construire la requête avec filtre optionnel
        base_query = """
            SELECT * FROM search_results 
            WHERE project_id = ?
        """
        params = [project_id]
        
        if database_filter:
            base_query += " AND database_source = ?"
            params.append(database_filter)
        
        # Compter le total
        count_query = f"SELECT COUNT(*) FROM ({base_query})"
        total = conn.execute(count_query, params).fetchone()[0]
        
        # Récupérer les résultats paginés
        results_query = f"{base_query} ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params.extend([per_page, offset])
        
        results = conn.execute(results_query, params).fetchall()
    
    return jsonify({
        'results': [dict(row) for row in results],
        'total': total,
        'page': page,
        'per_page': per_page,
        'has_next': offset + per_page < total,
        'has_prev': page > 1
    })

@api_bp.route('/projects/<project_id>/search-stats', methods=['GET'])
def get_project_search_stats(project_id):
    """Récupère les statistiques de recherche d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        
        # Statistiques par base de données
        stats_query = """
            SELECT database_source, COUNT(*) as count
            FROM search_results 
            WHERE project_id = ?
            GROUP BY database_source
        """
        
        stats = conn.execute(stats_query, (project_id,)).fetchall()
        
        # Total
        total_query = "SELECT COUNT(*) FROM search_results WHERE project_id = ?"
        total = conn.execute(total_query, (project_id,)).fetchone()[0]
    
    return jsonify({
        'total_results': total,
        'results_by_database': {row['database_source']: row['count'] for row in stats}
    })

@api_bp.route('/queue-status', methods=['GET'])
def get_queue_status():
    """Récupère l'état des files d'attente."""
    queues = {
        'Traitement': processing_queue,
        'Synthèse': synthesis_queue,
        'Analyse': analysis_queue,
        'Tâches de fond': background_queue
    }
    
    status = {name: {'count': q.count} for name, q in queues.items()}
    return jsonify(status)

@api_bp.route('/queues/clear', methods=['POST'])
def clear_queues():
    """Vide une file d'attente spécifiée."""
    data = request.get_json()
    queue_name = data.get('queue_name')
    
    queues_map = {
        'Traitement': processing_queue,
        'Synthèse': synthesis_queue,
        'Analyse': analysis_queue,
        'Tâches de fond': background_queue
    }
    
    if queue_name in queues_map:
        q = queues_map[queue_name]
        q.empty()
        
        # Nettoyer le registre des échecs
        failed_registry = q.failed_job_registry
        for job_id in failed_registry.get_job_ids():
            failed_registry.remove(job_id, delete_job=True)
        
        return jsonify({'message': f'La file "{queue_name}" a été vidée.'}), 200
    
    return jsonify({'error': 'Nom de file invalide'}), 400

# Paramètres Zotero
@api_bp.route('/settings/zotero', methods=['POST'])
def save_zotero_settings():
    """Sauvegarde les paramètres Zotero."""
    data = request.get_json()
    
    zotero_config = {
        'user_id': data.get('userId'),
        'api_key': data.get('apiKey')
    }
    
    config_path = PROJECTS_DIR / 'zotero_config.json'
    with open(config_path, 'w') as f:
        json.dump(zotero_config, f)
    
    return jsonify({'message': 'Paramètres Zotero sauvegardés.'})

@api_bp.route('/settings/zotero', methods=['GET'])
def get_zotero_settings():
    """Récupère les paramètres Zotero."""
    config_path = PROJECTS_DIR / 'zotero_config.json'
    
    if config_path.exists():
        with open(config_path, 'r') as f:
            zotero_config = json.load(f)
        
        # Ne pas renvoyer la clé API complète pour la sécurité
        return jsonify({
            'userId': zotero_config.get('user_id', ''),
            'hasApiKey': bool(zotero_config.get('api_key'))
        })
    
    return jsonify({'userId': '', 'hasApiKey': False})

# Import depuis Zotero
@api_bp.route('/projects/<project_id>/import-zotero', methods=['POST'])
def import_from_zotero(project_id):
    """Lance l'import depuis Zotero."""
    try:
        with open(PROJECTS_DIR / 'zotero_config.json', 'r') as f:
            zotero_config = json.load(f)
    except FileNotFoundError:
        return jsonify({'error': 'Veuillez configurer vos identifiants Zotero dans les paramètres.'}), 400
    
    # Récupérer les article IDs depuis la base de données
    with sqlite3.connect(DATABASE_FILE) as conn:
        article_ids = conn.execute("SELECT article_id FROM search_results WHERE project_id = ?", (project_id,)).fetchall()
        article_ids = [row[0] for row in article_ids]
    
    if not article_ids:
        return jsonify({'error': 'Aucun article à importer pour ce projet.'}), 400
    
    job = background_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=article_ids,
        zotero_user_id=zotero_config.get('user_id'),
        zotero_api_key=zotero_config.get('api_key'),
        job_timeout='1h'
    )
    
    return jsonify({'message': f'Import depuis Zotero lancé pour {len(article_ids)} articles.'}), 202

@api_bp.route('/projects/<project_id>/zotero-import-status', methods=['GET'])
def get_zotero_import_status(project_id):
    """Récupère le statut de l'import Zotero."""
    redis_key = f"zotero_import_result:{project_id}"
    result = redis_conn.get(redis_key)
    
    if result:
        redis_conn.delete(redis_key)
        successful_pmids = json.loads(result)
        return jsonify({
            'status': 'completed',
            'successful_pmids': successful_pmids
        })
    else:
        return jsonify({'status': 'pending'})

# Upload PDF en lot
@api_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    """Upload de PDF en lot."""
    if 'files' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    
    files = request.files.getlist('files')
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    
    successful = []
    failed = []
    
    for file in files:
        if file and file.filename:
            # Extraire l'ID de l'article du nom de fichier
            article_id = Path(file.filename).stem
            pdf_path = project_dir / f"{article_id}.pdf"
            
            try:
                if file.content_length and file.content_length > config.MAX_PDF_SIZE:
                    failed.append(f"{file.filename}: fichier trop volumineux")
                    continue
                
                file.save(str(pdf_path))
                successful.append(file.filename)
                
            except Exception as e:
                failed.append(f"{file.filename}: {e}")
    
    return jsonify({
        'successful': successful, 
        'failed': failed, 
        'skipped': []
    })

# Recherche PDF en ligne
@api_bp.route('/projects/<project_id>/fetch-online-pdfs', methods=['POST'])
def fetch_online_pdfs(project_id):
    """Lance la recherche de PDF en ligne."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        article_ids = conn.execute("SELECT article_id FROM search_results WHERE project_id = ?", (project_id,)).fetchall()
        article_ids = [row[0] for row in article_ids]
    
    if not article_ids:
        return jsonify({'error': 'Aucun article à importer pour ce projet.'}), 400
    
    job = background_queue.enqueue(
        fetch_online_pdf_task,
        project_id=project_id,
        article_ids=article_ids,
        job_timeout='1h'
    )
    
    return jsonify({'message': f'La recherche de PDF en ligne a été lancée pour {len(article_ids)} articles.'}), 202

@api_bp.route('/projects/<project_id>/fetch-online-status', methods=['GET'])
def get_fetch_online_status(project_id):
    """Récupère le statut de la recherche PDF en ligne."""
    redis_key = f"online_fetch_result:{project_id}"
    result = redis_conn.get(redis_key)
    
    if result:
        redis_conn.delete(redis_key)
        successful_ids = json.loads(result)
        return jsonify({
            'status': 'completed',
            'successful_pmids': successful_ids
        })
    else:
        return jsonify({'status': 'pending'})

# Indexation
@api_bp.route('/projects/<project_id>/index', methods=['POST'])
def run_indexing(project_id):
    """Lance l'indexation des PDF d'un projet."""
    job = background_queue.enqueue(
        index_project_pdfs_task, 
        project_id=project_id, 
        job_timeout='1h'
    )
    
    update_project_status(project_id, 'indexing')
    
    return jsonify({
        'message': 'L\'indexation du corpus a été lancée.', 
        'job_id': job.id
    }), 202

# Chat
@api_bp.route('/projects/<project_id>/chat', methods=['POST'])
def handle_chat_message(project_id):
    """Traite un message de chat."""
    data = request.get_json()
    question = data.get('question')
    profile_id = data.get('profile', 'standard')
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        profile_row = conn.execute("SELECT * FROM analysis_profiles WHERE id = ?", (profile_id,)).fetchone()
        
        if not profile_row:
            return jsonify({'error': 'Profil invalide'}), 400
        
        profile = dict(profile_row)
    
    try:
        result = answer_chat_question_task(project_id, question, profile)
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Erreur lors du chat pour le projet {project_id}: {e}")
        return jsonify({'error': 'Erreur lors de la génération de la réponse.'}), 500

@api_bp.route('/projects/<project_id>/chat-history', methods=['GET'])
def get_chat_history(project_id):
    """Récupère l'historique de chat."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        messages = conn.execute("""
            SELECT role, content, sources, timestamp FROM chat_messages 
            WHERE project_id = ? ORDER BY timestamp ASC
        """, (project_id,)).fetchall()
    
    return jsonify([dict(m) for m in messages])

# Ollama
@api_bp.route('/ollama/models', methods=['GET'])
def get_ollama_local_models():
    """Récupère la liste des modèles Ollama installés."""
    try:
        import requests
        response = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags")
        response.raise_for_status()
        return jsonify(response.json().get('models', []))
        
    except requests.RequestException as e:
        logger.error(f"Erreur de communication avec Ollama: {e}")
        return jsonify({'error': 'Impossible de contacter le service Ollama.'}), 503

@api_bp.route('/ollama/pull', methods=['POST'])
def pull_ollama_model():
    """Lance le téléchargement d'un modèle Ollama."""
    data = request.get_json()
    model_name = data.get('model_name')
    
    if not model_name:
        return jsonify({'error': 'Le nom du modèle est requis.'}), 400
    
    job = background_queue.enqueue(
        pull_ollama_model_task, 
        model_name, 
        job_timeout='1h'
    )
    
    return jsonify({
        'message': f'Le téléchargement du modèle "{model_name}" a été lancé.', 
        'job_id': job.id
    }), 202

# Prompts
@api_bp.route('/prompts', methods=['GET'])
def get_prompts():
    """Récupère la liste des prompts."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        prompts = conn.execute("SELECT id, name, description, template FROM prompts").fetchall()
    
    return jsonify([dict(p) for p in prompts])

@api_bp.route('/prompts/<int:prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    """Met à jour un prompt."""
    data = request.get_json()
    template = data.get('template')
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("UPDATE prompts SET template = ? WHERE id = ?", (template, prompt_id))
        conn.commit()
    
    return jsonify({'message': 'Prompt mis à jour.'})

# Profils d'analyse
@api_bp.route('/analysis-profiles', methods=['GET'])
def get_analysis_profiles():
    """Récupère la liste des profils d'analyse."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        profiles = conn.execute("SELECT * FROM analysis_profiles ORDER BY is_custom, name").fetchall()
    
    return jsonify([dict(p) for p in profiles])

@api_bp.route('/analysis-profiles', methods=['POST'])
def create_analysis_profile():
    """Crée un nouveau profil d'analyse personnalisé."""
    data = request.get_json()
    required_fields = ['name', 'preprocess_model', 'extract_model', 'synthesis_model']
    
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Tous les champs sont requis'}), 400
    
    profile_id = str(uuid.uuid4())
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.execute("""
                INSERT INTO analysis_profiles
                (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
                VALUES (?, ?, 1, ?, ?, ?)
            """, (profile_id, data['name'], data['preprocess_model'], data['extract_model'], data['synthesis_model']))
            conn.commit()
        
        logger.info(f"✅ Nouveau profil créé: {data['name']} (ID: {profile_id})")
        return jsonify({'message': 'Profil créé avec succès', 'id': profile_id}), 201
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Un profil avec ce nom existe déjà'}), 409
    except Exception as e:
        logger.error(f"Erreur lors de la création du profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/analysis-profiles/<profile_id>', methods=['PUT'])
def update_analysis_profile(profile_id):
    """Met à jour un profil d'analyse personnalisé."""
    data = request.get_json()
    required_fields = ['name', 'preprocess_model', 'extract_model', 'synthesis_model']
    
    if not all(field in data for field in required_fields):
        return jsonify({'error': 'Tous les champs sont requis'}), 400
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            cursor = conn.execute("""
                UPDATE analysis_profiles SET
                name = ?, preprocess_model = ?, extract_model = ?, synthesis_model = ?
                WHERE id = ? AND is_custom = 1
            """, (data['name'], data['preprocess_model'], data['extract_model'], data['synthesis_model'], profile_id))
            
            if cursor.rowcount == 0:
                return jsonify({'error': 'Profil non trouvé ou non modifiable'}), 404
            
            conn.commit()
        
        return jsonify({'message': 'Profil mis à jour avec succès'})
        
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Un profil avec ce nom existe déjà'}), 409
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/analysis-profiles/<profile_id>', methods=['DELETE'])
def delete_analysis_profile(profile_id):
    """Supprime un profil d'analyse personnalisé."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            cursor = conn.execute("DELETE FROM analysis_profiles WHERE id = ? AND is_custom = 1", (profile_id,))
            
            if cursor.rowcount == 0:
                return jsonify({'error': 'Profil non trouvé ou non modifiable'}), 404
            
            conn.commit()
        
        return jsonify({'message': 'Profil supprimé avec succès'})
        
    except Exception as e:
        logger.error(f"Erreur lors de la suppression du profil: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# Projets
@api_bp.route('/projects', methods=['GET'])
def get_projects():
    """Récupère la liste des projets."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        projects = conn.execute("SELECT * FROM projects ORDER BY updated_at DESC").fetchall()
    
    return jsonify([dict(p) for p in projects])

@api_bp.route('/projects/<project_id>', methods=['GET'])
def get_project_details(project_id):
    """Récupère les détails d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if project is None:
            return jsonify({'error': 'Projet non trouvé'}), 404
    
    return jsonify(dict(project))

@api_bp.route('/projects', methods=['POST'])
def create_project():
    """Crée un nouveau projet."""
    data = request.get_json()
    analysis_mode = data.get('mode', 'screening')
    project_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("""
            INSERT INTO projects (id, name, description, created_at, updated_at, analysis_mode) 
            VALUES (?, ?, ?, ?, ?, ?)
        """, (project_id, data['name'], data.get('description', ''), now, now, analysis_mode))
        conn.commit()
    
    return jsonify({'id': project_id, 'name': data['name']}), 201

@api_bp.route('/projects/<project_id>', methods=['DELETE'])
def delete_project(project_id):
    """Supprime un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("DELETE FROM search_results WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM extractions WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM processing_log WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM extraction_grids WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM chat_messages WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
    
    return jsonify({'message': 'Projet supprimé'}), 200

# Grilles d'extraction
@api_bp.route('/projects/<project_id>/grids', methods=['POST'])
def create_extraction_grid(project_id):
    """Crée une nouvelle grille d'extraction."""
    data = request.get_json()
    name = data.get('name')
    fields = data.get('fields')
    
    if not name or not isinstance(fields, list) or not fields:
        return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400
    
    grid_id = str(uuid.uuid4())
    now = datetime.now().isoformat()
    fields_json = json.dumps(fields)
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.execute("""
                INSERT INTO extraction_grids (id, project_id, name, fields, created_at) 
                VALUES (?, ?, ?, ?, ?)
            """, (grid_id, project_id, name, fields_json, now))
            conn.commit()
        
        new_grid = {
            'id': grid_id,
            'project_id': project_id,
            'name': name,
            'fields': fields,
            'created_at': now
        }
        
        return jsonify(new_grid), 201
        
    except Exception as e:
        logger.error(f"Erreur lors de la création de la grille pour le projet {project_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/grids', methods=['GET'])
def get_extraction_grids(project_id):
    """Récupère toutes les grilles d'extraction pour un projet."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            grids_cursor = conn.execute("""
                SELECT id, name, fields, created_at FROM extraction_grids 
                WHERE project_id = ? ORDER BY created_at DESC
            """, (project_id,)).fetchall()
            
            grids = []
            for row in grids_cursor:
                grid = dict(row)
                grid['fields'] = json.loads(grid['fields'])
                grids.append(grid)
        
        return jsonify(grids)
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des grilles pour le projet {project_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['PUT'])
def update_extraction_grid(project_id, grid_id):
    """Met à jour une grille d'extraction."""
    data = request.get_json()
    name = data.get('name')
    fields = data.get('fields')
    
    if not name or not isinstance(fields, list) or not fields:
        return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400
    
    fields_json = json.dumps(fields)
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            cursor = conn.execute("""
                UPDATE extraction_grids SET name = ?, fields = ? 
                WHERE id = ? AND project_id = ?
            """, (name, fields_json, grid_id, project_id))
            
            if cursor.rowcount == 0:
                return jsonify({'error': 'Grille non trouvée ou n\'appartient pas à ce projet.'}), 404
            
            conn.commit()
        
        return jsonify({'message': 'Grille mise à jour avec succès.'})
        
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour de la grille {grid_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['DELETE'])
def delete_extraction_grid(project_id, grid_id):
    """Supprime une grille d'extraction."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            cursor = conn.execute("""
                DELETE FROM extraction_grids 
                WHERE id = ? AND project_id = ?
            """, (grid_id, project_id))
            
            if cursor.rowcount == 0:
                return jsonify({'error': 'Grille non trouvée ou n\'appartient pas à ce projet.'}), 404
            
            conn.commit()
        
        return jsonify({'message': 'Grille supprimée avec succès.'})
        
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de la grille {grid_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@api_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
def import_grid_from_file(project_id):
    """Importe une grille d'extraction depuis un fichier JSON."""
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier n'a été envoyé"}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400
    
    if file and file.filename.endswith('.json'):
        try:
            grid_data = json.load(file.stream)
            grid_name = grid_data.get('name')
            grid_fields = grid_data.get('fields')
            
            if not grid_name or not isinstance(grid_fields, list):
                return jsonify({"error": "Le fichier JSON doit contenir une clé 'name' et une clé 'fields' (liste)"}), 400
            
            with sqlite3.connect(DATABASE_FILE) as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO extraction_grids (id, project_id, name, fields, created_at) 
                    VALUES (?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), project_id, grid_name, json.dumps(grid_fields), datetime.now().isoformat()))
                conn.commit()
            
            return jsonify({"message": "Grille importée avec succès"}), 201
            
        except json.JSONDecodeError:
            return jsonify({"error": "Fichier JSON invalide"}), 400
        except Exception as e:
            logger.error(f"Erreur lors de l'importation de la grille: {e}")
            return jsonify({"error": "Erreur interne du serveur"}), 500
    
    return jsonify({"error": "Type de fichier non supporté. Veuillez utiliser un fichier .json"}), 400

# Pipeline de traitement
@api_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_project_pipeline(project_id):
    """Lance le pipeline d'analyse pour un projet."""
    data = request.get_json()
    source = data.get('source')
    profile_id = data.get('profile', 'standard')
    custom_grid_id = data.get('custom_grid_id')
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        profile_row = conn.execute("SELECT * FROM analysis_profiles WHERE id = ?", (profile_id,)).fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400
        profile = dict(profile_row)
        
        project = conn.execute("SELECT analysis_mode FROM projects WHERE id = ?", (project_id,)).fetchone()
        analysis_mode = project[0] if project else 'screening'

    article_ids = []
    if source == 'manual':
        article_ids = data.get('article_ids', [])
        if not article_ids:
            return jsonify({'error': 'La liste d\'identifiants manuels est vide.'}), 400
    else: # Par défaut, on utilise les résultats de recherche
        with sqlite3.connect(DATABASE_FILE) as conn:
            rows = conn.execute("SELECT article_id FROM search_results WHERE project_id = ?", (project_id,)).fetchall()
            article_ids = [row[0] for row in rows]
        if not article_ids:
            return jsonify({'error': 'Aucun résultat de recherche à analyser. Veuillez d\'abord lancer une recherche.'}), 400

    # Nettoyage et mise à jour du projet
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("DELETE FROM extractions WHERE project_id = ?", (project_id,))
        conn.execute("DELETE FROM processing_log WHERE project_id = ?", (project_id,))
        conn.execute("""
            UPDATE projects SET
            status = 'processing', profile_used = ?, updated_at = ?, pmids_count = ?,
            processed_count = 0, total_processing_time = 0
            WHERE id = ?
        """, (profile_id, datetime.now().isoformat(), len(article_ids), project_id))
        conn.commit()

    # Lancer les tâches de fond
    for article_id in article_ids:
        processing_queue.enqueue(
            process_single_article_task,
            project_id=project_id,
            article_id=article_id,
            profile=profile,
            analysis_mode=analysis_mode,
            custom_grid_id=custom_grid_id,
            job_timeout=1800
        )
    
    return jsonify({
        "status": "processing",
        "message": f"{len(article_ids)} articles sont en cours de traitement."
    }), 202

@api_bp.route('/projects/<project_id>/run-synthesis', methods=['POST'])
def run_synthesis_endpoint(project_id):
    """Lance la synthèse des résultats."""
    data = request.get_json()
    profile_id = data.get('profile')
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        profile_row = conn.execute("SELECT * FROM analysis_profiles WHERE id = ?", (profile_id,)).fetchone()
        
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400
        
        profile_to_use = dict(profile_row)
    
    job = synthesis_queue.enqueue(
        run_synthesis_task, 
        project_id=project_id, 
        profile=profile_to_use, 
        job_timeout=3600
    )
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("UPDATE projects SET status = 'synthesizing', job_id = ? WHERE id = ?", (job.id, project_id))
        conn.commit()
    
    return jsonify({
        "status": "synthesizing", 
        "message": "La synthèse des résultats a été lancée."
    }), 202

# Extractions
@api_bp.route('/projects/<project_id>/extractions', methods=['GET'])
def get_project_extractions(project_id):
    """Récupère les extractions d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        extractions = conn.execute("""
            SELECT id, pmid, title, relevance_score, relevance_justification,
            user_validation_status, extracted_data FROM extractions
            WHERE project_id = ? ORDER BY relevance_score DESC
        """, (project_id,)).fetchall()
    
    return jsonify([dict(row) for row in extractions])

@api_bp.route('/extractions/<extraction_id>/validate', methods=['POST'])
def validate_extraction(extraction_id):
    """Valide une extraction par l'utilisateur."""
    data = request.get_json()
    user_decision = data.get('decision')
    
    if user_decision not in ['include', 'exclude']:
        return jsonify({'error': 'Décision invalide'}), 400
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.execute("""
            UPDATE extractions SET user_validation_status = ? WHERE id = ?
        """, (user_decision, extraction_id))
        conn.commit()
    
    return jsonify({'message': f'Extraction marquée comme {user_decision}.'}), 200

# Logs et résultats
@api_bp.route('/projects/<project_id>/processing-log', methods=['GET'])
def get_project_processing_log(project_id):
    """Récupère les logs de traitement d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        logs = conn.execute("""
            SELECT pmid, status, details, timestamp FROM processing_log
            WHERE project_id = ? ORDER BY id DESC LIMIT 100
        """, (project_id,)).fetchall()
    
    return jsonify([dict(row) for row in logs])

@api_bp.route('/projects/<project_id>/result', methods=['GET'])
def get_project_result(project_id):
    """Récupère le résultat de synthèse d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        project = conn.execute("SELECT synthesis_result FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if project and project['synthesis_result']:
            return jsonify(json.loads(project['synthesis_result']))
    
    return jsonify({})

# Export
@api_bp.route('/projects/<project_id>/export', methods=['GET'])
def export_results_csv(project_id):
    """Exporte les résultats au format CSV."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            extractions = conn.execute("SELECT * FROM extractions WHERE project_id = ?", (project_id,)).fetchall()
            
            if not extractions:
                return jsonify({"error": "Aucune donnée à exporter."}), 404
            
            records = []
            for ext in extractions:
                base_record = {
                    "pmid": ext["pmid"],
                    "title": ext["title"],
                    "relevance_score": ext["relevance_score"],
                    "relevance_justification": ext["relevance_justification"],
                    "user_validation_status": ext["user_validation_status"],
                    "validation_score": ext["validation_score"],
                    "created_at": ext["created_at"]
                }
                
                # Ajouter les données extraites si disponibles
                try:
                    if ext['extracted_data']:
                        data = json.loads(ext['extracted_data'])
                        if isinstance(data, dict):
                            for category, details in data.items():
                                if isinstance(details, dict):
                                    for key, value in details.items():
                                        base_record[f"{category}_{key}"] = value
                                else:
                                    base_record[category] = details
                except (json.JSONDecodeError, TypeError):
                    pass
                
                records.append(base_record)
            
            df = pd.DataFrame(records)
            csv_data = df.to_csv(index=False)
            
            return Response(
                csv_data,
                mimetype="text/csv",
                headers={"Content-disposition": f"attachment; filename=export_{project_id}.csv"}
            )
    
    except Exception as e:
        logger.error(f"Erreur d'export CSV pour {project_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur lors de l'export."}), 500

@api_bp.route('/projects/<project_id>/export-all', methods=['GET'])
def export_all_data_zip(project_id):
    """Exporte toutes les données d'un projet dans une archive ZIP."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            project = conn.execute("SELECT * FROM projects WHERE id = ?", (project_id,)).fetchone()
            extractions = conn.execute("SELECT * FROM extractions WHERE project_id = ?", (project_id,)).fetchall()
            search_results = conn.execute("SELECT * FROM search_results WHERE project_id = ?", (project_id,)).fetchall()
            
            if not project:
                return jsonify({"error": "Projet non trouvé."}), 404
        
        memory_file = io.BytesIO()
        
        with zipfile.ZipFile(memory_file, 'w', zipfile.ZIP_DEFLATED) as zf:
            # 1. Fichier de résumé
            summary = f"""Rapport d'Exportation pour le Projet AnalyLit V4
-------------------------------------------------
ID du Projet: {project['id']}
Nom: {project['name']}
Description: {project['description']}
Date de création: {project['created_at']}
Dernière mise à jour: {project['updated_at']}
Statut: {project['status']}
Profil utilisé: {project['profile_used']}
Mode d'analyse: {project['analysis_mode']}
Nombre d'articles: {project['pmids_count']}
Requête de recherche: {project['search_query']}
Bases de données utilisées: {project['databases_used']}
"""
            zf.writestr('summary.txt', summary)
            
            # 2. Résultats de recherche en CSV
            if search_results:
                search_df = pd.DataFrame([dict(row) for row in search_results])
                zf.writestr('search_results.csv', search_df.to_csv(index=False))
            
            # 3. Extractions en CSV
            if extractions:
                extractions_df = pd.DataFrame([dict(row) for row in extractions])
                zf.writestr('extractions.csv', extractions_df.to_csv(index=False))
            
            # 4. Résultats de synthèse en JSON
            if project['synthesis_result']:
                zf.writestr('synthesis_result.json', project['synthesis_result'])
            
            # 5. Brouillon de discussion en texte
            if project['discussion_draft']:
                zf.writestr('discussion_draft.txt', project['discussion_draft'])
            
            # 6. Graphe de connaissances en JSON
            if project['knowledge_graph']:
                zf.writestr('knowledge_graph.json', project['knowledge_graph'])
            
            # 7. Résultats d'analyse en JSON
            if project['analysis_result']:
                zf.writestr('analysis_result.json', project['analysis_result'])
        
        memory_file.seek(0)
        
        return Response(
            memory_file.read(),
            mimetype="application/zip",
            headers={"Content-disposition": f"attachment; filename=analylit_export_{project_id}.zip"}
        )
    
    except Exception as e:
        logger.error(f"Erreur d'export ZIP pour {project_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur lors de l'export."}), 500

# Analyse avancée
@api_bp.route('/projects/<project_id>/generate-discussion', methods=['POST'])
def generate_discussion_endpoint(project_id):
    """Lance la génération de la discussion."""
    analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération de la discussion lancée."}), 202

@api_bp.route('/projects/<project_id>/generate-knowledge-graph', methods=['POST'])
def generate_knowledge_graph_endpoint(project_id):
    """Lance la génération du graphe de connaissances."""
    analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du graphe de connaissances lancée."}), 202

@api_bp.route('/projects/<project_id>/generate-prisma-flow', methods=['POST'])
def generate_prisma_flow_endpoint(project_id):
    """Lance la génération du diagramme PRISMA."""
    analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du diagramme PRISMA lancée."}), 202

@api_bp.route('/projects/<project_id>/run-meta-analysis', methods=['POST'])
def run_meta_analysis_endpoint(project_id):
    """Lance la méta-analyse."""
    analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement de la méta-analyse."}), 202

@api_bp.route('/projects/<project_id>/run-descriptive-stats', methods=['POST'])
def run_descriptive_stats_endpoint(project_id):
    """Lance l'analyse descriptive."""
    analysis_queue.enqueue(run_descriptive_stats_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement de l'analyse descriptive."}), 202

@api_bp.route('/projects/<project_id>/run-atn-score', methods=['POST'])
def run_atn_score_endpoint(project_id):
    """Lance le calcul du score ATN."""
    analysis_queue.enqueue(run_atn_score_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Lancement du calcul du score ATN."}), 202

# Images et fichiers
@api_bp.route('/projects/<project_id>/analysis-plot', methods=['GET'])
def get_analysis_plot_image(project_id):
    """Récupère l'image d'analyse."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        project = conn.execute("SELECT analysis_plot_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if project and project[0] and os.path.exists(project[0]):
            return send_from_directory(os.path.dirname(project[0]), os.path.basename(project[0]))
    
    return jsonify({"error": "Image d'analyse non trouvée."}), 404

@api_bp.route('/projects/<project_id>/analysis-plot/<plot_type>', methods=['GET'])
def get_analysis_plot_by_type(project_id, plot_type):
    """Récupère une image d'analyse par type."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        project = conn.execute("SELECT analysis_plot_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if project and project[0]:
            try:
                plot_paths = json.loads(project[0])
                if plot_type in plot_paths and os.path.exists(plot_paths[plot_type]):
                    plot_path = plot_paths[plot_type]
                    return send_from_directory(os.path.dirname(plot_path), os.path.basename(plot_path))
            except (json.JSONDecodeError, TypeError, KeyError):
                pass
    
    return jsonify({"error": f"Image '{plot_type}' non trouvée."}), 404

@api_bp.route('/projects/<project_id>/prisma-flow', methods=['GET'])
def get_prisma_flow_image(project_id):
    """Récupère l'image du diagramme PRISMA."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        project = conn.execute("SELECT prisma_flow_path FROM projects WHERE id = ?", (project_id,)).fetchone()
        
        if project and project[0] and os.path.exists(project[0]):
            return send_from_directory(os.path.dirname(project[0]), os.path.basename(project[0]))
    
    return jsonify({"error": "Image PRISMA non trouvée."}), 404

# Validation
@api_bp.route('/projects/<project_id>/validation-stats', methods=['GET'])
def get_validation_stats(project_id):
    """Calcule les statistiques de validation pour un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        
        # Récupérer toutes les extractions avec décision utilisateur
        extractions = conn.execute("""
            SELECT relevance_score, user_validation_status
            FROM extractions
            WHERE project_id = ? AND user_validation_status IS NOT NULL
        """, (project_id,)).fetchall()
        
        if not extractions:
            return jsonify({"error": "Aucune validation utilisateur trouvée."}), 404
        
        # Calculer les métriques de performance
        total = len(extractions)
        ia_includes = sum(1 for e in extractions if e['relevance_score'] >= 7)
        user_includes = sum(1 for e in extractions if e['user_validation_status'] == 'include')
        
        # Matrice de confusion
        tp = sum(1 for e in extractions if e['relevance_score'] >= 7 and e['user_validation_status'] == 'include')
        tn = sum(1 for e in extractions if e['relevance_score'] < 7 and e['user_validation_status'] == 'exclude')
        fp = sum(1 for e in extractions if e['relevance_score'] >= 7 and e['user_validation_status'] == 'exclude')
        fn = sum(1 for e in extractions if e['relevance_score'] < 7 and e['user_validation_status'] == 'include')
        
        # Métriques
        accuracy = (tp + tn) / total if total > 0 else 0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1_score = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        
        return jsonify({
            "total_articles": total,
            "ia_includes": ia_includes,
            "user_includes": user_includes,
            "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn},
            "metrics": {
                "accuracy": round(accuracy, 3),
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1_score": round(f1_score, 3)
            }
        })

# Upload de PDF individuel
@api_bp.route('/projects/<project_id>/<article_id>/upload-pdf', methods=['POST'])
def upload_pdf(project_id, article_id):
    """Upload d'un PDF pour un article spécifique."""
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'Nom de fichier vide'}), 400
    
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    
    pdf_path = project_dir / f"{article_id}.pdf"
    file.save(str(pdf_path))
    
    return jsonify({'message': f'PDF pour {article_id} importé avec succès.'}), 200

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Gestion de la connexion WebSocket."""
    logger.info(f"Client WebSocket connecté: {request.sid}")
    
    socketio.emit('connection_confirmed', {
        'status': 'connected',
        'server_time': datetime.now().isoformat(),
        'version': config.ANALYLIT_VERSION
    })

@socketio.on('disconnect')
def handle_disconnect():
    """Gestion de la déconnexion WebSocket."""
    logger.info(f"Client WebSocket déconnecté: {request.sid}")

@socketio.on('join_project')
def handle_join_project(data):
    from flask_socketio import join_room
    project_id = data.get('project_id')
    if not project_id:
        return
    join_room(project_id)
    # Confirmer aux clients de la room (dont l’émetteur)
    socketio.emit('project_joined', {'project_id': project_id}, room=project_id)
    
# Enregistrement du blueprint et routes statiques
app.register_blueprint(api_bp)

@app.route('/')
def serve_index():
    """Sert la page d'accueil."""
    return app.send_static_file('index.html')

@app.errorhandler(404)
def not_found(error):
    """Gestion des erreurs 404 - redirige vers l'app SPA."""
    return app.send_static_file('index.html')

@app.errorhandler(500)
def internal_error(error):
    """Gestion des erreurs internes."""
    logger.error(f"Erreur interne du serveur: {error}")
    return jsonify({"error": "Erreur interne du serveur"}), 500
    
if __name__ == '__main__':
    init_db()
    logger.info("🚀 Démarrage du serveur AnalyLit V4.0 sur le port 5001...")
    socketio.run(app, host='0.0.0.0', port=5001, debug=False)