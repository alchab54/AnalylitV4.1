# api/projects.py

import uuid
import json
import logging
import shutil
from datetime import datetime
from pathlib import Path

from flask import Blueprint, jsonify, request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from utils.app_globals import with_db_session, config, Session
from utils.models import Project, SearchResult, Extraction, Grid, Analysis
from utils.prisma_scr import get_base_prisma_checklist

logger = logging.getLogger(__name__)
projects_bp = Blueprint('projects_api', __name__)

@projects_bp.route('/projects', methods=['GET', 'POST'])
@with_db_session
def handle_projects(db_session=None):
    try:
        if request.method == 'GET':
            rows = db_session.execute(text("SELECT * FROM projects ORDER BY updated_at DESC")).mappings().all()
            return jsonify([dict(r) for r in rows])

        if request.method == 'POST':
            data = request.get_json(force=True)
            now = datetime.now().isoformat()
            project = {
                "id": str(uuid.uuid4()),
                "name": data['name'],
                "description": data.get('description', ''),
                "created_at": now,
                "updated_at": now,
                "analysis_mode": data.get('mode', 'screening')
            }

            db_session.execute(text("""
                INSERT INTO projects (id, name, description, created_at, updated_at, analysis_mode)
                VALUES (:id, :name, :description, :created_at, :updated_at, :analysis_mode)
            """), project)

            config.PROJECTS_DIR.joinpath(project['id']).mkdir(exist_ok=True)
            return jsonify(project), 201

    except Exception as e:
        logger.exception(f"Erreur handle_projects: {e}")
        return jsonify({'error': 'Erreur interne'}), 500

@projects_bp.route('/projects/<project_id>', methods=['DELETE'])
@with_db_session
def delete_project(project_id, db_session=None):
    """Supprime un projet et ses données associées."""
    try:
        project = db_session.get(Project, project_id)
        if not project:
            return jsonify({"error": "Projet non trouvé"}), 404

        project_path = Path(config.PROJECTS_DIR) / str(project_id)
        if project_path.exists() and project_path.is_dir():
            shutil.rmtree(project_path)
            
        db_session.query(SearchResult).filter(SearchResult.project_id == project_id).delete(synchronize_session=False)
        db_session.query(Extraction).filter(Extraction.project_id == project_id).delete(synchronize_session=False)
        db_session.query(Grid).filter(Grid.project_id == project_id).delete(synchronize_session=False)
        db_session.query(Analysis).filter(Analysis.project_id == project_id).delete(synchronize_session=False)

        db_session.delete(project)

        logger.info(f"Projet {project_id} supprimé avec succès.")
        return jsonify({"message": "Projet supprimé"})

    except SQLAlchemyError as e:
        db_session.rollback()
        logger.exception(f"Erreur DB lors de la suppression du projet {project_id}: {e}")
        return jsonify({"error": "Erreur base de données"}), 500
    except Exception as e:
        db_session.rollback()
        logger.exception(f"Erreur inattendue lors de la suppression du projet {project_id}: {e}")
        return jsonify({"error": "Erreur interne du serveur"}), 500

@projects_bp.route('/projects/<project_id>/prisma-checklist', methods=['GET', 'POST'])
@with_db_session
def handle_prisma_checklist(db_session, project_id):
    """Gère la checklist PRISMA-ScR du projet."""
    project = db_session.get(Project, project_id)
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    if request.method == 'GET':
        if project.prisma_checklist:
            try:
                return jsonify(json.loads(project.prisma_checklist))
            except json.JSONDecodeError:
                pass
        return jsonify(get_base_prisma_checklist())

    elif request.method == 'POST':
        data = request.get_json(force=True)
        payload_data = data.get('checklist', {})
        if 'title' not in payload_data or 'sections' not in payload_data:
            return jsonify({"error": "Structure de checklist invalide"}), 400
        project.prisma_checklist = json.dumps(payload_data)
        project.updated_at = datetime.now()
        return jsonify({"message": "Checklist PRISMA-ScR sauvegardée"}), 200

@projects_bp.route('/projects/<project_id>', methods=['GET'])
@with_db_session
def get_project_details(project_id, db_session=None):
    """Récupère les détails d'un seul projet par ID."""
    try:
        # Valide l'UUID pour la sécurité
        uuid.UUID(project_id, version=4)
        project = db_session.get(Project, project_id)
        
        if not project:
            return jsonify({'error': 'Projet non trouvé'}), 404
            
        return jsonify(project.to_dict()), 200
        
    except ValueError:
        return jsonify({'error': 'ID de projet invalide'}), 400
    except Exception as e:
        logger.exception(f"Erreur get_project_details: {e}")
        return jsonify({'error': 'Erreur interne'}), 500