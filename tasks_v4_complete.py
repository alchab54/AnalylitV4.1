# AnalyLit V4.0 - Tâches de traitement et d'analyse COMPLÈTES

import requests
import json
import time
import re
import sqlite3
import subprocess
import uuid
from pathlib import Path
from datetime import datetime
from urllib.parse import urljoin, quote
import bs4
from rq import Queue
import redis
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import stats
import numpy as np
import pandas as pd
import matplotlib.ticker as mticker
import PyPDF2
from pyzotero import zotero
from config_v4 import get_config
from langchain.text_splitter import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb
from chromadb.utils import embedding_functions
from flask_socketio import SocketIO
import random
import hashlib
import xml.etree.ElementTree as ET
import arxiv
import crossref_commons.retrieval as cr
import os

# Configuration
config = get_config()
redis_conn = redis.from_url(config.REDIS_URL)

PROJECTS_DIR = config.PROJECTS_DIR
DATABASE_FILE = PROJECTS_DIR / "database.db"

# Models
embedding_model = SentenceTransformer(config.EMBEDDING_MODEL)

# Variables d'environnement pour la robustesse API
UNPAYWALL_EMAIL = config.UNPAYWALL_EMAIL
HTTP_MAX_RETRIES = config.MAX_RETRIES
HTTP_BACKOFF_BASE = 1.6
MIN_CHUNK_LEN = 250
NORMALIZE_LOWER = False
EMBED_BATCH = 32
USE_QUERY_EMBED = True
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://ollama:11434")

class DatabaseManager:
    """Gestionnaire centralisé pour les requêtes multi-bases de données."""
    
    def __init__(self):
        self.config = config.get_database_config()
    
    def get_available_databases(self):
        """Retourne la liste des bases de données disponibles."""
        databases = []
        
        # PubMed (toujours disponible)
        databases.append({
            'id': 'pubmed',
            'name': 'PubMed',
            'description': 'Base de données biomédicale de référence',
            'enabled': True,
            'type': 'biomedical'
        })
        
        # ArXiv (toujours disponible)
        databases.append({
            'id': 'arxiv',
            'name': 'arXiv',
            'description': 'Articles de pré-publication scientifique',
            'enabled': True,
            'type': 'preprint'
        })
        
        # CrossRef (toujours disponible)
        databases.append({
            'id': 'crossref',
            'name': 'CrossRef',
            'description': 'Métadonnées d\'articles académiques',
            'enabled': True,
            'type': 'metadata'
        })
        
        # IEEE (si clé API configurée)
        if self.config['ieee']['enabled']:
            databases.append({
                'id': 'ieee',
                'name': 'IEEE Xplore',
                'description': 'Articles d\'ingénierie et technologie',
                'enabled': True,
                'type': 'technical'
            })
        
        return databases
    
    def search_pubmed(self, query, max_results=50):
        """Recherche dans PubMed."""
        results = []
        
        try:
            # Recherche avec E-utilities
            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_params = {
                'db': 'pubmed',
                'term': query,
                'retmax': max_results,
                'retmode': 'json'
            }
            
            response = requests.get(search_url, params=search_params, timeout=30)
            response.raise_for_status()
            
            search_data = response.json()
            pmids = search_data.get('esearchresult', {}).get('idlist', [])
            
            if not pmids:
                return results
            
            # Récupérer les détails
            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {
                'db': 'pubmed',
                'id': ','.join(pmids),
                'retmode': 'xml'
            }
            
            response = requests.get(fetch_url, params=fetch_params, timeout=30)
            response.raise_for_status()
            
            # Parser le XML
            root = ET.fromstring(response.text)
            
            for article in root.iter('PubmedArticle'):
                try:
                    # PMID
                    pmid_elem = article.find('.//PMID')
                    pmid = pmid_elem.text if pmid_elem is not None else ''
                    
                    # Titre
                    title_elem = article.find('.//ArticleTitle')
                    title = title_elem.text if title_elem is not None else ''
                    
                    # Abstract
                    abstract_elem = article.find('.//AbstractText')
                    abstract = abstract_elem.text if abstract_elem is not None else ''
                    
                    # Auteurs
                    authors = []
                    for author in article.iter('Author'):
                        lastname = author.find('LastName')
                        forename = author.find('ForeName')
                        if lastname is not None and forename is not None:
                            authors.append(f"{forename.text} {lastname.text}")
                    
                    # Journal
                    journal_elem = article.find('.//Journal/Title')
                    journal = journal_elem.text if journal_elem is not None else ''
                    
                    # Date de publication
                    pub_date = article.find('.//PubDate/Year')
                    publication_date = pub_date.text if pub_date is not None else ''
                    
                    # DOI
                    doi = ''
                    for article_id in article.iter('ArticleId'):
                        if article_id.get('IdType') == 'doi':
                            doi = article_id.text
                            break
                    
                    results.append({
                        'id': pmid,
                        'title': title,
                        'abstract': abstract,
                        'authors': '; '.join(authors),
                        'publication_date': publication_date,
                        'journal': journal,
                        'doi': doi,
                        'url': f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                        'database_source': 'pubmed'
                    })
                    
                except Exception as e:
                    print(f"Erreur parsing article PubMed: {e}")
                    continue
        
        except Exception as e:
            print(f"Erreur recherche PubMed: {e}")
        
        return results
    
    def search_arxiv(self, query, max_results=50):
        """Recherche dans arXiv."""
        results = []
        
        try:
            client = arxiv.Client()
            search = arxiv.Search(
                query=query,
                max_results=max_results,
                sort_by=arxiv.SortCriterion.Relevance
            )
            
            for paper in client.results(search):
                results.append({
                    'id': paper.entry_id.split('/')[-1],
                    'title': paper.title,
                    'abstract': paper.summary,
                    'authors': '; '.join([str(author) for author in paper.authors]),
                    'publication_date': paper.published.strftime('%Y-%m-%d') if paper.published else '',
                    'journal': ', '.join(paper.categories),
                    'doi': paper.doi or '',
                    'url': paper.entry_id,
                    'database_source': 'arxiv'
                })
        
        except Exception as e:
            print(f"Erreur recherche arXiv: {e}")
        
        return results
    
    def search_crossref(self, query, max_results=50):
        """Recherche dans CrossRef."""
        results = []
        
        try:
            url = "https://api.crossref.org/works"
            params = {
                'query': query,
                'rows': max_results,
                'mailto': self.config['crossref']['email']
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            items = data.get('message', {}).get('items', [])
            
            for item in items:
                # Titre
                title = ''
                if 'title' in item and item['title']:
                    title = item['title'][0]
                
                # Auteurs
                authors = []
                if 'author' in item:
                    for author in item['author']:
                        given = author.get('given', '')
                        family = author.get('family', '')
                        if given and family:
                            authors.append(f"{given} {family}")
                
                # Journal
                journal = ''
                if 'container-title' in item and item['container-title']:
                    journal = item['container-title'][0]
                
                # Date de publication
                publication_date = ''
                if 'published-print' in item:
                    date_parts = item['published-print'].get('date-parts', [[]])[0]
                    if date_parts:
                        publication_date = f"{date_parts[0]}"
                        if len(date_parts) > 1:
                            publication_date += f"-{date_parts[1]:02d}"
                        if len(date_parts) > 2:
                            publication_date += f"-{date_parts[2]:02d}"
                
                # DOI et URL
                doi = item.get('DOI', '')
                url = f"https://doi.org/{doi}" if doi else item.get('URL', '')
                
                results.append({
                    'id': doi or item.get('URL', '').split('/')[-1],
                    'title': title,
                    'abstract': item.get('abstract', ''),
                    'authors': '; '.join(authors),
                    'publication_date': publication_date,
                    'journal': journal,
                    'doi': doi,
                    'url': url,
                    'database_source': 'crossref'
                })
        
        except Exception as e:
            print(f"Erreur recherche CrossRef: {e}")
        
        return results
    
    def search_ieee(self, query, max_results=50):
        """Recherche dans IEEE Xplore."""
        results = []
        
        if not self.config['ieee']['enabled']:
            return results
        
        try:
            url = "https://ieeexploreapi.ieee.org/api/v1/search/articles"
            params = {
                'apikey': self.config['ieee']['api_key'],
                'querytext': query,
                'max_records': max_results,
                'start_record': 1,
                'sort_field': 'article_number',
                'sort_order': 'desc'
            }
            
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            
            data = response.json()
            articles = data.get('articles', [])
            
            for article in articles:
                # Auteurs
                authors = []
                if 'authors' in article:
                    if isinstance(article['authors'], dict):
                        for author_list in article['authors'].values():
                            if isinstance(author_list, list):
                                authors.extend([a.get('full_name', '') for a in author_list])
                    elif isinstance(article['authors'], list):
                        authors = [a.get('full_name', '') for a in article['authors']]
                
                results.append({
                    'id': article.get('article_number', ''),
                    'title': article.get('title', ''),
                    'abstract': article.get('abstract', ''),
                    'authors': '; '.join(authors),
                    'publication_date': article.get('publication_year', ''),
                    'journal': article.get('publication_title', ''),
                    'doi': article.get('doi', ''),
                    'url': article.get('html_url', ''),
                    'database_source': 'ieee'
                })
        
        except Exception as e:
            print(f"Erreur recherche IEEE: {e}")
        
        return results

# Instance globale du gestionnaire de bases de données
db_manager = DatabaseManager()

# NOUVEAU : Fonction de sanétisation unifiée
def sanitize_filename(article_id: str) -> str:
    """Convertit un identifiant d'article en un nom de fichier valide."""
    # Remplace les caractères non alphanumériques (sauf le point) par un underscore
    return re.sub(r'[^a-zA-Z0-9.-]', '_', article_id)
    
# Fonctions utilitaires
def http_get_with_retries(url, headers=None, timeout=15, max_retries=HTTP_MAX_RETRIES,
                         backoff_base=HTTP_BACKOFF_BASE, jitter=True, ok_statuses=(200,)):
    """Effectue une requête GET avec retry automatique et backoff exponentiel."""
    last_exc = None
    
    for attempt in range(max_retries):
        try:
            r = requests.get(url, headers=headers or {}, timeout=timeout)
            if r.status_code in ok_statuses:
                return r
            
            if r.status_code in (429, 500, 502, 503, 504):
                sleep_s = (backoff_base ** attempt)
                if jitter:
                    sleep_s += random.uniform(0, 0.3)
                print(f"⚠️ Status {r.status_code}, retry dans {sleep_s:.1f}s...")
                time.sleep(sleep_s)
                continue
            
            r.raise_for_status()
            return r
            
        except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as e:
            last_exc = e
            sleep_s = (backoff_base ** attempt)
            if jitter:
                sleep_s += random.uniform(0, 0.3)
            print(f"⚠️ Erreur réseau (essai {attempt+1}/{max_retries}), retry dans {sleep_s:.1f}s...")
            time.sleep(sleep_s)
    
    raise last_exc if last_exc else RuntimeError("HTTP retries exhausted")

def parse_doi_from_pubmed_xml(xml_text: str) -> str | None:
    """Extrait un DOI depuis du XML PubMed."""
    try:
        root = ET.fromstring(xml_text)
        
        for el in root.iter():
            if el.tag.endswith("ELocationID") and el.attrib.get("EIdType") == "doi":
                v = (el.text or "").strip()
                if v.startswith("10."):
                    return v
        
        for el in root.iter():
            if el.tag.endswith("ArticleId") and el.attrib.get("IdType") == "doi":
                v = (el.text or "").strip()
                if v.startswith("10."):
                    return v
    
    except ET.ParseError:
        pass
    
    return None

def get_doi_from_pmid(pmid: str) -> str | None:
    """Récupère le DOI d'un article via E-utilities NCBI."""
    efetch = f"https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id={quote(str(pmid))}&retmode=xml"
    
    try:
        r = http_get_with_retries(efetch, timeout=20)
        doi = parse_doi_from_pubmed_xml(r.text)
        return doi
    
    except Exception as e:
        print(f"⚠️ DOI introuvable via E-utilities pour PMID {pmid}: {e}")
        return None

def fetch_unpaywall_pdf_url(doi: str) -> str | None:
    """Interroge Unpaywall pour obtenir l'URL du PDF OA."""
    url = f"https://api.unpaywall.org/v2/{quote(doi)}?email={quote(UNPAYWALL_EMAIL)}"
    
    try:
        r = http_get_with_retries(url, timeout=20)
        data = r.json()
        loc = (data or {}).get("best_oa_location") or {}
        pdf = loc.get("url_for_pdf")
        return pdf
    
    except Exception as e:
        print(f"⚠️ Unpaywall erreur pour DOI {doi}: {e}")
        return None

def normalize_text(s: str) -> str:
    """Normalise le texte pour réduire le bruit avant indexation."""
    if not s:
        return ""
    
    # Supprimer soft hyphen et caractères de contrôle
    s = s.replace("\u00ad", "")
    s = re.sub(r"[\x00-\x08\x0B\x0C\x0E-\x1F]", "", s)
    
    # Normaliser espaces
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\s*\n\s*", "\n", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    s = s.strip()
    
    if NORMALIZE_LOWER:
        s = s.lower()
    
    return s

def send_project_notification(project_id: str, event_type: str, message: str, data: dict = None):
    """Envoie une notification WebSocket à un projet spécifique."""
    try:
        external_socketio = SocketIO(message_queue=config.REDIS_URL, async_mode='threading')
        
        payload = {
            'type': event_type,
            'message': message,
            'project_id': project_id,
            'timestamp': datetime.now().isoformat(),
            'data': data or {}
        }
        
        external_socketio.emit('notification', payload, room=project_id)
        print(f"📢 Notification envoyée au projet {project_id}: {event_type}")
    
    except Exception as e:
        print(f"❌ Erreur lors de l'envoi de la notification WebSocket: {e}")

def extract_text_from_pdf(pdf_path):
    """Extrait le texte d'un fichier PDF."""
    text = ""
    
    try:
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            for page in reader.pages:
                text += page.extract_text() or ""
    
    except Exception as e:
        print(f"Erreur de lecture du PDF {pdf_path}: {e}")
        return None
    
    return text

def get_prompt_from_db(prompt_name: str) -> str:
    """Récupère un template de prompt depuis la base de données."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        cursor = conn.execute("SELECT template FROM prompts WHERE name = ?", (prompt_name,))
        row = cursor.fetchone()
        if row:
            return row[0]
    
    # Fallback si la BDD est inaccessible
    if prompt_name == 'screening_prompt':
        return """En tant qu'assistant de recherche spécialisé, analysez cet article et déterminez sa pertinence pour une revue systématique.

Titre: {title}
Résumé: {abstract}
Source: {database_source}

Veuillez évaluer la pertinence de cet article sur une échelle de 1 à 10 et fournir une justification concise.

Répondez UNIQUEMENT avec un objet JSON contenant :
- "relevance_score": score numérique de 0 à 10
- "decision": "À inclure" si score >= 7, sinon "À exclure" 
- "justification": phrase courte (max 30 mots) expliquant le score"""
    
    elif prompt_name == 'full_extraction_prompt':
        return """En tant qu'expert en revue systématique, extrayez les données importantes de cet article selon une grille d'extraction structurée.

Texte à analyser: "{text}"
Source: {database_source}

Extrayez les informations suivantes au format JSON:
{
  "type_etude": "...",
  "population": "...",
  "intervention": "...",
  "resultats_principaux": "...",
  "limites": "...",
  "methodologie": "..."
}"""
    
    return ""

def get_screening_prompt(title, abstract, database_source="unknown"):
    """Génère le prompt de screening avec les données de l'article."""
    template = get_prompt_from_db('screening_prompt')
    return template.format(title=title, abstract=abstract, database_source=database_source)

def get_full_extraction_prompt(text, database_source="unknown", custom_grid_id=None):
    """Génère le prompt d'extraction avec grille personnalisée optionnelle (CORRIGÉ)."""
    
    # Décomposition du prompt pour un assemblage plus robuste
    intro = "En tant qu'expert en revue systématique, extrayez les données importantes de cet article selon une grille d'extraction structurée."
    text_to_analyze = f'Texte à analyser: "{text}"'
    source_info = f'Source: {database_source}'
    instruction = "Extrayez les informations suivantes au format JSON:"

    json_structure = ""
    
    # Si une grille personnalisée est fournie, on l'utilise
    if custom_grid_id:
        try:
            with sqlite3.connect(DATABASE_FILE) as conn:
                cursor = conn.execute("SELECT fields FROM extraction_grids WHERE id = ?", (custom_grid_id,))
                row = cursor.fetchone()
                if row:
                    custom_fields = json.loads(row[0])
                    # Création de la structure JSON à partir des champs de la grille
                    json_fields = ",\n".join([f'  "{field}": "..."' for field in custom_fields])
                    json_structure = f"{{\n{json_fields}\n}}"
        except Exception as e:
            print(f"Erreur lors de la récupération de la grille personnalisée: {e}")
            # En cas d'erreur, on se rabat sur la grille par défaut
            json_structure = ""

    # Si aucune grille personnalisée n'est trouvée ou s'il y a eu une erreur, on utilise la grille par défaut
    if not json_structure:
        default_prompt_template = get_prompt_from_db('full_extraction_prompt')
        # Extraction de la partie JSON du prompt par défaut
        json_start = default_prompt_template.find('{')
        if json_start != -1:
            json_structure = default_prompt_template[json_start:]

    # Assemblage final du prompt
    final_prompt = f"{intro}\n\n{text_to_analyze}\n{source_info}\n\n{instruction}\n{json_structure}"
    
    return final_prompt
    
def update_project_status(project_id: str, status: str, result: dict = None, discussion: str = None,
                         graph: dict = None, prisma_path: str = None, analysis_result: dict = None,
                         analysis_plot_path: str = None):
    """Met à jour le statut et les résultats d'un projet."""
    with sqlite3.connect(DATABASE_FILE) as conn:
        now_iso = datetime.now().isoformat()
        
        if result:
            conn.execute("UPDATE projects SET status = ?, synthesis_result = ?, updated_at = ? WHERE id = ?",
                        (status, json.dumps(result), now_iso, project_id))
        elif discussion:
            conn.execute("UPDATE projects SET discussion_draft = ?, updated_at = ? WHERE id = ?",
                        (discussion, now_iso, project_id))
        elif graph:
            conn.execute("UPDATE projects SET knowledge_graph = ?, updated_at = ? WHERE id = ?",
                        (json.dumps(graph), now_iso, project_id))
        elif prisma_path:
            conn.execute("UPDATE projects SET prisma_flow_path = ?, updated_at = ? WHERE id = ?",
                        (prisma_path, now_iso, project_id))
        elif analysis_result is not None:
            conn.execute("UPDATE projects SET status = ?, analysis_result = ?, analysis_plot_path = ?, updated_at = ? WHERE id = ?",
                        (status, json.dumps(analysis_result), analysis_plot_path, now_iso, project_id))
        else:
            conn.execute("UPDATE projects SET status = ?, updated_at = ? WHERE id = ?",
                        (status, now_iso, project_id))
        
        conn.commit()

def update_project_timing(project_id: str, duration: float):
    """Met à jour le temps de traitement total d'un projet."""
    try:
        with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
            conn.execute("UPDATE projects SET total_processing_time = total_processing_time + ? WHERE id = ?",
                        (duration, project_id))
            conn.commit()
    
    except sqlite3.Error as e:
        print(f"❌ ERREUR DATABASE (timing) pour {project_id}: {e}")

def log_processing_status(project_id: str, article_id: str, status: str, details: str):
    """Enregistre un événement de traitement dans les logs."""
    try:
        with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
            conn.execute("INSERT INTO processing_log (project_id, pmid, status, details, timestamp) VALUES (?, ?, ?, ?, ?)",
                        (project_id, article_id, status, details, datetime.now().isoformat()))
            conn.commit()
    
    except sqlite3.Error as e:
        print(f"❌ ERREUR DATABASE (log) pour {article_id}: {e}")

def increment_processed_count(project_id: str):
    """Incrémente le compteur d'articles traités."""
    try:
        with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
            conn.execute("UPDATE projects SET processed_count = processed_count + 1 WHERE id = ?", (project_id,))
            conn.commit()
    
    except sqlite3.Error as e:
        print(f"❌ ERREUR DATABASE (increment) pour {project_id}: {e}")

def call_ollama_api(prompt: str, model: str, output_format: str = "", retries: int = 3) -> any:
    """Appelle l'API Ollama avec gestion des erreurs et retry."""
    payload = {"model": model, "prompt": prompt, "stream": False}
    
    if output_format == "json":
        payload["format"] = "json"
    
    last_exception = None
    
    for attempt in range(retries):
        try:
            print(f"🤖 Appel Ollama avec le modèle : {model} (Essai {attempt + 1}/{retries})...")
            response = requests.post(f"{config.OLLAMA_BASE_URL}/api/generate", json=payload, timeout=900)
            response.raise_for_status()
            
            result = response.json()
            response_text = result.get('response', '')
            
            if output_format == "json":
                response_text = response_text.strip().replace("```json", "").replace("```", "")
                return json.loads(response_text)
            
            return response_text
        
        except (requests.RequestException, json.JSONDecodeError) as e:
            last_exception = e
            print(f"⚠️ Erreur Ollama (essai {attempt + 1}): {e}. Nouvel essai...")
            time.sleep(5)
    
    print(f"❌ Échec de l'appel API Ollama après {retries} essais. Erreur: {last_exception}")
    return {} if output_format == "json" else ""

def fetch_article_details(article_id: str, database_source: str = None) -> dict:
    """
    Récupère les détails d'un article selon son identifiant.
    CORRECTION BUG C : Détection automatique du type d'identifiant (DOI vs PMID)
    """
    # Nettoyer l'identifiant
    article_id = article_id.strip()
    
    # Détection automatique du type d'identifiant
    if article_id.startswith("10.") and "/" in article_id:
        # C'est un DOI
        print(f"📖 Détecté comme DOI : {article_id}")
        return fetch_crossref_details(article_id)
    elif article_id.isdigit() and len(article_id) >= 7:
        # C'est probablement un PMID
        print(f"📖 Détecté comme PMID : {article_id}")
        return fetch_pubtator_abstract(article_id)
    elif "arxiv" in article_id.lower() or article_id.count('.') == 1:
        # C'est probablement un ID arXiv
        print(f"📖 Détecté comme arXiv ID : {article_id}")
        return fetch_arxiv_details(article_id)
    else:
        # Fallback : essayer en tant que PMID d'abord, puis DOI
        print(f"⚠️ Type d'identifiant incertain pour : {article_id}, essai PMID d'abord...")
        details = fetch_pubtator_abstract(article_id)
        if details.get('title') == 'Erreur de récupération':
            print(f"⚠️ Échec PMID, essai en tant que DOI...")
            details = fetch_crossref_details(article_id)
        return details

def fetch_pubtator_abstract(pmid: str) -> dict:
    """Récupère le titre et le résumé d'un article via l'API PubTator avec retry."""
    url = f"https://www.ncbi.nlm.nih.gov/research/pubtator-api/publications/export/pubtator?pmids={pmid}"
    
    try:
        r = http_get_with_retries(url, timeout=20)
        content = r.text
        
        # Patterns regex améliorés avec échappement du PMID
        title_match = re.search(rf'^{re.escape(pmid)}\|t\|(.*?)$', content, re.MULTILINE)
        abstract_match = re.search(rf'^{re.escape(pmid)}\|a\|(.*?)$', content, re.MULTILINE)
        
        title = title_match.group(1).strip() if title_match else "Titre non trouvé"
        abstract = abstract_match.group(1).strip() if abstract_match else ""
        
        time.sleep(0.2)  # politesse API
        
        return {'id': pmid, 'title': title, 'abstract': abstract}
    
    except Exception as e:
        print(f"❌ PubTator erreur pour PMID {pmid}: {e}")
        return {'id': pmid, 'title': 'Erreur de récupération', 'abstract': ''}

def fetch_arxiv_details(arxiv_id: str) -> dict:
    """Récupère les détails d'un article arXiv."""
    try:
        client = arxiv.Client()
        search = arxiv.Search(id_list=[arxiv_id])
        
        for paper in client.results(search):
            return {
                'id': arxiv_id,
                'title': paper.title,
                'abstract': paper.summary
            }
    
    except Exception as e:
        print(f"❌ ArXiv erreur pour ID {arxiv_id}: {e}")
    
    return {'id': arxiv_id, 'title': 'Erreur de récupération', 'abstract': ''}

def fetch_crossref_details(doi: str) -> dict:
    """Récupère les détails d'un article CrossRef."""
    try:
        work = cr.get_publication_as_json(doi)
        
        title = ''
        if 'title' in work and work['title']:
            title = work['title'][0]
        
        abstract = work.get('abstract', '')
        
        return {
            'id': doi,
            'title': title,
            'abstract': abstract
        }
    
    except Exception as e:
        print(f"❌ CrossRef erreur pour DOI {doi}: {e}")
        return {'id': doi, 'title': 'Erreur de récupération', 'abstract': ''}

def fetch_ieee_details(article_id: str) -> dict:
    """Récupère les détails d'un article IEEE."""
    # Cette fonction nécessiterait l'API IEEE pour récupérer les détails
    # Pour l'instant, retour basique
    return {'id': article_id, 'title': 'Article IEEE', 'abstract': ''}

# --- TÂCHES PRINCIPALES ---

def multi_database_search_task(project_id: str, query: str, databases: list, max_results_per_db: int = 50):
    """Effectue une recherche dans plusieurs bases de données."""
    print(f"🔍 Recherche multi-bases pour le projet {project_id}: {query}")
    
    all_results = []
    total_found = 0
    
    try:
        for db_name in databases:
            print(f"📚 Recherche dans {db_name}...")
            
            try:
                if db_name == 'pubmed':
                    results = db_manager.search_pubmed(query, max_results_per_db)
                elif db_name == 'arxiv':
                    results = db_manager.search_arxiv(query, max_results_per_db)
                elif db_name == 'crossref':
                    results = db_manager.search_crossref(query, max_results_per_db)
                elif db_name == 'ieee':
                    results = db_manager.search_ieee(query, max_results_per_db)
                else:
                    print(f"⚠️ Base de données inconnue: {db_name}")
                    continue
                
                print(f"✅ {db_name}: {len(results)} résultats trouvés")
                
                # Sauvegarder les résultats dans la base de données
                with sqlite3.connect(DATABASE_FILE) as conn:
                    for result in results:
                        search_result_id = str(uuid.uuid4())
                        conn.execute("""
                            INSERT INTO search_results (
                                id, project_id, article_id, title, abstract, authors,
                                publication_date, journal, doi, url, database_source, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            search_result_id, project_id, result['id'], result['title'], 
                            result['abstract'], result['authors'], result['publication_date'],
                            result['journal'], result['doi'], result['url'], 
                            result['database_source'], datetime.now().isoformat()
                        ))
                    
                    conn.commit()
                
                all_results.extend(results)
                total_found += len(results)
                
                # Notification de progression
                send_project_notification(
                    project_id,
                    'search_progress',
                    f'Recherche terminée dans {db_name}: {len(results)} résultats',
                    {'database': db_name, 'count': len(results)}
                )
                
                time.sleep(1)  # Politesse entre les APIs
                
            except Exception as e:
                print(f"❌ Erreur lors de la recherche dans {db_name}: {e}")
                continue
        
        # Mettre à jour le statut du projet
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.execute("""
                UPDATE projects SET 
                status = 'search_completed',
                pmids_count = ?,
                updated_at = ?
                WHERE id = ?
            """, (total_found, datetime.now().isoformat(), project_id))
            conn.commit()
        
        # Notification finale
        send_project_notification(
            project_id,
            'search_completed',
            f'Recherche terminée: {total_found} articles trouvés dans {len(databases)} base(s) de données',
            {'total_results': total_found, 'databases': databases}
        )
        
        print(f"✅ Recherche multi-bases terminée: {total_found} articles trouvés")
        return {'total_results': total_found, 'databases': databases}
    
    except Exception as e:
        print(f"❌ Erreur critique lors de la recherche multi-bases: {e}")
        
        # Mettre à jour le statut d'erreur
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.execute("""
                UPDATE projects SET status = 'search_failed', updated_at = ? WHERE id = ?
            """, (datetime.now().isoformat(), project_id))
            conn.commit()
        
        send_project_notification(
            project_id,
            'search_failed',
            f'Erreur lors de la recherche: {str(e)}'
        )
        
        return {'error': str(e)}

def pull_ollama_model_task(model_name: str):
    """Tâche de téléchargement d'un modèle Ollama."""
    print(f"📥 Lancement du téléchargement pour le modèle : {model_name}...")
    
    try:
        process = subprocess.run(
            ["ollama", "pull", model_name], 
            capture_output=True, 
            text=True, 
            check=True, 
            timeout=1800
        )
        
        print(f"✅ Modèle '{model_name}' téléchargé avec succès.")
        return f"Modèle '{model_name}' téléchargé."
    
    except Exception as e:
        print(f"❌ Erreur lors du téléchargement du modèle '{model_name}': {e}")
        return f"Erreur: {e}"

def get_full_extraction_prompt(text, database_source="unknown", custom_grid_id=None):
    """Génère le prompt d'extraction avec grille personnalisée optionnelle (CORRIGÉ ET ROBUSTE)."""
    
    intro = "ROLE: Vous êtes un assistant expert en analyse de littérature scientifique, spécialisé dans l'extraction de données structurées.\n\nTÂCHE: Analysez le texte fourni et extrayez les informations demandées en respectant SCRUPULEUSEMENT le format JSON.\n\nINSTRUCTIONS IMPORTANTES:\n1. Répondez **UNIQUEMENT** avec un objet JSON valide. N'ajoutez aucun texte, commentaire ou explication avant ou après le JSON.\n2. Assurez-vous que chaque paire clé-valeur est séparée par une virgule, sauf la dernière.\n3. Échappez correctement les guillemets doubles (\") à l'intérieur des chaînes de caractères avec un antislash (\\).\n4. Si une information n'est pas présente dans le texte, utilisez une chaîne de caractères vide (\"\") comme valeur. Ne laissez pas de champ vide ou avec \"...\"."
    text_to_analyze = f'TEXTE À ANALYSER:\n---\n{text}\n---'
    source_info = f'SOURCE: {database_source}'
    instruction = "GRILLE D'EXTRACTION JSON (remplissez les valeurs):"

    json_structure = ""
    
    if custom_grid_id:
        try:
            with sqlite3.connect(DATABASE_FILE) as conn:
                cursor = conn.execute("SELECT fields FROM extraction_grids WHERE id = ?", (custom_grid_id,))
                row = cursor.fetchone()
                if row:
                    custom_fields = json.loads(row[0])
                    json_fields = ",\n".join([f'  "{field}": "..."' for field in custom_fields])
                    json_structure = f"{{\n{json_fields}\n}}"
        except Exception as e:
            print(f"Erreur lors du chargement de la grille personnalisée: {e}")
            json_structure = ""

    if not json_structure:
        default_prompt_template = get_prompt_from_db('full_extraction_prompt')
        json_start = default_prompt_template.find('{')
        if json_start != -1:
            json_structure = default_prompt_template[json_start:]

    final_prompt = f"{intro}\n\n{text_to_analyze}\n{source_info}\n\n{instruction}\n{json_structure}"
    
    return final_prompt
    
def process_single_article_task(
    project_id: str,
    article_id: str,
    profile: dict,
    analysis_mode: str,
    custom_grid_id: str = None
):
    """
    Traite un article individuel avec :
    - détection automatique DOI/PMID/arXiv
    - mode 'screening' ou 'full_extraction'
    - grille personnalisée pour extraction détaillée
    """
    start_time = time.time()
    try:
        # Chaque tâche utilise sa propre connexion à la base de données pour éviter les blocages
        with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
            conn.row_factory = sqlite3.Row
            row = conn.execute(
                "SELECT * FROM search_results WHERE project_id = ? AND article_id = ?",
                (project_id, article_id)
            ).fetchone()

        if row:
            article_data = dict(row)
        else:
            print(f"ℹ️ Article {article_id} non trouvé localement, recherche en ligne...")
            details = fetch_article_details(article_id)
            if not details or not details.get("title") or details.get("title") == "Erreur de récupération":
                log_processing_status(project_id, article_id, "erreur", "Détails introuvables")
                return
            article_data = {
                "project_id": project_id,
                "article_id": article_id,
                "title": details.get("title", "Titre inconnu"),
                "abstract": details.get("abstract", ""),
                "database_source": details.get("database_source", "manual_input")
            }

        if analysis_mode == "full_extraction":
            pdf_path = PROJECTS_DIR / project_id / f"{article_id.replace('/', '_')}.pdf"
            text_for_extraction = ""
            if pdf_path.exists():
                text_for_extraction = extract_text_from_pdf(str(pdf_path)) or ""

            if not text_for_extraction:
                text_for_extraction = (
                    article_data["title"] + "\n\n" + article_data.get("abstract", "")
                )

            prompt = get_full_extraction_prompt(
                text_for_extraction,
                article_data.get("database_source", "unknown"),
                custom_grid_id
            )
            extracted = call_ollama_api(
                prompt, profile["extract_model"], output_format="json"
            )

            if isinstance(extracted, dict) and extracted:
                with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
                    conn.execute("""
                        INSERT INTO extractions (
                            id, project_id, pmid, title,
                            extracted_data, relevance_score,
                            relevance_justification, created_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        str(uuid.uuid4()), project_id, article_id,
                        article_data["title"], json.dumps(extracted),
                        10, "Extraction détaillée effectuée", datetime.now().isoformat()
                    ))
                    conn.commit()
                log_processing_status(project_id, article_id, "analysé", "Extraction détaillée réussie")
                print(f"✅ Extraction complète pour {article_id}")
            else:
                log_processing_status(project_id, article_id, "écarté", "Réponse de l'IA invalide pour l'extraction")
                print(f"⚠️ Extraction invalide pour {article_id}")
        
        else: # Mode Screening par défaut
            abstract = article_data.get("abstract", "")
            if not abstract:
                log_processing_status(project_id, article_id, "écarté", "Résumé manquant pour le screening")
                return

            prompt = get_screening_prompt(
                article_data["title"], abstract, article_data.get("database_source", "unknown")
            )
            resp = call_ollama_api(prompt, profile["preprocess_model"], output_format="json")
            
            score = resp.get("relevance_score", 0) if isinstance(resp, dict) else 0
            justification = resp.get("justification", "Non pertinent selon IA.") if isinstance(resp, dict) else "Réponse IA invalide."

            with sqlite3.connect(DATABASE_FILE, timeout=30.0) as conn:
                conn.execute("""
                    INSERT INTO extractions (
                        id, project_id, pmid, title,
                        relevance_score, relevance_justification, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()), project_id, article_id,
                    article_data["title"], score, justification, datetime.now().isoformat()
                ))
                conn.commit()
            log_processing_status(project_id, article_id, "analysé", f"Screening terminé (Score: {score}/10)")
            print(f"▶️ Screening terminé pour {article_id} (score {score})")

        increment_processed_count(project_id)
        update_project_timing(project_id, time.time() - start_time)

    except Exception as e:
        print(f"❌ Erreur critique dans le traitement de l'article {article_id}: {e}")
        log_processing_status(project_id, article_id, "erreur", f"Exception: {str(e)}")
        
def run_synthesis_task(project_id: str, profile: dict):
    """Génère une synthèse des articles pertinents d'un projet."""
    update_project_status(project_id, "synthesizing")
    
    with sqlite3.connect(DATABASE_FILE) as conn:
        conn.row_factory = sqlite3.Row
        
        project = conn.execute("SELECT description FROM projects WHERE id = ?", (project_id,)).fetchone()
        project_description = project['description'] if project else "Non spécifié"

        # CORRECTION : Jointure pour récupérer title et abstract depuis search_results
        extractions = conn.execute("""
            SELECT s.title, s.abstract
            FROM extractions e
            JOIN search_results s ON e.project_id = s.project_id AND e.pmid = s.article_id
            WHERE e.project_id = ? AND e.relevance_score >= 7 
            ORDER BY e.relevance_score DESC LIMIT 30
        """, (project_id,)).fetchall()
        
        if not extractions:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', 'Aucun article pertinent trouvé pour la synthèse.')
            print(f"⏩ Échec de la synthèse pour {project_id}: Aucun article pertinent trouvé (score >= 7).")
            return "Échec : Aucun article suffisamment pertinent trouvé pour la synthèse."
        
        abstracts_for_prompt = [
            f"Titre: {row['title']}\nRésumé: {row['abstract']}"
            for row in extractions if row['abstract']
        ]
        
        if not abstracts_for_prompt:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', 'Les articles pertinents n\'avaient pas de résumé.')
            print(f"⏩ Échec de la synthèse pour {project_id}: Les articles pertinents n'avaient pas de résumé.")
            return "Échec : Les articles pertinents n'avaient pas de résumé."

        data_for_prompt = "\n\n---\n\n".join(abstracts_for_prompt)
        
        synthesis_prompt_template = get_prompt_from_db('synthesis_prompt')
        prompt = synthesis_prompt_template.format(
            project_description=project_description,
            data_for_prompt=data_for_prompt
        )
        
        synthesis_output = call_ollama_api(prompt, profile['synthesis_model'], output_format="json")
        
        if synthesis_output and isinstance(synthesis_output, dict):
            update_project_status(project_id, "completed", result=synthesis_output)
            print(f"--- ✅ SYNTHÈSE COMPLÈTE pour le projet {project_id} ---")
            send_project_notification(project_id, 'synthesis_completed', 'La synthèse est terminée avec succès.')
        else:
            update_project_status(project_id, "failed")
            send_project_notification(project_id, 'synthesis_failed', 'La synthèse a échoué car l\'IA a renvoyé une réponse invalide.')
            
def run_discussion_generation_task(project_id: str):
    """Génère une section discussion académique pour un projet."""
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            project = conn.execute("SELECT synthesis_result, profile_used FROM projects WHERE id = ?", (project_id,)).fetchone()
            extractions = conn.execute("SELECT pmid, title FROM extractions WHERE project_id = ?", (project_id,)).fetchall()
            
            if not project or not project['synthesis_result']:
                return
            
            synthesis_data = json.loads(project['synthesis_result'])
            profile_name = project['profile_used'] or 'standard'
            
            # Récupérer le profil pour obtenir le modèle de synthèse
            with sqlite3.connect(DATABASE_FILE) as conn:
                conn.row_factory = sqlite3.Row
                profile_row = conn.execute("SELECT synthesis_model FROM analysis_profiles WHERE id = ?", (profile_name,)).fetchone()
                model_name = profile_row['synthesis_model'] if profile_row else 'llama3.1:8b'
            
            article_list = "\n".join([f"- {e['title']} (ID: {e['pmid']})" for e in extractions])
            
            prompt = f"""En tant que chercheur, rédige une section 'Discussion' académique en te basant sur le résumé de synthèse et la liste d'articles ci-dessous.

**Résumé de Synthèse :**

---

{json.dumps(synthesis_data, indent=2)}

---

**Articles Inclus :**

---

{article_list}

---

La discussion doit synthétiser les apports, analyser les perspectives, explorer les divergences et suggérer des pistes de recherche futures en citant les sources."""
            
            discussion_text = call_ollama_api(prompt, model_name)
            
            if discussion_text:
                update_project_status(project_id, status="completed", discussion=discussion_text)
    
    except Exception as e:
        print(f"❌ Erreur discussion pour {project_id}: {e}")

def run_knowledge_graph_task(project_id: str):
    """Génère un graphe de connaissances pour un projet."""
    update_project_status(project_id, status="generating_graph")
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            project = conn.execute("SELECT profile_used FROM projects WHERE id = ?", (project_id,)).fetchone()
            extractions = conn.execute("SELECT title, pmid FROM extractions WHERE project_id = ?", (project_id,)).fetchall()
            
            if not extractions:
                return
            
            profile_key = project['profile_used'] if project else 'standard'
            
            # Récupérer le modèle d'extraction du profil
            with sqlite3.connect(DATABASE_FILE) as conn:
                conn.row_factory = sqlite3.Row
                profile_row = conn.execute("SELECT extract_model FROM analysis_profiles WHERE id = ?", (profile_key,)).fetchone()
                model_to_use = profile_row['extract_model'] if profile_row else 'llama3.1:8b'
            
            titles = [f"{e['title']} (ID: {e['pmid']})" for e in extractions][:100]
            
            prompt = f"""À partir de la liste de titres suivante, génère un graphe de connaissances. Identifie les 10 concepts les plus importants et leurs relations.

Ta réponse doit être UNIQUEMENT un objet JSON avec "nodes" (id, label) et "edges" (from, to, label).

Titres : {json.dumps(titles, indent=2)}"""
            
            graph_data = call_ollama_api(prompt, model=model_to_use, output_format="json")
            
            if graph_data and "nodes" in graph_data and "edges" in graph_data:
                update_project_status(project_id, status="completed", graph=graph_data)
            else:
                update_project_status(project_id, status="completed")
    
    except Exception as e:
        print(f"❌ Erreur graphe pour {project_id}: {e}")
        update_project_status(project_id, status="completed")

def run_prisma_flow_task(project_id: str):
    """Génère un diagramme PRISMA pour un projet."""
    update_project_status(project_id, status="generating_prisma")
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            # Statistiques depuis search_results et extractions
            total_found = conn.execute("SELECT COUNT(*) FROM search_results WHERE project_id = ?", (project_id,)).fetchone()[0]
            n_included = conn.execute("SELECT COUNT(*) FROM extractions WHERE project_id = ?", (project_id,)).fetchone()[0]
            
            if total_found == 0:
                return
            
            n_after_duplicates = total_found
            n_excluded_screening = n_after_duplicates - n_included
            
            # Créer le diagramme
            fig, ax = plt.subplots(figsize=(8, 10))
            box_style = dict(boxstyle='round,pad=0.5', fc='lightblue', alpha=0.7)
            
            ax.text(0.5, 0.9, f'Articles identifiés (n = {total_found})', ha='center', va='center', bbox=box_style)
            ax.text(0.5, 0.7, f'Articles après exclusion des doublons (n = {n_after_duplicates})', ha='center', va='center', bbox=box_style)
            ax.text(0.5, 0.5, f'Articles évalués (n = {n_after_duplicates})', ha='center', va='center', bbox=box_style)
            ax.text(0.5, 0.3, f'Études incluses (n = {n_included})', ha='center', va='center', bbox=box_style)
            ax.text(1.0, 0.5, f'Exclus après criblage (n = {n_excluded_screening})', ha='left', va='center', bbox=box_style)
            
            ax.axis('off')
            
            # Sauvegarder l'image
            project_dir = PROJECTS_DIR / project_id
            project_dir.mkdir(exist_ok=True)
            image_path = str(project_dir / 'prisma_flow.png')
            plt.savefig(image_path, bbox_inches='tight')
            plt.close(fig)
            
            update_project_status(project_id, status="completed", prisma_path=image_path)
    
    except Exception as e:
        print(f"❌ Erreur PRISMA pour {project_id}: {e}")
        update_project_status(project_id, status="completed")

def run_meta_analysis_task(project_id: str):
    """Lance une méta-analyse statistique pour un projet."""
    update_project_status(project_id, "generating_analysis")
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            extractions = pd.read_sql_query(f"""
                SELECT pmid, title, relevance_score 
                FROM extractions 
                WHERE project_id = '{project_id}' 
                AND relevance_score IS NOT NULL 
                AND relevance_score > 0
            """, conn)
            
            if len(extractions) < 2:
                return
            
            scores = extractions['relevance_score']
            mean_score = np.mean(scores)
            std_dev = np.std(scores, ddof=1)
            n = len(scores)
            std_err = std_dev / np.sqrt(n)
            ci = stats.t.interval(0.95, df=n-1, loc=mean_score, scale=std_err)
            
            analysis_result = {
                "mean_score": mean_score,
                "std_dev": std_dev,
                "confidence_interval": list(ci),
                "n_articles": n
            }
            
            # Créer le graphique
            project_dir = PROJECTS_DIR / project_id
            project_dir.mkdir(exist_ok=True)
            plot_path = str(project_dir / 'meta_analysis_plot.png')
            
            fig, ax = plt.subplots(figsize=(10, 6))
            ax.hist(scores, bins=10, alpha=0.7, color='skyblue', edgecolor='black')
            ax.axvline(mean_score, color='red', linestyle='--', linewidth=2, label=f'Moyenne: {mean_score:.2f}')
            ax.set_xlabel('Score de Pertinence')
            ax.set_ylabel('Nombre d\'Articles')
            ax.set_title('Distribution des Scores de Pertinence')
            ax.legend()
            
            plt.savefig(plot_path, bbox_inches='tight')
            plt.close(fig)
            
            update_project_status(project_id, "completed", analysis_result=analysis_result, analysis_plot_path=plot_path)
    
    except Exception as e:
        print(f"❌ Erreur méta-analyse pour {project_id}: {e}")
        update_project_status(project_id, "failed")

def run_descriptive_stats_task(project_id: str):
    """Génère des statistiques descriptives pour un projet."""
    update_project_status(project_id, "generating_analysis")
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            extractions = conn.execute("SELECT extracted_data FROM extractions WHERE project_id = ? AND extracted_data IS NOT NULL", (project_id,)).fetchall()
            
            if not extractions:
                return
            
            records = [json.loads(ext[0]) for ext in extractions]
            df = pd.json_normalize(records)
            
            project_dir = PROJECTS_DIR / project_id
            project_dir.mkdir(exist_ok=True)
            
            plot_paths = {}
            
            # Graphique simple des types d'études
            if 'methodologie.type_etude' in df.columns:
                study_types = df['methodologie.type_etude'].value_counts()
                fig, ax = plt.subplots(figsize=(10, 6))
                study_types.plot(kind='bar', ax=ax)
                ax.set_title('Répartition des Types d\'Études')
                ax.set_ylabel('Nombre d\'Articles')
                plt.xticks(rotation=45, ha='right')
                
                plot_path = str(project_dir / 'study_types.png')
                plt.savefig(plot_path, bbox_inches='tight')
                plt.close(fig)
                plot_paths['study_types'] = plot_path
            
            summary_stats = {
                "total_articles": len(df)
            }
            
            update_project_status(project_id, "completed", analysis_result=summary_stats, analysis_plot_path=json.dumps(plot_paths))
    
    except Exception as e:
        print(f"❌ Erreur stats descriptives pour {project_id}: {e}")
        update_project_status(project_id, "failed")

def run_atn_score_task(project_id: str):
    """Calcule un score ATN (Alliance Thérapeutique Numérique) personnalisé."""
    update_project_status(project_id, "generating_analysis")
    
    try:
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            extractions = conn.execute("""
                SELECT id, pmid, title, extracted_data 
                FROM extractions 
                WHERE project_id = ? AND extracted_data IS NOT NULL
            """, (project_id,)).fetchall()
            
            if not extractions:
                update_project_status(project_id, "failed")
                return
            
            scores = []
            for ext in extractions:
                try:
                    data = json.loads(ext['extracted_data'])
                    score = 0
                    
                    # Logique de scoring ATN
                    if 'alliance' in str(data).lower() or 'therapeutic' in str(data).lower():
                        score += 3
                    if any(tech in str(data).lower() for tech in ['numérique', 'digital', 'app', 'plateforme', 'ia']):
                        score += 3
                    if any(stakeholder in str(data).lower() for stakeholder in ['patient', 'soignant', 'développeur']):
                        score += 2
                    if any(outcome in str(data).lower() for outcome in ['empathie', 'adherence', 'confiance']):
                        score += 2
                    
                    scores.append({
                        'pmid': ext['pmid'],
                        'title': ext['title'],
                        'atn_score': min(score, 10)
                    })
                
                except Exception as e:
                    print(f"Erreur ATN pour {ext['pmid']}: {e}")
                    continue
            
            analysis_result = {
                "atn_scores": scores,
                "mean_atn": np.mean([s['atn_score'] for s in scores]) if scores else 0,
                "total_articles_scored": len(scores)
            }
            
            # Créer le graphique
            project_dir = PROJECTS_DIR / project_id
            project_dir.mkdir(exist_ok=True)
            plot_path = str(project_dir / 'atn_scores.png')
            
            if scores:
                fig, ax = plt.subplots(figsize=(10, 6))
                atn_values = [s['atn_score'] for s in scores]
                ax.hist(atn_values, bins=11, range=(-0.5, 10.5), alpha=0.7, color='green', edgecolor='black')
                ax.set_xlabel('Score ATN')
                ax.set_ylabel('Nombre d\'Articles')
                ax.set_title('Distribution des Scores ATN')
                ax.set_xticks(range(0, 11))
                
                plt.savefig(plot_path, bbox_inches='tight')
                plt.close(fig)
            
            update_project_status(project_id, "completed", analysis_result=analysis_result, analysis_plot_path=plot_path)
    
    except Exception as e:
        print(f"❌ Erreur ATN pour {project_id}: {e}")
        update_project_status(project_id, "failed")

def import_pdfs_from_zotero_task(project_id, pmids, zotero_user_id, zotero_api_key):
    """Importe des PDF depuis Zotero pour un projet avec gestion d'erreurs et recherche améliorée."""
    print(f"🔄 Import Zotero démarré pour {len(pmids)} IDs...")
    
    successful_pmids = []
    
    if not zotero_user_id or not zotero_api_key:
        print("❌ ERREUR: ZOTERO_USER_ID ou ZOTERO_API_KEY manquant. Veuillez les configurer.")
        send_project_notification(project_id, 'zotero_import_failed', 'ID utilisateur ou Clé API Zotero non configurés.')
        return

    try:
        zot = zotero.Zotero(zotero_user_id, 'user', zotero_api_key)
        
        try:
            print("🔐 Test de la connexion à l'API Zotero...")
            zot.key_info()
            print("✅ Connexion à l'API Zotero réussie.")
        except Exception as e:
            print(f"❌ ÉCHEC DE LA CONNEXION ZOTERO. Vérifiez vos identifiants.")
            print(f"   Erreur détaillée: {e}")
            send_project_notification(project_id, 'zotero_import_failed', 'Échec de la connexion à Zotero. Vérifiez vos identifiants.')
            return

        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        
        for article_id in pmids:
            try:
                search_queries = [article_id, f"PMID:{article_id}"]
                if '/' in article_id and article_id.startswith('10.'):
                    search_queries.append(f"doi:\"{article_id}\"")

                found_item = None
                print(f"--- [ID: {article_id}] ---")
                
                for query in search_queries:
                    if found_item: break
                    print(f"   -> Recherche avec la requête: '{query}'")
                    items = zot.items(q=query, limit=5)
                    if items:
                        print(f"   ✅ Trouvé {len(items)} item(s). Sélection du premier.")
                        found_item = items[0]
                        break
                    else:
                        print(f"   -> Aucun résultat pour cette requête.")
                
                if not found_item:
                    print(f"   ⏩ Article non trouvé dans Zotero.")
                    continue

                item_key = found_item['key']
                print(f"   -> Item Zotero Key: {item_key}. Recherche des pièces jointes...")
                attachments = zot.children(item_key)
                print(f"   -> Trouvé {len(attachments)} pièce(s) jointe(s).")
                
                pdf_found_for_item = False
                for attachment in attachments:
                    content_type = attachment.get('data', {}).get('contentType', 'N/A')
                    print(f"      - Pièce jointe trouvée, type: {content_type}")
                    if content_type == 'application/pdf':
                        print(f"      -> C'est un PDF! Téléchargement...")
                        pdf_content = zot.file(attachment['key'])
                        safe_filename = sanitize_filename(article_id) + ".pdf"
                        pdf_path = project_dir / safe_filename
                        
                        with open(pdf_path, 'wb') as f:
                            f.write(pdf_content)
                        
                        print(f"      ✅ PDF téléchargé et sauvegardé: {safe_filename}")
                        successful_pmids.append(article_id)
                        pdf_found_for_item = True
                        break

                if not pdf_found_for_item:
                    print(f"   ⏩ Item trouvé, mais aucun PDF attaché.")

                time.sleep(0.5)
            
            except Exception as e:
                print(f"❌ Erreur durant le traitement de l'ID {article_id}: {e}")
                continue
        
        redis_key = f"zotero_import_result:{project_id}"
        redis_conn.set(redis_key, json.dumps(successful_pmids), ex=600)
        
        print(f"--- FIN DE L'IMPORT ---")
        print(f"📊 Total: {len(successful_pmids)}/{len(pmids)} PDF importés")
        send_project_notification(
            project_id,
            'zotero_import_completed',
            f'Import Zotero terminé: {len(successful_pmids)}/{len(pmids)} PDF importés',
            {'successful_count': len(successful_pmids), 'total_count': len(pmids)}
        )
    
    except Exception as e:
        print(f"❌ ERREUR CRITIQUE PENDANT L'IMPORT ZOTERO: {e}")
        send_project_notification(
            project_id, 'zotero_import_failed', f'Échec de l\'import Zotero: {str(e)}'
        )
        
def fetch_online_pdf_task(project_id, article_ids):
    """Recherche et télécharge des PDF OA via DOI→Unpaywall."""
    print(f"🌐 Recherche OA (DOI→Unpaywall) pour {len(article_ids)} articles...")
    
    successful_ids = []
    
    try:
        project_dir = PROJECTS_DIR / project_id
        project_dir.mkdir(exist_ok=True)
        
        # Récupérer les DOI des articles depuis la base de données
        with sqlite3.connect(DATABASE_FILE) as conn:
            conn.row_factory = sqlite3.Row
            articles = conn.execute("""
                SELECT article_id, doi FROM search_results 
                WHERE project_id = ? AND article_id IN ({})
            """.format(','.join(['?']*len(article_ids))), [project_id] + article_ids).fetchall()
        
        for article in articles:
            try:
                article_id = article['article_id']
                doi = article['doi']
                
                if not doi:
                    print(f"⏩ Pas de DOI pour article {article_id}")
                    continue
                
                # Étape : DOI → URL PDF via Unpaywall
                pdf_url = fetch_unpaywall_pdf_url(doi)
                if not pdf_url:
                    print(f"⏩ Pas de PDF OA pour DOI {doi} (article {article_id})")
                    continue
                
                # Étape : Télécharger le PDF
                resp = http_get_with_retries(pdf_url, timeout=30)
                if resp.status_code == 200:
                    content_type = resp.headers.get("Content-Type", "").lower()
                    if content_type.startswith("application/pdf"):
                        safe_filename = sanitize_filename(article_id) + ".pdf"
                        pdf_path = project_dir / safe_filename
                        
                        with open(pdf_path, "wb") as f:
                            f.write(resp.content)
                        
                        print(f"✅ PDF OA téléchargé pour {article_id} sous le nom {safe_filename}")
                        successful_ids.append(article_id)
                    else:
                        print(f"⚠️ Contenu non-PDF pour article {article_id} (type: {content_type})")
                else:
                    print(f"⚠️ Statut HTTP {resp.status_code} pour article {article_id}")
                
                time.sleep(0.4)  # politesse API
            
            except Exception as e:
                print(f"❌ Erreur pour article {article_id}: {e}")
                continue
        
        # Mémoriser le résultat dans Redis
        redis_key = f"online_fetch_result:{project_id}"
        redis_conn.set(redis_key, json.dumps(successful_ids), ex=600)
        
        print(f"📊 OA terminé: {len(successful_ids)}/{len(article_ids)} PDF trouvés")
        
        # Notification de fin
        send_project_notification(
            project_id,
            'fetch_online_completed',
            f'Recherche OA terminée: {len(successful_ids)}/{len(article_ids)} PDF trouvés',
            {'successful_count': len(successful_ids), 'total_count': len(article_ids)}
        )
    
    except Exception as e:
        print(f"❌ Erreur critique OA: {e}")
        redis_key = f"online_fetch_result:{project_id}"
        redis_conn.set(redis_key, json.dumps([]), ex=600)
        
def index_project_pdfs_task(project_id: str):
    """Indexe les PDF d'un projet avec normalisation, filtrage et embeddings."""
    print(f"📚 Indexation améliorée pour le projet {project_id}...")
    
    try:
        project_dir = PROJECTS_DIR / project_id
        
        chroma_client = chromadb.PersistentClient(path=str(project_dir / "chroma_db"))
        collection_name = f"project_{project_id}"
        
        try:
            chroma_client.delete_collection(collection_name)
            print(f"🗑️ Ancienne collection supprimée: {collection_name}")
        except Exception:
            pass # C'est normal si la collection n'existait pas
        
        collection = chroma_client.create_collection(collection_name)
        
        pdf_files = list(project_dir.glob("*.pdf"))
        if not pdf_files:
            print("❌ Aucun PDF trouvé pour l'indexation")
            send_project_notification(
                project_id,
                'indexing_failed',
                'Aucun PDF trouvé pour l\'indexation'
            )
            return
        
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=config.CHUNK_SIZE,
            chunk_overlap=config.CHUNK_OVERLAP,
            length_function=len,
        )
        
        all_documents, all_metadatas, all_ids = [], [], []
        total_filtered = 0
        successful_files = 0
        
        for pdf_file in pdf_files:
            # CORRECTION : S'assurer que la variable article_id est toujours définie dans la boucle
            article_id = pdf_file.stem
            if not article_id:
                continue # Ignorer les fichiers sans nom de base

            try:
                text = extract_text_from_pdf(pdf_file)
                if not text or len(text.strip()) < 50:
                    print(f"⚠️ Texte trop court ou vide pour {article_id}")
                    continue
                
                text = normalize_text(text)
                chunks = text_splitter.split_text(text)
                
                keep_docs, seen_hashes = [], set()
                
                for i, chunk in enumerate(chunks):
                    c = normalize_text(chunk)
                    if len(c) < MIN_CHUNK_LEN:
                        continue
                    
                    h = hashlib.sha1(c.encode("utf-8")).hexdigest()
                    if h in seen_hashes:
                        continue
                    
                    seen_hashes.add(h)
                    keep_docs.append(c)
                    
                    all_metadatas.append({
                        'article_id': article_id,
                        'chunk_id': len(keep_docs)-1,
                        'source': str(pdf_file.name)
                    })
                    all_ids.append(f"{article_id}_chunk_{len(keep_docs)-1}")

                all_documents.extend(keep_docs)
                total_filtered += len(chunks) - len(keep_docs)
                successful_files += 1
                print(f"🔎 {article_id}: {len(chunks)} → {len(keep_docs)} chunks (filtrage+dedup)")
            
            except Exception as e:
                print(f"❌ Erreur durant le traitement du PDF {article_id}: {e}")
                continue
        
        if all_documents:
            print(f"🤖 Calcul embeddings pour {len(all_documents)} chunks...")
            vectors = embedding_model.encode(all_documents, batch_size=EMBED_BATCH, show_progress_bar=False).tolist()
            
            collection.add(
                documents=all_documents,
                metadatas=all_metadatas,
                ids=all_ids,
                embeddings=vectors
            )
            
            print(f"✅ Indexation terminée: {len(all_documents)} chunks de {successful_files}/{len(pdf_files)} PDF")
            with sqlite3.connect(DATABASE_FILE) as conn:
                conn.execute("UPDATE projects SET indexed_at = ? WHERE id = ?", (datetime.now().isoformat(), project_id))
                conn.commit()
            
            send_project_notification(project_id, 'indexing_completed', f'Indexation terminée: {len(all_documents)} chunks indexés.')
        else:
            print("❌ Aucun chunk valide après filtrage.")
            send_project_notification(project_id, 'indexing_failed', 'Aucun contenu textuel trouvé dans les PDF.')
    
    except Exception as e:
        print(f"❌ Erreur critique lors de l'indexation: {e}")
        send_project_notification(project_id, 'indexing_failed', f'Erreur critique: {str(e)}')

def answer_chat_question_task(project_id: str, question: str, profile: dict):
    """Répond à une question avec recherche par embeddings optionnelle."""
    print(f"💬 Question reçue pour le projet {project_id}: {question}")
    
    try:
        project_dir = PROJECTS_DIR / project_id
        chroma_path = project_dir / "chroma_db"
        
        if not chroma_path.exists():
            return {
                "answer": "❌ Le corpus n'a pas encore été indexé. Veuillez d'abord lancer l'indexation.",
                "sources": []
            }
        
        # Connexion à ChromaDB
        chroma_client = chromadb.PersistentClient(path=str(chroma_path))
        collection_name = f"project_{project_id}"
        
        try:
            collection = chroma_client.get_collection(collection_name)
        except Exception:
            return {
                "answer": "❌ Collection non trouvée. Veuillez ré-indexer le corpus.",
                "sources": []
            }
        
        # Recherche de documents pertinents (avec ou sans embeddings)
        if USE_QUERY_EMBED:
            print("🔍 Recherche par embedding...")
            qv = embedding_model.encode([question], convert_to_numpy=True).tolist()
            results = collection.query(query_embeddings=qv, n_results=5)
        else:
            print("🔍 Recherche textuelle...")
            results = collection.query(query_texts=[question], n_results=5)
        
        if not results['documents'] or not results['documents'][0]:
            return {
                "answer": "❌ Aucun document pertinent trouvé pour cette question.",
                "sources": []
            }
        
        # Construire le contexte
        context_chunks = results['documents'][0]
        context_metadatas = results['metadatas'][0]
        
        context = "\n\n".join([
            f"Source: {meta['source']} (Article: {meta['article_id']})\n{chunk}"
            for chunk, meta in zip(context_chunks, context_metadatas)
        ])
        
        # Construire le prompt RAG
        rag_prompt = f"""Tu es un assistant de recherche expert. Réponds à la question suivante en te basant UNIQUEMENT sur le contexte fourni.

Question: {question}

Contexte:

{context}

Instructions:
- Réponds de manière précise et factuelle
- Cite les sources (ID articles) dans ta réponse
- Si l'information n'est pas dans le contexte, dis-le clairement
- Sois concis mais complet

Réponse:"""
        
        # Appel à l'IA
        answer = call_ollama_api(rag_prompt, profile.get('synthesis_model', 'llama3.1:8b'))
        
        # Extraire les sources uniques
        sources = list(set([f"Article: {meta['article_id']}" for meta in context_metadatas]))
        
        # Sauvegarder dans l'historique
        chat_message_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()
        
        with sqlite3.connect(DATABASE_FILE) as conn:
            # Message utilisateur
            conn.execute("""
                INSERT INTO chat_messages (id, project_id, role, content, timestamp) 
                VALUES (?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), project_id, "user", question, timestamp))
            
            # Réponse assistant
            conn.execute("""
                INSERT INTO chat_messages (id, project_id, role, content, sources, timestamp) 
                VALUES (?, ?, ?, ?, ?, ?)
            """, (chat_message_id, project_id, "assistant", answer, json.dumps(sources), timestamp))
            
            conn.commit()
        
        return {
            "answer": answer,
            "sources": sources
        }
    
    except Exception as e:
        print(f"❌ Erreur lors de la réponse au chat: {e}")
        return {
            "answer": f"❌ Erreur lors de la génération de la réponse: {str(e)}",
            "sources": []
        }
 
def import_from_zotero_file_task(project_id, zotero_json_data):
    """
    Importe des PDF en se basant sur un export CSL JSON de Zotero.
    Cette version détecte automatiquement si la bibliothèque est personnelle ou de groupe.
    """
    zotero_api_key = os.getenv('ZOTERO_API_KEY')
    print(f"🔄 Import Zotero depuis fichier pour {len(zotero_json_data)} articles...")

    if not zotero_json_data:
        print("❌ Fichier Zotero vide.")
        return

    # --- DÉTECTION AUTOMATIQUE DE LA BIBLIOTHÈQUE ---
    try:
        first_item_id_uri = zotero_json_data[0].get('id', '')
        parts = first_item_id_uri.split('/')
        library_type = parts[3]
        library_id = parts[4]
        
        if library_type == 'users':
            library_type = 'user'
        
        print(f"🏢 Bibliothèque Zotero détectée: type='{library_type}', id='{library_id}'")
        
        zot = zotero.Zotero(library_id, library_type, zotero_api_key)
        zot.key_info()
        print("✅ Connexion à l'API Zotero réussie.")

    except Exception as e:
        print(f"❌ ÉCHEC CONNEXION ZOTERO. Erreur: {e}")
        send_project_notification(project_id, 'zotero_import_failed', 'Échec connexion Zotero.')
        return

    # --- AJOUT DES ARTICLES À LA BASE DE DONNÉES ---
    with sqlite3.connect(DATABASE_FILE) as conn:
        for item in zotero_json_data:
            article_id = item.get('DOI', item.get('PMID', item.get('id', str(uuid.uuid4()))))
            title = item.get('title', 'Titre inconnu')
            abstract = item.get('abstract', '')
            
            exists = conn.execute("SELECT 1 FROM search_results WHERE project_id = ? AND article_id = ?", (project_id, article_id)).fetchone()
            if not exists:
                conn.execute("""
                    INSERT INTO search_results (id, project_id, article_id, title, abstract, database_source, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (str(uuid.uuid4()), project_id, article_id, title, abstract, 'zotero_file', datetime.now().isoformat()))
        conn.commit()

    # --- TÉLÉCHARGEMENT DES PDF ---
    project_dir = PROJECTS_DIR / project_id
    project_dir.mkdir(exist_ok=True)
    successful_imports = 0

    for item in zotero_json_data:
        # ## CORRECTION DE LA FAUTE DE FRAPPE ICI ##
        zotero_item_key_uri = item.get('id')
        zotero_item_key = zotero_item_key_uri.split('/')[-1] if zotero_item_key_uri else None
        
        article_id = item.get('DOI', item.get('PMID', zotero_item_key))
        
        if not zotero_item_key:
            continue

        try:
            attachments = zot.children(zotero_item_key)
            for attachment in attachments:
                if attachment.get('data', {}).get('contentType') == 'application/pdf':
                    pdf_content = zot.file(attachment['key'])
                    safe_filename = sanitize_filename(article_id) + ".pdf"
                    pdf_path = project_dir / safe_filename
                    with open(pdf_path, 'wb') as f:
                        f.write(pdf_content)
                    
                    print(f"✅ PDF téléchargé pour {article_id} via Zotero Key {zotero_item_key}")
                    successful_imports += 1
                    break
            time.sleep(0.5)
        except Exception as e:
            print(f"❌ Erreur import PDF pour Zotero Key {zotero_item_key}: {e}")

    print(f"📊 Import Fichier Zotero terminé: {successful_imports}/{len(zotero_json_data)} PDF importés")
    send_project_notification(
        project_id,
        'zotero_import_completed',
        f'Import Fichier Zotero terminé: {successful_imports}/{len(zotero_json_data)} PDF importés'
    )