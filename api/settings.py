# api/settings.py

import logging
from flask import Blueprint, jsonify, request
from sqlalchemy import text

from server_v4_complete import with_db_session
from utils.models import AnalysisProfile as Profile, Prompt

logger = logging.getLogger(__name__)
settings_bp = Blueprint('settings_api', __name__)

# --- Profils et prompts ---
@settings_bp.route('/profiles', methods=['GET', 'POST'])
@with_db_session
def handle_profiles(db_session=None):
    if request.method == 'GET':
        profiles = db_session.query(Profile).order_by(Profile.name).all()
        return jsonify([p.to_dict() for p in profiles])

    if request.method == 'POST':
        data = request.get_json()
        if not data or not data.get('name'):
            return jsonify({"error": "Le nom du profil est requis"}), 400

        new_profile = Profile(
            name=data['name'],
            description=data.get('description', ''),
            preprocess_model=data.get('preprocess_model'),
            extract_model=data.get('extract_model'),
            synthesis_model=data.get('synthesis_model'),
            temperature=data.get('temperature', 0.7),
            context_length=data.get('context_length', 4096)
        )
        db_session.add(new_profile)
        return jsonify(new_profile.to_dict()), 201

@settings_bp.route('/profiles/<profile_id>', methods=['DELETE', 'PUT'])
@with_db_session
def handle_single_profile(db_session, profile_id):
    profile = db_session.get(Profile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    if request.method == 'DELETE':
        db_session.delete(profile)
        return jsonify({"message": "Profil supprimé"})

    if request.method == 'PUT':
        data = request.get_json()
        if not data:
            return jsonify({"error": "Données manquantes"}), 400

        profile.name = data.get('name', profile.name)
        profile.description = data.get('description', profile.description)
        profile.preprocess_model = data.get('preprocess_model', profile.preprocess_model)
        profile.extract_model = data.get('extract_model', profile.extract_model)
        profile.synthesis_model = data.get('synthesis_model', profile.synthesis_model)
        profile.temperature = data.get('temperature', profile.temperature)
        profile.context_length = data.get('context_length', profile.context_length)
        return jsonify(profile.to_dict())

# ALIAS pour compatibilité frontend: /analysis-profiles
@settings_bp.route('/analysis-profiles', methods=['GET'])
@with_db_session
def handle_analysis_profiles_alias(db_session=None):
    profiles = db_session.query(Profile).order_by(Profile.name).all()
    return jsonify([p.to_dict() for p in profiles])

@settings_bp.route('/prompts', methods=['GET', 'POST'])
@with_db_session
def handle_prompts(db_session=None):
    if request.method == 'GET':
        rows = db_session.execute(text("SELECT * FROM prompts ORDER BY name")).mappings().all()
        return jsonify([dict(r) for r in rows])

    if request.method == 'POST':
        data = request.get_json(force=True)
        db_session.execute(text("""
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
        return jsonify({'message': 'Prompt sauvegardé'}), 201

@settings_bp.route('/prompts/<prompt_id>', methods=['PUT'])
@with_db_session
def update_prompt(db_session, prompt_id):
    prompt = db_session.get(Prompt, prompt_id)
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Données manquantes"}), 400

    prompt.template = data.get('template', prompt.template)
    return jsonify(prompt.to_dict())
