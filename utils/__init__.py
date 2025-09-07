# utils/__init__.py - Initialisation du package utils - CORRIGÉ

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
try:
    from .fetchers import db_manager, fetch_unpaywall_pdf_url, fetch_article_details
except ImportError as e:
    print(f"Warning: Could not import fetchers: {e}")

try:
    from .ai_processors import call_ollama_api
except ImportError as e:
    print(f"Warning: Could not import ai_processors: {e}")

try:
    from .file_handlers import sanitize_filename, extract_text_from_pdf
except ImportError as e:
    print(f"Warning: Could not import file_handlers: {e}")

try:
    from .notifications import send_project_notification, send_global_notification
except ImportError as e:
    print(f"Warning: Could not import notifications: {e}")

try:
    from .helpers import http_get_with_retries, safe_json_loads, format_file_size
except ImportError as e:
    print(f"Warning: Could not import helpers: {e}")

try:
    from .prompt_templates import (
        get_screening_prompt_template,
        get_full_extraction_prompt_template,
        get_synthesis_prompt_template,
        get_rag_chat_prompt_template,
        get_effective_prompt_template,
    )
except ImportError as e:
    print(f"Warning: Could not import prompt_templates: {e}")

# Fallback functions pour éviter les erreurs d'import
def safe_fallback(*args, **kwargs):
    """Fonction de fallback pour éviter les erreurs d'import."""
    return None

# Créer des fallbacks si les imports échouent
if 'db_manager' not in globals():
    db_manager = type('DBManager', (), {
        'search_pubmed': safe_fallback,
        'search_arxiv': safe_fallback,
        'search_crossref': safe_fallback,
        'search_ieee': safe_fallback,
        'get_available_databases': lambda: []
    })()

if 'fetch_unpaywall_pdf_url' not in globals():
    fetch_unpaywall_pdf_url = safe_fallback

if 'fetch_article_details' not in globals():
    fetch_article_details = safe_fallback

if 'call_ollama_api' not in globals():
    call_ollama_api = safe_fallback

if 'sanitize_filename' not in globals():
    def sanitize_filename(filename):
        """Fallback pour sanitize_filename."""
        import re
        return re.sub(r'[<>:"/\\|?*]', '_', str(filename))

if 'extract_text_from_pdf' not in globals():
    extract_text_from_pdf = safe_fallback

if 'send_project_notification' not in globals():
    def send_project_notification(project_id, type, message, data=None):
        """Fallback pour send_project_notification."""
        print(f"Notification [{type}] for {project_id}: {message}")

if 'send_global_notification' not in globals():
    send_global_notification = safe_fallback

if 'http_get_with_retries' not in globals():
    http_get_with_retries = safe_fallback

if 'safe_json_loads' not in globals():
    def safe_json_loads(text, default=None):
        """Fallback pour safe_json_loads."""
        try:
            import json
            return json.loads(text)
        except:
            return default

if 'format_file_size' not in globals():
    def format_file_size(size):
        """Fallback pour format_file_size."""
        return f"{size} bytes"

# Fallbacks pour les prompt templates
if 'get_screening_prompt_template' not in globals():
    def get_screening_prompt_template():
        return """En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence.
Titre: {title}
Résumé: {abstract}
Source: {database_source}
Répondez UNIQUEMENT en JSON: {{"relevance_score": 0-10, "decision": "À inclure"|"À exclure", "justification": "..."}}"""

if 'get_full_extraction_prompt_template' not in globals():
    def get_full_extraction_prompt_template(fields):
        return """ROLE: Assistant expert. Répondez UNIQUEMENT avec un JSON valide.
TEXTE À ANALYSER:
---
{text}
---
SOURCE: {database_source}
Extrayez les informations selon cette grille et répondez en JSON."""

if 'get_synthesis_prompt_template' not in globals():
    def get_synthesis_prompt_template():
        return """Contexte: {project_description}
Résumés:
---
{data_for_prompt}
---
Rédigez une synthèse en JSON: {{"relevance_evaluation":[],"main_themes":[],"key_findings":[],"methodologies_used":[],"synthesis_summary":"","research_gaps":[]}}"""

if 'get_rag_chat_prompt_template' not in globals():
    def get_rag_chat_prompt_template():
        return """En te basant sur ces extraits de documents, réponds à la question:
Question: {question}
Contexte:
{context}
Réponds de façon concise et précise."""

if 'get_effective_prompt_template' not in globals():
    def get_effective_prompt_template(prompt_name, fallback_template):
        """Fallback pour get_effective_prompt_template."""
        return fallback_template
