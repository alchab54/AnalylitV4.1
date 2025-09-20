# utils/importers.py (corrigé)

import json
import re
import hashlib
import logging
import pandas as pd
from pathlib import Path
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class ZoteroAbstractExtractor:
    def __init__(self, json_path: str):
        self.json_path = Path(json_path)
        self.stats = {"total": 0, "with_abstract": 0, "with_pmid": 0, "duplicates": 0, "errors": 0}

    def clean_html(self, text: str) -> str:
        text = re.sub(r"<[^>]+>", " ", text or "")
        return re.sub(r"\s+", " ", text).strip()

    def load_items(self) -> list:
        if not self.json_path.exists():
            raise FileNotFoundError(f"Le fichier {self.json_path} est introuvable.")
        raw_data = json.loads(self.json_path.read_text(encoding="utf-8"))
        items = raw_data.get("items", raw_data if isinstance(raw_data, list) else [])
        self.stats["total"] = len(items)
        logger.info(f"{len(items)} références chargées depuis le fichier.")
        return items

    def _get_best_identifier(self, item: dict) -> str:
        """
        Tente d'extraire le meilleur identifiant unique (PMID, DOI, puis Zotero Key).
        """
        # 1. Chercher un PMID
        extra_field = str(item.get("extra", ""))
        pmid_field = str(item.get("PMID", ""))
        combined_text = extra_field + " " + pmid_field
        pmid_match = re.search(r'\b(\d{7,9})\b', combined_text)
        if pmid_match:
            self.stats["with_pmid"] += 1
            return pmid_match.group(1)

        # 2. Chercher un DOI
        doi = item.get("DOI")
        if doi and isinstance(doi, str) and doi.strip():
            return doi.strip()

        # 3. En dernier recours, utiliser la clé Zotero
        zotero_key = item.get("key")
        if zotero_key:
            return f"zotero:{zotero_key}"

        # 4. Si vraiment rien, générer un ID basé sur un hash
        title = item.get("title", "Sans titre") or "Sans titre"
        return hashlib.md5(title[:50].encode()).hexdigest()[:16]

    def _get_publication_year(self, item: dict) -> Optional[str]:
        """Extrait l'année de publication de manière robuste."""
        date_str = str(item.get("date", "")) or str(item.get("year", ""))
        if date_str:
            year_match = re.search(r'\b(19|20)\d{2}\b', date_str)
            if year_match:
                return year_match.group(0)
        return None

    def extract_reference_data(self, item: dict) -> dict:
        try:
            pmid_text = item.get("extra", "") or ""
            if isinstance(item.get("PMID"), (str, int, float)):
                pmid_text += " " + str(item.get("PMID"))
            pmid_match = re.search(r'\b(\d{7,9})\b', pmid_text)
            pmid = pmid_match.group(1) if pmid_match else None

            abstract = item.get("abstractNote", "") or ""
            if abstract:
                self.stats["with_abstract"] += 1

            authors_list = []
            for creator in item.get("creators", []):
                # Vérification de type plus robuste
                if isinstance(creator, dict) and creator.get("lastName"):
                    authors_list.append(f"{creator.get('lastName', '')}, {creator.get('firstName', '')}")
            authors = "; ".join(authors_list)

            year = self._get_publication_year(item)

            title = item.get("title", "Sans titre") or "Sans titre"
            hash_base = f"{title[:50]}_{(authors_list if authors_list else '')}_{year or ''}"

            return {
                "zotero_key": item.get("key"),
                "article_id": self._get_best_identifier(item),
                "title": title,
                "authors": authors,
                "publication_date": year or "",
                "journal": item.get("publicationTitle", "") or "",
                "abstract": self.clean_html(abstract),
                "doi": item.get("DOI", "") or "",
                "url": item.get("url", f"https://doi.org/{item.get('DOI', '')}" if item.get('DOI') else "") or "",
                "database_source": "zotero_import",
                "__hash": hashlib.md5(hash_base.encode()).hexdigest(),
            }
        except Exception as e:
            logger.error(f"Erreur d'extraction sur une référence: {e}")
            self.stats["errors"] += 1
            return None

    def process(self) -> list[dict]:
        """Orchestre le processus et retourne une liste de dictionnaires."""
        items = self.load_items()
        records = [self.extract_reference_data(i) for i in items if i]
        seen_hashes = set()
        unique_records = []
        for rec in records:
            if not rec:
                continue
            h = rec.get("__hash")
            if h and h not in seen_hashes:
                # préparer avant suppression
                seen_hashes.add(h)
                del rec["__hash"]
                unique_records.append(rec)
            else:
                self.stats["duplicates"] += 1
        logger.info(f"Traitement terminé. {len(unique_records)} uniques trouvés.")
        return unique_records

# --- NOUVELLES FONCTIONS POUR L'EXTENSION CHROME ---

def _clean_html_for_extension(text: str) -> str:
    """Nettoie le HTML pour l'import d'extension."""
    text = re.sub(r"<[^>]+>", " ", text or "")
    return re.sub(r"\s+", " ", text).strip()

def _get_publication_year_for_extension(item: dict) -> Optional[str]:
    """Extrait l'année de publication de manière robuste pour l'import d'extension."""
    date_str = str(item.get("date", "")) or str(item.get("year", ""))
    if date_str:
        year_match = re.search(r'\b(19|20)\d{2}\b', date_str)
        if year_match:
            return year_match.group(0)
    return None

def _get_best_identifier_for_extension(item: dict) -> str:
    """Tente d'extraire le meilleur identifiant unique pour l'import d'extension."""
    # 1. Chercher un PMID (logique de ZoteroAbstractExtractor)
    extra_field = str(item.get("extra", ""))
    pmid_field = str(item.get("PMID", ""))
    combined_text = extra_field + " " + pmid_field
    pmid_match = re.search(r'\b(\d{7,9})\b', combined_text)
    if pmid_match:
        return pmid_match.group(1)

    # 2. Chercher un DOI
    doi = item.get("DOI")
    if doi and isinstance(doi, str) and doi.strip():
        return doi.strip()
    
    # 3. Utiliser l'URL si c'est un lien DOI
    url = item.get("url", "")
    if "doi.org/" in url:
        return url.split("doi.org/")[-1]

    # 4. En dernier recours, utiliser la clé Zotero
    zotero_key = item.get("key")
    if zotero_key:
        return f"zotero:{zotero_key}"

    # 5. Si vraiment rien, générer un ID basé sur un hash
    title = item.get("title", "Sans titre") or "Sans titre"
    return hashlib.md5(title[:50].encode()).hexdigest()[:16]

def _extract_reference_data_for_extension(item: dict) -> Optional[dict]:
    """
    Extrait et formate les données d'un seul item Zotero
    provenant du payload JSON de l'extension.
    """
    try:
        authors_list = []
        for creator in item.get("creators", []):
            if isinstance(creator, dict):
                # Format de zotero-inject.js
                if creator.get("lastName"):
                    authors_list.append(f"{creator.get('lastName', '')}, {creator.get('firstName', '')}")
                # Format JSON Zotero standard
                elif creator.get("name"):
                     authors_list.append(creator.get("name"))

        authors = "; ".join(authors_list)
        year = _get_publication_year_for_extension(item)
        title = item.get("title", "Sans titre") or "Sans titre"
        
        # Créer un hash pour la déduplication
        hash_base = f"{title[:50]}_{(authors_list[0] if authors_list else '')}_{year or ''}"
        
        doi = item.get("DOI", "") or item.get("doi", "")
        url = item.get("url", f"https://doi.org/{doi}" if doi else "") or ""

        return {
            "zotero_key": item.get("key"),
            "article_id": _get_best_identifier_for_extension(item),
            "title": title,
            "authors": authors,
            "publication_date": year or "",
            "journal": item.get("publicationTitle", "") or item.get("journal", ""),
            "abstract": _clean_html_for_extension(item.get("abstractNote", "")),
            "doi": doi,
            "url": url,
            "database_source": "zotero_extension_import",
            "__hash": hashlib.md5(hash_base.encode()).hexdigest(),
        }
    except Exception as e:
        logger.error(f"Erreur d'extraction (extension) sur une référence: {e}")
        return None

def process_zotero_item_list(items: list[dict]) -> list[dict]:
    """
    Orchestre le processus d'import pour une liste d'items JSON
    provenant de l'extension.
    """
    if not items:
        return []

    records = [_extract_reference_data_for_extension(i) for i in items if i]
    
    seen_hashes = set()
    unique_records = []
    duplicates = 0
    
    for rec in records:
        if not rec:
            continue
        h = rec.get("__hash")
        if h and h not in seen_hashes:
            seen_hashes.add(h)
            del rec["__hash"]
            unique_records.append(rec)
        else:
            duplicates += 1
            
    logger.info(f"Traitement (extension) terminé. {len(unique_records)} uniques trouvés, {duplicates} doublons ignorés.")
    return unique_records
