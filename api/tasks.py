import logging
from flask import Blueprint, jsonify
from rq.job import Job
from rq.registry import StartedJobRegistry, FinishedJobRegistry, FailedJobRegistry
from rq.exceptions import NoSuchJobError
from utils.app_globals import (
    redis_conn, processing_queue, synthesis_queue, analysis_queue, background_queue, extension_queue
)

tasks_bp = Blueprint('tasks_bp', __name__)
logger = logging.getLogger(__name__)

@tasks_bp.route('/tasks/<task_id>/status', methods=['GET'])
def get_task_status(task_id):
    """
    Récupère le statut d'une tâche spécifique à partir de son ID.
    """
    try:
        job = Job.fetch(task_id, connection=redis_conn)
    except NoSuchJobError:
        return jsonify({"error": "Tâche non trouvée"}), 404
    except Exception as e:
        logger.error(f"Erreur en récupérant la tâche {task_id} depuis Redis: {e}", exc_info=True)
        return jsonify({"error": "Erreur interne du serveur"}), 500

    # ✅ CORRECTION: Utiliser job.exc_info qui est la méthode standard pour obtenir les infos d'exception.
    exc_string = None
    if job.is_failed:
        exc_string = job.exc_info

    response = {
        # ✅ CORRECTION: L'attribut est .id, pas la méthode .get_id()
        'task_id': job.id,
        'status': job.get_status(),
        'result': job.return_value,
        'enqueued_at': job.enqueued_at.isoformat() if job.enqueued_at else None,
        'started_at': job.started_at.isoformat() if job.started_at else None,
        'ended_at': job.ended_at.isoformat() if job.ended_at else None,
        'exc_info': exc_string
    }
    return jsonify(response)

@tasks_bp.route('/tasks/status', methods=['GET'])
def get_all_tasks_status():
    """
    ✅ NOUVEL ENDPOINT: Retourne une liste de toutes les tâches (en cours, en attente, finies, échouées).
    Ceci corrige le test `test_get_tasks_status` qui attendait cet endpoint.
    """
    all_tasks = []
    queues = [processing_queue, synthesis_queue, analysis_queue, background_queue, extension_queue]

    for q in queues:
        # Registres pour les tâches dans des états spécifiques
        started_registry = StartedJobRegistry(queue=q)
        finished_registry = FinishedJobRegistry(queue=q)
        failed_registry = FailedJobRegistry(queue=q)

        # Tâches en cours, en attente, finies, échouées
        started_jobs = Job.fetch_many(started_registry.get_job_ids(), connection=redis_conn)
        queued_jobs = Job.fetch_many(q.get_job_ids(), connection=redis_conn)
        finished_jobs = Job.fetch_many(finished_registry.get_job_ids(end=50), connection=redis_conn) # Limite aux 50 dernières
        failed_jobs = Job.fetch_many(failed_registry.get_job_ids(end=50), connection=redis_conn)

        for job in started_jobs + queued_jobs + finished_jobs + failed_jobs:
            if job:
                all_tasks.append({
                    'id': job.id,
                    'queue': q.name,
                    'description': job.description,
                    'status': job.get_status(),
                    'created_at': job.created_at.isoformat() if job.created_at else None,
                    'started_at': job.started_at.isoformat() if job.started_at else None,
                    'ended_at': job.ended_at.isoformat() if job.ended_at else None,
                })

    # Trier par date de création, les plus récentes en premier
    all_tasks.sort(key=lambda x: x['created_at'] or '', reverse=True)
    return jsonify(all_tasks)

@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Annule une tâche en cours."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.cancel()
        return jsonify({"message": "Demande d_annulation envoyée."}), 200
    except NoSuchJobError:
        return jsonify({"error": "Tâche non trouvée"}), 404
    except Exception as e:
        logger.error(f"Erreur lors de l'annulation de la tâche {task_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500