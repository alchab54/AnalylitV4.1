# api/tasks.py
import logging
from flask import Blueprint, jsonify
from rq import Queue
from rq.exceptions import NoSuchJobError
from rq.job import Job
from utils.app_globals import (
    import_queue, screening_queue, atn_scoring_queue, extraction_queue,
    analysis_queue, synthesis_queue, discussion_draft_queue, extension_queue, redis_conn
)

tasks_bp = Blueprint('tasks', __name__)
logger = logging.getLogger(__name__)


@tasks_bp.route('/queues/info', methods=['GET'])
def get_queues_info():
    """Récupérer l'état des files d'attente"""
    try:
        # ✅ Queue map pour accès direct aux instances
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
        
        queues_info = []
        for queue_name, queue_instance in queue_map.items():
            try:
                queues_info.append({
                    'name': queue_name,
                    'size': len(queue_instance),
                    'workers': queue_instance.count,  # Nombre de workers actifs
                    'is_empty': queue_instance.is_empty,
                    'jobs_count': len(queue_instance.jobs)
                })
            except Exception as e:
                logger.error(f"Erreur lors de la récupération des infos pour {queue_name}: {e}")
                queues_info.append({
                    'name': queue_name,
                    'size': 0,
                    'workers': 0,
                    'is_empty': True,
                    'error': str(e)
                })

        return jsonify({"queues": queues_info, "count": len(queues_info)})
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des infos des queues: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/<task_id>/status', methods=['GET'])
def get_task_status(task_id):
    """Récupérer le statut d'une tâche spécifique"""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        return jsonify({
            "task_id": task_id,
            'status': job.get_status(),
            'result': job.result,
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'ended_at': job.ended_at.isoformat() if job.ended_at else None,
            'description': job.description,
            'exc_info': str(job.exc_info) if job.exc_info else None
        })
    except NoSuchJobError:
        return jsonify({'error': 'Task not found'}), 404
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut de la tâche {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/status', methods=['GET'])
def get_all_tasks_status():
    """Retourne le statut de toutes les tâches dans les files d'attente surveillées."""
    try:
        # ✅ Queues alignées sur l'architecture ATN v4.2
        queue_instances = [
            import_queue, screening_queue, atn_scoring_queue, extraction_queue,
            analysis_queue, synthesis_queue, discussion_draft_queue, extension_queue
        ]
        
        all_jobs = []
        
        for queue_instance in queue_instances:
            # Jobs en cours d'exécution
            started_ids = queue_instance.started_job_registry.get_job_ids()
            if started_ids:
                all_jobs.extend(Job.fetch_many(started_ids, connection=redis_conn))
            
            # Jobs en attente
            queued_ids = queue_instance.get_job_ids()
            if queued_ids:
                all_jobs.extend(Job.fetch_many(queued_ids, connection=redis_conn))

            # Jobs terminés (derniers 5 seulement pour éviter la surcharge)
            finished_ids = queue_instance.finished_job_registry.get_job_ids()[:5]
            if finished_ids:
                all_jobs.extend(Job.fetch_many(finished_ids, connection=redis_conn))

            # Jobs échoués
            failed_ids = queue_instance.failed_job_registry.get_job_ids()
            if failed_ids:
                all_jobs.extend(Job.fetch_many(failed_ids, connection=redis_conn))

        # Tri par date de création, plus récents en premier
        all_jobs.sort(key=lambda job: job.created_at, reverse=True)
        
        tasks_data = [{
            'id': job.id,
            'description': job.description,
            'status': job.get_status(),
            'created_at': job.created_at.isoformat() if job.created_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'ended_at': job.ended_at.isoformat() if job.ended_at else None,
            'queue_name': job.origin,  # Nom de la queue d'origine
            'exc_info': str(job.exc_info) if job.exc_info else None
        } for job in all_jobs]
        
        return jsonify(tasks_data)
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du statut de toutes les tâches: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    """Annule une tâche spécifique."""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.cancel()
        return jsonify({'message': f"Tâche {task_id} annulée avec succès."})
    except NoSuchJobError:
        return jsonify({'error': 'Tâche non trouvée'}), 404
    except Exception as e:
        logger.error(f"Erreur lors de l'annulation de la tâche {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/clear/<queue_name>', methods=['POST'])
def clear_queue(queue_name):
    """Vide une queue spécifique."""
    try:
        # ✅ Validation que la queue existe dans notre architecture
        valid_queues = [
            'import_queue', 'screening_queue', 'atn_scoring_queue', 'extraction_queue',
            'analysis_queue', 'synthesis_queue', 'discussion_draft_queue', 'extension_queue'
        ]
        
        if queue_name not in valid_queues:
            return jsonify({'error': f'Queue invalide. Queues disponibles: {valid_queues}'}), 400
            
        q = Queue(queue_name, connection=redis_conn)
        q.empty()
        return jsonify({'message': f'Queue {queue_name} vidée avec succès'})
    except Exception as e:
        logger.error(f"Erreur lors du vidage de la queue {queue_name}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@tasks_bp.route('/tasks/<task_id>', methods=['DELETE'])
def delete_task(task_id):
    """Supprimer une tâche de la file d'attente"""
    try:
        job = Job.fetch(task_id, connection=redis_conn)
        job.delete()
        return jsonify({'message': f'Tâche {task_id} supprimée avec succès'})
    except NoSuchJobError:
        return jsonify({'error': 'Tâche non trouvée'}), 404
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de la tâche {task_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
