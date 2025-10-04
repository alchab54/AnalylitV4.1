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
def get_task_status(task_id):
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        return jsonify({
            'task_id': job.get_id(),
            'status': job.get_status(),
            'result': job.result
        }), 200
    except NoSuchJobError:
        # ✅ Gère explicitement le cas "not found"
        return jsonify({'error': 'Tâche non trouvée'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

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
