# utils/notifications.py - Système de notifications (corrigé)

import logging
import json
from typing import Dict, Any, Optional
from datetime import datetime
import redis
from config_v4 import get_config

logger = logging.getLogger(__name__)
config = get_config()

# Se connecter directement à Redis
try:
    redis_conn = redis.from_url(config.REDIS_URL)
    REDIS_CHANNEL = "analylit_notifications"
except Exception as e:
    logger.error(f"Impossible de se connecter à Redis pour les notifications: {e}")
    redis_conn = None

def _publish_notification(payload: Dict[str, Any]):
    """Publie une notification sur le canal Redis."""
    if redis_conn:
        try:
            redis_conn.publish(REDIS_CHANNEL, json.dumps(payload))
        except Exception as e:
            logger.error(f"Erreur lors de la publication de la notification sur Redis: {e}")

def send_project_notification(project_id: str, notification_type: str, message: str, data: Optional[Dict[str, Any]] = None):
    """Envoie une notification pour un projet via WebSocket."""
    notification_data = {
        "type": notification_type,
        "project_id": project_id,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "is_global": False,
    }
    if data:
        notification_data.update(data)
    
    _publish_notification(notification_data)
    logger.info(f"Notification publiée pour projet {project_id}: {notification_type}")

def send_global_notification(notification_type: str, message: str, data: Optional[Dict[str, Any]] = None):
    """Envoie une notification globale à tous les clients connectés."""
    notification_data = {
        "type": notification_type,
        "message": message,
        "timestamp": datetime.now().isoformat(),
        "is_global": True,
    }
    if data:
        notification_data.update(data)
        
    _publish_notification(notification_data)
    logger.info(f"Notification globale publiée: {notification_type}")
