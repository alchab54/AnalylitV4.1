# api/extensions.py


from flask import Blueprint, jsonify, request

from utils.app_globals import extension_queue
from backend.tasks_v4_complete import run_extension_task

extensions_bp = Blueprint('extensions', __name__)
logger = logging.getLogger(__name__)

@extensions_bp.route('/extensions', methods=['POST'])
def run_extension():
    """Exécute une extension personnalisée via une tâche de fond."""
    data = request.get_json()
    project_id = data.get('project_id')
    extension_name = data.get('extension_name')

    if not all([project_id, extension_name]):
        return jsonify({"error": "project_id et extension_name sont requis"}), 400

    job = extension_queue.enqueue(run_extension_task, project_id=project_id, extension_name=extension_name, job_timeout=1800)
    logger.info(f"Job d'extension enqueued: {job.id}")
    return jsonify({"message": "Tâche d'extension lancée", "job_id": job.id}), 202

@extensions_bp.route('/processed', methods=['POST'])  # ✅ Ajouter POST
def processed():
    """Logique extension"""
    return jsonify({'status': 'processed'}), 202
