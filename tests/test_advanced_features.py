# test_advanced_features.py (Corrected and Aligned with Code)
import pytest
from pytest_mock import MockerFixture
import requests
from backend.tasks_v4_complete import pull_ollama_model_task

@pytest.mark.gpu 
@pytest.mark.slow
def test_pull_ollama_model_task(mocker: MockerFixture):
    """
    Teste la tâche de téléchargement de modèle Ollama.
    Utilise un mock pour simuler l'appel réseau `requests.post`.
    """
    
    # 1. Mocker `requests.post` que la tâche appelle en interne.
    mock_post = mocker.patch('requests.post')
    
    # Simuler une réponse réussie
    mock_response = mocker.Mock()
    mock_response.raise_for_status.return_value = None
    mock_post.return_value = mock_response
    
    model_name = "llama3:latest"
    
    # 2. Exécuter la tâche
    # La tâche ne retourne rien en cas de succès, on vérifie juste qu'elle se termine.
    pull_ollama_model_task(model_name=model_name)
    
    # 3. Vérifier que l'appel a été fait correctement
    mock_post.assert_called_once()
    args, kwargs = mock_post.call_args
    assert "api/pull" in args[0]
    assert kwargs["json"]["name"] == model_name

@pytest.mark.gpu
def test_pull_ollama_model_task_failure(mocker: MockerFixture):
    """
    Teste l'échec de la tâche de téléchargement si `requests.post` lève une exception.
    """
    
    # 1. Mocker `requests.post` pour qu'il lève une exception
    error_message = "Connection refused"
    mocker.patch('requests.post', side_effect=requests.exceptions.RequestException(error_message))
    
    model_name = "model-inexistant"
    
    # 2. Exécuter la tâche et s'attendre à une exception
    with pytest.raises(Exception) as exc_info:
        pull_ollama_model_task(model_name=model_name)
        
    # 3. Vérifier que l'exception contient le bon message
    assert error_message in str(exc_info.value)