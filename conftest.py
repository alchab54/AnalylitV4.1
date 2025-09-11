# tests/conftest.py
import pytest
from server_v4_complete import app as flask_app, db

@pytest.fixture(scope='module')
def app():
    """
    Fixture qui configure l'application Flask pour les tests.
    """
    # Configure l'application pour le mode test
    flask_app.config.update({
        "TESTING": True,
        # Utilise une base de données en mémoire ou une base de données de test dédiée
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "WTF_CSRF_ENABLED": False, # Désactive le CSRF pour les tests de formulaire
    })

    with flask_app.app_context():
        db.create_all() # Crée les tables dans la base de données en mémoire
        yield flask_app
        db.drop_all() # Nettoie la base de données après les tests

@pytest.fixture()
def client(app):
    """
    Fixture qui fournit un client de test pour envoyer des requêtes HTTP.
    """
    return app.test_client()