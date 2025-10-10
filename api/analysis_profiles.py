# api/analysis_profiles.py


from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError
from utils.models import AnalysisProfile
from utils.extensions import limiter

analysis_profiles_bp = Blueprint('analysis_profiles_bp', __name__)
logger = logging.getLogger(__name__)

@analysis_profiles_bp.route('/analysis-profiles', methods=['POST'])
@limiter.limit("5 per minute")
def create_analysis_profile():
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
    db.session.add(new_profile)
    try:
        db.session.commit()
        return jsonify(new_profile.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Un profil avec ce nom existe déjà"}), 409

@analysis_profiles_bp.route('/profiles', methods=['GET'])
def get_profiles_simple():    
    """Endpoint simplifié pour récupérer les profils sans dépendance DB."""
    try:
        # Profils hardcodés pour éviter les erreurs DB
        profiles = [
                {
                    'id': 'fast-local',
                    'name': '⚡ Rapide (Local)',


                    'description': 'Pour tests et développement',
                    'preprocess': 'phi3:mini',
                    'extract': 'phi3:mini',
                    'synthesis': 'llama3:8b'
                },
                {
                    'id': 'standard-local',
                    'name': 'Standard (Local)',

                    'description': 'Équilibre vitesse/qualité',
                    'preprocess': 'phi3:mini',
                    'extract': 'llama3:8b',
                    'synthesis': 'llama3:8b'
                }
            ]
        return jsonify(profiles), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des profils: {e}", exc_info=True)
        # Fallback d'urgence
        fallback_profiles = [
            {
                'id': 'emergency-fallback',
                'name': 'Fallback Standard',
                'preprocess': 'phi3:mini',
                'extract': 'llama3:8b',
                'synthesis': 'llama3:8b'
            }
        ]
        return jsonify(fallback_profiles), 200


@analysis_profiles_bp.route('/analysis-profiles', methods=['GET'])
@limiter.limit("50 per minute")
def get_all_analysis_profiles():
    """Retourne tous les profils d'analyse."""
    try:  

        from sqlalchemy import select
        stmt = select(AnalysisProfile)
        profiles = db.session.execute(stmt).scalars().all()
        return jsonify([p.to_dict() for p in profiles]), 200

    except Exception as e:
        logger.error(f"Erreur lors de la récupération des profils d'analyse: {e}", exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Erreur interne du serveur"}), 500

@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['GET'])
def get_analysis_profile_details(profile_id):
    """Retourne les détails d'un profil d'analyse spécifique."""
    profile = db.session.get(AnalysisProfile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404
    return jsonify(profile.to_dict()), 200

@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['PUT'])
@limiter.limit("5 per minute")
def update_analysis_profile(profile_id):
    """Met à jour un profil d'analyse existant."""
    profile = db.session.get(AnalysisProfile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour"}), 400

    for key, value in data.items():
        if hasattr(profile, key):
            setattr(profile, key, value)

    try:
        db.session.commit()
        return jsonify(profile.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erreur lors de la mise à jour du profil"}), 500


@analysis_profiles_bp.route('/analysis-profiles/<profile_id>', methods=['DELETE'])
@limiter.limit("5 per minute")
def delete_analysis_profile(profile_id):
    """Supprime un profil d'analyse."""
    profile = db.session.get(AnalysisProfile, profile_id)
    if not profile:
        return jsonify({"error": "Profil non trouvé"}), 404

    if not profile.is_custom:
        return jsonify({"error": "Impossible de supprimer un profil par défaut"}), 403

    db.session.delete(profile)
    db.session.commit()
    return jsonify({"message": "Profil supprimé"}), 200
