# api/admin.py

import json
from flask import Blueprint, jsonify
from rq.worker import Worker

# --- Import des variables globales partagées ---
from utils.app_globals import (
    redis_conn, processing_queue, synthesis_queue, analysis_queue,
    background_queue
)

admin_bp = Blueprint('admin_bp', __name__)

@admin_bp.route('/queues/info', methods=['GET'])
def get_queues_info():
    """Retourne le statut des files RQ."""
    queues_list = [processing_queue, synthesis_queue, analysis_queue, background_queue]
    workers = Worker.all(connection=redis_conn)
    
    queues_info = []
    for q in queues_list:
        worker_count = sum(1 for w in workers if q.name in w.queue_names())
        queues_info.append({
            'name': q.name,
            'size': len(q),
            'workers': worker_count
        })
        
    return jsonify({"queues": queues_info})