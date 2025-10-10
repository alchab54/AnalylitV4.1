# api/selection.py

from flask import Blueprint, request, jsonify
import logging
from utils.app_globals import analysis_queue


logger = logging.getLogger(__name__)

selection_bp = Blueprint("selection", __name__)

# In-memory database for the selection
# This is a temporary solution to make the feature operational without database changes.
selection_store = []

@selection_bp.route("/", methods=["GET"])
def get_selection():
    """Returns the list of selected items."""    
    return jsonify(selection_store)

@selection_bp.route("/add", methods=["POST"])
def add_to_selection():
    """Adds an item to the selection."""
    item = request.get_json()
    if not item or 'title' not in item:
        return jsonify({"error": "Invalid item"}), 400
    
    # Add a unique ID if it doesn't exist
    if 'id' not in item:
        item['id'] = len(selection_store) + 1
    
    # Default inclusion status
    item['included'] = False

    selection_store.append(item)
    logger.info(f"Added item to selection: {item['title']}")
    return jsonify(item), 201

@selection_bp.route("/toggle", methods=["POST"])
def toggle_selection():
    """Toggles the inclusion status of a selected item."""
    data = request.get_json()
    item_id = data.get('id')
    included = data.get('included')

    if item_id is None or included is None:
        return jsonify({"error": "Missing id or included status"}), 400

    for item in selection_store:
        # The ID from the frontend is a string from dataset, so we compare strings
        if str(item.get('id')) == str(item_id):
            item['included'] = bool(included)
            logger.info(f"Toggled selection for item {item_id} to {included}")
            return jsonify(item), 200

    return jsonify({"error": "Item not found"}), 404

@selection_bp.route('/run-screening', methods=['POST'])
def run_screening(project_id):
    """Lance le screening pour une liste d'articles."""
    data = request.get_json()
    articles = data.get('articles', [])
    profile_data = data.get('profile', {})

    if not articles:
        return jsonify({"error": "Liste d'articles vide"}), 400

    from backend.tasks_v4_complete import process_single_article_task
    task = import_queue.enqueue(
        process_single_article_task, # <-- Use the function object
        project_id=project_id,
        article_ids=articles,
        profile=profile_data
    )
    return jsonify({"message": "Tâche de screening lancée", "job_id": task.id}), 202

@selection_bp.route('/run-extraction', methods=['POST'])
def run_extraction(project_id):
    """Lance l'extraction pour une liste d'articles."""
    # TODO: Implement the logic to run the extraction task
    # This will likely involve enqueuing a task to a queue
    return jsonify({"message": "Extraction lancée (à implémenter)"}), 202
