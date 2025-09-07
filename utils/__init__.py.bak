# utils/__init__.py - Initialisation du package utils

__all__ = [
    'db_manager', 'fetch_unpaywall_pdf_url', 'fetch_article_details',
    'call_ollama_api',
    'sanitize_filename', 'extract_text_from_pdf',
    'send_project_notification', 'send_global_notification',
    'http_get_with_retries', 'safe_json_loads', 'format_file_size',
    'get_screening_prompt_template', 'get_full_extraction_prompt_template',
    'get_synthesis_prompt_template', 'get_rag_chat_prompt_template',
    'get_effective_prompt_template'
]

# Imports pour faciliter l'accès depuis d'autres modules
from .fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from .ai_processors import call_ollama_api
from .file_handlers import sanitize_filename, extract_text_from_pdf
from .notifications import send_project_notification, send_global_notification
from .helpers import http_get_with_retries, safe_json_loads, format_file_size
from .prompt_templates import (
    get_screening_prompt_template,
    get_full_extraction_prompt_template,
    get_synthesis_prompt_template,
    get_rag_chat_prompt_template,
    get_effective_prompt_template
)
