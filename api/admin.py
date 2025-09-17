# api/admin.py

import logging
from datetime import datetime
from flask import Blueprint, jsonify
from rq.job import Job as RqJob
from rq.worker import Worker
from sqlalchemy import text

from utils.app_globals import redis_conn, processing_queue, synthesis_queue, analysis_queue, background_queue, Session, config

logger = logging.getLogger(__name__)
admin_bp = Blueprint('admin_api', __name__)

@admin_bp.route('/health', methods=['GET'])
def health_check():
    """Vérifie l'état de santé des services connectés."""
    try:
        redis_status = "connected" if redis_conn.ping() else "disconnected"
    except Exception:
        redis_status = "disconnected"

    session = Session()
    try:
        session.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    finally:
        session.close()

    # CORRECTION: Ajout du statut Ollama pour un healthcheck complet
    try:
        import requests
        # Utilise un timeout court pour ne pas bloquer
        requests.get(f"{config.OLLAMA_BASE_URL}/api/version", timeout=2)
        ollama_status = "connected"
    except Exception:
        ollama_status = "disconnected"

    return jsonify({
        "status": "ok",
        "version": config.ANALYLIT_VERSION,
        "timestamp": datetime.now().isoformat(),
        "services": {
            "database": db_status,
            "redis": redis_status,
            "ollama": ollama_status
        }
    })

@admin_bp.route('/tasks/<task_id>/cancel', methods=['POST'])
def cancel_task(task_id):
    try:
        job = RqJob.fetch(task_id, connection=redis_conn)
        if job is None:
            return jsonify({'error': 'Tâche non trouvée.'}), 404
        job.cancel()
        logger.info(f"Demande d'annulation pour la tâche {task_id} envoyée.")
        return jsonify({'message': 'Demande d\'annulation envoyée.'}), 200
    except Exception as e:
        logger.exception(f"Erreur lors de l'annulation de la tâche {task_id}: {e}")
        return jsonify({'error': 'Erreur interne du serveur lors de l\'annulation.'}), 500

@admin_bp.route('/admin/queues-status', methods=['GET'])
def get_queues_status():
    try:
        queues = [
            ('analylit_processing_v4', processing_queue, 'Traitement des articles'),
            ('analylit_synthesis_v4', synthesis_queue, 'Synthèses et analyses'),
            ('analylit_analysis_v4', analysis_queue, 'Analyses avancées'),
            ('analylit_background_v4', background_queue, 'Arrière-plan')
        ]
        all_workers = Worker.all(connection=redis_conn)
        worker_map = {qname: 0 for qname, _, _ in queues}
        for w in all_workers:
            try:
                names = [n.decode() if isinstance(n, bytes) else n for n in w.queue_names()]
            except Exception:
                names = []
            for qname, qobj, _ in queues:
                if qobj.name in names:
                    worker_map[qname] += 1

        payload = []
        for qname, qobj, label in queues:
            payload.append({
                "rq_name": qobj.name,
                "display": label,
                "pending": len(qobj),
                "started": len(qobj.started_job_registry),
                "failed": len(qobj.failed_job_registry),
                "finished": len(qobj.finished_job_registry),
                "scheduled": len(qobj.scheduled_job_registry),
                "workers": worker_map.get(qname, 0)
            })
        return jsonify({"queues": payload, "timestamp": datetime.now().isoformat()}), 200
    except Exception as e:
        logger.exception(f"Erreur get_queues_status: {e}")
        return jsonify({"queues": []}), 200

@admin_bp.route('/tasks/status', methods=['GET'])
def get_all_tasks_status():
    try:
        queues = [processing_queue, synthesis_queue, analysis_queue, background_queue]
        all_tasks = []
        
        for queue in queues:
            for job in RqJob.fetch_many(queue.started_job_registry.get_job_ids(), connection=redis_conn):
                all_tasks.append({
                    "id": job.id, "description": job.description, "status": "started",
                    "queue": queue.name, "started_at": job.started_at.isoformat() if job.started_at else None
                })
            for job in RqJob.fetch_many(queue.get_job_ids(), connection=redis_conn):
                 all_tasks.append({
                    "id": job.id, "description": job.description, "status": "queued",
                    "queue": queue.name, "created_at": job.created_at.isoformat() if job.created_at else None
                })
            for job in RqJob.fetch_many(queue.finished_job_registry.get_job_ids(0, 49), connection=redis_conn):
                 all_tasks.append({
                    "id": job.id, "description": job.description, "status": "finished",
                    "queue": queue.name, "ended_at": job.ended_at.isoformat() if job.ended_at else None
                })
            for job in RqJob.fetch_many(queue.failed_job_registry.get_job_ids(0, 49), connection=redis_conn):
                 all_tasks.append({
                    "id": job.id, "description": job.description, "status": "failed",
                    "queue": queue.name, "ended_at": job.ended_at.isoformat() if job.ended_at else None,
                    "error": job.exc_info
                })

        all_tasks.sort(key=lambda x: x.get('started_at') or x.get('created_at') or x.get('ended_at'), reverse=True)
        return jsonify(all_tasks[:100])

    except Exception as e:
        logger.exception(f"Erreur lors de la récupération du statut des tâches: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500