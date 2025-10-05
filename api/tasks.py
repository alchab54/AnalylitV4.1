# api/tasks.py

import logging
from flask import Blueprint, jsonify
from utils.app_globals import redis_conn
from rq import Queue
from rq.exceptions import NoSuchJobError
from rq.job import Job

tasks_bp = Blueprint('tasks', __name__)
logger = logging.getLogger(__name__)

@tasks_bp.route('/queues/info', methods=['GET'])
def get_queues_info():
    """Récupérer l'état des files d'attente"""
    try:
        queues_to_check = [
            'processing_queue', 'synthesis_queue', 'analysis_queue',
            'background_queue', 'models_queue', 'extension_queue',
            'fast_queue', 'default_queue', 'ai_queue'
        ]

        queues_info = []
        for queue_name in queues_to_check:
            try:
                q = Queue(queue_name, connection=redis_conn)
                queues_info.append({
                    'name': queue_name,
                    'size': len(q),
                    'workers': 0  # Placeholder
                })
            except Exception as e:
                logger.error(f"Error getting info for queue {queue_name}: {e}")
                queues_info.append({
                    'name': queue_name,
                    'size': 0,
                    'workers': 0
                })

        return jsonify({"queues": queues_info, "count": len(queues_info)})
    except Exception as e:
        logger.error(f"Error getting queues info: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/tasks/<task_id>/status', methods=['GET'])
def get_task_status(task_id):
    """Récupérer le statut d'une tâche spécifique"""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        return jsonify({
            "job_id": task_id,
            'status': job.get_status(),
            'result': job.result
        })
    except NoSuchJobError:
        return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        logger.error(f"Error getting task status for task_id {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/clear/<queue_name>', methods=['POST'])
def clear_queue(queue_name):
    q = Queue(queue_name, connection=redis_conn)
    q.empty()
    return jsonify({'message': f'Queue {queue_name} cleared'})

@tasks_bp.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Supprimer une tâche de la file d'attente"""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.delete()
        return jsonify({'message': f'Task {task_id} deleted'})
    except NoSuchJobError:
        return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        logger.error(f"Error deleting task with task_id {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500