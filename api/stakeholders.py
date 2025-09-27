# api/stakeholders.py

import logging
from flask import Blueprint, jsonify, request
from sqlalchemy.exc import IntegrityError

from utils.database import with_db_session
from utils.models import Project, Stakeholder

stakeholders_bp = Blueprint('stakeholders_bp', __name__, url_prefix='/api')
logger = logging.getLogger(__name__)

@stakeholders_bp.route('/projects/<project_id>/stakeholders', methods=['POST'])
@with_db_session
def create_stakeholder(session, project_id):
    project = session.query(Project).filter_by(id=project_id).first()
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
    session.add(new_stakeholder)
    try:
        session.commit()
        return jsonify(new_stakeholder.to_dict()), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Erreur lors de la création du stakeholder"}), 500

@stakeholders_bp.route('/projects/<project_id>/stakeholders', methods=['GET'])
@with_db_session
def get_all_stakeholders(session, project_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholders = session.query(Stakeholder).filter_by(project_id=project_id).all()
    return jsonify([s.to_dict() for s in stakeholders]), 200

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['GET'])
@with_db_session
def get_stakeholder_details(session, project_id, stakeholder_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = session.query(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id).first()
    if not stakeholder:
        return jsonify({"error": "Stakeholder non trouvé"}), 404
    return jsonify(stakeholder.to_dict()), 200

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['PUT'])
@with_db_session
def update_stakeholder(session, project_id, stakeholder_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = session.query(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id).first()
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
        session.commit()
        return jsonify(stakeholder.to_dict()), 200
    except IntegrityError:
        session.rollback()
        return jsonify({"error": "Erreur lors de la mise à jour du stakeholder"}), 500

@stakeholders_bp.route('/projects/<project_id>/stakeholders/<stakeholder_id>', methods=['DELETE'])
@with_db_session
def delete_stakeholder(session, project_id, stakeholder_id):
    project = session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    stakeholder = session.query(Stakeholder).filter_by(id=stakeholder_id, project_id=project_id).first()
    if not stakeholder:
        return jsonify({"error": "Stakeholder non trouvé"}), 404
    
    session.delete(stakeholder)
    session.commit()
    return jsonify({"message": "Stakeholder supprimé"}), 200
