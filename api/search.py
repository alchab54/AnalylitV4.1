# api/search.py

import json
import uuid
import logging
from datetime import datetime
from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from utils.extensions import db
from utils.app_globals import background_queue
from backend.tasks_v4_complete import multi_database_search_task
from utils.fetchers import db_manager

logger = logging.getLogger(__name__)
search_bp = Blueprint('search_api', __name__)

@search_bp.route('/databases', methods=['GET'])
def get_available_databases():
    try:
        return jsonify(db_manager.get_available_databases())
    except Exception as e:
        logger.error(f"Erreur get_available_databases: {e}")
        return jsonify([]), 200

@search_bp.route('/search', methods=['POST'])
def search_multiple_databases():
    data = request.get_json(force=True)
    project_id = data.get('project_id')
    databases = data.get('databases', ['pubmed'])
    max_results_per_db = data.get('max_results_per_db', 50)
    
    is_expert_mode = 'expert_queries' in data
    simple_query = data.get('query')
    expert_queries = data.get('expert_queries')

    if not project_id:
        return jsonify({'error': 'project_id requis'}), 400
    
    if not is_expert_mode and not simple_query:
        return jsonify({'error': 'Une requête simple ("query") est requise.'}), 400
    if is_expert_mode and (not expert_queries or not any(expert_queries.values())):
        return jsonify({'error': 'Un dictionnaire de requêtes expertes ("expert_queries") avec au moins une requête non vide est requis.'}), 400

    main_query_to_save = next(iter(expert_queries.values())) if is_expert_mode and expert_queries else simple_query
    
    try:
        db.session.execute(text("""
            UPDATE projects
            SET search_query = :q, databases_used = :dbs, status = 'searching', updated_at = :now
            WHERE id = :pid
        """), {"q": main_query_to_save, "dbs": json.dumps(databases), "now": datetime.now().isoformat(), "pid": project_id})
        db.session.commit() # Commit the changes to the database
    except SQLAlchemyError as e:
        logger.error(f"Erreur DB saving search params: {e}", exc_info=True)
        db.session.rollback() # Rollback in case of error
        return jsonify({'error': 'Erreur interne'}), 500

    task_kwargs = {
        "project_id": project_id, "query": simple_query, "databases": databases,
        "max_results_per_db": max_results_per_db, "expert_queries": expert_queries
    }
    job = background_queue.enqueue(multi_database_search_task, **task_kwargs)
    return jsonify({'message': f'Recherche lancée dans {len(databases)} base(s)', 'job_id': job.id}), 202

@search_bp.route('/projects/<project_id>/search-stats', methods=['GET'])
def get_project_search_stats(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400

    stats = db.session.execute(text("""
        SELECT database_source, COUNT(*) as count
        FROM search_results WHERE project_id = :pid
        GROUP BY database_source
    """), {"pid": project_id}).mappings().all()
    
    total = sum(r['count'] for r in stats)

    return jsonify({
        "total_results": total,
        "results_by_database": {r["database_source"]: r["count"] for r in stats}
    })