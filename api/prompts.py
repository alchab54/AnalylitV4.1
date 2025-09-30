# api/prompts.py

import logging
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError
from utils.extensions import db
from utils.models import Prompt

prompts_bp = Blueprint('prompts_bp', __name__)
logger = logging.getLogger(__name__)

@prompts_bp.route('/prompts', methods=['GET'])
def get_all_prompts():
    """Retourne tous les prompts."""
    prompts = db.session.query(Prompt).all()
    return jsonify([p.to_dict() for p in prompts]), 200

@prompts_bp.route('/prompts', methods=['POST'])
def create_prompt():
    """Crée un nouveau prompt."""
    data = request.get_json()
    if not data or not data.get('name') or not data.get('content'):
        return jsonify({"error": "Les champs 'name' et 'content' sont requis"}), 400

    new_prompt = Prompt(name=data['name'], content=data['content'])
    db.session.add(new_prompt)
    try:
        db.session.commit()
        return jsonify(new_prompt.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Un prompt avec ce nom existe déjà"}), 409

@prompts_bp.route('/prompts/<prompt_id>', methods=['PUT'])
def update_prompt(prompt_id):
    """Met à jour un prompt existant."""
    prompt = db.session.query(Prompt).filter_by(id=prompt_id).first()
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie"}), 400

    prompt.name = data.get('name', prompt.name)
    prompt.content = data.get('content', prompt.content)
    db.session.commit()
    return jsonify(prompt.to_dict()), 200

@prompts_bp.route('/prompts/<prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id):
    """Supprime un prompt."""
    prompt = db.session.query(Prompt).filter_by(id=prompt_id).first()
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404
    
    db.session.delete(prompt)
    db.session.commit()
    return jsonify({"message": "Prompt supprimé"}), 200
