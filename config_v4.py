# AnalyLit V4.1 - Configuration centrale

import os
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class Config:
    """Configuration pour AnalyLit V4.1"""
    
    # Version de l'application
    ANALYLIT_VERSION: str = "4.1.0"
    
    # Configuration Redis
    REDIS_URL: str = os.getenv('REDIS_URL', 'redis://redis:6379/0')
    
    # Configuration Ollama
    OLLAMA_BASE_URL: str = os.getenv('OLLAMA_BASE_URL', 'http://ollama:11434')
    
    # Configuration base de données (PostgreSQL)
    DATABASE_URL: str = os.getenv('DATABASE_URL', 'postgresql+psycopg2://analylit_user:strong_password@db:5432/analylit_db')
    PROJECTS_DIR: Path = Path("/app/projects")
    
    # Configuration Flask
    SECRET_KEY: str = os.getenv('SECRET_KEY', 'your-super-secret-key-change-this-in-production')
    
    # Configuration timeouts
    REQUEST_TIMEOUT: int = 900  # 15 minutes
    JOB_TIMEOUT: int = 3600     # 1 heure
    WEBSOCKET_PING_INTERVAL: int = 25
    WEBSOCKET_PING_TIMEOUT: int = 60
    
    # Configuration logging
    LOG_LEVEL: str = os.getenv('LOG_LEVEL', 'INFO')
    
    # Configuration sécurité
    ALLOWED_EXTENSIONS: set = field(default_factory=lambda: {'pdf', 'json'})
    MAX_CONTENT_LENGTH: int = 16 * 1024 * 1024  # 16MB
    
    # Configuration APIs externes
    UNPAYWALL_EMAIL: str = os.getenv('UNPAYWALL_EMAIL', 'researcher@analylit.com')
    MAX_RETRIES: int = int(os.getenv('HTTP_MAX_RETRIES', '3'))
    
    # Configuration embedding et indexation
    EMBEDDING_MODEL: str = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
    CHUNK_SIZE: int = int(os.getenv('CHUNK_SIZE', '1000'))
    CHUNK_OVERLAP: int = int(os.getenv('CHUNK_OVERLAP', '200'))
    
    # Configuration bases de données externes
    IEEE_API_KEY: str = os.getenv('IEEE_API_KEY', '')
    CROSSREF_EMAIL: str = os.getenv('CROSSREF_EMAIL', 'researcher@analylit.com')
    MAX_PDF_SIZE: int = 50 * 1024 * 1024  # Exemple: 50MB

def get_config() -> Config:
    """Retourne une instance de configuration"""
    return Config()
