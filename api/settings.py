# api/settings.py
import logging
from flask import Blueprint, jsonify, request # request a été ajouté
from sqlalchemy import text # text a été ajouté
from utils.database import with_db_session
from utils.models import AnalysisProfile, Prompt # Import des modèles corrects

logger = logging.getLogger(__name__)
settings_bp = Blueprint('settings_bp', __name__)

@settings_bp.route('/profiles', methods=['GET'])
@with_db_session
def handle_profiles(session): # Standardisé sur 'session'
    """
    Récupère et retourne tous les profils d'analyse disponibles.
    """
    try:
        profiles = session.query(AnalysisProfile).order_by(AnalysisProfile.name).all()
        
        profiles_data = [
            {
                "id": profile.id,
                "name": profile.name,
                "description": profile.description,
                "temperature": profile.temperature,
                "context_length": profile.context_length,
                "preprocess_model": profile.preprocess_model,
                "extract_model": profile.extract_model,
                "synthesis_model": profile.synthesis_model
            } for profile in profiles
        ]
        
        logger.info(f"{len(profiles_data)} profils d'analyse récupérés.")
        return jsonify(profiles_data)
    except Exception as e:
        logger.exception("Erreur lors de la récupération des profils d'analyse.")
        return jsonify({"error": "Erreur interne du serveur."}), 500

@settings_bp.route('/profiles/<profile_id>', methods=['DELETE', 'PUT'])
@with_db_session
def handle_single_profile(session, profile_id): # Standardisé sur 'session'
    """ Gère la suppression et la mise à jour d'un profil unique. """
    # Correction : Utilisation de AnalysisProfile au lieu de Profile
    profile = session.get(AnalysisProfile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404
        
    if request.method == 'DELETE':
        session.delete(profile)
        session.commit() # Important: Le commit est nécessaire pour les opérations d'écriture
        return jsonify({"message": "Profil supprimé"})
        
    if request.method == 'PUT':
        data = request.get_json()
        if not data:
            return jsonify({"error": "Données manquantes"}), 400
        # Mise à jour des champs du profil
        profile.name = data.get('name', profile.name)
        profile.description = data.get('description', profile.description)
        profile.preprocess_model = data.get('preprocess_model', profile.preprocess_model)
        profile.extract_model = data.get('extract_model', profile.extract_model)
        profile.synthesis_model = data.get('synthesis_model', profile.synthesis_model)
        profile.temperature = data.get('temperature', profile.temperature)
        profile.context_length = data.get('context_length', profile.context_length)
        session.commit() # Important: Le commit est nécessaire
        return jsonify(profile.to_dict())

# ALIAS pour compatibilité frontend: /analysis-profiles
@settings_bp.route('/analysis-profiles', methods=['GET'])
@with_db_session
def handle_analysis_profiles_alias(session): # Standardisé sur 'session'
    """ Alias pour récupérer tous les profils d'analyse. """
    profiles = session.query(AnalysisProfile).order_by(AnalysisProfile.name).all()
    return jsonify([p.to_dict() for p in profiles])

@settings_bp.route('/prompts', methods=['GET', 'POST'])
@with_db_session
def handle_prompts(session): # Standardisé sur 'session'
    """ Gère la lecture et l'écriture des prompts. """
    if request.method == 'GET':
        rows = session.execute(text("SELECT * FROM prompts ORDER BY name")).mappings().all()
        return jsonify([dict(r) for r in rows])
        
    if request.method == 'POST':
        data = request.get_json(force=True)
        session.execute(text("""
            INSERT INTO prompts (name, description, template)
            VALUES (:name, :description, :template)
            ON CONFLICT (name) DO UPDATE SET
            description = EXCLUDED.description,
            template = EXCLUDED.template
        """), {
            "name": data['name'],
            "description": data['description'],
            "template": data['template']
        })
        session.commit() # Important: Le commit est nécessaire
        return jsonify({'message': 'Prompt sauvegardé'}), 201

@settings_bp.route('/prompts/<prompt_id>', methods=['PUT'])
@with_db_session
def update_prompt(session, prompt_id): # Standardisé sur 'session'
    """ Met à jour un prompt existant. """
    prompt = session.get(Prompt, prompt_id)
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404
        
    data = request.get_json()
    if not data:
        return jsonify({"error": "Données manquantes"}), 400
        
    prompt.template = data.get('template', prompt.template)
    session.commit() # Important: Le commit est nécessaire
    return jsonify(prompt.to_dict())

