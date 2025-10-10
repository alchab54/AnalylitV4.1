# api/admin.py
from flask import Blueprint, jsonify, request
from utils.app_globals import redis_conn, import_queue
from utils.extensions import limiter, logging
from rq import Queue, Worker
import time


admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/queues/stats', methods=['GET'])
@limiter.limit("100 per minute")
def get_queue_detailed_stats():
    """Statistiques détaillées des queues avec workers"""
    try:
        queues_to_check = [
            'import_queue',
            'screening_queue',
            'atn_scoring_queue',
            'extraction_queue',
            'analysis_queue',
            'synthesis_queue',
            'discussion_draft_queue'
        ]
        
        queues_stats = []
        workers = Worker.all(connection=redis_conn)
        
        for queue_name in queues_to_check:
            try:
                q = Queue(queue_name, connection=redis_conn)
                active_workers = len([w for w in workers if queue_name in [wq.name for wq in w.queues]])
                running_jobs = q.started_job_registry.get_job_ids()
                failed_jobs = q.failed_job_registry.get_job_ids()
                
                queues_stats.append({
                    'name': queue_name,
                    'size': len(q),
                    'workers': active_workers,
                    'running': len(running_jobs),
                    'failed': len(failed_jobs),
                    'failed_jobs': failed_jobs[:10]
                })
            except Exception as e:
                queues_stats.append({ 'name': queue_name, 'error': str(e) })
        
        return jsonify({
            "queues": queues_stats, 
            "total_workers": len(workers),
            "timestamp": int(time.time())
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/admin/pull-model', methods=['POST'])
def pull_model():
    data = request.get_json()
    model_name = data.get('model_name')
    if not model_name:
        return jsonify({'error': 'model_name requis'}), 400
    job = import_queue.enqueue('backend.tasks_v4_complete.pull_ollama_model_task', model_name=model_name)
    return jsonify({"message": "Tâche lancée", "task_id": job.id}), 202

@admin_bp.route('/queues/clear', methods=['POST'])
@limiter.limit("10 per minute")
def clear_queue():
    """Vider complètement une queue spécifiée"""
    try:
        data = request.get_json()
        queue_name = data.get('queue_name')
        if not queue_name:
            return jsonify({'error': 'queue_name requis'}), 400
        
        q = Queue(queue_name, connection=redis_conn)
        cleared_count = q.empty()
        
        return jsonify({
            'success': True,
            'message': f'Queue {queue_name} vidée',
            'cleared_tasks': cleared_count
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/queues/clear-all', methods=['POST'])
@limiter.limit("5 per minute")
def clear_all_queues():
    """Vider TOUTES les queues"""
    try:
        queues_to_clear = [
            'import_queue',
            'screening_queue',
            'atn_scoring_queue',
            'extraction_queue',
            'analysis_queue',
            'synthesis_queue',
            'discussion_draft_queue'
        ]
        total_cleared = 0
        for queue_name in queues_to_clear:
            q = Queue(queue_name, connection=redis_conn)
            total_cleared += q.empty()
        
        return jsonify({'success': True, 'total_cleared': total_cleared})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
