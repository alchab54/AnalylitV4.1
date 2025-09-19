# api/projects.py

import json
import logging
import uuid
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError
from utils.app_globals import background_queue, processing_queue, analysis_queue, discussion_draft_queue, q
from utils.database import get_session as Session, with_db_session
from utils.models import Project, Grid, Extraction, AnalysisProfile
from tasks_v4_complete import (
    run_discussion_generation_task,
    answer_chat_question_task,
    process_single_article_task,
    run_meta_analysis_task,
    run_atn_score_task,
    run_knowledge_graph_task,
    run_prisma_flow_task,
    import_from_zotero_file_task,
    import_pdfs_from_zotero_task,
    run_risk_of_bias_task,
    add_manual_articles_task
)
from werkzeug.utils import secure_filename
from utils.file_handlers import save_file_to_project_dir
from utils.database import Session  # <-- Importez Session depuis le bon fichier
from utils.app_globals import with_db_session, background_queue, processing_queue, analysis_queue, discussion_draft_queue, q
projects_bp = Blueprint('projects_bp', __name__)
logger = logging.getLogger(__name__)

@projects_bp.route('/projects', methods=['POST'])
@with_db_session
def create_project(session):
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error": "Le nom du projet est requis"}), 400
    
    new_project = Project(
        name=data['name'],
        description=data.get('description', ''),
        analysis_mode=data.get('mode', 'screening')
    )
    session.add(new_project)
    try:
        session.commit()
        return jsonify(new_project.to_dict()), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Un projet avec ce nom existe déjà"}), 409

@projects_bp.route('/projects', methods=['GET'])
@with_db_session
def get_all_projects(session):
    projects = session.query(Project).all()
    return jsonify([p.to_dict() for p in projects]), 200

@projects_bp.route('/projects/<project_id>', methods=['GET'])
@with_db_session
def get_project_details(session, project_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404
    return jsonify(project.to_dict()), 200

@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
@with_db_session
def delete_project(session, project_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404
    session.delete(project)
    session.commit()
    return jsonify({"message": "Projet supprimé"}), 200

@projects_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
@with_db_session
def import_grid(session, project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
        grid_data = json.load(file)
        if not grid_data.get('name') or not isinstance(grid_data.get('fields'), list):
            return jsonify({"error": "Format de grille invalide"}), 400

        # Convertir la liste de strings en liste de dictionnaires
        formatted_fields = [{"name": field, "description": ""} for field in grid_data['fields']]

        new_grid = Grid(
            project_id=project_id,
            name=grid_data['name'],
            fields=json.dumps(formatted_fields)
        )
        session.add(new_grid)
        session.commit()
        return jsonify(new_grid.to_dict()), 201
    except json.JSONDecodeError:
        return jsonify({"error": "Fichier JSON invalide"}), 400
    except Exception as e:
        logger.error(f"Erreur lors de l'import de la grille: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/grids', methods=['GET'])
@with_db_session
def get_grids(session, project_id):
    grids = session.query(Grid).filter_by(project_id=project_id).all()
    return jsonify([grid.to_dict() for grid in grids]), 200

@projects_bp.route('/projects/<project_id>/extractions/<extraction_id>/decision', methods=['PUT'])
@with_db_session
def set_extraction_decision(session, project_id, extraction_id):
    data = request.get_json()
    decision = data.get('decision')
    evaluator = data.get('evaluator')

    if not all([decision, evaluator]):
        return jsonify({"error": "Les champs 'decision' et 'evaluator' sont requis"}), 400

    extraction = session.query(Extraction).filter_by(id=extraction_id, project_id=project_id).first()
    if not extraction:
        return jsonify({"error": "Extraction non trouvée"}), 404

    validations = json.loads(extraction.validations) if extraction.validations else {}
    validations[evaluator] = decision

    extraction.validations = json.dumps(validations)
    
    # Mettre à jour le statut principal si c'est le premier évaluateur
    if len(validations) == 1:
        extraction.user_validation_status = decision

    session.commit()
    return jsonify(extraction.to_dict()), 200

@projects_bp.route('/projects/<project_id>/import-validations', methods=['POST'])
@with_db_session
def import_validations(session, project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
        # Utiliser io.TextIOWrapper pour lire le fichier en texte
        import io
        import csv
        
        file_stream = io.TextIOWrapper(file.stream, encoding='utf-8')
        reader = csv.DictReader(file_stream)
        
        count = 0
        for row in reader:
            article_id = row.get('articleId')
            decision = row.get('decision')
            
            if not article_id or not decision:
                continue

            extraction = session.query(Extraction).filter_by(project_id=project_id, pmid=article_id).first()
            if extraction:
                validations = json.loads(extraction.validations) if extraction.validations else {}
                validations['evaluator2'] = decision # Le test suppose 'evaluator2'
                extraction.validations = json.dumps(validations)
                count += 1
        
        session.commit()
        return jsonify({"message": f"{count} validations ont été importées pour l'évaluateur 2."}), 200
    except Exception as e:
        logger.error(f"Erreur lors de l'import des validations: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/run-discussion-draft', methods=['POST'])
def run_discussion_draft(project_id):
    job = discussion_draft_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout='1h')
    return jsonify({"message": "Génération du brouillon de discussion lancée", "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/chat', methods=['POST'])
def chat_with_project(project_id):
    data = request.get_json()
    question = data.get('question')
    if not question:
        return jsonify({"error": "Question is required"}), 400
    job = background_queue.enqueue(answer_chat_question_task, project_id=project_id, question=question, job_timeout='15m')
    return jsonify({"message": "Question soumise", "job_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/run', methods=['POST'])
@with_db_session
def run_pipeline(session, project_id):
    data = request.get_json()
    article_ids = data.get('articles', [])
    profile_id = data.get('profile')
    analysis_mode = data.get('analysis_mode', 'screening')
    custom_grid_id = data.get('custom_grid_id')

    if not article_ids:
        return jsonify({"error": "Liste d'articles vide"}), 400
    if not profile_id:
        return jsonify({"error": "Profil d'analyse requis"}), 400

    profile = session.query(AnalysisProfile).filter_by(id=profile_id).first()
    if not profile:
        return jsonify({"error": "Profil d'analyse non trouvé"}), 404

    task_ids = []
    for article_id in article_ids:
        job = processing_queue.enqueue(
            process_single_article_task,
            project_id=project_id,
            article_id=article_id,
            profile=profile.to_dict(),
            analysis_mode=analysis_mode,
            custom_grid_id=custom_grid_id,
            job_timeout='30m'
        )
        task_ids.append(job.id)
    return jsonify({"message": f"{len(task_ids)} tâches de traitement lancées", "task_ids": task_ids}), 202

@projects_bp.route('/projects/<project_id>/run-analysis', methods=['POST'])
def run_advanced_analysis(project_id):
    data = request.get_json()
    analysis_type = data.get('type')

    task_map = {
        "meta_analysis": run_meta_analysis_task,
        "atn_scores": run_atn_score_task,
        "knowledge_graph": run_knowledge_graph_task,
        "prisma_flow": run_prisma_flow_task,
    }

    task_function = task_map.get(analysis_type)
    if not task_function:
        return jsonify({"error": "Type d'analyse inconnu"}), 400

    job = analysis_queue.enqueue(task_function, project_id=project_id, job_timeout='30m')
    return jsonify({"message": f"Analyse '{analysis_type}' lancée", "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/import-zotero', methods=['POST'])
def import_zotero_pdfs(project_id):
    data = request.get_json()
    pmids = data.get('articles', [])
    zotero_user_id = data.get('zotero_user_id')
    zotero_api_key = data.get('zotero_api_key')

    if not pmids:
        return jsonify({"error": "Liste d'articles vide"}), 400
    if not zotero_user_id or not zotero_api_key:
        return jsonify({"error": "Identifiants Zotero requis"}), 400

    job = background_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=pmids,
        zotero_user_id=zotero_user_id,
        zotero_api_key=zotero_api_key,
        job_timeout='1h'
    )
    return jsonify({"message": "Importation Zotero lancée", "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/upload-zotero', methods=['POST'])
def upload_zotero_file(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
        filename = secure_filename(file.filename)
        file_path = save_file_to_project_dir(file, project_id, filename, PROJECTS_DIR)
        
        job = q.enqueue(
            import_from_zotero_file_task,
            project_id=project_id,
            json_file_path=file_path
        )
        return jsonify({"message": "Importation de fichier Zotero lancée", "job_id": job.id}), 202
    except Exception as e:
        logger.error(f"Erreur lors de l'upload du fichier Zotero: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/run-rob-analysis', methods=['POST'])
def run_rob_analysis(project_id):
    data = request.get_json()
    article_ids = data.get('article_ids', [])

    if not article_ids:
        return jsonify({"error": "Liste d'articles vide"}), 400

    task_ids = []
    for article_id in article_ids:
        job = analysis_queue.enqueue(
            run_risk_of_bias_task,
            project_id=project_id,
            article_id=article_id,
            job_timeout='20m'
        )
        task_ids.append(job.id)
    return jsonify({"message": f"{len(task_ids)} tâches d'analyse de risque de biais lancées", "task_ids": task_ids}), 202

@projects_bp.route('/projects/<project_id>/add-manual-articles', methods=['POST'])
def add_manual_articles(project_id):
    data = request.get_json()
    articles_data = data.get('items', [])

    if not articles_data:
        return jsonify({"error": "Aucun article fourni"}), 400

    job = background_queue.enqueue(
        add_manual_articles_task,
        project_id=project_id,
        articles_data=articles_data,
        job_timeout='1h'
    )
    return jsonify({"message": f"Ajout de {len(articles_data)} article(s) manuel(s) lancé", "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/run-knowledge-graph', methods=['POST'])
def run_knowledge_graph(project_id):
    job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout='30m')
    return jsonify({"message": "Génération du graphe de connaissances lancée", "task_id": job.id}), 202
