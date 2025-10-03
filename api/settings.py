# api/settings.py

from flask import Blueprint, jsonify
import logging
from utils.extensions import db

import requests
import os

logger = logging.getLogger(__name__)

# Blueprint Configuration
settings_bp = Blueprint("settings", __name__, url_prefix="/api")

@settings_bp.route("/settings/debug", methods=["GET"])
def settings_debug():
    """Route de debug."""
    return jsonify({"status": "OK", "blueprint": "settings_bp"}), 200

@settings_bp.route("/settings/models", methods=["GET"])
def get_settings_models():
    """Retourne la liste des modèles Ollama disponibles."""
    try:
        ollama_url = os.environ.get("OLLAMA_URL", "http://localhost:11434")
        response = requests.get(f"{ollama_url}/api/tags", timeout=2)
        if response.status_code == 200:
            data = response.json()
            return jsonify(data.get("models", [])), 200
        return jsonify([]), 200
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des modèles: {e}")
        return jsonify({"error": "Erreur serveur"}), 500
