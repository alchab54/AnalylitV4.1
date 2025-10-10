# api/files.py

import logging
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename
from utils.app_globals import PROJECTS_DIR

from utils.file_handlers import save_file_to_project_dir
# api/files.py

files_bp = Blueprint('files_bp', __name__)
logger = logging.getLogger(__name__)

@files_bp.route('/projects/<project_id>/files', methods=['GET'])
def list_project_files(project_id):
    """Lists files in a project."""
    project_dir = PROJECTS_DIR / project_id
    if not project_dir.exists() or not project_dir.is_dir():
        return jsonify({"error": "Projet non trouvé"}), 404
    
    files = [f.name for f in project_dir.iterdir() if f.is_file()]
    return jsonify({"files": files}), 200