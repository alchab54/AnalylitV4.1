# api/prompts.py - Routes complètes corrigées
from flask import Blueprint, jsonify, request
from utils.extensions import db
from utils.models import Prompt
from utils.app_globals import limiter

prompts_bp = Blueprint('prompts', __name__)

@prompts_bp.route('/', methods=['GET'])
@limiter.limit("50/minute")
@limiter.limit("50 per minute")
def get_all_prompts():
    """Récupérer tous les prompts"""
    try:
        prompts = Prompt.query.all()
        return jsonify([prompt.to_dict() for prompt in prompts])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@prompts_bp.route('/', methods=['POST'])
@limiter.limit("10 per minute")
def create_prompt():
    """Créer un nouveau prompt"""
    try:
        data = request.get_json()
        if not data or 'name' not in data:
            return jsonify({'error': 'Nom du prompt requis'}), 400
            
        prompt = Prompt(
            name=data['name'],
            content=data.get('content', ''),
            description=data.get('description', '')
        )
        
        db.session.add(prompt)
        db.session.commit()
        
        return jsonify(prompt.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@prompts_bp.route('/<prompt_id>', methods=['GET'])
def get_prompt(prompt_id):
    prompt = Prompt.query.get(prompt_id)
    if not prompt:
        # ✅ Gère le cas où le prompt n'existe pas
        return jsonify({'error': 'Prompt non trouvé'}), 404
    return jsonify(prompt.to_dict())

@prompts_bp.route('/<prompt_id>', methods=['PUT'])
@limiter.limit("20 per minute")
def update_prompt(prompt_id):
    """Mettre à jour un prompt"""
    try:
        prompt = Prompt.query.filter_by(id=prompt_id).first()
        if not prompt:
            return jsonify({'error': 'Prompt non trouvé'}), 404
            
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Données requises'}), 400
            
        # Mise à jour des champs autorisés
        allowed_fields = ['name', 'content', 'description']
        for field in allowed_fields:
            if field in data:
                setattr(prompt, field, data[field])
        
        db.session.commit()
        return jsonify(prompt.to_dict())
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@prompts_bp.route('/<prompt_id>', methods=['DELETE'])
@limiter.limit("10 per minute")
def delete_prompt(prompt_id):
    """Supprimer un prompt"""
    try:
        prompt = Prompt.query.filter_by(id=prompt_id).first()
        if not prompt:
            return jsonify({'error': 'Prompt non trouvé'}), 404
            
        db.session.delete(prompt)
        db.session.commit()
        
        return jsonify({'message': 'Prompt supprimé avec succès'})
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
