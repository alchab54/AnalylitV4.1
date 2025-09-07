# utils/notifications.py - Système de notifications (corrigé)

import logging
from typing import Dict, Any, Optional
from datetime import datetime
from flask_socketio import SocketIO
from config_v4 import get_config

logger = logging.getLogger(__name__)

config = get_config()
socketio_worker = SocketIO(message_queue=config.REDIS_URL)

def send_project_notification(project_id: str, notification_type: str, message: str, data: Optional[Dict[str, Any]] = None):
    """Envoie une notification pour un projet via WebSocket."""
    try:
        notification_data: Dict[str, Any] = {
            "type": notification_type,
            "project_id": project_id,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }
        if data:
            notification_data.update(data)
        socketio_worker.emit('notification', notification_data, room=project_id, namespace='/')
        logger.info(f"Notification envoyée pour projet {project_id}: {notification_type}")
    except Exception as e:
        logger.error(f"Erreur envoi notification pour projet {project_id}: {e}")

def send_global_notification(notification_type: str, message: str, data: Optional[Dict[str, Any]] = None):
    """Envoie une notification globale à tous les clients connectés."""
    try:
        notification_data: Dict[str, Any] = {
            "type": notification_type,
            "message": message,
            "timestamp": datetime.now().isoformat(),
        }
        if data:
            notification_data.update(data)
        socketio_worker.emit('notification', notification_data, broadcast=True, namespace='/')
        logger.info(f"Notification globale envoyée: {notification_type}")
    except Exception as e:
        logger.error(f"Erreur envoi notification globale: {e}")
