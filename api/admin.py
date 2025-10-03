# api/admin.py

import json
from flask import Blueprint, jsonify, request
from rq.worker import Worker

# --- Import des variables globales partagées ---
from utils.app_globals import (
    redis_conn, processing_queue, synthesis_queue, analysis_queue,
    background_queue, models_queue, extension_queue
)
 
admin_bp = Blueprint('admin_bp', __name__)
 
@admin_bp.route('/queues/info', methods=['GET'])
def get_queues_info():
    """Retourne le statut des files RQ."""
    queues_list = [processing_queue, synthesis_queue, analysis_queue, background_queue, extension_queue, models_queue]
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

@admin_bp.route('/health', methods=['GET'])
def health_check():
    """Route simple pour le healthcheck de Docker."""
    return jsonify({"status": "healthy"}), 200

@admin_bp.route('/models/pull', methods=['POST'])
def pull_model():
    data = request.get_json()
    model_name = data.get('model_name')
    if not model_name:
        return jsonify({"error": "model_name est requis"}), 400
    
    from backend.tasks_v4_complete import pull_ollama_model_task
    job = models_queue.enqueue(pull_ollama_model_task, model_name, job_timeout='30m')
    return jsonify({"message": f"Téléchargement du modèle '{model_name}' lancé.", "job_id": job.get_id()}), 202

@admin_bp.route('/queues/clear', methods=['POST'])
def clear_queue():
    data = request.get_json()
    queue_name = data.get('queue_name')
    
    queues_map = {
        "analylit_processing_v4": processing_queue,
        "analylit_synthesis_v4": synthesis_queue,
        "analylit_analysis_v4": analysis_queue,
        "analylit_background_v4": background_queue,
    }
    
    if queue_name in queues_map:
        queues_map[queue_name].empty()
        return jsonify({"message": f"Les jobs de la file '{queue_name}' ont été vidés."}), 200
    else:
        return jsonify({"error": f"File '{queue_name}' non trouvée."}), 404