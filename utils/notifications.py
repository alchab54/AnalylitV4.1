"""
Utilitaire pour l'envoi de notifications via Redis pub/sub et les logs
"""
import logging
import json
import sys
import os

# ✅ CORRECTION : S'assurer que le chemin est correct
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from redis import Redis
try:
    from backend.config.config_v4 import get_config
except ImportError:
    # Fallback pour Alembic qui n'a pas accès au module backend
    def get_config():
        class MockConfig:
            REDIS_URL = "redis://localhost:6379/0"
        return MockConfig()

logger = logging.getLogger(__name__)
config = get_config()
REDIS_CHANNEL = "analylit_notifications"

# Connexion "lazy" : initialisée à None
_redis_conn = None

def get_redis_connection():
    """
    Fonction lazy loader pour la connexion Redis.
    Crée la connexion si elle n'existe pas, sinon la réutilise.
    Permet aux mocks Pytest de fonctionner correctement.
    """
    global _redis_conn
    if _redis_conn is None:
        try:
            _redis_conn = redis.from_url(config.REDIS_URL)
            # Teste la connexion
            _redis_conn.ping() 
            logger.info("Connexion Redis pour notifications établie.")
        except Exception as e:
            logger.error(f"Impossible de se connecter à Redis pour les notifications: {e}")
            # Reste None, la publication échouera gracieusement
            _redis_conn = None 
    return _redis_conn

def _publish_notification(payload: Dict[str, Any]):
    """Publie une notification sur le canal Redis."""
    # Récupère la connexion (ou tente de la créer)
    conn = get_redis_connection()
    
    if conn: # Vérifie si la connexion a réussi
        try:
            conn.publish(REDIS_CHANNEL, json.dumps(payload))
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