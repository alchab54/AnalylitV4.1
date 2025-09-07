# utils/importers.py (corrigé)

import json
import re
import hashlib
import logging
import pandas as pd
from pathlib import Path
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

    def extract_reference_data(self, item: dict) -> dict:
        try:
            pmid_text = item.get("extra", "") or ""
            if isinstance(item.get("PMID"), (str, int, float)):
                pmid_text += " " + str(item.get("PMID"))
            pmid_match = re.search(r'\b(\d{7,9})\b', pmid_text)
            pmid = pmid_match.group(1) if pmid_match else None
            if pmid:
                self.stats["with_pmid"] += 1

            abstract = item.get("abstractNote", "") or ""
            if abstract:
                self.stats["with_abstract"] += 1

            authors_list = []
            for creator in item.get("creators", []):
                if isinstance(creator, dict):
                    authors_list.append(f"{creator.get('lastName', '')}, {creator.get('firstName', '')}")
            authors = "; ".join(authors_list)

            date_str = item.get("date", "") or ""
            year_match = re.search(r'\b(19|20)\d{2}\b', date_str)
            year = int(year_match.group(0)) if year_match else None

            title = item.get("title", "Sans titre") or "Sans titre"
            hash_base = f"{title[:50]}_{(authors_list if authors_list else '')}_{year or ''}"

            zotero_key = item.get("key")
            return {
                "zotero_key": zotero_key,
                "article_id": pmid or item.get("DOI", ""),
                "title": title,
                "authors": authors,
                "publication_date": str(year) if year else "",
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
