import os
import pytest
import json

# Définir environnement de test avant tout import
os.environ.setdefault("TESTING", "true")
os.environ.setdefault("FLASK_ENV", "testing")
os.environ.setdefault("DATABASE_URL", "postgresql://analylit:password@analylit-db-v4:5432/analylit_db")

from utils.database import engine, Base, get_session

@pytest.fixture(scope="session", autouse=True)
def init_test_db():
    # Créer un schéma si mappé, pas de seed
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def db_session():
    session = get_session()
    try:
        yield session
        session.commit()
    finally:
        session.rollback()
        session.close()

@pytest.fixture(scope="function", autouse=False)
def clean_db(db_session):
    # Vide les tables entre tests
    for table in reversed(Base.metadata.sorted_tables):
        db_session.execute(table.delete())
        db_session.commit()
    yield

# Ajout des fixtures manquantes pour les tests API
@pytest.fixture(scope="session")
def app():
    """Créer une instance de l'application Flask pour les tests."""
    from server_v4_complete import create_app
    
    app_instance = create_app()
    app_instance.config.update({
        "TESTING": True,
        "WTF_CSRF_ENABLED": False
    })
    
    with app_instance.app_context():
        yield app_instance

@pytest.fixture
def client(app):
    """Client de test Flask."""
    return app.test_client()

@pytest.fixture
def session(db_session):
    """Alias pour la session de base de données."""
    return db_session

@pytest.fixture
def setup_project(client, clean_db):
    """Fixture pour créer un projet de base et retourner son ID."""
    project_data = {
        'name': 'Projet de Test (Extensions)',
        'description': 'Description test.',
        'mode': 'screening'
    }
    response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    assert response.status_code == 201
    project_id = json.loads(response.data)['id']
    return {"project_id": project_id, "name": project_data['name']}
