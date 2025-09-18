from flask import Blueprint, request, jsonify
from utils.database import with_db_session
from tasks_v4_complete import run_extension_task
from utils.app_globals import extension_queue # Using extension_queue as suggested

extensions_bp = Blueprint('extensions', __name__, url_prefix='/api/extensions')

@extensions_bp.route('', methods=['POST'])
@with_db_session
def post_extension(session):
    data = request.get_json()
    project_id = data.get('project_id')
    extension_name = data.get('extension_name')
    if not project_id or not extension_name:
        return jsonify({'error': 'project_id et extension_name requis'}), 400

    # Enqueue la tâche d’extension
    job = extension_queue.enqueue(
        run_extension_task,
        project_id=project_id,
        extension_name=extension_name,
        job_timeout='30m'
    )
    return jsonify({'task_id': job.id, 'message': 'Extension lancée'}), 202
