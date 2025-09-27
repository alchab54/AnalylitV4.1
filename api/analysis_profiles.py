# api/analysis_profiles.py

import logging
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from utils.database import with_db_session
from utils.models import AnalysisProfile

analysis_profiles_bp = Blueprint('analysis_profiles_bp', __name__)
logger = logging.getLogger(__name__)

@analysis_profiles_bp.route('/analysis-profiles', methods=['POST'])
@with_db_session
def create_analysis_profile(session):
    """Crée un nouveau profil d'analyse."""
    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error": "Le nom du profil est requis"}), 400

    if not data.get('name').strip():
        return jsonify({"error": "Le nom du profil ne peut pas être vide"}), 400

    new_profile = AnalysisProfile(
        name=data['name'],
        description=data.get('description', ''),
        preprocess_model=data.get('preprocess_model'),
        extract_model=data.get('extract_model'),
        synthesis_model=data.get('synthesis_model'),
        is_custom=data.get('is_custom', True)
    )
    session.add(new_profile)
    try:
        session.commit()
        return jsonify(new_profile.to_dict()), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Un profil avec ce nom existe déjà"}), 409

@analysis_profiles_bp.route('/analysis-profiles', methods=['GET'])
@with_db_session
def get_all_analysis_profiles(session):
    """Retourne tous les profils d'analyse."""
    profiles = session.query(AnalysisProfile).all()
    return jsonify([p.to_dict() for p in profiles]), 200

@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['GET'])
@with_db_session
def get_analysis_profile_details(session, profile_id):
    """Retourne les détails d'un profil d'analyse spécifique."""
    profile = session.query(AnalysisProfile).filter_by(id=profile_id).first()
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404
    return jsonify(profile.to_dict()), 200

@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['PUT'])
@with_db_session
def update_analysis_profile(session, profile_id):
    """Met à jour un profil d'analyse existant."""
    profile = session.query(AnalysisProfile).filter_by(id=profile_id).first()
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour"}), 400

    # Mettre à jour tous les champs fournis
    for key, value in data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    try:
        session.commit()
        return jsonify(profile.to_dict()), 200
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Erreur lors de la mise à jour du profil"}), 500

@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['DELETE'])
@with_db_session
def delete_analysis_profile(session, profile_id):
    """Supprime un profil d'analyse."""
    profile = session.query(AnalysisProfile).filter_by(id=profile_id).first()
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    if not profile.is_custom:
        return jsonify({"error": "Impossible de supprimer un profil par défaut"}), 403

    session.delete(profile)
    session.commit()
    return jsonify({"message": "Profil supprimé"}), 200