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

class AIResponseError(Exception):
    """Exception personnalisée pour les erreurs de réponse de l'IA."""

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
                "temperature": 0.2,  # CORRECTION: Température encore plus basse pour plus de déterminisme
                "top_p": 0.9,
                "num_predict": 1024, # CORRECTION: Augmentation pour les extractions complexes
                "stop": ["\n\n\n", "```"]  # CORRECTION: Patterns d'arrêt plus robustes
            }
        }
        
        if output_format == "json":
            payload["format"] = "json"
            # CORRECTION: Instructions explicites pour le JSON
            payload["prompt"] = prompt + "\n\nRépondez UNIQUEMENT avec un JSON valide et complet:"
            
        response = requests.post(url, json=payload, timeout=config.REQUEST_TIMEOUT)
        response.raise_for_status()
        result = response.json()
        raw_response = result.get("response", "").strip()
        
        if output_format == "json":
            try:
                # CORRECTION: Nettoyage plus robuste de la réponse avant parsing
                # Trouve le premier '{' et le dernier '}' pour extraire le JSON potentiel
                start = raw_response.find('{')
                end = raw_response.rfind('}')
                if start != -1 and end != -1:
                    json_str = raw_response[start:end+1]
                    return json.loads(json_str)
                raise json.JSONDecodeError("Marqueurs JSON non trouvés", raw_response, 0)
            except json.JSONDecodeError as e:
                logger.warning(f"Réponse IA non-JSON valide: {raw_response[:200]}...")
                # CORRECTION: Fallback plus robuste
                return {
                    "relevance_score": 5,
                    "decision": "À exclure",
                    "justification": "Erreur de parsing de la réponse IA - article écarté par sécurité"
                }
                logger.info("Utilisation de la réponse fallback pour éviter l'échec complet")
        else:
            return raw_response
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Erreur de communication avec Ollama: {e}")
        raise AIResponseError("Erreur de communication avec le service Ollama.") from e
    except Exception as e:
        logger.error(f"Erreur inattendue dans call_ollama_api: {e}", exc_info=True)
        raise AIResponseError(f"Erreur inattendue: {str(e)}") from e
