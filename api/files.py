# api/files.py

import os
import uuid
import logging
from pathlib import Path

from flask import Blueprint, jsonify, request, send_from_directory
from werkzeug.utils import secure_filename

from utils.app_globals import config, q
from utils.file_handlers import sanitize_filename
from utils.notifications import send_project_notification

logger = logging.getLogger(__name__)
files_bp = Blueprint('files_api', __name__)

@files_bp.route('/projects/<project_id>/upload-zotero', methods=['POST'])
def handle_zotero_file_upload(project_id):
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({"error": "ID de projet invalide"}), 400

    file = request.files.get('file')
    if not file:
        return jsonify({"error": "Aucun fichier fourni"}), 400

    project_path = config.PROJECTS_DIR / project_id
    project_path.mkdir(exist_ok=True)

    filename = secure_filename(file.filename)
    file_path = project_path / filename
    file.save(str(file_path))

    task = q.enqueue('tasks_v4_complete.import_from_zotero_file_task', project_id=str(project_id), json_file_path=str(file_path))
    return jsonify({'message': f'Fichier {filename} téléversé, import en cours.', 'job_id': task.id}), 202

@files_bp.route('/projects/<project_id>/files/<filename>')
def serve_project_file(project_id, filename):
    """Sert un fichier statique depuis le dossier d'un projet spécifique."""
    try:
        uuid.UUID(project_id, version=4)
    except ValueError:
        return jsonify({"error": "ID de projet invalide"}), 400

    project_path = config.PROJECTS_DIR / project_id
    try:
        return send_from_directory(str(project_path), filename)
    except FileNotFoundError:
        return jsonify({"error": "Fichier non trouvé"}), 404