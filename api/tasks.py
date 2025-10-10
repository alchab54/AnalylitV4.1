# api/tasks.py
import logging

from utils.app_globals import (
    import_queue, screening_queue, atn_scoring_queue, extraction_queue,
    analysis_queue, synthesis_queue, discussion_draft_queue, extension_queue, redis_conn
)
from rq import Queue
from flask import Blueprint, jsonify
from rq.exceptions import NoSuchJobError
from rq.job import Job
tasks_bp = Blueprint('tasks', __name__)
logger = logging.getLogger(__name__)

@tasks_bp.route('/queues/info', methods=['GET'])
def get_queues_info():
    """Récupère les détails d'une queue spécifique"""
    queue_map = {
        'import_queue': import_queue,
        'screening_queue': screening_queue,
        'atn_scoring_queue': atn_scoring_queue,
        'extraction_queue': extraction_queue,
        'analysis_queue': analysis_queue,
        'synthesis_queue': synthesis_queue,
        'discussion_draft_queue': discussion_draft_queue,
        'extension_queue': extension_queue
    }
    
    queue = queue_map.get(queue_name)
    if queue:
        return {
            'name': queue_name,
            'length': len(queue),
            'is_empty': queue.is_empty,
            'jobs': [job.id for job in queue.jobs[:10]]  # 10 premiers jobs
        }
    """Récupérer l'état des files d'attente"""
    try:
        queues_to_check = [
            'import_queue', 'screening_queue', 'atn_scoring_queue', 
            'extraction_queue', 'analysis_queue', 'synthesis_queue',
            'discussion_draft_queue', 'extension_queue'
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
            "task_id": task_id,

            'status': job.get_status(),
            'result': job.result
        })
    except NoSuchJobError:
        return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        logger.error(f"Error getting task status for task_id {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/tasks/status', methods=['GET'])
def get_all_tasks_status():
    """Retourne le statut de toutes les tâches dans les files d'attente surveillées."""
    try:
        queues_to_check = [
            'import_queue', 'screening_queue', 'atn_scoring_queue', 
            'extraction_queue', 'analysis_queue', 'synthesis_queue',
            'discussion_draft_queue', 'extension_queue'
        ]
        
        all_jobs = []
        
        for queue_name in queues_to_check:
            q = Queue(queue_name, connection=redis_conn)
            
            # Started jobs
            started_ids = q.started_job_registry.get_job_ids()
            if started_ids:
                all_jobs.extend(Job.fetch_many(started_ids, connection=redis_conn))
            
            # Queued jobs
            queued_ids = q.get_job_ids()
            if queued_ids:
                all_jobs.extend(Job.fetch_many(queued_ids, connection=redis_conn))

            # Finished jobs
            finished_ids = q.finished_job_registry.get_job_ids()
            if finished_ids:
                all_jobs.extend(Job.fetch_many(finished_ids, connection=redis_conn))

            # Failed jobs
            failed_ids = q.failed_job_registry.get_job_ids()
            if failed_ids:
                all_jobs.extend(Job.fetch_many(failed_ids, connection=redis_conn))

        # Sort jobs by creation date, most recent first
        all_jobs.sort(key=lambda job: job.created_at, reverse=True)
        
        tasks_data = [{
            'id': job.id,
            'description': job.description,
            'status': job.get_status(),
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'ended_at': job.ended_at.isoformat() if job.ended_at else None,
            'exc_info': str(job.exc_info) if job.exc_info else None
        } for job in all_jobs]
        
        return jsonify(tasks_data)
        
    except Exception as e:
        logger.error(f"Error getting all tasks status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Annule une tâche spécifique."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.cancel()
        return jsonify({'message': "Demande d'annulation envoyée."})
    except NoSuchJobError:
        return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        logger.error(f"Error cancelling task {task_id}: {e}", exc_info=True)
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