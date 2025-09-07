# utils/helpers.py - Fonctions utilitaires diverses (corrigé)

import logging
import requests
import time
from typing import Optional, Any
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)

def http_get_with_retries(url: str, timeout: int = 30, max_retries: int = 3) -> Optional[requests.Response]:
    """Effectue une requête GET avec retry automatique."""
    session = requests.Session()
    retry_strategy = Retry(
        total=max_retries,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
        backoff_factor=1,
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    try:
        response = session.get(url, timeout=timeout)
        response.raise_for_status()
        return response
    except Exception as e:
        logger.error(f"Erreur HTTP GET {url}: {e}")
        return None

def safe_json_loads(json_string: str, default: Any = None) -> Any:
    """Parse JSON de manière sécurisée avec fallback."""
    try:
        import json
        return json.loads(json_string)
    except Exception as e:
        logger.warning(f"Erreur parsing JSON: {e}")
        return default

def format_file_size(size_bytes: int) -> str:
    """Formate une taille de fichier de manière lisible."""
    if size_bytes == 0:
        return "0 B"
    size_names = ["B", "KB", "MB", "GB"]
    i = 0
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    return f"{size_bytes:.1f} {size_names[i]}"

def clean_text(text: str) -> str:
    """Nettoie et normalise du texte."""
    if not text:
        return ""
    import re
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def validate_email(email: str) -> bool:
    """Valide un format d'email basique."""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def calculate_processing_time(start_time: float) -> float:
    """Calcule le temps de traitement depuis start_time."""
    return time.time() - start_time

def truncate_text(text: str, max_length: int = 100, suffix: str = "...") -> str:
    """Tronque un texte à une longueur maximale."""
    if not text or len(text) <= max_length:
        return text
    return text[:max_length - len(suffix)] + suffix
