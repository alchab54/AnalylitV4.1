# api/files.py

import logging
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from utils.file_handlers import save_file_to_project_dir

from utils.app_globals import PROJECTS_DIR, with_db_session

files_bp = Blueprint('files_bp', __name__)
logger = logging.getLogger(__name__)



@files_bp.route('/projects/<project_id>/upload-pdfs-bulk', methods=['POST'])
@with_db_session
def upload_pdfs_bulk(session, project_id):
    if 'files' not in request.files:
        return jsonify({"error": "Aucun fichier (part 'files') fourni"}), 400

    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "Aucun fichier sélectionné"}), 400

    saved_files = []
    for file in files:
        filename = secure_filename(file.filename)
        save_file_to_project_dir(file, project_id, filename, PROJECTS_DIR)
        saved_files.append(filename)

    return jsonify({"message": f"{len(saved_files)} fichiers uploadés avec succès.", "files": saved_files}), 200