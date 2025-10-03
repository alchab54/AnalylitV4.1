# api/reporting.py

import logging
import json
from flask import Blueprint, jsonify, request, send_file
from utils.extensions import db
from utils.models import Project
from utils.app_globals import background_queue
from backend.tasks_v4_complete import (
    generate_bibliography_task,
    generate_summary_table_task,
    export_excel_report_task
)

reporting_bp = Blueprint('reporting_bp', __name__)
logger = logging.getLogger(__name__)

@reporting_bp.route('/projects/<project_id>/reports/bibliography', methods=['POST'])
def generate_bibliography(project_id):
    """
    Génère une bibliographie pour le projet spécifié.
    Peut enfiler une tâche de fond si la génération est complexe.
    """
    project = db.session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    # Enfiler une tâche de fond pour la génération de la bibliographie
    job = background_queue.enqueue(generate_bibliography_task, project_id=project_id, job_timeout='10m')
    return jsonify({"message": "Génération de la bibliographie lancée", "job_id": job.id}), 202

@reporting_bp.route('/projects/<project_id>/reports/summary-table', methods=['POST'])
def generate_summary_table(project_id):
    """    Génère les données pour un tableau de synthèse pour le projet spécifié.
    Peut enfiler une tâche de fond si la génération est complexe.
    """
    project = db.session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    # Enfiler une tâche de fond pour la génération du tableau de synthèse
    job = background_queue.enqueue(generate_summary_table_task, project_id=project_id, job_timeout='10m')
    return jsonify({"message": "Génération du tableau de synthèse lancée", "job_id": job.id}), 202

@reporting_bp.route('/projects/<project_id>/reports/excel-export', methods=['POST'])
def export_summary_table_excel(project_id):
    """
    Exporte le tableau de synthèse du projet spécifié au format Excel.
    Peut enfiler une tâche de fond si l'export est complexe.
    """
    project = db.session.query(Project).filter_by(id=project_id).first()
    if not project:
        return jsonify({"error": "Projet non trouvé"}), 404

    # Enfiler une tâche de fond pour l'export Excel
    job = background_queue.enqueue(export_excel_report_task, project_id=project_id, job_timeout='10m')
    return jsonify({"message": "Export Excel lancé", "job_id": job.id}), 202
