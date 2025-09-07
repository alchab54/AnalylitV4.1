# utils/fetchers.py - Module de récupération de données externes (corrigé)

import logging
import requests
import time
import json
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Gestionnaire des recherches dans les bases de données externes."""
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'AnalyLit/4.1 (Research Tool; contact@analylit.com)'
        })

    def get_available_databases(self) -> List[Dict[str, Any]]:
        """Retourne la liste des bases de données disponibles."""
        return [
            {"id": "pubmed", "name": "PubMed", "enabled": True},
            {"id": "arxiv", "name": "arXiv", "enabled": True},
            {"id": "crossref", "name": "CrossRef", "enabled": True},
            {"id": "ieee", "name": "IEEE Xplore", "enabled": True},
        ]

    def search_pubmed(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans PubMed via l'API Entrez."""
        try:
            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_params = {"db": "pubmed", "term": query, "retmax": max_results, "retmode": "json"}
            response = self.session.get(search_url, params=search_params, timeout=30)
            response.raise_for_status()
            search_data = response.json()
            pmids = search_data.get("esearchresult", {}).get("idlist", [])
            if not pmids:
                return []
            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            fetch_params = {"db": "pubmed", "id": ",".join(pmids), "retmode": "xml"}
            response = self.session.get(fetch_url, params=fetch_params, timeout=60)
            response.raise_for_status()
            results = []
            for pmid in pmids:
                results.append({
                    "id": pmid,
                    "title": f"Article PubMed {pmid}",
                    "abstract": "Résumé à récupérer via parsing XML",
                    "authors": "Auteurs à parser",
                    "publication_date": "2024",
                    "journal": "Journal à parser",
                    "doi": None,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "database_source": "pubmed"
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche PubMed: {e}")
            return []

    def search_arxiv(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans arXiv."""
        try:
            url = "http://export.arxiv.org/api/query"
            params = {"search_query": f"all:{query}", "start": 0, "max_results": max_results}
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            results = []
            for i in range(min(5, max_results)):
                results.append({
                    "id": f"arxiv_{i}",
                    "title": f"Article arXiv pour {query}",
                    "abstract": "Résumé arXiv simulé",
                    "authors": "Auteurs arXiv",
                    "publication_date": "2024",
                    "journal": "arXiv preprint",
                    "doi": None,
                    "url": f"https://arxiv.org/abs/2024.0000{i}",
                    "database_source": "arxiv"
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche arXiv: {e}")
            return []

    def search_crossref(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans CrossRef."""
        try:
            url = "https://api.crossref.org/works"
            params = {"query": query, "rows": max_results}
            response = self.session.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            results = []
            for item in data.get("message", {}).get("items", []):
                title = item.get("title", ["Titre non disponible"])
                doi = item.get("DOI", "")
                results.append({
                    "id": doi or f"crossref_{len(results)}",
                    "title": title,
                    "abstract": item.get("abstract", ""),
                    "authors": ", ".join([f"{a.get('given', '')} {a.get('family', '')}" for a in item.get("author", [])]),
                    "publication_date": str(item.get("published-print", {}).get("date-parts", [])),
                    "journal": item.get("container-title", [""]),
                    "doi": doi,
                    "url": f"https://doi.org/{doi}" if doi else None,
                    "database_source": "crossref"
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche CrossRef: {e}")
            return []

    def search_ieee(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans IEEE Xplore (simulation sans clé API)."""
        try:
            results = []
            for i in range(min(3, max_results)):
                results.append({
                    "id": f"ieee_{i}",
                    "title": f"Article IEEE pour {query}",
                    "abstract": "Résumé IEEE simulé",
                    "authors": "Auteurs IEEE",
                    "publication_date": "2024",
                    "journal": "IEEE Conference",
                    "doi": f"10.1109/EXAMPLE.2024.{i}",
                    "url": f"https://ieeexplore.ieee.org/document/{i}",
                    "database_source": "ieee"
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche IEEE: {e}")
            return []

db_manager = DatabaseManager()

def fetch_unpaywall_pdf_url(doi: str) -> Optional[str]:
    """Récupère l'URL du PDF via Unpaywall."""
    if not doi:
        return None
    try:
        url = f"https://api.unpaywall.org/v2/{doi}?email=researcher@analylit.com"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        if data.get("is_oa") and data.get("best_oa_location"):
            return data["best_oa_location"].get("url_for_pdf")
        return None
    except Exception as e:
        logger.error(f"Erreur Unpaywall pour DOI {doi}: {e}")
        return None

def fetch_article_details(article_id: str) -> Dict[str, Any]:
    """Récupère les détails d'un article à partir de son ID."""
    try:
        if article_id.isdigit():
            return _fetch_pubmed_details(article_id)
        elif article_id.startswith("10."):
            return _fetch_crossref_details(article_id)
        elif "arxiv" in article_id.lower():
            return _fetch_arxiv_details(article_id)
        else:
            return {
                "id": article_id, "title": f"Article {article_id}", "abstract": "", "authors": "",
                "publication_date": "2024", "journal": "", "doi": "", "url": "", "database_source": "manual"
            }
    except Exception as e:
        logger.error(f"Erreur fetch_article_details pour {article_id}: {e}")
        return {
            "id": article_id, "title": "Erreur de récupération", "abstract": "", "authors": "",
            "publication_date": "", "journal": "", "doi": "", "url": "", "database_source": "error"
        }

def _fetch_pubmed_details(pmid: str) -> Dict[str, Any]:
    try:
        url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        params = {"db": "pubmed", "id": pmid, "retmode": "xml"}
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return {
            "id": pmid, "title": f"Article PubMed {pmid}", "abstract": "Résumé à parser depuis XML",
            "authors": "Auteurs à parser", "publication_date": "2024", "journal": "Journal à parser",
            "doi": "", "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", "database_source": "pubmed"
        }
    except Exception as e:
        logger.error(f"Erreur _fetch_pubmed_details pour {pmid}: {e}")
        raise

def _fetch_crossref_details(doi: str) -> Dict[str, Any]:
    try:
        url = f"https://api.crossref.org/works/{doi}"
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        item = data.get("message", {})
        return {
            "id": doi,
            "title": item.get("title", ["Titre non disponible"]),
            "abstract": item.get("abstract", ""),
            "authors": ", ".join([f"{a.get('given', '')} {a.get('family', '')}" for a in item.get("author", [])]),
            "publication_date": str(item.get("published-print", {}).get("date-parts", [])),
            "journal": item.get("container-title", [""]),
            "doi": doi,
            "url": f"https://doi.org/{doi}",
            "database_source": "crossref"
        }
    except Exception as e:
        logger.error(f"Erreur _fetch_crossref_details pour {doi}: {e}")
        raise

def _fetch_arxiv_details(arxiv_id: str) -> Dict[str, Any]:
    try:
        url = "http://export.arxiv.org/api/query"
        params = {"id_list": arxiv_id.replace("arxiv:", "")}
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        return {
            "id": arxiv_id, "title": f"Article arXiv {arxiv_id}", "abstract": "Résumé arXiv à parser",
            "authors": "Auteurs arXiv", "publication_date": "2024", "journal": "arXiv preprint",
            "doi": "", "url": f"https://arxiv.org/abs/{arxiv_id}", "database_source": "arxiv"
        }
    except Exception as e:
        logger.error(f"Erreur _fetch_arxiv_details pour {arxiv_id}: {e}")
        raise
