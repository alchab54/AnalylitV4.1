# config_v4.py
import os
import json
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Dict, Any, Optional
from pathlib import Path

def load_default_models() -> Dict[str, Any]:
    """Charge les profils de modèles depuis un fichier JSON externe."""
    try:
        # Le chemin est relatif à la racine de l'application dans le conteneur
        config_path = Path(__file__).parent / "profiles.json"
        with open(config_path, 'r', encoding='utf-8') as f:
            # CORRECTION : S'assurer que la fonction retourne un dictionnaire
            # comme l'indique son annotation de type `-> Dict[str, Any]`.
            # Si profiles.json contient une liste, on la transforme en dictionnaire.
            data = json.load(f)
            return {item['id']: item for item in data} if isinstance(data, list) else data
    except (FileNotFoundError, json.JSONDecodeError):
        # Fournit une configuration de secours si le fichier est manquant ou invalide
        print("WARNING: profiles.json not found or invalid. Using fallback default models.")
        return {
            'fast': {'preprocess': 'phi3:mini', 'extract': 'phi3:mini', 'synthesis': 'llama3.1:8b'},
            'standard': {'preprocess': 'phi3:mini', 'extract': 'llama3.1:8b', 'synthesis': 'llama3.1:8b'},
            'deep': {'preprocess': 'llama3.1:8b', 'extract': 'mixtral:8x7b', 'synthesis': 'llama3.1:70b'}
        }

class Settings(BaseSettings):
    """
    Classe de configuration de l'application utilisant Pydantic pour la validation.
    Charge les variables depuis un fichier .env et les variables d'environnement.
    """
    # Configuration pour Pydantic : lit le fichier .env, ignore les variables supplémentaires
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    # --- Paramètres de l'application ---
    ANALYLIT_VERSION: str = "4.1.0"
    SECRET_KEY: str
    LOG_LEVEL: str = 'INFO'
    
    # --- Connexions aux services externes ---
    REDIS_URL: str = 'redis://localhost:6379/0' # Valeur par défaut pour dev local, surchargée par Docker
    OLLAMA_BASE_URL: str = 'http://ollama:11434'
    DATABASE_URL: str = 'postgresql+psycopg2://analylit_user:strong_password@db:5432/analylit_db'
    
    # --- Chemins de fichiers ---
    
    # 1. Définir le chemin de base de l'application D'ABORD
    APP_BASE_DIR: Path = Path(__file__).parent 
    
    # 2. Définir tous les autres chemins EN UTILISANT cette variable
    PROJECTS_DIR: Path = APP_BASE_DIR / "projects"
    LOG_DIR: Path = APP_BASE_DIR / "logs"
    LOG_FILE: str = "analylit.log"
    
    # --- Paramètres de performance et de robustesse ---
    REQUEST_TIMEOUT: int = 900
    HTTP_MAX_RETRIES: int = 3
    
    # --- Configuration des Modèles IA ---
    # Chargé depuis profiles.json via la fonction `load_default_models`
    DEFAULT_MODELS: Dict[str, Any] = load_default_models()

    # --- Paramètres divers ---
    UNPAYWALL_EMAIL: str = 'researcher@analylit.com'

# --- Singleton pour l'instance de configuration ---
_config_instance: Optional[Settings] = None

def get_config() -> Settings:
    """
    Retourne une instance unique (singleton) de la configuration.
    Cela garantit que les paramètres sont chargés et validés une seule fois.
    """
    global _config_instance
    if _config_instance is None:
        _config_instance = Settings()
        # Créer le répertoire des projets s'il n'existe pas
        _config_instance.LOG_DIR.mkdir(parents=True, exist_ok=True)
        _config_instance.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
    return _config_instance
