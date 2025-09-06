# utils/__init__.py - Initialisation du package utils
"""
Package utils pour AnalyLit V4.1
Contient les modules utilitaires pour les fetchers, processors, handlers, etc.
"""

# Imports principaux pour faciliter l'utilisation
from .fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from .ai_processors import call_ollama_api, get_screening_prompt, get_full_extraction_prompt
from .file_handlers import sanitize_filename, extract_text_from_pdf
from .notifications import send_project_notification, send_global_notification
from .helpers import http_get_with_retries, safe_json_loads, format_file_size

__version__ = "4.1.0"
__author__ = "AnalyLit Team"

__all__ = [
    # Fetchers
    "db_manager",
    "fetch_unpaywall_pdf_url", 
    "fetch_article_details",
    
    # AI Processors
    "call_ollama_api",
    "get_screening_prompt",
    "get_full_extraction_prompt",
    
    # File Handlers
    "sanitize_filename",
    "extract_text_from_pdf",
    
    # Notifications
    "send_project_notification",
    "send_global_notification",
    
    # Helpers
    "http_get_with_retries",
    "safe_json_loads",
    "format_file_size"
]