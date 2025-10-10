# api/projects.py

import json
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

import logging
from utils.app_globals import (
    background_queue, processing_queue, analysis_queue, discussion_draft_queue, synthesis_queue,
    extension_queue
)
from datetime import datetime
from utils.extensions import db  # ← AJOUT
from utils.app_globals import import_queue
from utils.extensions import db
from utils.models import Project, Grid, Extraction, AnalysisProfile, RiskOfBias, Analysis, SearchResult, ChatMessage
from utils.file_handlers import save_file_to_project_dir
from backend.tasks_v4_complete import (

    run_synthesis_task,
    run_discussion_generation_task,
    answer_chat_question_task,
    process_single_article_task,
    import_from_zotero_rdf_task,
    run_meta_analysis_task,
    run_atn_score_task,
    run_knowledge_graph_task,
    run_prisma_flow_task,
    import_from_zotero_file_task,
    import_pdfs_from_zotero_task,
    run_atn_specialized_extraction_task,
    run_empathy_comparative_analysis_task,
    import_from_zotero_json_task,
    run_risk_of_bias_task,
    add_manual_articles_task,
    run_descriptive_stats_task,
    run_atn_stakeholder_analysis_task,
    run_extension_task,
)
from utils.helpers import format_bibliography
from utils.decorators import require_api_key
from werkzeug.utils import secure_filename
from sqlalchemy import select

projects_bp = Blueprint('projects_bp', __name__)
from sqlalchemy import text
logger = logging.getLogger(__name__)

# ✅ **CORRECTION MAJEURE : Aligner toutes les routes sur la convention `/projects`**

@projects_bp.route('/projects', methods=['GET', 'POST'])
def handle_projects():
    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({"error": "Project name is required"}), 400
        
        new_project = Project(
            name=data['name'],
            description=data.get('description', ''),
            analysis_mode=data.get('mode', 'screening')
        )
        db.session.add(new_project)
        try:
            db.session.commit()
            return jsonify(new_project.to_dict()), 201
        except IntegrityError:
            db.session.rollback()
            return jsonify({"error": "A project with this name already exists"}), 409
    else: # GET
        stmt = select(Project).order_by(Project.created_at.desc())
        projects = db.session.execute(stmt).scalars().all()
        return jsonify([p.to_dict() for p in projects]), 200

@projects_bp.route('/projects/<project_id>', methods=['GET', 'DELETE'])
def handle_project(project_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404
    
    if request.method == 'GET':
        return jsonify(project.to_dict()), 200
    elif request.method == 'DELETE':
        db.session.delete(project)
        db.session.commit()
        return '', 204

@projects_bp.route('/projects/<project_id>/add-manual-articles', methods=['POST'])
def add_manual_articles_endpoint(project_id):
    from utils.app_globals import import_queue
    payload = request.get_json()
    items_to_add = payload.get('items', [])
    use_full_data_flag = payload.get('use_full_data', False)
    if items_to_add:
        task = background_queue.enqueue(
            'backend.tasks_v4_complete.add_manual_articles_task',
            args=(project_id, items_to_add, use_full_data_flag),
            job_timeout=600
        )
        return jsonify({"task_id": task.id}), 202
    return jsonify({"error": "No items provided"}), 400

@projects_bp.route('/projects/<project_id>/search-results', methods=['GET'])
def get_project_search_results(project_id):
    """Retourne les résultats de recherche paginés pour un projet."""
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    sort_by = request.args.get('sort_by', 'created_at')
    sort_order = request.args.get('sort_order', 'desc')
    
    stmt = select(SearchResult).filter_by(project_id=project_id)
    if hasattr(SearchResult, sort_by):
        order_column = getattr(SearchResult, sort_by)
        if sort_order == 'asc':
            stmt = stmt.order_by(order_column.asc())
        else:
            stmt = stmt.order_by(order_column.desc())

    total_stmt = select(db.func.count()).select_from(stmt.subquery())
    total = db.session.execute(total_stmt).scalar_one()
    offset = (page - 1) * per_page
    paginated_stmt = stmt.offset(offset).limit(per_page)
    items = db.session.execute(paginated_stmt).scalars().all()
    total_pages = (total + per_page - 1) // per_page if per_page > 0 else 0

    return jsonify({
        'results': [item.to_dict() for item in items],
        'total': total,
        'page': page,
        'per_page': per_page,
        'total_pages': total_pages,
    })

@projects_bp.route('/projects/<project_id>/extractions', methods=['GET'])
def get_project_extractions(project_id):
    """Retourne toutes les extractions pour un projet."""
    extractions = db.session.scalars(select(Extraction).filter_by(project_id=project_id)).all()
    return jsonify([e.to_dict() for e in extractions]), 200

@projects_bp.route('/projects/<project_id>/analyses', methods=['GET'])
def get_project_analyses(project_id):
    """Retourne les résultats de toutes les analyses terminées pour un projet."""
    analyses = db.session.scalars(select(Analysis).filter_by(project_id=project_id)).all()
    return jsonify([analysis.to_dict() for analysis in analyses]), 200

@projects_bp.route('/projects/<project_id>/chat-history', methods=['GET'])
def get_chat_history(project_id):
    """Retourne l'historique du chat pour un projet, trié par date."""
    messages = db.session.scalars(
        select(ChatMessage).filter_by(project_id=project_id).order_by(ChatMessage.timestamp.asc())
    ).all()
    return jsonify([msg.to_dict() for msg in messages])

@projects_bp.route('/projects/<project_id>/grids/import', methods=['POST'])
def import_grid(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
        grid_data = json.load(file)
        if not grid_data.get('name') or not isinstance(grid_data.get('fields'), list):
            return jsonify({"error": "Format de grille invalide"}), 400

        formatted_fields = [{"name": field, "description": ""} for field in grid_data['fields']]

        new_grid = Grid(
            project_id=project_id,
            name=grid_data['name'],
            fields=json.dumps(formatted_fields)
        )
        db.session.add(new_grid)
        db.session.commit()
        return jsonify(new_grid.to_dict()), 201
    except json.JSONDecodeError:
        return jsonify({"error": "Fichier JSON invalide"}), 400
    except Exception as e:
        logger.error(f"Erreur lors de l'import de la grille: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/grids', methods=['GET', 'POST'])
def handle_grids(project_id):
    if request.method == 'GET':
        grids = db.session.scalars(select(Grid).filter_by(project_id=project_id)).all()
        return jsonify([grid.to_dict() for grid in grids]), 200
    elif request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name') or not isinstance(data.get('fields'), list):
            return jsonify({"error": "Format de grille invalide"}), 400

        new_grid = Grid(
            project_id=project_id,
            name=data['name'],
            fields=json.dumps(data['fields'])
        )
        db.session.add(new_grid)
        db.session.commit()
        return jsonify(new_grid.to_dict()), 201

@projects_bp.route('/projects/<project_id>/grids/<grid_id>', methods=['PUT'])
def update_grid(project_id, grid_id):
    grid = db.session.get(Grid, grid_id)
    if not grid:
        return jsonify({"error": "Grille non trouvée"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie"}), 400

    grid.name = data.get('name', grid.name)
    if 'fields' in data and isinstance(data['fields'], list):
        grid.fields = json.dumps(data['fields'])
    
    db.session.commit()
    return jsonify(grid.to_dict()), 200

@projects_bp.route('/projects/<project_id>/extractions/<extraction_id>/decision', methods=['PUT'])
def set_extraction_decision(project_id, extraction_id):
    data = request.get_json()
    decision = data.get('decision')
    evaluator = data.get('evaluator')

    if not all([decision, evaluator]):
        return jsonify({"error": "Les champs 'decision' et 'evaluator' sont requis"}), 400

    extraction = db.session.get(Extraction, extraction_id)
    if not extraction:
        return jsonify({"error": "Extraction non trouvée"}), 404

    validations = json.loads(extraction.validations) if extraction.validations else {}
    validations[evaluator] = decision

    extraction.validations = json.dumps(validations)
    
    if len(validations) == 1:
        extraction.user_validation_status = decision

    db.session.commit()
    return jsonify(extraction.to_dict()), 200

@projects_bp.route('/projects/<project_id>/import-validations', methods=['POST'])
def import_validations(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Aucun fichier fourni"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
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

            extraction = db.session.scalar(select(Extraction).filter_by(project_id=project_id, pmid=article_id))
            if extraction:
                validations = json.loads(extraction.validations) if extraction.validations else {}
                validations['evaluator2'] = decision
                extraction.validations = json.dumps(validations)
                count += 1
        
        db.session.commit()
        return jsonify({"message": f"{count} validations ont été importées pour l'évaluateur evaluator2."}), 200
    except Exception as e:
        logger.error(f"Erreur lors de l'import des validations: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/run-discussion-draft', methods=['POST'])
def run_discussion_draft(project_id):
    job = discussion_draft_queue.enqueue(run_discussion_generation_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du brouillon de discussion lancée", "job_id": job.id}), 202 #✅ CORRECTION : La clé task_id est ici

@projects_bp.route('/projects/<project_id>/chat', methods=['POST'])
def chat_with_project(project_id):
    data = request.get_json()
    question = data.get('question')    
    if not question:
        return jsonify({"error": "Question is required"}), 400
    job = background_queue.enqueue(answer_chat_question_task, project_id=project_id, question=question, job_timeout=900)
    return jsonify({"message": "Question soumise", "job_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/run', methods=['POST'])
def run_pipeline(project_id):
    data = request.get_json()    
    article_ids = data.get('articles', [])
    profile_id = data.get('profile')
    analysis_mode = data.get('analysis_mode', 'screening')
    custom_grid_id = data.get('custom_grid_id')

    if not article_ids:
        return jsonify({"error": "Liste d'articles vide"}), 400
    if not profile_id:
        return jsonify({"error": "Profil d'analyse requis"}), 400

    profile = db.session.get(AnalysisProfile, profile_id)
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
            job_timeout=1800
        )
        task_ids.append(job.id)
    return jsonify({"message": f"{len(task_ids)} tâches de traitement lancées", "job_ids": [str(tid) for tid in task_ids]}), 202

@projects_bp.route('/projects/<project_id>/run-analysis', methods=['POST'])
def run_analysis(project_id):
    """Lance une analyse avancée (méta-analyse, graphe, etc.)."""
    data = request.get_json()
    analysis_type = data.get('type')

    # ✅ CORRECTION : Définir analysis_tasks APRÈS que toutes les fonctions soient disponibles
    analysis_tasks = {
        "synthesis": (run_synthesis_task, synthesis_queue, 1800),
        "discussion": (run_discussion_generation_task, discussion_draft_queue, 1800),
        "knowledge_graph": (run_knowledge_graph_task, analysis_queue, 1800),
        "prisma_flow": (run_prisma_flow_task, analysis_queue, 1800),
        "meta_analysis": (run_meta_analysis_task, analysis_queue, 1800),
        "descriptive_stats": (run_descriptive_stats_task, analysis_queue, 1800),
        "atn_scores": (run_atn_score_task, analysis_queue, 1800),
        "atn_stakeholder": (run_atn_stakeholder_analysis_task, analysis_queue, 1800),
        "atn_specialized_extraction": (run_atn_specialized_extraction_task, extension_queue, 1800),
        "empathy_comparative_analysis": (run_empathy_comparative_analysis_task, extension_queue, 1800)
    }

    if analysis_type in analysis_tasks:
        task_func, queue, timeout = analysis_tasks[analysis_type]
        
        kwargs = {'project_id': project_id, 'job_timeout': timeout}
        if analysis_type == 'synthesis':
            project = db.session.get(Project, project_id)            
            if not project:
                return jsonify({"error": "Projet non trouvé"}), 404
            
            profile_id = project.profile_used or 'standard'
            profile = db.session.get(AnalysisProfile, profile_id)
            if not profile:
                logger.warning(f"Profil d'analyse '{profile_id}' non trouvé pour la synthèse. Utilisation des valeurs par défaut.")
                kwargs['profile'] = {}
            else:
                kwargs['profile'] = profile.to_dict()

        job = queue.enqueue(task_func, **kwargs)
        return jsonify({"message": f"Analyse '{analysis_type}' lancée", "job_id": str(job.id)}), 202
    else:
        return jsonify({"error": f"Type d'analyse inconnu: {analysis_type}"}), 400

@projects_bp.route('/projects/<project_id>/import-zotero-pdfs', methods=['POST'])
def import_zotero_pdfs(project_id):
    data = request.get_json()
    pmids = data.get('articles', [])
    zotero_user_id = data.get('zotero_user_id')
    zotero_api_key = data.get('zotero_api_key')

    if not pmids:
        return jsonify({"error": "Liste d'articles vide"}), 400
    if not zotero_user_id or not zotero_api_key:
        return jsonify({"error": "Identifiants Zotero requis"}), 400

    job = import_queue.enqueue(
        import_pdfs_from_zotero_task,
        project_id=project_id,
        pmids=pmids,
        zotero_user_id=zotero_user_id,
        zotero_api_key=zotero_api_key,
        job_timeout=3600
    )
    return jsonify({"message": "Importation Zotero lancée", "job_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/import-zotero-rdf', methods=['POST'])
def import_zotero_rdf_endpoint(project_id):
    """
    Lance l'importation à partir d'un fichier RDF et de son stockage Zotero.
    C'est la nouvelle méthode privilégiée par atn_workflow_GLORY.py.
    """
    data = request.get_json()
    if not data:
        return jsonify({"error": "Données JSON invalides"}), 400

    rdf_file_path = data.get('rdf_file_path')
    zotero_storage_path = data.get('zotero_storage_path')

    if not rdf_file_path or not zotero_storage_path:
        return jsonify({"error": "Les chemins 'rdf_file_path' et 'zotero_storage_path' sont requis."}), 400
    
    # Validation du projet
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    # Lancer la tâche de fond avec la nouvelle fonction
    job = background_queue.enqueue(
        import_from_zotero_rdf_task,
        args=(project_id, rdf_file_path, zotero_storage_path),
        job_timeout=3600  # 1 heure
    )

    log_message = f"Tâche d'import RDF lancée pour le projet {project_id}."
    logger.info(log_message)
    

    return jsonify({"message": log_message, "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/upload-zotero', methods=['POST'])
def upload_zotero_file(project_id):
    if 'file' not in request.files:
        return jsonify({"error": "Données JSON invalides"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    try:
        from utils.app_globals import PROJECTS_DIR
        
        filename = secure_filename(file.filename)
        file_path = save_file_to_project_dir(file, project_id, filename, PROJECTS_DIR)
        
        job = import_queue.enqueue(
            import_from_zotero_file_task,
            project_id=project_id,
            json_file_path=file_path,
            job_timeout=3600
        )
        return jsonify({"message": "Importation de fichier Zotero lancée", "job_id": job.id}), 202
    except Exception as e:
        logger.error(f"Erreur lors de l'upload du fichier Zotero: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500
    
@projects_bp.route('/projects/<project_id>/run-rob-analysis', methods=['POST'])
def run_rob_analysis(project_id): # ✅ Injection
    data = request.get_json()
    article_ids = data.get('article_ids', [])

    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    if not article_ids:
        return jsonify({"error": "Liste d'articles vide"}), 400

    task_ids = []
    for article_id in article_ids:
        job = analysis_queue.enqueue(
            run_risk_of_bias_task,
            project_id=project_id,
            article_id=article_id,
            job_timeout=1200
        )
        task_ids.append(job.id)
    return jsonify({"message": f"{len(task_ids)} tâches d'analyse de risque de biais lancées", "job_ids": task_ids}), 202

@projects_bp.route('/projects/<project_id>/rob/<article_id>', methods=['POST'])
def save_rob_assessment(project_id, article_id):
    data = request.get_json()
    assessment_data = data.get('rob_assessment')

    if not assessment_data:
        return jsonify({"error": "Données d'évaluation manquantes"}), 400

    rob_assessment = db.session.scalar(select(RiskOfBias).filter_by(project_id=project_id, article_id=article_id))

    if rob_assessment:
        rob_assessment.domain_1_bias = assessment_data.get('random_sequence_generation', rob_assessment.domain_1_bias)
        rob_assessment.domain_1_justification = assessment_data.get('random_sequence_generation_notes', rob_assessment.domain_1_justification)
        rob_assessment.domain_2_bias = assessment_data.get('allocation_concealment', rob_assessment.domain_2_bias)
        rob_assessment.domain_2_justification = assessment_data.get('allocation_concealment_notes', rob_assessment.domain_2_justification)
        logger.info(f"Mise à jour de l'évaluation RoB pour l'article {article_id}")
        status_code = 200
    else:
        rob_assessment = RiskOfBias(
            project_id=project_id,
            article_id=article_id,
            pmid=article_id,
            domain_1_bias=assessment_data.get('random_sequence_generation'),
            domain_1_justification=assessment_data.get('random_sequence_generation_notes'),
            domain_2_bias=assessment_data.get('allocation_concealment'),
            domain_2_justification=assessment_data.get('allocation_concealment_notes')
        )
        db.session.add(rob_assessment)
        logger.info(f"Création de l'évaluation RoB pour l'article {article_id}")
        status_code = 201

    db.session.commit()
    response_data = rob_assessment.to_dict()
    response_data['project_id'] = rob_assessment.project_id
    response_data['article_id'] = rob_assessment.article_id
    response_data['random_sequence_generation'] = rob_assessment.domain_1_bias
    response_data['allocation_concealment_notes'] = rob_assessment.domain_2_justification
    return jsonify(response_data), status_code

@projects_bp.route('/projects/<project_id>/calculate-kappa', methods=['POST'])
def calculate_kappa(project_id):
    """Lance la tâche de calcul du Kappa de Cohen."""
    #✅ CORRECTION : La clé task_id est ici
    from backend.tasks_v4_complete import calculate_kappa_task
    job = analysis_queue.enqueue(calculate_kappa_task, project_id=project_id, job_timeout='5m')
    return jsonify({"message": "Calcul du Kappa de Cohen lancé.", "job_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/run-knowledge-graph', methods=['POST'])
def run_knowledge_graph(project_id):
    job = analysis_queue.enqueue(run_knowledge_graph_task, project_id=project_id, job_timeout=1800)
    return jsonify({"message": "Génération du graphe de connaissances lancée", "task_id": job.id}), 202

@projects_bp.route('/projects/<project_id>/prisma-checklist', methods=['GET', 'POST'])
def handle_prisma_checklist(project_id):
    if request.method == 'GET':
        from utils.prisma_scr import get_base_prisma_checklist
        project = db.session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404
        
        if project.prisma_checklist:
            return jsonify(json.loads(project.prisma_checklist))
        return jsonify(get_base_prisma_checklist())
    elif request.method == 'POST':
        project = db.session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404
        
        data = request.get_json()
        project.prisma_checklist = json.dumps(data.get('checklist'))
        db.session.commit()
        return jsonify({"message": "Checklist PRISMA sauvegardée"}), 200

@projects_bp.route('/projects/<project_id>/export/thesis', methods=['GET'])
def export_thesis(project_id):
    """Export de thèse."""
    import pandas as pd
    import zipfile
    import io
    from sqlalchemy import text
    import logging
    from utils.app_globals import background_queue
    from utils.extensions import db
    from datetime import datetime
    from flask import send_file
    
    try:
        search_results = db.session.scalars(select(SearchResult).filter_by(project_id=project_id)).all()
        
        included_article_ids = db.session.scalars(select(Extraction.pmid).filter_by(project_id=project_id, user_validation_status='include')).all()
        
        if included_article_ids:
            articles_to_export = [r.to_dict() for r in search_results if r.article_id in included_article_ids]
        else:
            articles_to_export = [r.to_dict() for r in search_results]

        if not articles_to_export:
            return jsonify({"error": "Aucun article inclus à exporter"}), 404

        df = pd.DataFrame(articles_to_export)
        excel_buffer = io.BytesIO()
        df.to_excel(excel_buffer, index=False, sheet_name='Articles Inclus')
        excel_buffer.seek(0)

        bibliography_text = format_bibliography(articles_to_export)
        
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
            zf.writestr('export_articles.xlsx', excel_buffer.read())
            zf.writestr('bibliographie.txt', "\n".join(bibliography_text).encode('utf-8'))            
        zip_buffer.seek(0)
        
        return send_file(
            zip_buffer,
            as_attachment=True,
            download_name=f'export_these_{project_id}.zip',
            mimetype='application/zip'
        )
    except Exception as e:
        logger.error(f"Erreur lors de l'export de la thèse: {e}")
        return jsonify({"error": "Erreur lors de la génération de l'export"}), 500

@projects_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
def upload_pdfs_bulk(project_id):
    """Upload en masse de PDFs."""
    if 'files' not in request.files:
        return jsonify({"error": "Aucun fichier n'a été envoyé."}), 400
    
    files = request.files.getlist('files')
    if not files or all(f.filename == '' for f in files):
        return jsonify({"error": "Aucun fichier sélectionné pour l'upload."}), 400
    
    task_ids, successful_uploads, failed_uploads = [], [], []
    for file in files:
        if file and file.filename.endswith('.pdf'):
            try:
                from utils.app_globals import PROJECTS_DIR
                filename = secure_filename(file.filename)
                    #logger.info(f"Fichier {filename} uploadé, mais aucune tâche de traitement n'est définie pour l'upload de PDF en masse.")
                job = background_queue.enqueue(add_manual_articles_task, project_id=project_id, identifiers=[filename], job_timeout='10m')
                task_ids.append(job.id)
                successful_uploads.append(filename)
            except Exception as e:
                logger.error(f"Erreur upload {file.filename}: {e}")
                failed_uploads.append(file.filename)
        elif file and file.filename:
            failed_uploads.append(f"{file.filename} (format non supporté)")
    
    response_message = f"{len(successful_uploads)} PDF(s) mis en file pour traitement."
    if failed_uploads:
        response_message += f" {len(failed_uploads)} fichier(s) ignoré(s)."

    return jsonify({"message": response_message, "job_ids": task_ids, "failed_files": failed_uploads}), 202

@projects_bp.route('/<project_id>/launch-atn-workflow', methods=['POST'])
@require_api_key
def launch_atn_workflow(project_id):
    """Lance le workflow ATN séquentiel optimisé"""
    
    data = request.get_json()
    articles_data = data.get('articles_data', [])
    profile = data.get('profile', {})
    fetch_pdfs = data.get('fetch_pdfs', True)
    use_atn_grid = data.get('use_atn_grid', True)
    
    if not articles_data:
        return jsonify({'error': 'articles_data requis'}), 400
    
    try:
        from utils.extensions import db
        from backend.workflow_orchestrator import orchestrator
        
        # Lancement du workflow orchestré
        job_ids = orchestrator.launch_atn_workflow(
            project_id=project_id,
            articles_data=articles_data,
            profile=profile,
            fetch_pdfs=fetch_pdfs
        )
        
        # Mise à jour du projet
        db.session.execute(text("""
            UPDATE projects SET 
                status = 'pipeline_started',
                current_stage = 'import',
                progress_percentage = 0,
                workflow_type = 'atn_sequential',
                updated_at = :ts
            WHERE id = :pid
        """), {"pid": project_id, "ts": datetime.now().isoformat()})
        db.session.commit()
        
        return jsonify({
            'message': 'Workflow ATN séquentiel démarré',
            'project_id': project_id,
            'pipeline_jobs': job_ids,
            'expected_stages': ['import', 'pdfs', 'screening', 'extraction', 'analysis', 'synthesis'],
            'estimated_duration': '10-15 minutes'
        }), 202
        
    except Exception as e:
        logger.error(f"Erreur lancement workflow ATN: {e}")
        return jsonify({'error': str(e)}), 500
    return jsonify({"message": response_message, "job_ids": task_ids, "failed_files": failed_uploads}), 202
