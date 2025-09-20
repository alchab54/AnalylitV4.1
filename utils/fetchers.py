# utils/fetchers.py - Module de récupération de données externes (CORRIGÉ)

import logging
import requests
import time
import json
import xml.etree.ElementTree as ET
from typing import List, Dict, Optional, Any

logger = logging.getLogger(__name__)

class DatabaseManager:
    """Gestionnaire des recherches dans les bases de données externes."""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'AnalyLit/4.1 (Research Tool; contact@analylit.com)'
        })

    def _parse_pubmed_xml(self, xml_data: str) -> List[Dict[str, Any]]:
        """Parse le XML de la réponse eFetch de PubMed."""
        results = []
        try:
            root = ET.fromstring(xml_data)
            for article in root.findall('.//PubmedArticle'):
                pmid_node = article.find('.//PMID')
                pmid = pmid_node.text if pmid_node is not None else ''

                title_node = article.find('.//ArticleTitle')
                title = title_node.text if title_node is not None else 'N/A'

                abstract_node = article.find('.//Abstract/AbstractText')
                abstract = abstract_node.text if abstract_node is not None else ''

                authors_list = []
                for author in article.findall('.//Author'):
                    lastname = author.find('LastName')
                    initials = author.find('Initials')
                    if lastname is not None and initials is not None:
                        authors_list.append(f"{lastname.text} {initials.text}")
                authors = ", ".join(authors_list)

                journal_node = article.find('.//ISOAbbreviation')
                journal = journal_node.text if journal_node is not None else ''

                doi_node = article.find('.//ArticleId[@IdType="doi"]')
                doi = doi_node.text if doi_node is not None else ''
                
                year_node = article.find('.//ArticleDate/Year')
                pub_date = year_node.text if year_node is not None else ''

                results.append({
                    "id": pmid,
                    "title": title,
                    "abstract": abstract,
                    "authors": authors,
                    "publication_date": pub_date,
                    "journal": journal,
                    "doi": doi,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    "database_source": "pubmed"
                })
        except ET.ParseError as e:
            logger.error(f"Erreur parsing XML PubMed: {e}")
        return results

    def _parse_arxiv_xml(self, xml_data: str) -> List[Dict[str, Any]]:
        """Parse le flux Atom XML d'arXiv."""
        results = []
        try:
            ns = {'atom': 'http://www.w3.org/2005/Atom'}
            root = ET.fromstring(xml_data)
            for entry in root.findall('atom:entry', ns):
                arxiv_id_node = entry.find('atom:id', ns)
                # CORRECTION: Extrait l'ID correctement, ex: 'http://arxiv.org/abs/1234.5678v1' -> '1234.5678v1'
                arxiv_id = arxiv_id_node.text.split('/abs/')[-1] if arxiv_id_node is not None else ''

                title_node = entry.find('atom:title', ns)
                title = title_node.text.strip() if title_node is not None else 'N/A'
                
                summary_node = entry.find('atom:summary', ns)
                abstract = summary_node.text.strip() if summary_node is not None else ''
                
                authors_list = [author.find('atom:name', ns).text for author in entry.findall('atom:author', ns)]
                authors = ", ".join(authors_list)
                
                pub_date_node = entry.find('atom:published', ns)
                pub_date = pub_date_node.text.split('T')[0] if pub_date_node is not None else ''
                
                results.append({
                    "id": f"arxiv:{arxiv_id}",
                    "title": title,
                    "abstract": abstract,
                    "authors": authors,
                    "publication_date": pub_date,
                    "journal": "arXiv preprint",
                    "doi": None, # ArXiv a son propre système d'ID
                    "url": f"https://arxiv.org/abs/{arxiv_id}",
                    "database_source": "arxiv"
                })
        except ET.ParseError as e:
            logger.error(f"Erreur parsing XML arXiv: {e}")
        return results
        
    def get_available_databases(self) -> List[Dict[str, Any]]:
        """Retourne la liste des bases de données disponibles."""
        return [
            {"id": "pubmed", "name": "PubMed", "enabled": True},
            {"id": "arxiv", "name": "arXiv", "enabled": True},
            {"id": "crossref", "name": "CrossRef", "enabled": True},
            {"id": "ieee", "name": "IEEE Xplore (Simulé)", "enabled": True},
        ]

    def search_pubmed(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans PubMed via l'API Entrez et récupère les détails."""
        try:
            search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
            search_params = {"db": "pubmed", "term": query, "retmax": max_results, "retmode": "json"}
            response = requests.get(search_url, params=search_params, timeout=30)
            response.raise_for_status()
            search_data = response.json()
            pmids = search_data.get("esearchresult", {}).get("idlist", [])
            
            if not pmids:
                return []

            fetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
            # On récupère en mode XML pour avoir tous les détails
            fetch_params = {"db": "pubmed", "id": ",".join(pmids), "retmode": "xml"}
            fetch_response = requests.post(fetch_url, data=fetch_params, timeout=60)
            fetch_response.raise_for_status()
            
            return self._parse_pubmed_xml(fetch_response.text)
            
        except Exception as e:
            logger.error(f"Erreur recherche PubMed: {e}", exc_info=True)
            return []

    def search_arxiv(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans arXiv via son API."""
        try:
            url = "http://export.arxiv.org/api/query"
            params = {"search_query": f'all:"{query}"', "start": 0, "max_results": max_results}
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            return self._parse_arxiv_xml(response.text)
        except Exception as e:
            logger.error(f"Erreur recherche arXiv: {e}", exc_info=True)
            return []

    def search_crossref(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans CrossRef."""
        try:
            url = "https://api.crossref.org/works"
            params = {"query": query, "rows": max_results, "mailto": "contact@analylit.com"}
            response = requests.get(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            results = []
            for item in data.get("message", {}).get("items", []):
                title = (item.get("title") or ["Titre non disponible"])[0]
                doi = item.get("DOI", "")
                
                authors_list = []
                for author in item.get("author", []):
                    if 'family' in author:
                        authors_list.append(f"{author.get('given', '')} {author.get('family', '')}".strip())

                pub_date_parts = item.get("published-print", {}).get("date-parts", [[]])[0]
                pub_date = "-".join(map(str, pub_date_parts)) if pub_date_parts else ""

                results.append({
                    "id": doi or f"crossref_{len(results)}",
                    "title": title,
                    "abstract": item.get("abstract", "").replace("</jats:p>", "").replace("<jats:p>", ""), # Nettoyage simple
                    "authors": ", ".join(authors_list),
                    "publication_date": pub_date,
                    "journal": (item.get("container-title") or [""])[0],
                    "doi": doi,
                    "url": f"https://doi.org/{doi}" if doi else item.get("URL"),
                    "database_source": "crossref"
                })
            return results
        except Exception as e:
            logger.error(f"Erreur recherche CrossRef: {e}", exc_info=True)
            return []

    def search_ieee(self, query: str, max_results: int = 50) -> List[Dict[str, Any]]:
        """Recherche dans IEEE Xplore (simulation sans clé API)."""
        logger.warning("La recherche IEEE est simulée car elle requiert une clé API non fournie.")
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
        if article_id.isdigit() and len(article_id) >= 7:
            # C'est un PMID
            return _fetch_pubmed_details(article_id)
        elif article_id.startswith("10.") and "/" in article_id:
            # C'est un DOI
            return _fetch_crossref_details(article_id)
        elif "arxiv" in article_id.lower() or "arXiv" in article_id:
            # C'est un arXiv ID
            return _fetch_arxiv_details(article_id)
        else:
            # ID non reconnu, créer un placeholder
            return {
                "id": article_id, 
                "title": f"Article {article_id} - Détails à compléter manuellement", 
                "abstract": "Résumé non disponible. Veuillez ajouter manuellement les détails de cet article.", 
                "authors": "Auteurs non spécifiés",
                "publication_date": "2024", 
                "journal": "Journal à spécifier", 
                "doi": "", 
                "url": "", 
                "database_source": "manual"
            }

    except Exception as e:
        logger.error(f"Erreur fetch_article_details pour {article_id}: {e}")
        return {
            "id": article_id, 
            "title": "Erreur de récupération des détails", 
            "abstract": "Impossible de récupérer les informations de cet article.", 
            "authors": "Auteurs inconnus",
            "publication_date": "", 
            "journal": "", 
            "doi": "", 
            "url": "", 
            "database_source": "error"
        }

def _fetch_pubmed_details(pmid: str) -> Dict[str, Any]:
    """Récupère les détails d'un article PubMed via l'API Entrez."""
    try:
        # 1. Récupérer les détails XML
        url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        params = {"db": "pubmed", "id": pmid, "retmode": "xml"}
        response = requests.get(url, params=params, timeout=30)
        response.raise_for_status()
        
        # 2. Parser le XML
        import xml.etree.ElementTree as ET
        root = ET.fromstring(response.text)
        
        # Extraire les informations
        article = root.find('.//PubmedArticle')
        if article is None:
            raise ValueError("Article non trouvé dans la réponse PubMed")
        
        # Titre
        title_node = article.find('.//ArticleTitle')
        title = title_node.text if title_node is not None else f"Article PubMed {pmid}"
        
        # Résumé
        abstract_node = article.find('.//Abstract/AbstractText')
        abstract = abstract_node.text if abstract_node is not None else "Résumé non disponible"
        
        # Auteurs
        authors_list = []
        for author in article.findall('.//Author'):
            lastname = author.find('LastName')
            initials = author.find('Initials')
            if lastname is not None and initials is not None:
                authors_list.append(f"{lastname.text} {initials.text}")
        authors = ", ".join(authors_list) if authors_list else "Auteurs non spécifiés"
        
        # Journal
        journal_node = article.find('.//ISOAbbreviation')
        if journal_node is None:
            journal_node = article.find('.//Title')
        journal = journal_node.text if journal_node is not None else "Journal non spécifié"
        
        # Date de publication
        year_node = article.find('.//ArticleDate/Year')
        pub_date = year_node.text if year_node is not None else "2024"
        
        # DOI
        doi_node = article.find('.//ArticleId[@IdType="doi"]')
        doi = doi_node.text if doi_node is not None else ""
        
        return {
            "id": pmid, 
            "title": title, 
            "abstract": abstract,
            "authors": authors, 
            "publication_date": pub_date, 
            "journal": journal,
            "doi": doi, 
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", 
            "database_source": "pubmed"
        }

    except Exception as e:
        logger.error(f"Erreur _fetch_pubmed_details pour {pmid}: {e}")
        # Fallback avec données partielles
        return {
            "id": pmid, 
            "title": f"Article PubMed {pmid} (erreur récupération)", 
            "abstract": "Erreur lors de la récupération du résumé depuis PubMed",
            "authors": "Auteurs à récupérer", 
            "publication_date": "2024", 
            "journal": "Journal à récupérer",
            "doi": "", 
            "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/", 
            "database_source": "pubmed"
        }


def _fetch_crossref_details(doi: str) -> Dict[str, Any]:
    try:
        url = f"https://api.crossref.org/works/{doi}"
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        item = data.get("message", {})
        return {
            "id": doi,
            "title": (item.get("title") or ["Titre non disponible"])[0],
            "abstract": item.get("abstract", ""),
            "authors": ", ".join([f"{a.get('given', '')} {a.get('family', '')}" for a in item.get("author", [])]),
            "publication_date": "-".join(map(str, item.get("published-print", {}).get("date-parts", [[]])[0])),
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
        
        # Utiliser le parseur existant pour extraire les détails
        parsed_results = db_manager._parse_arxiv_xml(response.text)
        if parsed_results:
            return parsed_results[0]
        raise ValueError(f"Impossible de parser les détails pour arXiv ID: {arxiv_id}")

    except Exception as e:
        logger.error(f"Erreur _fetch_arxiv_details pour {arxiv_id}: {e}")
        raise
