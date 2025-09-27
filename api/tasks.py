import logging
from flask import Blueprint, jsonify
from rq.job import Job
from rq.exceptions import NoSuchJobError
from utils.app_globals import redis_conn

tasks_bp = Blueprint('tasks_bp', __name__, url_prefix='/api')
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

    exc_string = None
    if job.is_failed:
        latest_res = job.latest_result()
        if latest_res:
            exc_string = latest_res.exc_string

    response = {
        'task_id': job.get_id(),
        'status': job.get_status(),
        'result': job.return_value(),  # CORRECTION FINALE
        'enqueued_at': job.enqueued_at.isoformat() if job.enqueued_at else None,
        'started_at': job.started_at.isoformat() if job.started_at else None,
        'ended_at': job.ended_at.isoformat() if job.ended_at else None,
        'exc_info': exc_string
    }
    return jsonify(response)

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