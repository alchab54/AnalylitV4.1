# utils/ai_processors.py - Processeurs IA pour AnalyLit v4.1

import json
import logging
import requests
from typing import Any

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

def call_ollama_api(prompt: str, model: str = "llama3.1:8b", output_format: str = "text") -> Any:
    """
    Appelle l'API Ollama avec le prompt fourni.
    
    Args:
        prompt: Le prompt à envoyer au modèle.
        model: Le nom du modèle Ollama à utiliser.
        output_format: "text" ou "json" selon le format de réponse attendu.
        
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
                "temperature": 0.5,
                "top_p": 0.9,
            }
        }
        
        if output_format == "json":
            payload["format"] = "json"
        
        response = requests.post(url, json=payload, timeout=config.REQUEST_TIMEOUT)
        response.raise_for_status()
        
        result = response.json()
        raw_response = result.get("response", "").strip()
        
        if output_format == "json":
            try:
                return json.loads(raw_response)
            except json.JSONDecodeError:
                logger.warning(f"Réponse IA non-JSON valide: {raw_response[:200]}...")
                return {}
        else:
            return raw_response
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Erreur de communication avec Ollama: {e}")
        return {} if output_format == "json" else f"Erreur: Impossible de contacter le service Ollama."
    except Exception as e:
        logger.error(f"Erreur inattendue dans call_ollama_api: {e}", exc_info=True)
        return {} if output_format == "json" else f"Erreur inattendue: {str(e)}"

