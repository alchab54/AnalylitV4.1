# utils/__init__.py - Initialisation du package utils

__all__ = [
    # fetchers.py
    'db_manager', 'fetch_unpaywall_pdf_url', 'fetch_article_details',
    # ai_processors.py
    'call_ollama_api',
    # file_handlers.py
    'sanitize_filename', 'extract_text_from_pdf', 'ensure_directory_exists',
    # notifications.py
    'send_project_notification', 'send_global_notification',
    # helpers.py
    'http_get_with_retries', 'safe_json_loads', 'format_file_size',
    # prompt_templates.py
    'get_screening_prompt_template', 'get_full_extraction_prompt_template',
    'get_synthesis_prompt_template', 'get_rag_chat_prompt_template',
    'get_effective_prompt_template', 'get_scoping_atn_template',
    # analysis.py
    'generate_discussion_draft', 'generate_knowledge_graph_data', 'analyze_themes',
    # importers.py
    'ZoteroAbstractExtractor',
    # reporting.py
    'AdvancedPRISMAFlowExtractor',
    # prisma_scr.py
    'get_base_prisma_checklist', 'get_prisma_scr_completion_rate'
]

# Imports pour faciliter l'accès depuis d'autres modules
from .fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
from .ai_processors import call_ollama_api
from .file_handlers import sanitize_filename, extract_text_from_pdf, ensure_directory_exists
from .notifications import send_project_notification, send_global_notification
from .helpers import http_get_with_retries, safe_json_loads, format_file_size
from .prompt_templates import (
    get_screening_prompt_template,
    get_full_extraction_prompt_template,
    get_synthesis_prompt_template,
    get_rag_chat_prompt_template,
    get_effective_prompt_template,
    get_scoping_atn_template,
)
from .analysis import generate_discussion_draft, generate_knowledge_graph_data, analyze_themes
from .importers import ZoteroAbstractExtractor
# from .reporting import AdvancedPRISMAFlowExtractor
from .prisma_scr import get_base_prisma_checklist, get_prisma_scr_completion_rate
