# utils/ai_processors.py - Processeurs IA et prompts
import logging
import requests
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

def call_ollama_api(prompt: str, model: str, output_format: str = "text") -> Any:
    """Appelle l'API Ollama avec le prompt donné."""
    try:
        from config_v4 import get_config
        config = get_config()
        
        url = f"{config.OLLAMA_BASE_URL}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False
        }
        
        if output_format == "json":
            payload["format"] = "json"
        
        response = requests.post(url, json=payload, timeout=config.REQUEST_TIMEOUT)
        response.raise_for_status()
        
        data = response.json()
        response_text = data.get("response", "")
        
        if output_format == "json":
            try:
                return json.loads(response_text)
            except json.JSONDecodeError:
                logger.error(f"Réponse JSON invalide de Ollama: {response_text}")
                return {}
        
        return response_text
        
    except Exception as e:
        logger.error(f"Erreur call_ollama_api: {e}")
        if output_format == "json":
            return {}
        return f"Erreur: {str(e)}"

def get_screening_prompt(title: str, abstract: str, database_source: str) -> str:
    """Génère le prompt de screening."""
    return f"""En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.

Titre: {title}

Résumé: {abstract}

Source: {database_source}

Répondez UNIQUEMENT en JSON: {{"relevance_score": 0-10, "decision": "À inclure"|"À exclure", "justification": "..."}}"""

def get_full_extraction_prompt(text: str, database_source: str, custom_grid_id: str = None) -> str:
    """Génère le prompt d'extraction complète."""
    base_prompt = f"""ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.

TEXTE À ANALYSER:
---
{text}
---
SOURCE: {database_source}

Extractez les informations suivantes au format JSON:
"""

    if custom_grid_id:
        # Utiliser une grille personnalisée (à implémenter selon vos besoins)
        base_prompt += """
{
"type_etude": "...",
"population": "...", 
"intervention": "...",
"resultats_principaux": "...",
"limites": "...",
"methodologie": "..."
}"""
    else:
        # Grille par défaut
        base_prompt += """
{
"type_etude": "...",
"population": "...",
"intervention": "...",
"resultats_principaux": "...",
"limites": "...",
"methodologie": "..."
}"""
    
    return base_prompt