# api/files.py

import logging
from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from utils.file_handlers import save_file_to_project_dir
# api/files.py

files_bp = Blueprint('files_bp', __name__)
logger = logging.getLogger(__name__)