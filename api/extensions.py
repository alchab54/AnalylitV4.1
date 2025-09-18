from flask import Blueprint, request, jsonify
import logging
from utils.database import with_db_session
from utils.app_globals import extension_queue
from tasks_v4_complete import run_extension_task

logger = logging.getLogger(__name__)

extensions_bp = Blueprint("extensions", __name__, url_prefix="/api/extensions")

@extensions_bp.route("", methods=["POST"])
@with_db_session
def post_extension(session):
    data = request.get_json(silent=True) or {}
    project_id = data.get("project_id")
    extension_name = data.get("extension_name")

    if not project_id or not extension_name:
        logger.warning("Payload invalide: %s", data)
        return jsonify({"error": "project_id et extension_name requis"}), 400

    logger.info("Enqueue extension: project_id=%s, extension=%s", project_id, extension_name)
    job = extension_queue.enqueue(
        run_extension_task,
        project_id=project_id,
        extension_name=extension_name,
        job_timeout="30m",
        result_ttl=3600,
    )
    logger.info("Job enqueued: %s", job.id)
    return jsonify({"task_id": job.id, "message": "Extension lancée"}), 202
