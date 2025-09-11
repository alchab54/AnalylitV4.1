# tests/test_task_processing.py
import pytest
from unittest.mock import patch, MagicMock
import pandas as pd
from pathlib import Path

# Importez la fonction que vous voulez tester
# Le chemin d'importation dépend de la structure de votre projet
from tasks.processing import process_zotero_file
from server_v4_complete import SearchResult # Importez le modèle pour vérifier l'instanciation

@pytest.fixture
def mock_db_session():
    """Crée un faux objet de session de base de données."""
    with patch('tasks.processing.Session') as mock_session_class:
        mock_session = MagicMock()
        mock_session_class.return_value = mock_session
        yield mock_session

def test_process_zotero_file_success(mock_db_session, tmp_path):
    """
    GIVEN un fichier CSV Zotero valide et un ID de projet
    WHEN la fonction process_zotero_file est appelée
    THEN vérifier qu'elle lit le fichier et insère les données en base.
    """
    # 1. Préparation (Arrange)
    project_id = "a-fake-project-id"
    # Crée un faux fichier CSV dans un dossier temporaire
    file_path = tmp_path / "zotero_export.csv"
    csv_content = "Title,Author,Abstract\nTest Article,Doe J.,An abstract."
    file_path.write_text(csv_content)

    # 2. Action (Act)
    # On appelle la fonction directement, pas via RQ
    process_zotero_file(str(file_path), project_id)

    # 3. Vérification (Assert)
    # Vérifie que la session a été utilisée pour ajouter des objets
    mock_db_session.add_all.assert_called_once()
    # Vérifie que la session a été "commit"
    mock_db_session.commit.assert_called_once()

    # Inspection plus détaillée de ce qui a été passé à add_all
    # Cela rend le test beaucoup plus robuste
    call_args = mock_db_session.add_all.call_args[0][0] # Récupère la liste d'objets
    assert len(call_args) == 1
    added_object = call_args[0]
    assert isinstance(added_object, SearchResult)
    assert added_object.title == "Test Article"
    assert added_object.project_id == project_id