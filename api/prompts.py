# api/prompts.py

import logging
from flask import Blueprint, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from utils.extensions import db
from utils.models import Prompt

prompts_bp = Blueprint('prompts_bp', __name__)
logger = logging.getLogger(__name__)

@prompts_bp.route('', methods=['GET'])
def get_all_prompts():
    """Retourne tous les prompts."""
    stmt = select(Prompt)
    prompts = db.session.execute(stmt).scalars().all()
    return jsonify([p.to_dict() for p in prompts]), 200

@prompts_bp.route('', methods=['POST'])
def create_prompt():
    """Crée un nouveau prompt."""
    data = request.get_json()
    # ✅ AMÉLIORATION: Validation plus stricte pour éviter les noms/contenus vides.
    name = data.get('name') if data else None
    content = data.get('content') if data else None
    if not name or not content:
        return jsonify({"error": "Les champs 'name' et 'content' sont requis et ne peuvent être vides"}), 400

    new_prompt = Prompt(name=data['name'], content=data['content'])
    db.session.add(new_prompt)
    try:
        db.session.commit()
        return jsonify(new_prompt.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Un prompt avec ce nom existe déjà"}), 409

@prompts_bp.route('/<prompt_id>', methods=['GET', 'PUT'])  # ✅ Ajouter PUT
def update_prompt(prompt_id):
    """Met à jour un prompt existant."""
    # ✅ AMÉLIORATION: Utiliser db.session.get() est plus direct pour une recherche par clé primaire.
    prompt = db.session.get(Prompt, prompt_id)
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie"}), 400

    # Mettre à jour les champs s'ils sont fournis et non vides
    if 'name' in data and data['name']:
        prompt.name = data['name']
    if 'content' in data and data['content']:
        prompt.content = data['content']
    
    try:
        db.session.commit()
        return jsonify(prompt.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Un prompt avec ce nom existe déjà"}), 409

@prompts_bp.route('/', methods=['GET'])
def get_prompts():
    """Ajouter route pour liste des prompts"""
    prompts = Prompt.query.all()
    return jsonify([prompt.to_dict() for prompt in prompts]), 200

@prompts_bp.route('/<prompt_id>', methods=['DELETE'])
def delete_prompt(prompt_id):
    """Supprime un prompt."""    
    # ✅ AMÉLIORATION: Utiliser db.session.get()
    prompt = db.session.get(Prompt, prompt_id)
    if not prompt:
        return jsonify({"error": "Prompt non trouvé"}), 404
    
    db.session.delete(prompt)
    db.session.commit()
    return jsonify({"message": "Prompt supprimé"}), 200
