# api/tasks.py - VERSION FINALE CORRIGÉE

import logging
from redis.exceptions import ConnectionError
from flask import Blueprint, jsonify
from rq.job import Job
from rq.exceptions import NoSuchJobError
from rq.registry import StartedJobRegistry, FinishedJobRegistry, FailedJobRegistry

# ✅ CORRECTION : Import propre et sans duplication
from utils.app_globals import (
    limiter, redis_conn, processing_queue, synthesis_queue,
    analysis_queue, background_queue, extension_queue
)

tasks_bp = Blueprint('tasks_bp', __name__)
logger = logging.getLogger(__name__)

@tasks_bp.route('/tasks/<task_id>/status', methods=['GET'])
@limiter.limit("200 per minute")
def get_task_status(task_id):
    """Récupère le statut et le résultat d'une tâche RQ."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
    except NoSuchJobError:
        return jsonify({"error": "Tâche non trouvée"}), 404
    except ConnectionError as e:
        logger.error(f"Erreur de connexion à Redis: {e}", exc_info=True)
        return jsonify({'status': 'error', 'message': 'Erreur de connexion au serveur Redis'}), 500
    
    # ✅ CORRECTION: Utiliser 'task_id' comme attendu par le test
    response_data = {
        'task_id': job.id,  # ← CHANGÉ de 'id' vers 'task_id'
        'status': job.get_status(),
        'result': job.result,
        'enqueued_at': job.enqueued_at.isoformat() if job.enqueued_at else None,
        'started_at': job.started_at.isoformat() if job.started_at else None,
        'ended_at': job.ended_at.isoformat() if job.ended_at else None,
        'exc_info': str(job.exc_info) if job.exc_info else None
    }
    return jsonify(response_data)

@tasks_bp.route('/tasks/status', methods=['GET'])
def get_all_tasks_status():
    """Retourne une liste de toutes les tâches."""
    all_tasks = []
    queues = [processing_queue, synthesis_queue, analysis_queue, background_queue, extension_queue]

    for q in queues:
        started_registry = StartedJobRegistry(queue=q)
        finished_registry = FinishedJobRegistry(queue=q)
        failed_registry = FailedJobRegistry(queue=q)

        jobs = Job.fetch_many(
            q.get_job_ids() + started_registry.get_job_ids() + 
            finished_registry.get_job_ids(end=50) + failed_registry.get_job_ids(end=50),
            connection=redis_conn
        )

        for job in jobs:
            if job:
                all_tasks.append({
                    'id': job.id, 'queue': q.name, 'description': job.description,
                    'status': job.get_status(), 'created_at': job.created_at.isoformat() if job.created_at else None,
                })

    all_tasks.sort(key=lambda x: x['created_at'] or '', reverse=True)
    return jsonify(all_tasks)

@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Annule une tâche en cours."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)        
        job.cancel()
        return jsonify({"message": "Demande d'annulation envoyée."}), 200
    except NoSuchJobError:
        return jsonify({"error": "Tâche non trouvée"}), 404
