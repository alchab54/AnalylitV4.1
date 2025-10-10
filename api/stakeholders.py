# api/stakeholders.py


from flask import Blueprint, jsonify, request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from utils.extensions import db
from utils.models import Project, Stakeholder

stakeholders_bp = Blueprint('stakeholders', __name__)
logger = logging.getLogger(__name__)

@stakeholders_bp.route('/projects/<project_id>/stakeholders', methods=['POST'])
def create_stakeholder(project_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    data = request.get_json()
    if not data or not data.get('name'):
        return jsonify({"error": "Le nom du stakeholder est requis"}), 400
    
    new_stakeholder = Stakeholder(
        project_id=project_id,
        name=data['name'],
        role=data.get('role'),
        contact_info=data.get('contact_info'),
        notes=data.get('notes')
    )
    db.session.add(new_stakeholder)
    try:
        db.session.commit()
        return jsonify(new_stakeholder.to_dict()), 201
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erreur lors de la création du stakeholder"}), 500

@stakeholders_bp.route('/projects/<project_id>/stakeholders', methods=['GET'])
def get_all_stakeholders(project_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholders = db.session.scalars(select(Stakeholder).filter_by(project_id=project_id)).all()
    return jsonify([s.to_dict() for s in stakeholders]), 200

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['GET'])
def get_stakeholder_details(project_id, stakeholder_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = db.session.scalar(select(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id))
    if not stakeholder:
        return jsonify({"error": "Stakeholder non trouvé"}), 404
    return jsonify(stakeholder.to_dict()), 200

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['PUT'])
def update_stakeholder(project_id, stakeholder_id):
    project = db.session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = db.session.scalar(select(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id))
    if not stakeholder:
        return jsonify({"error": "Stakeholder non trouvé"}), 404

    data = request.get_json()
    if not data:
        return jsonify({"error": "Aucune donnée fournie pour la mise à jour"}), 400

    stakeholder.name = data.get('name', stakeholder.name)
    stakeholder.role = data.get('role', stakeholder.role)
    stakeholder.contact_info = data.get('contact_info', stakeholder.contact_info)
    stakeholder.notes = data.get('notes', stakeholder.notes)
    
    try:
        db.session.commit()
        return jsonify(stakeholder.to_dict()), 200
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Erreur lors de la mise à jour du stakeholder"}), 500

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['DELETE'])
def delete_stakeholder(project_id, stakeholder_id):
    project = db.session.get(Project, project_id)    
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = db.session.scalar(select(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id))
    if not stakeholder:
        return jsonify({"error": "Stakeholder non trouvé"}), 404
    
    db.session.delete(stakeholder)
    db.session.commit()
    return jsonify({"message": "Stakeholder supprimé"}), 200
