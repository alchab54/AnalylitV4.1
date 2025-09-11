# tests/test_server_endpoints.py
import json
import uuid
from server_v4_complete import Project # Assurez-vous que le modèle Project est importable


def test_health_check(client):
    """
    GIVEN un client de test Flask
    WHEN la route '/api/health' est appelée en GET
    THEN vérifier que la réponse est 200 OK et contient le bon message.
    """
    response = client.get('/api/health')
    data = json.loads(response.data)

    assert response.status_code == 200
    assert data['status'] == 'ok'
    assert data['message'] == 'API is healthy'

def test_create_project(client):
    """
    GIVEN un client de test Flask
    WHEN la route '/api/projects' est appelée en POST avec des données valides
    THEN vérifier que la réponse est 201 Created et que le projet est en base de données.
    """
    # Définition des données du nouveau projet
    project_data = {
        'name': 'Mon Projet de Test',
        'description': 'Une description pour le test.',
        'model_profile': 'fast'
    }

    # Envoi de la requête POST
    response = client.post('/api/projects', data=json.dumps(project_data), content_type='application/json')
    
    # Vérification de la réponse HTTP
    assert response.status_code == 201
    response_data = json.loads(response.data)
    assert response_data['message'] == 'Projet créé avec succès'
    assert 'project_id' in response_data

    # Vérification en base de données (via le modèle SQLAlchemy)
    project_id = response_data['project_id']
    project_in_db = Project.query.get(project_id)
    assert project_in_db is not None
    assert project_in_db.name == 'Mon Projet de Test'