# ================================================================
# AnalyLit V4.1 - Serveur Flask (100% PostgreSQL/SQLAlchemy) - CORRIGÉ
# ================================================================
import os
import uuid
import json
import logging
import io
import zipfile
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone
from flask import Flask, jsonify, request, Blueprint, send_from_directory, Response
from flask_cors import CORS
from rq import Queue
from rq.worker import Worker
import redis
from flask_socketio import SocketIO
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, scoped_session
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
    import_pdfs_from_zotero_task,
    run_atn_stakeholder_analysis_task, # Correction: Import de la bonne fonction ATN
    import_from_zotero_file_task,
    index_project_pdfs_task,
    answer_chat_question_task,
    fetch_online_pdf_task,
    pull_ollama_model_task,
    calculate_kappa_task,
    run_atn_score_task,
    run_risk_of_bias_task, # Ajout de la nouvelle tâche
    add_manual_articles_task # Ajout de la nouvelle tâche
)
from werkzeug.utils import secure_filename

from utils.fetchers import db_manager, fetch_article_details
from utils.file_handlers import sanitize_filename
from utils.notifications import send_project_notification
from sklearn.metrics import cohen_kappa_score

# --- Configuration ---
config = get_config()
logging.basicConfig(level=getattr(logging, config.LOG_LEVEL))
logger = logging.getLogger(__name__)

# --- Base de Données (SQLAlchemy) ---
engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Session = scoped_session(SessionFactory)

# --- Application ---
app = Flask(__name__, static_folder='web', static_url_path='/')
api_bp = Blueprint('api', __name__, url_prefix='/api')
CORS(app, resources={r"/api/*": {"origins": "*"}})
socketio = SocketIO(
    app,
    cors_allowed_origins="*",
    message_queue=config.REDIS_URL,
    async_mode='gevent',
    path='/socket.io/'
)

# --- Redis / Queues ---
redis_conn = redis.from_url(config.REDIS_URL)
processing_queue = Queue('analylit_processing_v4', connection=redis_conn)
synthesis_queue = Queue('analylit_synthesis_v4', connection=redis_conn)
analysis_queue = Queue('analylit_analysis_v4', connection=redis_conn)
background_queue = Queue('analylit_background_v4', connection=redis_conn)

# --- Projets: répertoire fichiers ---
PROJECTS_DIR = Path(config.PROJECTS_DIR)
PROJECTS_DIR.mkdir(parents=True, exist_ok=True)

# ================================================================
# 1) Initialisation / Migrations
# ================================================================
def init_db():
    """Initialise ou migre le schéma PostgreSQL."""
    with engine.begin() as conn:
        try:
            conn.execute(text("""
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
    total_processing_time DOUBLE PRECISION DEFAULT 0,
    indexed_at TEXT,
    search_query TEXT,
    databases_used TEXT,
    inter_rater_reliability TEXT
)
"""))
            conn.execute(text("""
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
    FOREIGN KEY (project_id) REFERENCES projects(id),
    UNIQUE(project_id, article_id)
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS extractions (
    id TEXT PRIMARY KEY,
    project_id TEXT,
    pmid TEXT,
    title TEXT,
    validation_score DOUBLE PRECISION,
    created_at TEXT,
    extracted_data TEXT,
    relevance_score DOUBLE PRECISION DEFAULT 0,
    relevance_justification TEXT,
    user_validation_status TEXT,
    analysis_source TEXT,
    validations TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS processing_log (
    id SERIAL PRIMARY KEY,
    project_id TEXT,
    pmid TEXT,
    status TEXT,
    details TEXT,
    "timestamp" TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS analysis_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    is_custom BOOLEAN DEFAULT TRUE,
    preprocess_model TEXT NOT NULL,
    extract_model TEXT NOT NULL,
    synthesis_model TEXT NOT NULL
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS prompts (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    template TEXT NOT NULL
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS extraction_grids (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    fields TEXT NOT NULL,
    created_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    sources TEXT,
    timestamp TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))

            conn.execute(text("""
CREATE TABLE IF NOT EXISTS atn_metrics (
    id TEXT PRIMARY KEY,
    extraction_id TEXT NOT NULL,
    empathy_score_ai FLOAT,
    empathy_score_human FLOAT,
    wai_sr_score FLOAT,
    adherence_rate FLOAT,
    algorithmic_trust FLOAT,
    acceptability_score FLOAT,
    stakeholder_group TEXT,
    created_at TEXT,
    FOREIGN KEY (extraction_id) REFERENCES extractions(id)
)
"""))

            # Table pour les groupes de parties prenantes (manquait)
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS stakeholder_groups (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#4CAF50',
    description TEXT,
    created_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))


            # Colonnes spécialisées pour l'ATN
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS stakeholder_perspective TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS ai_type TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS platform_used TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS ethical_considerations TEXT"))

# Table pour la conformité réglementaire
# Ajout de la colonne PRISMA checklist
            conn.execute(text("ALTER TABLE projects ADD COLUMN IF NOT EXISTS prisma_checklist TEXT"))

            # Nouvelle table pour le Risque de Biais (RoB)
            conn.execute(text("""
CREATE TABLE IF NOT EXISTS risk_of_bias (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    article_id TEXT NOT NULL,
    domain_1_bias TEXT,
    domain_1_justification TEXT,
    domain_2_bias TEXT,
    domain_2_justification TEXT,
    overall_bias TEXT,
    overall_justification TEXT,
    created_at TEXT,
    FOREIGN KEY (project_id) REFERENCES projects(id)
)
"""))

            # Ajout de colonnes pour la gestion multipartie prenante
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS stakeholder_perspective TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS stakeholder_barriers TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS stakeholder_facilitators TEXT"))
            conn.execute(text("ALTER TABLE extractions ADD COLUMN IF NOT EXISTS stakeholder_outcomes TEXT"))

            # --- Début du bloc à remplacer ---

            # Vérifier si le projet par défaut existe, sinon le créer
            default_project_exists = conn.execute(text("SELECT id FROM projects WHERE id = 'default'")).first()
            if not default_project_exists:
                conn.execute(text("""
                    INSERT INTO projects (id, name, description, status, created_at, updated_at)
                    VALUES ('default', 'Modèles par défaut', 'Projet système pour les grilles par défaut', 'completed', NOW(), NOW())
                """))
                logger.info("✅ Projet par défaut créé.")

            # Vérifier si la grille ATN par défaut existe, sinon la créer
            atn_grid_exists = conn.execute(text("SELECT id FROM extraction_grids WHERE name = 'Grille ATN Standardisée' AND project_id = 'default'")).first()
            if not atn_grid_exists:
                try:
                    with open('grille-ATN.json', 'r', encoding='utf-8') as f:
                        atn_data = json.load(f)
                    
                    atn_grid_params = {
                        "id": str(uuid.uuid4()),
                        "project_id": "default",  # Lier au projet par défaut maintenant existant
                        "name": atn_data.get("name", "Grille ATN Standardisée"),
                        "fields": json.dumps([
                            {"name": field, "description": f"Extraction pour {field}"} for field in atn_data.get("fields", [])
                        ]),
                        "created_at": datetime.now(timezone.utc)
                    }
                    
                    conn.execute(text("""
                        INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
                        VALUES (:id, :project_id, :name, :fields, :created_at)
                    """), atn_grid_params)
                    logger.info("✅ Grille ATN standardisée créée et liée au projet par défaut.")
                except FileNotFoundError:
                    logger.warning("⚠️ Fichier grille-ATN.json non trouvé. La grille par défaut ne sera pas créée.")
                except Exception as e:
                    logger.error(f"❌ Erreur lors de la création de la grille ATN par défaut: {e}")

            # Seeding profils
            count_profiles = conn.execute(text("SELECT COUNT(*) FROM analysis_profiles")).scalar_one()
            if count_profiles == 0:
                default_profiles = [
                    {"id": "fast", "name": "Rapide", "is_custom": False, "preprocess_model": "gemma:2b",
                     "extract_model": "phi3:mini", "synthesis_model": "llama3.1:8b"},
                    {"id": "standard", "name": "Standard", "is_custom": False, "preprocess_model": "phi3:mini",
                     "extract_model": "llama3.1:8b", "synthesis_model": "llama3.1:8b"},
                    {"id": "deep", "name": "Approfondi", "is_custom": False, "preprocess_model": "llama3.1:8b",
                     "extract_model": "mixtral:8x7b", "synthesis_model": "llama3.1:70b"},
                ]
                stmt = text("""
INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
VALUES (:id, :name, :is_custom, :preprocess_model, :extract_model, :synthesis_model)
""")
                for p in default_profiles:
                    conn.execute(stmt, p)

            # Seeding prompts (JSON échappé)
            count_prompts = conn.execute(text("SELECT COUNT(*) FROM prompts")).scalar_one()
            if count_prompts == 0:
                default_prompts = [
                    {
                        "name": "screening_prompt",
                        "description": "Prompt pour la pré-sélection des articles.",
                        "template": (
                            "En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.\n\n"
                            "Titre: {title}\n\nRésumé: {abstract}\n\nSource: {database_source}\n\n"
                            "Répondez UNIQUEMENT en JSON: "
                            "{{\"relevance_score\": 0-10, \"decision\": \"À inclure\"|\"À exclure\", \"justification\": \"...\"}}"
                        ),
                    },
                    {
                        "name": "full_extraction_prompt",
                        "description": "Prompt pour l'extraction détaillée (grille).",
                        "template": (
                            "ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.\n"
                            "TEXTE À ANALYSER:\n---\n{text}\n---\nSOURCE: {database_source}\n"
                            "{{\n\"type_etude\":\"...\",\"population\":\"...\",\"intervention\":\"...\","
                            "\"resultats_principaux\":\"...\",\"limites\":\"...\",\"methodologie\":\"...\"\n}}"
                        ),
                    },
                    {
                        "name": "synthesis_prompt",
                        "description": "Prompt pour la synthèse.",
                        "template": (
                            "Contexte: {project_description}\n"
                            "Résumés:\n---\n{data_for_prompt}\n---\n"
                            "Réponds en JSON: {{\"relevance_evaluation\":[],\"main_themes\":[],\"key_findings\":[],"
                            "\"methodologies_used\":[],\"synthesis_summary\":\"\",\"research_gaps\":[]}}"
                        ),
                    },
                ]
                stmt = text("INSERT INTO prompts (name, description, template) VALUES (:name, :description, :template)")
                for pr in default_prompts:
                    conn.execute(stmt, pr)

            logger.info("✅ DB init/migrations OK.")
        except Exception as e:
            logger.error(f"❌ Erreur initialisation DB: {e}", exc_info=True)
            raise
        finally:
            conn.commit() # S'assurer que la transaction est validée
            
# ================================================================
# 2) API Routes
# ================================================================
@api_bp.route('/projects/<project_id>/export/thesis', methods=['GET'])
def export_for_thesis(project_id):
    """Export spécialisé pour thèse : données ATN + graphiques haute résolution."""
    session = Session()
    try:
        # 1. Données ATN avec gestion des erreurs
        atn_data = session.execute(text("""
            SELECT extracted_data, stakeholder_perspective, ai_type, 
                   ethical_considerations, stakeholder_barriers, stakeholder_facilitators
            FROM extractions 
            WHERE project_id = :pid AND extracted_data IS NOT NULL
        """), {"pid": project_id}).mappings().all()

        # 2. Métriques ATN avec valeurs par défaut et syntaxe PostgreSQL
        metrics_query = """
            SELECT 
                AVG(CASE WHEN extracted_data->>'Score_empathie_IA' ~ '^[0-9.]+$' 
                    THEN CAST(extracted_data->>'Score_empathie_IA' AS FLOAT) END) as avg_ai_empathy,
                AVG(CASE WHEN extracted_data->>'Score_empathie_humain' ~ '^[0-9.]+$' 
                    THEN CAST(extracted_data->>'Score_empathie_humain' AS FLOAT) END) as avg_human_empathy,
                COUNT(*) as total_studies,
                COUNT(CASE WHEN extracted_data->>'RGPD_conformité' = 'Oui' THEN 1 END) as gdpr_compliant,
                COUNT(CASE WHEN extracted_data->>'Type_IA' IS NOT NULL THEN 1 END) as ai_type_identified
            FROM extractions 
            WHERE project_id = :pid
        """
        
        metrics = session.execute(text(metrics_query), {"pid": project_id}).mappings().fetchone()
        
        # 3. Récupérer les infos du projet
        project_info = session.execute(text("""
            SELECT name, description, created_at, search_query, databases_used
            FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()

        # 4. Créer le ZIP d'export thèse
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            
            # Excel avec données ATN pour tableaux
            if atn_data:
                df_atn = pd.DataFrame([dict(row) for row in atn_data])
                excel_buffer = io.BytesIO()
                with pd.ExcelWriter(excel_buffer, engine='openpyxl') as writer:
                    df_atn.to_excel(writer, sheet_name='Données_ATN', index=False)
                    
                    # Feuille métriques
                    metrics_df = pd.DataFrame([dict(metrics)])
                    metrics_df.to_excel(writer, sheet_name='Métriques_Agrégées', index=False)
                    
                zf.writestr('donnees_atn_these.xlsx', excel_buffer.getvalue())

            # JSON détaillé pour analyses
            export_data = {
                "project_info": dict(project_info) if project_info else {},
                "metrics": dict(metrics) if metrics else {},
                "export_date": datetime.now().isoformat(),
                "total_extractions": len(atn_data)
            }
            zf.writestr('export_metadata.json', json.dumps(export_data, indent=2, ensure_ascii=False))

            # Graphiques haute résolution
            project_dir = PROJECTS_DIR / project_id
            if project_dir.exists():
                for graph_file in project_dir.glob("*.png"):
                    zf.write(graph_file, f"graphiques_these/{graph_file.name}")
                for graph_file in project_dir.glob("*.pdf"):  # Versions vectorielles
                    zf.write(graph_file, f"graphiques_these/{graph_file.name}")

            # Rapport automatique LaTeX
            generate_thesis_report(zf, atn_data, metrics, project_info)

        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype='application/zip',  # CORRECTION : Ajout d'une virgule ici
            headers={'Content-Disposition': f'attachment; filename=these_atn_{project_id}.zip'}
        )
        
    except Exception as e:
        logger.error(f"Erreur export ATN: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

def generate_thesis_report(zf, atn_data, metrics, project_info):
    """Génère un rapport LaTeX complet pour la thèse."""
    
    # Données sécurisées
    project_name = project_info.get('name', 'Projet ATN') if project_info else 'Projet ATN'
    total_studies = metrics.get('total_studies', 0) if metrics else 0
    avg_ai_empathy = metrics.get('avg_ai_empathy') or 0
    avg_human_empathy = metrics.get('avg_human_empathy') or 0
    gdpr_compliant = metrics.get('gdpr_compliant', 0) if metrics else 0
    
    latex_template = f"""\\documentclass[12pt,a4paper]{{article}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[french]{{babel}}
\\usepackage{{graphicx}}
\\usepackage{{booktabs}}
\\usepackage{{longtable}}
\\usepackage{{geometry}}
\\geometry{{margin=2.5cm}}

\\title{{Alliance Thérapeutique Numérique\\\\
Résultats de la Revue Systématique}}
\\author{{Thèse de Médecine Générale}}
\\date{{\\today}}

\\begin{{document}}
\\maketitle

\\section*{{Informations sur le projet}}
\\begin{{itemize}}
    \\item \\textbf{{Nom du projet}}: {project_name.replace('_', ' ')}
    \\item \\textbf{{Nombre d'études incluses}}: {total_studies}
    \\item \\textbf{{Date d'export}}: \\today
\\end{{itemize}}

\\section{{Résumé de l'analyse}}

\\subsection{{Métriques d'Empathie}}
\\begin{{table}}[h]
\\centering
\\begin{{tabular}}{{lc}}
\\toprule
\\textbf{{Métrique}} & \\textbf{{Valeur}} \\\\
\\midrule
Score moyen d'empathie IA & {avg_ai_empathy:.2f}/10 \\\\
Score moyen d'empathie humaine & {avg_human_empathy:.2f}/10 \\\\
Études conformes RGPD & {gdpr_compliant}/{total_studies} \\\\
\\bottomrule
\\end{{tabular}}
\\caption{{Métriques d'empathie et conformité réglementaire}}
\\end{{table}}

\\subsection{{Visualisations}}

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.9\\textwidth]{{graphiques_these/prisma_flow.png}}
    \\caption{{Diagramme PRISMA-ScR de sélection des études sur l'Alliance Thérapeutique Numérique.}}
    \\label{{fig:prisma}}

\\begin{{figure}}[h]
    \\centering
    \\includegraphics[width=0.8\\textwidth]{{graphiques_these/meta_analysis_plot.png}}
    \\caption{{Distribution des scores de pertinence des études analysées}}
    \\label{{fig:scores}}
\\end{{figure}}

\\section{{Méthodologie}}
Cette analyse a été réalisée avec AnalyLit v4.1, un outil d'intelligence artificielle spécialisé dans les revues de littérature systématiques. Les données ont été extraites automatiquement selon la grille ATN standardisée et validées manuellement.

\\section{{Fichiers disponibles}}
\\begin{{itemize}}
    \\item \\texttt{{donnees\_atn\_these.xlsx}} : Données complètes au format Excel
    \\item \\texttt{{graphiques\_these/}} : Graphiques haute résolution (PNG et PDF)
    \\item \\texttt{{export\_metadata.json}} : Métadonnées de l'export
\\end{{itemize}}

\\end{{document}}
"""
    
    zf.writestr('rapport_these.tex', latex_template)
    
    # Rapport Markdown pour Word
    markdown_template = f"""# Alliance Thérapeutique Numérique - Résultats

## Informations du projet
- **Projet** : {project_name}
- **Études analysées** : {total_studies}
- **Date d'export** : {datetime.now().strftime('%d/%m/%Y')}

## Métriques clés
- **Empathie IA moyenne** : {avg_ai_empathy:.2f}/10
- **Empathie humaine moyenne** : {avg_human_empathy:.2f}/10
- **Conformité RGPD** : {gdpr_compliant}/{total_studies} études

## Graphiques Disponibles
1. **Diagramme PRISMA-ScR** : `graphiques_these/prisma_flow.png`
2. **Méta-analyse** : `graphiques_these/meta_analysis_plot.png`
3. **Graphe de connaissances** : `graphiques_these/knowledge_graph.png`

Ces fichiers sont prêts à être insérés dans votre document de thèse.

## Données disponibles
- `donnees_atn_these.xlsx` : Tableaux Excel pour insertion directe
- `export_metadata.json` : Métadonnées détaillées
- `rapport_these.tex` : Template LaTeX compilable

*Export généré par AnalyLit v4.1 ATN*"""
    
    zf.writestr('rapport_these.md', markdown_template)

@api_bp.route('/projects/<project_id>/prisma-checklist', methods=['GET', 'POST'])
def handle_prisma_checklist(project_id):
    """Gère la checklist PRISMA-ScR du projet."""
    session = Session()
    try:
        if request.method == 'GET':
            project = session.execute(text("""
                SELECT prisma_checklist FROM projects WHERE id = :pid
            """), {"pid": project_id}).mappings().fetchone()
            
            if project and project.get('prisma_checklist'):
                checklist_data = json.loads(project['prisma_checklist'])
            else:
                from utils.prisma_scr import PRISMA_SCR_CHECKLIST
                checklist_data = PRISMA_SCR_CHECKLIST
            
            from utils.prisma_scr import get_prisma_scr_completion_rate
            completion_rate = get_prisma_scr_completion_rate(checklist_data)
            
            return jsonify({
                "checklist": checklist_data,
                "completion_rate": completion_rate
            })
        
        elif request.method == 'POST':
            data = request.get_json(force=True)
            
            session.execute(text("""
                UPDATE projects 
                SET prisma_checklist = :checklist, updated_at = :ts 
                WHERE id = :pid
            """), {
                "checklist": json.dumps(data.get('checklist', {})),
                "ts": datetime.now().isoformat(),
                "pid": project_id
            })
            session.commit()
            
            return jsonify({"message": "Checklist PRISMA-ScR sauvegardée"}), 200
            
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_prisma_checklist: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/atn-analysis', methods=['POST'])
def run_atn_analysis(project_id):
    """Lance l'analyse ATN multipartie prenante."""
    job = analysis_queue.enqueue(
        run_atn_stakeholder_analysis_task,
        project_id=project_id,
        job_timeout='30m'
    )
    
    return jsonify({
        "message": "Analyse ATN multipartie prenante lancée.",
        "job_id": job.id
    }), 202

@api_bp.route('/projects/<project_id>/atn-metrics', methods=['GET'])
def get_atn_metrics(project_id):
    """Récupère les métriques ATN agrégées."""
    session = Session()
    try:
        # Métriques d'empathie
        # CORRECTION: Remplacement de JSON_EXTRACT par la syntaxe PostgreSQL
        empathy_metrics = session.execute(text("""
            SELECT AVG((extracted_data->>'Score_empathie_IA')::FLOAT) as avg_ai_empathy,
                   AVG((extracted_data->>'Score_empathie_humain')::FLOAT) as avg_human_empathy,
                   COUNT(*) as total_with_empathy
            FROM extractions 
            WHERE project_id = :pid 
            AND extracted_data->>'Score_empathie_IA' IS NOT NULL
        """), {"pid": project_id}).mappings().fetchone()
        
        # Distribution des types d'IA
        ai_types = session.execute(text("""
            SELECT extracted_data->>'Type_IA' as ai_type, COUNT(*) as count
            FROM extractions 
            WHERE project_id = :pid 
            AND extracted_data->>'Type_IA' IS NOT NULL
            GROUP BY extracted_data->>'Type_IA'
        """), {"pid": project_id}).mappings().all()
        
        # Conformité réglementaire
        regulatory_stats = session.execute(text("""
            SELECT 
                SUM(CASE WHEN extracted_data->>'RGPD_conformité' = 'Oui' THEN 1 ELSE 0 END) as gdpr_compliant,
                COUNT(CASE WHEN extracted_data->>'RGPD_conformité' IS NOT NULL THEN 1 END) as total_gdpr_mentioned,
                COUNT(CASE WHEN extracted_data->>'AI_Act_risque' IS NOT NULL THEN 1 END) as total_ai_act_mentioned
            FROM extractions 
            WHERE project_id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        
        return jsonify({
            "empathy_metrics": dict(empathy_metrics) if empathy_metrics else {},
            "ai_types_distribution": [dict(r) for r in ai_types],
            "regulatory_compliance": dict(regulatory_stats) if regulatory_stats else {}
        })
        
    except Exception as e:
        logger.error(f"Erreur get_atn_metrics: {e}", exc_info=True)
        return jsonify({'error': 'Erreur lors du calcul des métriques ATN'}), 500
    finally:
        session.close()

@api_bp.route('/health', methods=['GET'])
def health_check():
    db_status, redis_status = "error", "error"
    try:
        redis_status = "connected" if redis_conn.ping() else "disconnected"
    except Exception:
        pass
    session = Session()
    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        logger.error(f"Erreur health check DB: {e}")
    finally:
        session.close()
    return jsonify({
        "status": "ok",
        "version": config.ANALYLIT_VERSION,
        "timestamp": datetime.now().isoformat(),
        "services": {"database": db_status, "redis": redis_status, "ollama": "unknown"}
    })

@api_bp.route('/databases', methods=['GET'])
def get_available_databases():
    try:
        return jsonify(db_manager.get_available_databases())
    except Exception as e:
        logger.error(f"Erreur get_available_databases: {e}")
        return jsonify([]), 200

# --- Projets CRUD ---
@api_bp.route('/projects', methods=['GET', 'POST'])
def handle_projects():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM projects ORDER BY updated_at DESC")).mappings().all()
            return jsonify([dict(r) for r in rows])
        if request.method == 'POST':
            data = request.get_json(force=True)
            now = datetime.now().isoformat()
            project = {
                "id": str(uuid.uuid4()),
                "name": data['name'],
                "description": data.get('description', ''),
                "created_at": now,
                "updated_at": now,
                "analysis_mode": data.get('mode', 'screening')
            }
            session.execute(text("""
            INSERT INTO projects (id, name, description, created_at, updated_at, analysis_mode)
            VALUES (:id, :name, :description, :created_at, :updated_at, :analysis_mode)
            """), project)
            PROJECTS_DIR.joinpath(project['id']).mkdir(exist_ok=True)
            session.commit()
            return jsonify(project), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_projects: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>', methods=['GET', 'DELETE'])
def handle_single_project(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            row = session.execute(text("SELECT * FROM projects WHERE id = :id"), {"id": project_id}).mappings().fetchone()
            return (jsonify(dict(row)) if row else (jsonify({'error': 'Projet non trouvé'}), 404))
        if request.method == 'DELETE':
            session.execute(text("DELETE FROM search_results WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM extractions WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM processing_log WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM extraction_grids WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM chat_messages WHERE project_id = :pid"), {"pid": project_id})
            session.execute(text("DELETE FROM projects WHERE id = :pid"), {"pid": project_id})
            session.commit()
            return jsonify({'message': 'Projet supprimé'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_single_project: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Recherche multi-bases ---
@api_bp.route('/search', methods=['POST'])
def search_multiple_databases():
    data = request.get_json(force=True)
    project_id = data.get('project_id')
    query = data.get('query')
    databases = data.get('databases', ['pubmed'])
    max_results_per_db = data.get('max_results_per_db', 50)
    if not project_id or not query:
        return jsonify({'error': 'project_id et query requis'}), 400

    session = Session()
    try:
        session.execute(text("""
        UPDATE projects
        SET search_query = :q, databases_used = :dbs, status = 'searching', updated_at = :now
        WHERE id = :pid
        """), {"q": query, "dbs": json.dumps(databases), "now": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur saving search params: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

    background_queue.enqueue(
        multi_database_search_task,
        project_id=project_id,
        query=query,
        databases=databases,
        max_results_per_db=max_results_per_db,
        job_timeout='30m'
    )
    return jsonify({'message': f'Recherche lancée dans {len(databases)} base(s)'}), 202

@api_bp.route('/projects/<project_id>/search-results', methods=['GET'])
def get_project_search_results(project_id):
    session = Session()
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 500, type=int)
        database_filter = request.args.get('database')
        offset = (page - 1) * per_page

        base_query = "FROM search_results WHERE project_id = :pid"
        params = {"pid": project_id}
        if database_filter:
            base_query += " AND database_source = :db"
            params["db"] = database_filter

        total = session.execute(text(f"SELECT COUNT(*) {base_query}"), params).scalar_one()
        rows = session.execute(text(f"""
        SELECT * {base_query}
        ORDER BY created_at DESC
        LIMIT :limit OFFSET :offset
        """), {**params, "limit": per_page, "offset": offset}).mappings().all()

        return jsonify({
            "results": [dict(r) for r in rows],
            "total": total,
            "page": page,
            "per_page": per_page,
            "has_next": (offset + per_page) < total,
            "has_prev": page > 1
        })
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/search-stats', methods=['GET'])
def get_project_search_stats(project_id):
    session = Session()
    try:
        stats = session.execute(text("""
        SELECT database_source, COUNT(*) as count
        FROM search_results WHERE project_id = :pid
        GROUP BY database_source
        """), {"pid": project_id}).mappings().all()
        total = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"),
                                {"pid": project_id}).scalar_one()
        return jsonify({
            "total_results": total,
            "results_by_database": {r["database_source"]: r["count"] for r in stats}
        })
    finally:
        session.close()

# --- Upload et gestion des fichiers ---
@api_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    files = []
    if 'files' in request.files:
        files = request.files.getlist('files')
    elif 'file' in request.files:
        files = [request.files['file']]
    if not files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400

    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    successful, failed = [], []
    for file in files:
        if file and file.filename:
            filename_base = Path(file.filename).stem
            safe_filename = sanitize_filename(filename_base) + ".pdf"
            pdf_path = project_dir / safe_filename
            try:
                file.save(str(pdf_path))
                successful.append(safe_filename)
            except Exception as e:
                failed.append(f"{safe_filename}: {str(e)}")

    send_project_notification(project_id, 'pdf_upload_completed',
                              f"{len(successful)} PDF importés, {len(failed)} échecs.",
                              {'successful': successful, 'failed': failed})
    return jsonify({'successful': successful, 'failed': failed}), 200

@api_bp.route('/projects/<project_id>/upload-pdf-for-article', methods=['POST'])
def upload_pdf_for_article(project_id):
    """Upload manuel d'un PDF lié à un article (utilisé par le frontend)."""
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    file = request.files['file']
    if not file.filename or not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Veuillez fournir un fichier PDF.'}), 400

    article_id = request.args.get('article_id', '') or Path(file.filename).stem
    if not article_id:
        article_id = str(uuid.uuid4())

    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    safe_name = f"{sanitize_filename(article_id)}.pdf"
    try:
        file.save(str(project_dir / safe_name))
        send_project_notification(project_id, 'pdf_upload_completed', f'PDF uploadé pour {article_id}')
        return jsonify({'message': 'PDF uploadé avec succès', 'filename': safe_name}), 200
    except Exception as e:
        logger.error(f"Erreur upload_pdf_for_article: {e}", exc_info=True)
        return jsonify({'error': 'Erreur lors de l’upload'}), 500

@api_bp.route('/projects/<project_id>/files', methods=['GET'])
def list_project_files(project_id):
    project_dir = PROJECTS_DIR / project_id
    if not project_dir.is_dir():
        return jsonify([])
    pdf_files = [{"filename": f.name} for f in project_dir.glob("*.pdf")]
    return jsonify(pdf_files)

@api_bp.route('/projects/<project_id>/files/<filename>', methods=['GET'])
def get_project_file(project_id, filename):
    project_dir = PROJECTS_DIR / project_id
    if ".." in filename or filename.startswith("/"):
        return jsonify({"error": "Chemin de fichier invalide."}), 400
    return send_from_directory(str(project_dir), filename)

@api_bp.route('/projects/<project_id>/index', methods=['POST'])
def run_indexing(project_id):
    job = background_queue.enqueue(index_project_pdfs_task, project_id=project_id, job_timeout='1h')
    session = Session()
    try:
        session.execute(text("UPDATE projects SET status = 'indexing', updated_at = :t WHERE id = :pid"),
                        {"t": datetime.now().isoformat(), "pid": project_id})
        session.commit()
    finally:
        session.close()
    return jsonify({'message': "Indexation lancée.", 'job_id': job.id}), 202

# --- Extractions ---
@api_bp.route('/projects/<project_id>/extractions', methods=['GET'])
def get_project_extractions(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
        SELECT * FROM extractions
        WHERE project_id = :pid
        ORDER BY relevance_score DESC
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/files', methods=['GET'])
def get_project_files(project_id):
    """Retourne la liste des fichiers (PDFs) associés à un projet."""
    try:
        project_dir = PROJECTS_DIR / project_id
        if not project_dir.is_dir():
            # Le répertoire projet n'existe pas, donc pas de fichiers
            return jsonify([])

        files_info = []
        for f in project_dir.iterdir():
            if f.is_file():
                try:
                    # Ajoute la taille du fichier pour information
                    size = f.stat().st_size
                    files_info.append({'filename': f.name, 'size': size})
                except Exception as e:
                    # Si la lecture d'un fichier échoue, on continue
                    logger.warning(f"Impossible de lire les infos du fichier {f.name}: {e}")
                    continue
                    
        return jsonify(files_info)
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des fichiers pour le projet {project_id}: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur lors de la récupération des fichiers.'}), 500

@api_bp.route('/projects/<project_id>/index-pdfs', methods=['POST'])
def run_index_pdfs(project_id):
    """Lance l'indexation des PDFs pour le chat RAG."""
    try:
        # On met la tâche dans la file d'attente "background"
        job = background_queue.enqueue(
            index_project_pdfs_task,
            project_id=project_id,
            job_timeout='1h'  # Timeout généreux pour les gros projets
        )
        # Notifier l'utilisateur que la tâche a bien été lancée
        send_project_notification(
            project_id, 
            'info', 
            'Lancement de l\'indexation des PDFs en arrière-plan.'
        )
        return jsonify({'message': 'Indexation des PDFs lancée en arrière-plan.', 'job_id': job.id}), 202
    except Exception as e:
        logger.error(f"Erreur lors du lancement de l'indexation pour le projet {project_id}: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur lors du lancement de la tâche.'}), 500

@api_bp.route('/projects/<project_id>/results', methods=['GET'])
def get_project_results(project_id):
    """Récupère les résultats de recherche d'un projet."""
    session = Session()
    try:
        # Récupérer les résultats de recherche pour le projet
        rows = session.execute(text("""
            SELECT * FROM search_results 
            WHERE project_id = :pid 
            ORDER BY created_at DESC
        """), {"pid": project_id}).mappings().all()
        
        results = [dict(row) for row in rows]
        return jsonify(results), 200
        
    except Exception as e:
        logger.error(f"Erreur get_project_results: {e}", exc_info=True)
        return jsonify({"error": "Erreur lors de la récupération des résultats"}), 500
    finally:
        session.close()
        
# --- Profils et prompts ---
@api_bp.route('/profiles', methods=['GET', 'POST'])
def handle_analysis_profiles():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM analysis_profiles ORDER BY name")).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            profile = {
                "id": str(uuid.uuid4()),
                "name": data['name'],
                "is_custom": True,
                "preprocess_model": data['preprocess_model'],
                "extract_model": data['extract_model'],
                "synthesis_model": data['synthesis_model']
            }
            session.execute(text("""
            INSERT INTO analysis_profiles (id, name, is_custom, preprocess_model, extract_model, synthesis_model)
            VALUES (:id, :name, :is_custom, :preprocess_model, :extract_model, :synthesis_model)
            """), profile)
            session.commit()
            return jsonify(profile), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_analysis_profiles: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# ALIAS pour compatibilité frontend: /analysis-profiles
@api_bp.route('/analysis-profiles', methods=['GET', 'POST'])
def handle_analysis_profiles_alias():
    if request.method == 'GET':
        return handle_analysis_profiles()
    if request.method == 'POST':
        return handle_analysis_profiles()

@api_bp.route('/prompts', methods=['GET', 'POST'])
def handle_prompts():
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("SELECT * FROM prompts ORDER BY name")).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            session.execute(text("""
            INSERT INTO prompts (name, description, template)
            VALUES (:name, :description, :template)
            ON CONFLICT (name) DO UPDATE SET
              description = EXCLUDED.description,
              template = EXCLUDED.template
            """), {
                "name": data['name'],
                "description": data['description'],
                "template": data['template']
            })
            session.commit()
            return jsonify({'message': 'Prompt sauvegardé'}), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_prompts: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Grilles d'extraction ---
@api_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
def grids_collection(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("""
            SELECT id, name, fields, created_at FROM extraction_grids
            WHERE project_id = :pid ORDER BY created_at DESC
            """), {"pid": project_id}).mappings().all()
            
            grids = []
            for r in rows:
                g = dict(r)
                try:
                    g['fields'] = json.loads(g['fields'])
                except Exception:
                    g['fields'] = []
                grids.append(g)
            return jsonify(grids)

        if request.method == 'POST':
            data = request.get_json(force=True)
            name, fields = data.get('name'), data.get('fields')
            if not name or not isinstance(fields, list) or not fields:
                return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400

            grid_id = str(uuid.uuid4())
            session.execute(text("""
            INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
            VALUES (:id, :pid, :n, :f, :t)
            """), {"id": grid_id, "pid": project_id, "n": name, "f": json.dumps(fields), 
                   "t": datetime.now().isoformat()})
            session.commit()
            
            return jsonify({"id": grid_id, "project_id": project_id, "name": name, "fields": fields,
                            "created_at": datetime.now().isoformat()}), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur grids_collection: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['PUT', 'DELETE'])
def grid_resource(project_id, grid_id):
    session = Session()
    try:
        if request.method == 'PUT':
            data = request.get_json(force=True)
            name, fields = data.get('name'), data.get('fields')
            if not name or not isinstance(fields, list) or not fields:
                return jsonify({'error': 'Le nom et une liste de champs sont requis.'}), 400

            res = session.execute(text("""
            UPDATE extraction_grids SET name = :n, fields = :f
            WHERE id = :id AND project_id = :pid
            """), {"n": name, "f": json.dumps(fields), "id": grid_id, "pid": project_id})
            
            if res.rowcount == 0:
                return jsonify({'error': "Grille non trouvée ou n'appartient pas à ce projet."}), 404
            
            session.commit()
            return jsonify({'message': 'Grille mise à jour avec succès.'})

        if request.method == 'DELETE':
            res = session.execute(text("""
            DELETE FROM extraction_grids WHERE id = :id AND project_id = :pid
            """), {"id": grid_id, "pid": project_id})
            
            if res.rowcount == 0:
                return jsonify({'error': "Grille non trouvée ou n'appartient pas à ce projet."}), 404
            
            session.commit()
            return jsonify({'message': 'Grille supprimée avec succès.'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur grid_resource: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()
        
@api_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
def import_grid_from_file(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier n'a été envoyé"}), 400

    file = request.files['file']
    if file.filename == '' or not file.filename.endswith('.json'):
        return jsonify({"error": "Veuillez sélectionner un fichier .json"}), 400

    try:
        grid_data = json.load(file.stream)
        grid_name = grid_data.get('name')
        grid_fields = grid_data.get('fields')

        if not grid_name or not isinstance(grid_fields, list):
            return jsonify({"error": "Le JSON doit contenir 'name' (string) et 'fields' (liste de strings)"}), 400
        
        # Transformer la liste de strings en liste d'objets pour être cohérent
        formatted_fields = [{"name": field, "description": ""} for field in grid_fields]

        session = Session()
        try:
            session.execute(text("""
            INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
            VALUES (:id, :pid, :n, :f, :t)
            """), {"id": str(uuid.uuid4()), "pid": project_id, "n": grid_name,
                   "f": json.dumps(formatted_fields), "t": datetime.now().isoformat()})
            session.commit()
        finally:
            session.close()

        return jsonify({"message": "Grille importée avec succès"}), 201
    except json.JSONDecodeError:
        return jsonify({"error": "Fichier JSON invalide"}), 400
    except Exception as e:
        logger.error(f"Erreur import grid: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne du serveur"}), 500
        
# --- Grilles d'extraction ---
@api_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
def handle_extraction_grids(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("""
            SELECT * FROM extraction_grids
            WHERE project_id = :pid
            ORDER BY created_at DESC
            """), {"pid": project_id}).mappings().all()
            
            # Convertir la chaîne JSON des champs en liste
            grids = []
            for row in rows:
                grid = dict(row)
                try:
                    grid['fields'] = json.loads(grid['fields'])
                except (json.JSONDecodeError, TypeError):
                    grid['fields'] = []
                grids.append(grid)
            return jsonify(grids)

        if request.method == 'POST':
            data = request.get_json(force=True)
            grid = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "name": data['name'],
                "fields": json.dumps(data.get('fields', [])),
                "created_at": datetime.now().isoformat()
            }
            session.execute(text("""
            INSERT INTO extraction_grids (id, project_id, name, fields, created_at)
            VALUES (:id, :project_id, :name, :fields, :created_at)
            """), grid)
            session.commit()
            # Re-convertir les champs en liste pour la réponse
            grid['fields'] = data.get('fields', [])
            return jsonify(grid), 201
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_extraction_grids: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['PUT', 'DELETE'])
def handle_single_grid(project_id, grid_id):
    session = Session()
    try:
        if request.method == 'PUT':
            data = request.get_json(force=True)
            session.execute(text("""
            UPDATE extraction_grids SET name = :name, fields = :fields
            WHERE id = :id AND project_id = :pid
            """), {
                "name": data['name'],
                "fields": json.dumps(data.get('fields', [])),
                "id": grid_id,
                "pid": project_id
            })
            session.commit()
            return jsonify({'message': 'Grille mise à jour'})

        if request.method == 'DELETE':
            session.execute(text("DELETE FROM extraction_grids WHERE id = :id AND project_id = :pid"),
                            {"id": grid_id, "pid": project_id})
            session.commit()
            return jsonify({'message': 'Grille supprimée'})
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_single_grid: {e}")
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()
        
# --- Paramètres Zotero ---
@api_bp.route('/settings/zotero', methods=['GET', 'POST'])
def handle_zotero_settings():
    config_path = PROJECTS_DIR / 'zotero_config.json'
    if request.method == 'GET':
        if config_path.exists():
            with open(config_path, 'r') as f:
                zotero_config = json.load(f)
            return jsonify({
                'userId': zotero_config.get('user_id', ''),
                'hasApiKey': bool(zotero_config.get('api_key'))
            })
        return jsonify({'userId': '', 'hasApiKey': False})

    if request.method == 'POST':
        data = request.get_json(force=True)
        zotero_config = {
            'user_id': data.get('userId'),
            'api_key': data.get('apiKey')
        }
        with open(config_path, 'w') as f:
            json.dump(zotero_config, f)
        return jsonify({'message': 'Paramètres Zotero sauvegardés.'})

# --- Import Zotero ---
@api_bp.route('/projects/<project_id>/analyses', methods=['GET'])
def get_project_analyses(project_id):
    """
    Retourne un petit objet JSON résumant l'état et les sorties d'analyse
    pour alimenter l'onglet 'Analyses' du frontend.
    """
    session = Session()
    try:
        row = session.execute(text("""
            SELECT 
                status,
                analysis_result,
                analysis_plot_path,
                synthesis_result,
                discussion_draft,
                knowledge_graph,
                prisma_flow_path
            FROM projects
            WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()

        if not row:
            return jsonify({"error": "Projet introuvable"}), 404

        # Normalisation des champs (JSON string -> dict)
        def _safe_load(s):
            try:
                return json.loads(s) if isinstance(s, str) and s.strip() else None
            except (json.JSONDecodeError, TypeError):
                return s if isinstance(s, (dict, list)) else None # Retourne la donnée si déjà un dict/list

        analysis_data = {
            "status": row.get("status"),
            "analysis_result": _safe_load(row.get("analysis_result")),
            "analysis_plot_path": row.get("analysis_plot_path"),
            "synthesis_result": _safe_load(row.get("synthesis_result")),
            "discussion_draft": row.get("discussion_draft"),
            "knowledge_graph": _safe_load(row.get("knowledge_graph")),
            "prisma_flow_path": row.get("prisma_flow_path"),
        }
        return jsonify(analysis_data), 200
    except Exception as e:
        logger.error(f"Erreur get_project_analyses: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne"}), 500
    finally:
        session.close()
        
# --- Export projet ---
@api_bp.route('/projects/<project_id>/add-manual-articles', methods=['POST'])
def add_manual_articles(project_id):
    """
    Lance l'ajout asynchrone d'articles manuellement (PMID, DOI, arXiv) au projet.
    """
    try:
        data = request.get_json(force=True) or {}
        raw = data.get('identifiers', '') or ''
        items = data.get('items')
        
        if isinstance(items, list) and items:
            identifiers = [str(x).strip() for x in items if str(x).strip()]
        else:
            identifiers = [line.strip() for line in str(raw).splitlines() if line.strip()]
        
        if not identifiers:
            return jsonify({'error': 'Aucun identifiant fourni.'}), 400

        job = background_queue.enqueue(
            add_manual_articles_task,
            project_id=project_id,
            identifiers=identifiers,
            job_timeout='30m'
        )
        
        return jsonify({'message': f'Ajout de {len(identifiers)} article(s) lancé en arrière-plan.', 'job_id': job.id}), 202
        
    except Exception as e:
        logger.error(f"Erreur add_manual_articles: {e}", exc_info=True)
        return jsonify({'error': "Erreur lors du lancement de l'ajout des articles."}), 500

@api_bp.route('/projects/<project_id>/export-analyses', methods=['GET'])
def export_project_analyses(project_id):
    """Exporte les résultats d'analyse d'un projet dans une archive ZIP."""
    # CORRECTION : Renommer la fonction pour refléter son contenu plus large
    return export_project_data(project_id)

def export_project_data(project_id):
    """Exporte TOUTES les données d'un projet dans une archive ZIP."""
    session = Session()
    try:
        project = session.execute(text("""
            SELECT name, description, discussion_draft, knowledge_graph, prisma_flow_path, analysis_result, synthesis_result
            FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()

        if not project:
            return jsonify({'error': 'Projet non trouvé'}), 404

        project_name_safe = sanitize_filename(project.get('name', 'projet_sans_nom'))
        
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            # --- Fichiers d'analyse ---
            # Exporter le brouillon de discussion
            if project.get('discussion_draft'):
                zf.writestr('brouillon_discussion.txt', project['discussion_draft'])

            # Exporter le graphe de connaissances
            if project.get('knowledge_graph'):
                try:
                    kg_data = json.loads(project['knowledge_graph'])
                    zf.writestr('graphe_connaissances.json', json.dumps(kg_data, indent=2, ensure_ascii=False))
                except (json.JSONDecodeError, TypeError):
                    zf.writestr('graphe_connaissances.txt', str(project['knowledge_graph']))

            # Exporter les autres résultats d'analyse
            if project.get('analysis_result'):
                try:
                    analysis_data = json.loads(project['analysis_result'])
                    zf.writestr('resultats_analyse_generale.json', json.dumps(analysis_data, indent=2, ensure_ascii=False))
                except (json.JSONDecodeError, TypeError):
                    zf.writestr('resultats_analyse_generale.txt', str(project['analysis_result']))

            # Exporter la synthèse principale
            if project.get('synthesis_result'):
                try:
                    synthesis_data = json.loads(project['synthesis_result'])
                    zf.writestr('synthese_principale.json', json.dumps(synthesis_data, indent=2, ensure_ascii=False))
                except (json.JSONDecodeError, TypeError):
                    zf.writestr('synthese_principale.txt', str(project['synthesis_result']))

            # Ajouter l'image PRISMA si elle existe
            if project.get('prisma_flow_path'):
                prisma_path = Path(project['prisma_flow_path'])
                if prisma_path.exists():
                    zf.write(prisma_path, prisma_path.name)
            
            # --- Données brutes (CSV) ---
            # Exporter les résultats de recherche
            search_results = pd.read_sql(text("SELECT * FROM search_results WHERE project_id = :pid"), session.bind, params={"pid": project_id})
            if not search_results.empty:
                zf.writestr('articles_recherches.csv', search_results.to_csv(index=False))

            # Exporter les extractions
            extractions = pd.read_sql(text("SELECT * FROM extractions WHERE project_id = :pid"), session.bind, params={"pid": project_id})
            if not extractions.empty:
                zf.writestr('donnees_extraites_ia.csv', extractions.to_csv(index=False))

            # Exporter les évaluations de risque de biais
            risk_of_bias = pd.read_sql(text("SELECT * FROM risk_of_bias WHERE project_id = :pid"), session.bind, params={"pid": project_id})
            if not risk_of_bias.empty:
                zf.writestr('risques_de_biais.csv', risk_of_bias.to_csv(index=False))

        buf.seek(0)
        return Response(
            buf.getvalue(),
            mimetype='application/zip',
            headers={'Content-Disposition': f'attachment; filename=export_complet_{project_name_safe}.zip'}
        )
    except Exception as e:
        logger.error(f"Erreur lors de l'export des données pour le projet {project_id}: {e}", exc_info=True)
        return jsonify({'error': "Erreur lors de la création de l'export."}), 500
    finally:
        session.close()
        
# --- Statut détaillé des files (remplace/complète les endpoints de queues) ---
@api_bp.route('/admin/queues-status', methods=['GET'])
def get_queues_status():
    """Retourne un statut consolidé et stable pour l’UI (évite [object Promise])."""
    try:
        queues = [
            ('analylit_processing_v4', processing_queue, 'Traitement des articles'),
            ('analylit_synthesis_v4', synthesis_queue, 'Synthèses et analyses'),
            ('analylit_analysis_v4', analysis_queue, 'Analyses avancées'),
            ('analylit_background_v4', background_queue, 'Arrière-plan')
        ]
        all_workers = Worker.all(connection=redis_conn)
        # Compte des workers à l’écoute de chaque file réelle RQ
        worker_map = {qname: 0 for qname, _, _ in queues}
        for w in all_workers:
            try:
                names = [n.decode() if isinstance(n, bytes) else n for n in w.queue_names()]
            except Exception:
                names = []
            for qname, qobj, _ in queues:
                if qobj.name in names:
                    worker_map[qname] += 1

        payload = []
        for qname, qobj, label in queues:
            payload.append({
                "rq_name": qobj.name,
                "display": label,
                "pending": len(qobj),
                "started": len(qobj.started_job_registry),
                "failed": len(qobj.failed_job_registry),
                "finished": len(qobj.finished_job_registry),
                "scheduled": len(qobj.scheduled_job_registry),
                "workers": worker_map.get(qname, 0)
            })
        return jsonify({"queues": payload, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        logger.error(f"Erreur get_queues_status: {e}", exc_info=True)
        return jsonify({"queues": []}), 200

@api_bp.route('/projects/<project_id>/import-zotero', methods=['POST'])
def import_from_zotero(project_id):
    data = request.get_json(force=True)
    manual_ids = data.get('articles', [])
    try:
        with open(PROJECTS_DIR / 'zotero_config.json', 'r') as f:
            zotero_config = json.load(f)
    except FileNotFoundError:
        return jsonify({'error': 'Veuillez configurer Zotero dans les paramètres.'}), 400

    if not manual_ids:
        return jsonify({'error': 'Aucun article à importer pour ce projet.'}), 400

    # La logique d'ajout d'article est déjà gérée côté client ou via une autre route.
    # Cette tâche se concentre sur la récupération des PDFs.
    # CORRECTION: Appel de la bonne tâche pour récupérer les PDFs depuis Zotero.
    job = background_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=manual_ids,
        zotero_user_id=zotero_config.get('user_id'),
        zotero_api_key=zotero_config.get('api_key'),
        job_timeout='1h'
    )
    return jsonify({
        'message': f'Import Zotero lancé pour {len(manual_ids)} articles.',
        'job_id': job.id
    }), 202

@api_bp.route('/projects/<project_id>/import-zotero-file', methods=['POST'])
def import_from_zotero_file(project_id):
    if 'file' not in request.files:
        return jsonify({'error': 'Aucun fichier fourni'}), 400
    file = request.files['file']
    if not file.filename.endswith('.json'):
        return jsonify({'error': 'Veuillez fournir un fichier .json'}), 400

    temp_dir = PROJECTS_DIR / 'temp_uploads'
    temp_dir.mkdir(exist_ok=True)
    temp_filename = f"{uuid.uuid4()}.json"
    temp_filepath = temp_dir / temp_filename
    try:
        file.save(str(temp_filepath))
    except Exception as e:
        logger.error(f"Impossible de sauvegarder le fichier Zotero temporaire: {e}")
        return jsonify({"error": "Erreur interne lors de la sauvegarde du fichier."}), 500

    job = background_queue.enqueue(
        import_from_zotero_file_task,
        project_id=project_id,
        json_file_path=str(temp_filepath),
        job_timeout='1h'
    )
    return jsonify({'message': 'Import du fichier Zotero lancé.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/fetch-online-pdfs', methods=['POST'])
def fetch_online_pdfs(project_id):
    data = request.get_json(force=True)
    article_ids = data.get('articles', [])
    if not article_ids:
        return jsonify({'error': 'Aucun article valide à traiter pour ce projet.'}), 400

    for article_id in article_ids:
        background_queue.enqueue(
            fetch_online_pdf_task,
            project_id=project_id,
            article_id=article_id,
            job_timeout='1h'
        )
    return jsonify({
        'message': f'Recherche OA lancée pour {len(article_ids)} articles.'
    }), 202

# --- Pipeline d'analyse ---
@api_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_project_pipeline(project_id):
    data = request.get_json(force=True)
    selected_articles = data.get('articles', [])
    profile_id = data.get('profile', 'standard')
    custom_grid_id = data.get('custom_grid_id')
    analysis_mode = data.get('analysis_mode', 'screening')

    if not selected_articles:
        return jsonify({'error': "La liste d'articles est requise."}), 400

    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"),
                                      {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400

        session.execute(text("DELETE FROM extractions WHERE project_id = :pid"), {"pid": project_id})
        session.execute(text("DELETE FROM processing_log WHERE project_id = :pid"), {"pid": project_id})

        session.execute(text("""
        UPDATE projects SET
            status = 'processing',
            profile_used = :p,
            updated_at = :t,
            pmids_count = :n,
            processed_count = 0,
            total_processing_time = 0,
            analysis_mode = :am
        WHERE id = :pid
        """), {
            "p": profile_id,
            "t": datetime.now().isoformat(),
            "n": len(selected_articles),
            "am": analysis_mode,
            "pid": project_id
        })
        session.commit()

        profile = dict(profile_row)
        for article_id in selected_articles:
            processing_queue.enqueue(
                process_single_article_task,
                project_id=project_id,
                article_id=article_id,
                profile=profile,
                analysis_mode=analysis_mode,
                custom_grid_id=custom_grid_id,
                job_timeout=1800
            )
        return jsonify({"status": "processing"}), 202
    except Exception as e:
        session.rollback()
        logger.error(f"run_project_pipeline error: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/run-synthesis', methods=['POST'])
def run_synthesis_endpoint(project_id):
    data = request.get_json(force=True)
    profile_id = data.get('profile', 'standard')

    session = Session()
    try:
        profile_row = session.execute(text("SELECT * FROM analysis_profiles WHERE id = :id"),
                                      {"id": profile_id}).mappings().fetchone()
        if not profile_row:
            return jsonify({'error': f"Profil invalide: '{profile_id}'"}), 400

        profile_to_use = dict(profile_row)
        job = synthesis_queue.enqueue(
            run_synthesis_task,
            project_id=project_id,
            profile=profile_to_use,
            job_timeout=3600
        )

        session.execute(text(
            "UPDATE projects SET status = 'synthesizing', job_id = :jid WHERE id = :pid"
        ), {"jid": job.id, "pid": project_id})
        session.commit()
        return jsonify({"status": "synthesizing", "message": "Synthèse lancée."}), 202
    finally:
        session.close()

# --- Ajout pour la validation ---
@api_bp.route('/projects/<project_id>/extractions/<extraction_id>/decision', methods=['PUT'])
def save_extraction_decision(project_id, extraction_id):
    """Sauvegarde la décision d'un évaluateur pour une extraction."""
    data = request.get_json(force=True)
    decision = data.get('decision')
    evaluator = data.get('evaluator', 'evaluator1')

    if decision not in ['include', 'exclude', '']:
        return jsonify({'error': 'Décision invalide'}), 400

    session = Session()
    try:
        extraction = session.execute(text("""
            SELECT id, validations FROM extractions
            WHERE project_id = :pid AND id = :eid
        """), {"pid": project_id, "eid": extraction_id}).mappings().fetchone()

        if not extraction:
            return jsonify({'error': 'Extraction non trouvée'}), 404

        try:
            validations_data = json.loads(extraction['validations']) if extraction['validations'] else {}
        except (json.JSONDecodeError, TypeError):
            validations_data = {}

        # Mettre à jour le JSON et le statut principal
        validations_data[evaluator] = decision if decision else None
        
        # CORRECTION : Mettre à jour la colonne user_validation_status
        session.execute(text("""
            UPDATE extractions SET validations = :validations, user_validation_status = :status WHERE id = :eid
        """), {
            "validations": json.dumps(validations_data), 
            "status": decision if decision else None, # Mettre à jour le statut direct
            "eid": extraction_id
        })
        
        session.commit()
        send_project_notification(project_id, 'validation_updated', f'Validation mise à jour pour {extraction_id}')
        return jsonify({'message': 'Décision enregistrée'}), 200

    except Exception as e:
        session.rollback()
        logger.error(f"Erreur save_extraction_decision: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()
        
@api_bp.route('/projects/<project_id>/validate-article', methods=['POST'])
def validate_article_endpoint(project_id):
    """
    CORRECTION: Route manquante pour la validation manuelle depuis la section Validation.
    Met à jour le statut de validation d'un article (extraction).
    """
    session = Session()
    try:
        data = request.get_json(force=True)
        article_id = data.get('article_id')
        decision = data.get('decision') # 'include' ou 'exclude'
        score = data.get('score')
        justification = data.get('justification')

        if not all([article_id, decision]):
            return jsonify({'error': 'article_id et decision sont requis'}), 400

        # Trouver l'extraction correspondante
        extraction = session.execute(text("""
            SELECT id FROM extractions WHERE project_id = :pid AND pmid = :pmid
        """), {"pid": project_id, "pmid": article_id}).mappings().fetchone()

        if not extraction:
            return jsonify({'error': 'Extraction non trouvée pour cet article'}), 404

        # Mettre à jour l'extraction
        session.execute(text("""
            UPDATE extractions 
            SET user_validation_status = :decision, relevance_score = :score, relevance_justification = :justification
            WHERE id = :id
        """), {
            "decision": decision,
            "score": score,
            "justification": justification,
            "id": extraction['id']
        })
        session.commit()
        send_project_notification(project_id, 'validation_updated', f'Article {article_id} validé comme "{decision}".')
        return jsonify({'message': 'Validation enregistrée avec succès'}), 200
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur validate_article_endpoint: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()
                
# --- Validation inter-évaluateurs ---
@api_bp.route('/projects/<project_id>/export-validations', methods=['GET'])
def export_validations(project_id):
    session = Session()
    try:
        rows = session.execute(text("""
        SELECT pmid, title, validations, relevance_score
        FROM extractions
        WHERE project_id = :pid AND validations IS NOT NULL
        """), {"pid": project_id}).mappings().all()

        records = []
        for r in rows:
            try:
                v = json.loads(r["validations"]) if r.get("validations") else {}
                if "evaluator1" in v:
                    records.append({
                        "article_id": r["pmid"],
                        "title": r["title"],
                        "decision": v["evaluator1"],
                        "ia_score": r.get("relevance_score", None)
                    })
            except Exception:
                continue

        if not records:
            return jsonify({"message": "Aucune validation évaluateur 1 à exporter."}), 404

        df = pd.DataFrame(records)
        csv_data = df.to_csv(index=False)
        return Response(
            csv_data,
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=validations_eval1_{project_id}.csv'}
        )
    except Exception as e:
        logger.error(f"Erreur export validations: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne du serveur"}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/import-validations', methods=['POST'])
def import_validations(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']

    session = Session()
    try:
        df = pd.read_csv(file.stream)
        normalized = {str(c).strip().lower(): c for c in df.columns}
        if not {"articleid", "decision"}.issubset(set(normalized.keys())):
            return jsonify({"error": "Le fichier CSV doit contenir les colonnes ['articleId','decision']"}), 400

        updated = 0
        for _, row in df.iterrows():
            article_id = str(row[normalized["articleid"]]).strip()
            decision = str(row[normalized["decision"]]).strip().lower()
            mapping = {
                "inclure": "include", "inclu": "include", "include": "include",
                "exclure": "exclude", "exclu": "exclude", "exclude": "exclude"
            }
            decision = mapping.get(decision, decision)
            if not article_id or decision not in ("include", "exclude"):
                continue

            ext = session.execute(text("""
            SELECT id, validations FROM extractions
            WHERE project_id = :pid AND pmid = :pmid
            """), {"pid": project_id, "pmid": article_id}).mappings().fetchone()
            if not ext:
                continue

            try:
                v = json.loads(ext["validations"]) if ext.get("validations") else {}
            except Exception:
                v = {}
            v["evaluator2"] = decision

            session.execute(text("""
            UPDATE extractions SET validations = :val WHERE id = :id
            """), {"val": json.dumps(v, ensure_ascii=False), "id": ext["id"]})
            updated += 1

        session.commit()
        return jsonify({"message": f"{updated} validations importées pour l'évaluateur 2."}), 200
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur import validations: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne ou format invalide"}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/calculate-kappa', methods=['POST'])
def calculate_project_kappa(project_id):
    job = analysis_queue.enqueue(calculate_kappa_task, project_id=project_id, job_timeout='10m')
    return jsonify({"message": "Calcul du Kappa lancé.", "job_id": job.id}), 202

@api_bp.route('/projects/<project_id>/inter-rater-stats', methods=['GET'])
def get_inter_rater_stats(project_id):
    session = Session()
    try:
        row = session.execute(text("""
        SELECT inter_rater_reliability FROM projects WHERE id = :pid
        """), {"pid": project_id}).mappings().fetchone()
        return jsonify({
            "kappa_result": row["inter_rater_reliability"] if row else "Non calculé"
        })
    except Exception as e:
        logger.error(f"Erreur inter-rater stats: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne du serveur"}), 500
    finally:
        session.close()

# ================================================================
# --- Rapports & Exports pour la Thèse ---
# ================================================================

@api_bp.route('/projects/<project_id>/reports/summary-table', methods=['GET'])
def get_summary_table_data(project_id):
    """Fournit les données extraites des articles inclus pour un tableau de synthèse."""
    session = Session()
    try:
        # On ne prend que les articles validés par l'utilisateur comme 'inclus'
        query = text("""
            SELECT pmid, title, extracted_data 
            FROM extractions 
            WHERE project_id = :pid AND user_validation_status = 'include'
        """)
        rows = session.execute(query, {"pid": project_id}).mappings().all()
        
        records = []
        for row in rows:
            try:
                data = json.loads(row['extracted_data']) if row['extracted_data'] else {}
                record = {
                    'PMID': row['pmid'],
                    'Titre': row['title'],
                    **data
                }
                records.append(record)
            except (json.JSONDecodeError, TypeError):
                continue
        
        return jsonify(records)
    except Exception as e:
        logger.error(f"Erreur get_summary_table_data: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

def format_citation(article, style='apa'):
    """Formate une citation simple pour un article."""
    authors = article.get('authors', 'Auteur inconnu')
    year = article.get('publication_date', 's.d.')
    title = article.get('title', 'Titre inconnu')
    journal = article.get('journal', 'Journal inconnu')
    
    # Simplification : ne prend que le premier auteur pour l'instant
    first_author = authors.split(',')[0].split(' ')[0] if authors else 'Auteur inconnu'
    
    if style == 'apa':
        return f"{first_author}, {year}. {title}. *{journal}*."
    elif style == 'vancouver':
        return f"{first_author}. {title}. {journal}. {year}."
    else:
        return f"[{first_author} ({year})] {title}"

@api_bp.route('/projects/<project_id>/reports/bibliography', methods=['GET'])
def get_bibliography(project_id):
    """Génère une bibliographie formatée pour les articles inclus."""
    style = request.args.get('style', 'apa')
    session = Session()
    try:
        # On récupère les détails des articles inclus depuis la table search_results
        query = text("""
            SELECT sr.* FROM search_results sr
            JOIN extractions e ON sr.article_id = e.pmid AND sr.project_id = e.project_id
            WHERE e.project_id = :pid AND e.user_validation_status = 'include'
        """)
        articles = session.execute(query, {"pid": project_id}).mappings().all()
        
        bibliography = [format_citation(dict(art), style) for art in articles]
        
        return jsonify(bibliography)
    except Exception as e:
        logger.error(f"Erreur get_bibliography: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/risk-of-bias', methods=['GET', 'POST'])
def handle_risk_of_bias(project_id):
    """Gère la récupération et la sauvegarde des évaluations de risque de biais."""
    session = Session()
    try:
        if request.method == 'GET':
            article_id = request.args.get('article_id')
            if not article_id:
                return jsonify({'error': 'article_id est requis'}), 400
            
            rob = session.execute(text("""
                SELECT * FROM risk_of_bias WHERE project_id = :pid AND article_id = :aid
            """), {"pid": project_id, "aid": article_id}).mappings().fetchone()
            
            return jsonify(dict(rob) if rob else {})

        if request.method == 'POST':
            data = request.get_json(force=True)
            rob_id = data.get('id') or str(uuid.uuid4())
            
            # Logique de sauvegarde ou de mise à jour
            session.execute(text("""
                INSERT INTO risk_of_bias (id, project_id, article_id, domain_1_bias, domain_1_justification, domain_2_bias, domain_2_justification, overall_bias, overall_justification, created_at)
                VALUES (:id, :pid, :aid, :d1b, :d1j, :d2b, :d2j, :ob, :oj, :ts)
                ON CONFLICT (id) DO UPDATE SET
                    domain_1_bias = EXCLUDED.domain_1_bias,
                    domain_1_justification = EXCLUDED.domain_1_justification,
                    domain_2_bias = EXCLUDED.domain_2_bias,
                    domain_2_justification = EXCLUDED.domain_2_justification,
                    overall_bias = EXCLUDED.overall_bias,
                    overall_justification = EXCLUDED.overall_justification
            """), {**data, "id": rob_id, "pid": project_id, "ts": datetime.now().isoformat()})
            
            session.commit()
            send_project_notification(project_id, 'rob_updated', f"Évaluation RoB mise à jour pour {data.get('article_id')}")
            return jsonify({'message': 'Évaluation sauvegardée'}), 200

    finally:
        session.close()

# ================================================================
# 8) Analyses
# ================================================================

@api_bp.route('/projects/<project_id>/run-prisma-flow', methods=['POST'])
def run_prisma_flow(project_id):
    """Lance la génération du diagramme PRISMA."""
    job = analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout='10m')
    return jsonify({'message': 'Génération du diagramme PRISMA lancée.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/run-meta-analysis', methods=['POST'])
def run_meta_analysis(project_id):
    """Lance une méta-analyse."""
    job = analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout='20m')
    return jsonify({'message': 'Méta-analyse lancée.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/run-descriptive-stats', methods=['POST'])
def run_descriptive_stats(project_id):
    """Lance le calcul des statistiques descriptives."""
    job = analysis_queue.enqueue(run_descriptive_stats_task, project_id=project_id, job_timeout='15m')
    return jsonify({'message': 'Calcul des statistiques descriptives lancé.', 'job_id': job.id}), 202


# --- Analyses avancées ---
@api_bp.route('/projects/<project_id>/run-analysis', methods=['POST'])
def run_advanced_analysis(project_id):
    data = request.get_json(force=True)
    analysis_type = data.get('type')
    if not analysis_type:
        return jsonify({'error': 'Type d\'analyse requis'}), 400

    # Vérifier que le type est valide AVANT de changer le statut
    valid_types = ['meta_analysis', 'atn_scores', 'discussion', 'knowledge_graph', 'prisma_flow']
    if analysis_type not in valid_types:
        return jsonify({'error': 'Type d\'analyse non supporté'}), 400

    try:
        session = Session()
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"),
                        {"pid": project_id})
        session.commit()
        if analysis_type == 'meta_analysis':
            job = analysis_queue.enqueue(run_meta_analysis_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'atn_scores':
            job = analysis_queue.enqueue(run_atn_score_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'discussion':
            job = analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'knowledge_graph':
            job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout='30m')
        elif analysis_type == 'prisma_flow':
            job = analysis_queue.enqueue(run_prisma_flow_task, project_id=project_id, job_timeout='30m')
        return jsonify({'message': f'Analyse {analysis_type} lancée', 'job_id': job.id}), 202
    except Exception as e:
        logger.error(f"Erreur run analysis: {e}")
        return jsonify({'error': 'Erreur lors du lancement de l\'analyse'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/run-discussion-draft', methods=['POST'])
def run_discussion_draft(project_id):
    """Lance la génération du brouillon de discussion."""
    session = Session()
    try:
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"), {"pid": project_id})
        session.commit()
        job = analysis_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout='30m')
        return jsonify({'message': 'Génération du brouillon de discussion lancée', 'job_id': job.id}), 202
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur run discussion draft: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/run-knowledge-graph', methods=['POST'])
def run_knowledge_graph(project_id):
    """Lance la génération du graphe de connaissances."""
    session = Session()
    try:
        session.execute(text("UPDATE projects SET status = 'generating_analysis' WHERE id = :pid"), {"pid": project_id})
        session.commit()
        job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout='30m')
        return jsonify({'message': 'Génération du graphe de connaissances lancée', 'job_id': job.id}), 202
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur run knowledge graph: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()
        
# --- Chat RAG ---
@api_bp.route('/projects/<project_id>/chat', methods=['POST', 'GET'])
def handle_project_chat(project_id):
    if request.method == 'GET':
        session = Session()
        try:
            rows = session.execute(text("""
            SELECT * FROM chat_messages
            WHERE project_id = :pid
            ORDER BY timestamp ASC
            """), {"pid": project_id}).mappings().all()
            return jsonify([dict(r) for r in rows])
        finally:
            session.close()
    if request.method == 'POST':
        data = request.get_json(force=True)
        question = data.get('question', '').strip()
        if not question:
            return jsonify({'error': 'La question est requise.'}), 400
        job = background_queue.enqueue(
            answer_chat_question_task,
            project_id=project_id,
            question=question,
            job_timeout='15m'
        )
        return jsonify({'message': 'Question envoyée au moteur RAG.', 'job_id': job.id}), 202

@api_bp.route('/projects/<project_id>/chat-messages', methods=['GET'])
def get_chat_messages(project_id):
    """Récupère l'historique des messages pour le chat."""
    session = Session()
    try:
        rows = session.execute(text("""
            SELECT * FROM chat_messages
            WHERE project_id = :pid
            ORDER BY timestamp ASC
        """), {"pid": project_id}).mappings().all()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        logger.error(f"Erreur get_chat_messages: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# --- Ollama ---
@api_bp.route('/ollama/models', methods=['GET'])
def list_ollama_models():
    import requests
    try:
        resp = requests.get(f"{config.OLLAMA_BASE_URL}/api/tags", timeout=10)
        resp.raise_for_status()
        data = resp.json() or {}
        models = []
        for m in data.get('models', []):
            name = m.get('name')
            if name:
                models.append({"name": name, "size": m.get("size", 0)})
        return jsonify(models)
    except Exception as e:
        logger.error(f"Erreur /ollama/models: {e}", exc_info=True)
        return jsonify([]), 200

@api_bp.route('/ollama/pull', methods=['POST'])
def ollama_pull_model():
    data = request.get_json(force=True)
    model = data.get('model')
    if not model:
        return jsonify({'error': 'Champ "model" requis.'}), 400
    try:
        job = background_queue.enqueue(pull_ollama_model_task, model_name=model, job_timeout='1h')
        return jsonify({'message': f'Téléchargement du modèle {model} lancé', 'job_id': job.id}), 202
    except Exception as e:
        logger.error(f"Erreur pull model: {e}")
        return jsonify({'error': 'Erreur lors du lancement du téléchargement'}), 500

# --- Statut des files ---
@api_bp.route('/queues/info', methods=['GET'])
def get_queues_information():
    try:
        queues_info = []
        queue_map = {
            'processing': processing_queue,
            'synthesis': synthesis_queue,
            'analysis': analysis_queue,
            'background': background_queue
        }

        # Récupérer tous les workers et compter par file
        all_workers = Worker.all(connection=redis_conn)
        queues_workers_count = {name: 0 for name in queue_map.keys()}
        for w in all_workers:
            # w.queue_names() retourne les noms des files écoutées par le worker
            try:
                names = [q.decode() if isinstance(q, bytes) else q for q in w.queue_names()]
            except Exception:
                names = []
            for name in queue_map.keys():
                # Le nom réel de la file dans RQ = queue.name (ex: 'analylit_processing_v4')
                if queue_map[name].name in names:
                    queues_workers_count[name] += 1

        for name, queue in queue_map.items():
            queues_info.append({
                'name': name,
                'size': len(queue),
                'workers': queues_workers_count.get(name, 0)
            })
        return jsonify(queues_info)
    except Exception as e:
        logger.error(f"Erreur queues info: {e}")
        return jsonify([]), 500
        
@api_bp.route('/queues/<queue_name>/clear', methods=['POST'])
def clear_specific_queue(queue_name):
    try:
        queue_map = {
            'processing': processing_queue,
            'synthesis': synthesis_queue,
            'analysis': analysis_queue,
            'background': background_queue
        }
        if queue_name not in queue_map:
            return jsonify({'error': 'File inconnue'}), 404
        queue_map[queue_name].empty()
        return jsonify({'message': f'File {queue_name} vidée'})
    except Exception as e:
        logger.error(f"Erreur clear queue: {e}")
        return jsonify({'error': 'Erreur lors du vidage'}), 500

# --- Export projet ---
@api_bp.route('/projects/<project_id>/export', methods=['GET'])
def export_project(project_id):
    session = Session()
    try:
        proj = session.execute(text("SELECT * FROM projects WHERE id = :pid"),
                               {"pid": project_id}).mappings().fetchone()
        if not proj:
            return jsonify({'error': 'Projet introuvable'}), 404

        results = session.execute(text("SELECT * FROM search_results WHERE project_id = :pid"),
                                  {"pid": project_id}).mappings().all()
        extractions = session.execute(text("SELECT * FROM extractions WHERE project_id = :pid"),
                                      {"pid": project_id}).mappings().all()
        logs = session.execute(text("SELECT * FROM processing_log WHERE project_id = :pid ORDER BY timestamp DESC"),
                               {"pid": project_id}).mappings().all()
        grids = session.execute(text("SELECT * FROM extraction_grids WHERE project_id = :pid"),
                                {"pid": project_id}).mappings().all()
        chats = session.execute(text("SELECT * FROM chat_messages WHERE project_id = :pid ORDER BY timestamp"),
                                {"pid": project_id}).mappings().all()

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('project.json', json.dumps(dict(proj), ensure_ascii=False, indent=2))
            zf.writestr('search_results.json', json.dumps([dict(r) for r in results], ensure_ascii=False, indent=2))
            zf.writestr('extractions.json', json.dumps([dict(e) for e in extractions], ensure_ascii=False, indent=2))
            zf.writestr('processing_log.json', json.dumps([dict(l) for l in logs], ensure_ascii=False, indent=2))
            zf.writestr('extraction_grids.json', json.dumps([dict(g) for g in grids], ensure_ascii=False, indent=2))
            zf.writestr('chat_messages.json', json.dumps([dict(c) for c in chats], ensure_ascii=False, indent=2))

            project_dir = PROJECTS_DIR / project_id
            if project_dir.exists():
                for pdf_file in project_dir.glob("*.pdf"):
                    zf.write(pdf_file, f"pdfs/{pdf_file.name}")

        buf.seek(0)
        return Response(
            mimetype='application/zip',
            headers={'Content-Disposition': f'attachment; filename=export_complet_{project_name_safe}.zip'}
        )
    except Exception as e:
        logger.error(f"Erreur export projet: {e}")
        return jsonify({'error': 'Erreur lors de l\'export'}), 500
    finally:
        session.close()

# Route pour les statistiques de validation (récupérée de la v4.0 et adaptée)
@api_bp.route('/projects/<project_id>/validation-stats', methods=['GET'])
def get_validation_stats(project_id):
    """Calcule les statistiques de validation pour un projet."""
    session = Session()
    try:
        # Récupérer toutes les extractions avec une décision utilisateur
        extractions = session.execute(text("""
            SELECT relevance_score, validations
            FROM extractions
            WHERE project_id = :pid AND validations IS NOT NULL AND validations != '{}'
        """), {"pid": project_id}).mappings().all()

        if not extractions:
            return jsonify({"error": "Aucune validation utilisateur trouvée."}), 404

        # Calculer les métriques de performance en se basant sur l'évaluateur 1
        total = len(extractions)
        ia_includes = sum(1 for e in extractions if e['relevance_score'] >= 7)
        
        user_includes = 0
        tp = 0
        tn = 0
        fp = 0
        fn = 0
        
        for e in extractions:
            try:
                validation_data = json.loads(e['validations'])
                user_decision = validation_data.get('evaluator1')
                
                if user_decision == 'include':
                    user_includes += 1
                
                # Matrice de confusion
                if e['relevance_score'] >= 7 and user_decision == 'include':
                    tp += 1
                elif e['relevance_score'] < 7 and user_decision == 'exclude':
                    tn += 1
                elif e['relevance_score'] >= 7 and user_decision == 'exclude':
                    fp += 1
                elif e['relevance_score'] < 7 and user_decision == 'include':
                    fn += 1
            except (json.JSONDecodeError, TypeError):
                continue

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
    except Exception as e:
        logger.error(f"Erreur get_validation_stats: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()

@api_bp.route('/projects/<project_id>/stakeholders', methods=['GET', 'POST'])
def handle_stakeholders(project_id):
    session = Session()
    try:
        if request.method == 'GET':
            rows = session.execute(text("""
                SELECT * FROM stakeholder_groups 
                WHERE project_id = :pid 
                ORDER BY created_at ASC
            """), {"pid": project_id}).mappings().all()
            
            stakeholders = [dict(r) for r in rows]
            
            # Si aucun groupe défini, retourner les groupes par défaut
            if not stakeholders:
                default_groups = [
                    {"id": "patients", "name": "Patients/Soignés", "color": "#4CAF50", "description": "Utilisateurs finaux des solutions numériques"},
                    {"id": "healthcare", "name": "Professionnels de santé", "color": "#2196F3", "description": "Médecins, infirmiers, autres soignants"},
                    {"id": "developers", "name": "Développeurs/Tech", "color": "#FF9800", "description": "Concepteurs et développeurs de solutions"},
                    {"id": "regulators", "name": "Régulateurs/Décideurs", "color": "#9C27B0", "description": "Autorités, décideurs politiques"},
                    {"id": "payers", "name": "Payeurs/Assurances", "color": "#F44336", "description": "Organismes de financement"}
                ]
                return jsonify(default_groups)
            
            return jsonify(stakeholders)
            
        if request.method == 'POST':
            data = request.get_json(force=True)
            stakeholder = {
                "id": str(uuid.uuid4()),
                "project_id": project_id,
                "name": data['name'],
                "color": data.get('color', '#4CAF50'),
                "description": data.get('description', ''),
                "created_at": datetime.now().isoformat()
            }
            
            session.execute(text("""
                INSERT INTO stakeholder_groups (id, project_id, name, color, description, created_at)
                VALUES (:id, :project_id, :name, :color, :description, :created_at)
            """), stakeholder)
            session.commit()
            
            return jsonify(stakeholder), 201
            
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur handle_stakeholders: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne'}), 500
    finally:
        session.close()

# ================================================================
# 3) WebSocket Events
# ================================================================
@socketio.on('connect')
def handle_connect(auth):
    logger.info(f"Client connecté: {request.sid}")

@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client déconnecté: {request.sid}")

@socketio.on('join_room')
def handle_join_room(data):
    room = data.get('room')
    if room:
        from flask_socketio import join_room, emit
        join_room(room)
        emit('room_joined', {'project_id': room})
        logger.info(f"Client {request.sid} a rejoint la room {room}")

@api_bp.route('/projects/<project_id>/articles', methods=['DELETE'])
def delete_project_articles(project_id):
    """Supprime une liste d'articles d'un projet."""
    data = request.get_json(force=True)
    article_ids = data.get('article_ids', [])
    if not article_ids:
        return jsonify({'error': 'Aucun ID d\'article fourni'}), 400

    session = Session()
    try:
        session.execute(text("DELETE FROM extractions WHERE project_id = :pid AND pmid = ANY(:aids)"), 
                        {"pid": project_id, "aids": article_ids})
        session.execute(text("DELETE FROM search_results WHERE project_id = :pid AND article_id = ANY(:aids)"), 
                        {"pid": project_id, "aids": article_ids})
        
        total_articles = session.execute(text("SELECT COUNT(*) FROM search_results WHERE project_id = :pid"), 
                                        {"pid": project_id}).scalar_one()
        session.execute(text("UPDATE projects SET pmids_count = :count WHERE id = :pid"), 
                        {"count": total_articles, "pid": project_id})

        session.commit()
        send_project_notification(project_id, 'articles_updated', f'{len(article_ids)} article(s) ont été supprimés.')
        return jsonify({'message': f'{len(article_ids)} article(s) supprimé(s) avec succès'}), 200
    except Exception as e:
        session.rollback()
        logger.error(f"Erreur delete_project_articles: {e}", exc_info=True)
        return jsonify({'error': 'Erreur interne du serveur'}), 500
    finally:
        session.close()
        
@api_bp.route('/projects/<project_id>/run-rob-analysis', methods=['POST'])
def run_rob_analysis(project_id):
    """Lance l'analyse du risque de biais pour les articles sélectionnés."""
    data = request.get_json(force=True)
    article_ids = data.get('article_ids', [])
    if not article_ids:
        return jsonify({'error': 'Aucun article sélectionné'}), 400

    for article_id in article_ids:
        # On met la tâche dans la file d'analyse
        analysis_queue.enqueue(run_risk_of_bias_task, project_id=project_id, article_id=article_id, job_timeout='20m')
    
    return jsonify({
        "message": f"Analyse du risque de biais lancée pour {len(article_ids)} article(s)."
    }), 202
            
# ================================================================
# 4) Enregistrement du blueprint et route front
# ================================================================
app.register_blueprint(api_bp)

@app.route('/')
def serve_frontend():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    init_db()
    socketio.run(app, host='0.0.0.0', port=5001, debug=True)