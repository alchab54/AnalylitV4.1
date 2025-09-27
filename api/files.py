# api/files.py

import logging
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from utils.file_handlers import save_file_to_project_dir

from utils.app_globals import PROJECTS_DIR, with_db_session

files_bp = Blueprint('files_bp', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)