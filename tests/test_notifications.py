import pytest
import json
import logging
import importlib
import redis # <-- AJOUT NÉCESSAIRE POUR CORRIGER 'NameError'
from unittest.mock import patch, MagicMock
import utils.notifications # Importer le module pour le patching

# Fixture pour mocker les dépendances (redis.from_url)
@pytest.fixture
def mock_notifications_module_dependencies(mocker):
    # Ciblez le 'redis.from_url' *tel qu'il est vu par le module notifications*
    mock_redis_conn = MagicMock()
    # Simulez que le 'ping' (dans get_redis_connection) fonctionne
    mock_redis_conn.ping.return_value = True 
    
    # Patch la fonction qui crée la connexion
    mocker.patch('utils.notifications.redis.from_url', return_value=mock_redis_conn)
    
    # Recharge le module pour qu'il utilise la connexion mockée lors de l'appel à get_redis_connection
    reloaded_notifications_module = importlib.reload(utils.notifications)
    
    yield mock_redis_conn, reloaded_notifications_module

# Test 1: Publication réussie (Corrigé pour utiliser le module rechargé)
def test_publish_notification_success(mock_notifications_module_dependencies):
    mock_redis_conn, notifications_module = mock_notifications_module_dependencies
    payload = {"key": "value"}
    
    notifications_module._publish_notification(payload)
    
    # Doit appeler 'publish' sur l'instance mockée
    mock_redis_conn.publish.assert_called_once_with(notifications_module.REDIS_CHANNEL, json.dumps(payload))

# Test 2: Gestion de l'échec de publication (Corrigé)
def test_publish_notification_publish_exception(mock_notifications_module_dependencies, caplog):
    mock_redis_conn, notifications_module = mock_notifications_module_dependencies
    mock_redis_conn.publish.side_effect = Exception("Publish error")
    payload = {"key": "value"}

    with caplog.at_level(logging.ERROR):
        notifications_module._publish_notification(payload)
        
    assert "Erreur lors de la publication de la notification sur Redis" in caplog.text

# Test 3: Connexion Redis échoue (Corrigé)
def test_publish_notification_redis_conn_none(mocker, caplog):
        """
        Si _redis_conn est None (échec de connexion au démarrage),
        _publish_notification ne doit rien faire et ne pas planter.
        """
        # ARRANGE
        mock_get_conn = mocker.patch('utils.notifications.get_redis_connection', return_value=None)

        # ACT: Recharge le module pour simuler un état de test propre 
        # --- SUPPRIMEZ OU COMMENDEZ LA LIGNE SUIVANTE : ---
        # notifications_module = importlib.reload(utils.notifications)

        with caplog.at_level(logging.ERROR):
            # --- APPELEZ LE MODULE IMPORTÉ DIRECTEMENT : ---
            utils.notifications._publish_notification({"key": "value"})

        # ASSERT
        assert "Erreur lors de la publication" not in caplog.text # Ne doit pas essayer de publier
        mock_get_conn.assert_called_once()
        
# Test 4: send_project_notification (Vérifie le wrapper)
def test_send_project_notification(mocker):
    mock_publish = mocker.patch('utils.notifications._publish_notification')
    
    utils.notifications.send_project_notification("proj123", "test_type", "Test msg", {"data": "info"})
    
    mock_publish.assert_called_once()
    args, _ = mock_publish.call_args
    payload = args[0]
    assert payload["project_id"] == "proj123"
    assert payload["message"] == "Test msg"
    assert payload["data"] == "info"
    assert payload["is_global"] is False

# Test 5: send_global_notification (Vérifie le wrapper)
def test_send_global_notification(mocker):
    mock_publish = mocker.patch('utils.notifications._publish_notification')
    
    utils.notifications.send_global_notification("global_type", "Global msg")
    
    mock_publish.assert_called_once()
    args, _ = mock_publish.call_args
    payload = args[0]
    assert payload["type"] == "global_type"
    assert payload["is_global"] is True

# Test 6: get_redis_connection (logique Lazy)
def test_get_redis_connection_lazy_loading(mocker):
    # Simule que _redis_conn est déjà défini
    utils.notifications._redis_conn = "Connexion Existante"
    mock_from_url = mocker.patch('utils.notifications.redis.from_url')
    
    conn = utils.notifications.get_redis_connection()
    
    assert conn == "Connexion Existante"
    mock_from_url.assert_not_called() # Ne doit pas créer une nouvelle connexion
    
    # Réinitialise pour le prochain test
    utils.notifications._redis_conn = None

# Test 7: get_redis_connection (gestion d'échec de ping)
def test_get_redis_connection_ping_fails(mocker, caplog):
    mock_conn = MagicMock()
    # Utilise l'import redis ajouté en haut
    mock_conn.ping.side_effect = redis.ConnectionError("Ping failed") 
    mocker.patch('utils.notifications.redis.from_url', return_value=mock_conn)
    utils.notifications._redis_conn = None # Force la réinitialisation
    
    with caplog.at_level(logging.ERROR):
        conn = utils.notifications.get_redis_connection()
        
    assert conn is None # Doit retourner None
    assert "Impossible de se connecter à Redis" in caplog.text
    assert "Ping failed" in caplog.text
    
    # Réinitialise pour le prochain test
    utils.notifications._redis_conn = None