from flask import Blueprint, request, jsonify
import logging
import json
import os
from pathlib import Path
from utils.database import with_db_session

logger = logging.getLogger(__name__)

settings_bp = Blueprint("settings", __name__, url_prefix="/api/settings")

@settings_bp.route("/profiles", methods=["GET"])
def handle_profiles():
    """Retourne les profils de modèles disponibles."""
    try:
        # Chercher le fichier profiles.json
        profiles_path = Path("profiles.json")
        if not profiles_path.exists():
            # Fallback vers le fichier dans l'espace
            profiles_path = Path("profiles.json")
        
        if profiles_path.exists():
            with open(profiles_path, 'r', encoding='utf-8') as f:
                profiles_data = json.load(f)
                return jsonify(profiles_data)
        else:
            # Retourner des profils par défaut
            default_profiles = {
                "profiles": [
                    {
                        "id": "rapide",
                        "name": "Rapide",
                        "description": "Traitement rapide avec modèles légers",
                        "preprocess_model": "llama3.1:8b",
                        "extract_model": "llama3.1:8b",
                        "synthesis_model": "llama3.1:8b"
                    },
                    {
                        "id": "standard",
                        "name": "Standard",
                        "description": "Équilibre entre vitesse et qualité",
                        "preprocess_model": "llama3.1:8b",
                        "extract_model": "llama3.1:8b",
                        "synthesis_model": "llama3.1:8b"
                    },
                    {
                        "id": "approfondi",
                        "name": "Approfondi",
                        "description": "Analyse détaillée avec modèles avancés",
                        "preprocess_model": "llama3.1:8b",
                        "extract_model": "llama3.1:8b",
                        "synthesis_model": "llama3.1:8b"
                    }
                ]
            }
            return jsonify(default_profiles)
            
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des profils: {e}")
        return jsonify({"error": "Erreur serveur"}), 500

@settings_bp.route("/models", methods=["GET"])
@with_db_session
def get_available_models(session):
    """Retourne la liste des modèles Ollama disponibles."""
    try:
        # Ici vous pouvez ajouter la logique pour récupérer les modèles depuis Ollama
        # Pour l'instant, retournons des modèles par défaut
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
