# AnalyLit V4.0 - Configuration centrale
import os
from dataclasses import dataclass
from pathlib import Path

@dataclass
class Config
    Configuration pour AnalyLit V4.0
    
    # Version de l'application
    ANALYLIT_VERSION = 4.0.0
    
    # Configuration Redis
    REDIS_URL = os.getenv('REDIS_URL', 'redislocalhost63790')
    
    # Configuration Ollama
    OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'httplocalhost11434')
    
    # Configuration base de données
    DATABASE_PATH = appprojectsdatabase.db
    PROJECTS_DIR = Path(appprojects)
    
    # Configuration Flask
    SECRET_KEY = os.getenv('SECRET_KEY', 'your-super-secret-key-change-this-in-production')
    
    # Configuration des modèles par défaut
    DEFAULT_MODELS = {
        'fast' {
            'preprocess' 'gemma2b',
            'extract' 'phi3mini', 
            'synthesis' 'llama3.18b'
        },
        'standard' {
            'preprocess' 'phi3mini',
            'extract' 'llama3.18b',
            'synthesis' 'llama3.18b'
        },
        'deep' {
            'preprocess' 'llama3.18b', 
            'extract' 'mixtral8x7b',
            'synthesis' 'llama3.170b'
        }
    }
    
    # Configuration timeouts
    REQUEST_TIMEOUT = 900  # 15 minutes
    JOB_TIMEOUT = 3600    # 1 heure
    
    # Configuration logging
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    
    # Configuration sécurité
    ALLOWED_EXTENSIONS = {'pdf', 'json'}
    MAX_CONTENT_LENGTH = 16  1024  1024  # 16MB
    
    # Configuration APIs externes
    UNPAYWALL_EMAIL = os.getenv('UNPAYWALL_EMAIL', 'researcher@analylit.com')
    MAX_RETRIES = int(os.getenv('HTTP_MAX_RETRIES', '3'))
    
    # Configuration embedding et indexation
    EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '1000'))
    CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '200'))
    
    # Configuration bases de données externes
    IEEE_API_KEY = os.getenv('IEEE_API_KEY', '')
    CROSSREF_EMAIL = os.getenv('CROSSREF_EMAIL', 'researcher@analylit.com')
    
    def get_database_config(self)
        Configuration des bases de données externes
        return {
            'ieee' {
                'enabled' bool(self.IEEE_API_KEY),
                'api_key' self.IEEE_API_KEY
            },
            'crossref' {
                'email' self.CROSSREF_EMAIL
            },
            'unpaywall' {
                'email' self.UNPAYWALL_EMAIL
            }
        }

def get_config() - Config
    Retourne une instance de configuration
    return Config()
