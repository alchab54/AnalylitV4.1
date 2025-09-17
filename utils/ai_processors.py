# utils/ai_processors.py - Processeurs IA pour AnalyLit v4.1

import json
import logging
import time
import requests
from typing import Any
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# Import de la configuration de manière sécurisée
try:
    from config_v4 import get_config
    config = get_config()
except ImportError:
    # Fallback pour un contexte où le module config n'est pas dans le path
    class FallbackConfig:
        OLLAMA_BASE_URL = "http://localhost:11434"
        REQUEST_TIMEOUT = 900
    config = FallbackConfig()

logger = logging.getLogger(__name__)

class AIResponseError(Exception):
    """Exception personnalisée pour les erreurs de réponse de l'IA."""

def requests_session_with_retries():
    """Crée une session requests avec une stratégie de retry."""
    session = requests.Session()
    # Stratégie de retry: 3 essais, avec un délai qui augmente (0.5s, 1s, 2s)
    # et on réessaie sur les erreurs serveur (5xx)
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[500, 502, 503, 504])
    session.mount('http://', HTTPAdapter(max_retries=retries))
    return session

def call_ollama_api(prompt: str, model: str = "llama3.1:8b", output_format: str = "text", temperature: float = 0.2) -> Any:
    """
    Appelle l'API Ollama avec le prompt fourni.
    
    Args:
        prompt: Le prompt à envoyer au modèle.
        model: Le nom du modèle Ollama à utiliser.
        output_format: "text" ou "json" selon le format de réponse attendu.
        temperature: La température du modèle pour contrôler la créativité.
        
    Returns:
        La réponse du modèle (str si text, dict si json).
    """
    try:
        url = f"{config.OLLAMA_BASE_URL}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "top_p": 0.9,
                "num_predict": 1024, # CORRECTION: Augmentation pour les extractions complexes
                "stop": ["\n\n\n", "```"]  # CORRECTION: Patterns d'arrêt plus robustes
            }
        }
        
        session = requests_session_with_retries()

        if output_format == "json":
            payload["format"] = "json"
            payload["prompt"] = prompt + "\n\nRépondez UNIQUEMENT avec un JSON valide et complet:"
            
        response = session.post(url, json=payload, timeout=config.REQUEST_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        raw_response = result.get("response", "").strip()
        
        if output_format == "json":
            try:
                # CORRECTION: Nettoyage plus robuste de la réponse avant parsing
                start = raw_response.find('{')
                end = raw_response.rfind('}')
                if start != -1 and end != -1:
                    json_str = raw_response[start:end+1]
                    return json.loads(json_str)
                raise json.JSONDecodeError("Marqueurs JSON non trouvés", raw_response, 0)
            except json.JSONDecodeError:
                logger.warning(f"Réponse IA non-JSON valide: {raw_response[:200]}...")
                try:
                    cleanup_prompt = f"Extrais UNIQUEMENT l'objet JSON valide du texte suivant. Ne fournis rien d'autre.\n\n{raw_response}"
                    cleaned_response = call_ollama_api(cleanup_prompt, model="phi3:mini", output_format="text")
                    return json.loads(cleaned_response)
                except Exception as cleanup_error:
                    logger.error(f"Échec de la tentative de nettoyage du JSON: {cleanup_error}")
                    raise AIResponseError("La réponse de l'IA était un JSON invalide et n'a pas pu être nettoyée.")
        else:
            return raw_response
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Erreur de communication avec Ollama: {e}")
        raise AIResponseError("Erreur de communication avec le service Ollama.") from e
    except Exception as e:
        logger.error(f"Erreur inattendue dans call_ollama_api: {e}", exc_info=True)
        raise AIResponseError(f"Erreur inattendue: {str(e)}") from e
