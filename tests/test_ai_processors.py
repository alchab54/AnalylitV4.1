import pytest
from unittest.mock import MagicMock, patch, call
import requests
import json

# Mock the config_v4 module and its attributes
@pytest.fixture(autouse=True)
def mock_config():
    with patch('utils.ai_processors.config') as mock_config_obj:
        mock_config_obj.OLLAMA_BASE_URL = "http://mock-ollama:11434"
        mock_config_obj.REQUEST_TIMEOUT = 5
        yield mock_config_obj

# Import the function after config is potentially mocked
from utils.ai_processors import call_ollama_api, AIResponseError

@pytest.fixture
def mock_requests_session(mocker):
    """Fixture to mock requests.Session and its post method."""
    mock_session_instance = mocker.MagicMock()
    mocker.patch('utils.ai_processors.requests.Session', return_value=mock_session_instance)
    mocker.patch('utils.ai_processors.requests_session_with_retries', return_value=mock_session_instance)
    return mock_session_instance

def test_call_ollama_api_text_output_success(mock_requests_session):
    """Test successful call to Ollama API for text output."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": "This is a test response.", "done": True}
    mock_response.raise_for_status.return_value = None
    mock_requests_session.post.return_value = mock_response

    prompt = "Hello, AI!"
    model = "test-model"
    result = call_ollama_api(prompt, model=model, output_format="text")

    assert result == "This is a test response."
    mock_requests_session.post.assert_called_once_with(
        "http://mock-ollama:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 1024,
                "stop": ["\n\n\n", "```"]
            }
        },
        timeout=5
    )

def test_call_ollama_api_json_output_success(mock_requests_session):
    """Test successful call to Ollama API for JSON output."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": "```json\n{\"key\": \"value\"}\n```", "done": True}
    mock_response.raise_for_status.return_value = None
    mock_requests_session.post.return_value = mock_response

    prompt = "Generate JSON."
    model = "test-model"
    result = call_ollama_api(prompt, model=model, output_format="json")

    assert result == {"key": "value"}
    mock_requests_session.post.assert_called_once_with(
        "http://mock-ollama:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt + "\n\nRépondez UNIQUEMENT avec un JSON valide et complet:",
            "stream": False,
            "options": {
                "temperature": 0.2,
                "top_p": 0.9,
                "num_predict": 1024,
                "stop": ["\n\n\n", "```"]
            },
            "format": "json"
        },
        timeout=5
    )

def test_call_ollama_api_request_exception(mock_requests_session):
    """Test call to Ollama API raising RequestException."""
    mock_requests_session.post.side_effect = requests.exceptions.RequestException("Network error")

    prompt = "Test exception."
    with pytest.raises(AIResponseError, match="Erreur de communication avec le service Ollama."):
        call_ollama_api(prompt)
    mock_requests_session.post.assert_called_once()

def test_call_ollama_api_http_error(mock_requests_session):
    """Test call to Ollama API returning non-200 HTTP status."""
    mock_response = MagicMock()
    mock_response.status_code = 500
    mock_response.raise_for_status.side_effect = requests.exceptions.HTTPError("Server error")
    mock_requests_session.post.return_value = mock_response

    prompt = "Test HTTP error."
    with pytest.raises(AIResponseError, match="Erreur de communication avec le service Ollama."):
        call_ollama_api(prompt)
    mock_requests_session.post.assert_called_once()
    mock_response.raise_for_status.assert_called_once()

def test_call_ollama_api_malformed_json_cleanup_success(mock_requests_session, mocker):
    """Test malformed JSON response with successful cleanup."""
    # First response: malformed JSON
    mock_response_malformed = MagicMock()
    mock_response_malformed.status_code = 200
    mock_response_malformed.json.return_value = {"response": "This is not {valid json. It has extra text. {\"key\": \"value\"}", "done": True}
    mock_response_malformed.raise_for_status.return_value = None

    # Second response (for cleanup call): valid JSON
    mock_response_cleaned = MagicMock()
    mock_response_cleaned.status_code = 200
    mock_response_cleaned.json.return_value = {"response": "{\"key\": \"value\"}", "done": True}
    mock_response_cleaned.raise_for_status.return_value = None

    # Configure side_effect for post to return different responses for the initial call and the cleanup call
    mock_requests_session.post.side_effect = [mock_response_malformed, mock_response_cleaned]

    prompt = "Generate JSON."
    model = "test-model"
    result = call_ollama_api(prompt, model=model, output_format="json")

    assert result == {"key": "value"}
    assert mock_requests_session.post.call_count == 2
    # Verify the first call
    mock_requests_session.post.assert_has_calls([
        call(
            "http://mock-ollama:11434/api/generate",
            json={
                "model": model,
                "prompt": prompt + "\n\nRépondez UNIQUEMENT avec un JSON valide et complet:",
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "top_p": 0.9,
                    "num_predict": 1024,
                    "stop": ["\n\n\n", "```"]
                },
                "format": "json"
            },
            timeout=5
        ),
        # Verify the second call (cleanup)
        call(
            "http://mock-ollama:11434/api/generate",
            json={
                "model": "phi3:mini", # Cleanup model
                "prompt": mocker.ANY, # Prompt content will vary
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "top_p": 0.9,
                    "num_predict": 1024,
                    "stop": ["\n\n\n", "```"]
                }
            },
            timeout=5
        )
    ])

def test_call_ollama_api_malformed_json_cleanup_fails(mock_requests_session, mocker):
    """Test malformed JSON response where cleanup also fails."""
    # First response: malformed JSON
    mock_response_malformed = MagicMock()
    mock_response_malformed.status_code = 200
    mock_response_malformed.json.return_value = {"response": "This is not {valid json. It has extra text.", "done": True}
    mock_response_malformed.raise_for_status.return_value = None

    # Second response (for cleanup call): still malformed or raises error
    mock_response_cleanup_fail = MagicMock()
    mock_response_cleanup_fail.status_code = 200
    mock_response_cleanup_fail.json.return_value = {"response": "Still not valid json", "done": True}
    mock_response_cleanup_fail.raise_for_status.return_value = None

    mock_requests_session.post.side_effect = [mock_response_malformed, mock_response_cleanup_fail]

    prompt = "Generate JSON."
    model = "test-model"
    with pytest.raises(AIResponseError, match="La réponse de l'IA était un JSON invalide et n'a pas pu être nettoyée."):
        call_ollama_api(prompt, model=model, output_format="json")
    assert mock_requests_session.post.call_count == 2

def test_call_ollama_api_general_exception(mock_requests_session):
    """Test call to Ollama API raising a general unexpected exception."""
    mock_requests_session.post.side_effect = Exception("Unexpected error")

    prompt = "Test general exception."
    with pytest.raises(AIResponseError, match="Erreur inattendue:"):
        call_ollama_api(prompt)
    mock_requests_session.post.assert_called_once()

def test_call_ollama_api_empty_response(mock_requests_session):
    """Test call to Ollama API returning an empty response field."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {"response": "", "done": True}
    mock_response.raise_for_status.return_value = None
    mock_requests_session.post.return_value = mock_response

    prompt = "Empty response."
    model = "test-model"
    result = call_ollama_api(prompt, model=model, output_format="text")

    assert result == ""
    mock_requests_session.post.assert_called_once()
