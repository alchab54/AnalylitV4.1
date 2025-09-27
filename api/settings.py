# api/settings.py

from flask import Blueprint, request, jsonify
import logging
from utils.database import with_db_session

logger = logging.getLogger(__name__)

# Le frontend appelle /api/analysis-profiles, donc nous utilisons ce préfixe.
settings_bp = Blueprint("settings_bp", __name__)

@settings_bp.route("/api/settings/models", methods=["GET"])
@with_db_session
def get_available_models(session):
    """Retourne la liste des modèles Ollama disponibles."""
    try:
        # TODO: Implémenter la logique pour récupérer les modèles depuis Ollama
        # Pour l'instant, retournons une liste statique pour la démonstration.
        models = [
            "llama3.1:8b",
            "llama3.1:70b",
            "mistral:7b",
            "codellama:7b"
        ]
        return jsonify({"models": models})
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des modèles: {e}")
        return jsonify({"error": "Erreur serveur"}), 500
