# Fichier : utils/zotero_parser.py

import logging
from pathlib import Path
import hashlib
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

def generate_pmid_from_title(title: str) -> str:
    """Génère un ID stable basé sur le titre."""
    return hashlib.md5(str(title).encode('utf-8')).hexdigest()[:15]

def parse_zotero_rdf(rdf_path: str, storage_path: str) -> list:
    """
    Parse un fichier Zotero RDF en utilisant BeautifulSoup pour une robustesse maximale.
    Extrait les métadonnées des articles, livres, et sections de livres.
    """
    logger.info(f"Début du parsing RDF avec BeautifulSoup : {rdf_path}")
    
    try:
        with open(rdf_path, 'r', encoding='utf-8') as f:
            xml_content = f.read()
    except FileNotFoundError:
        logger.error(f"Échec critique : Fichier RDF introuvable à l'adresse {rdf_path}")
        return []
    except Exception as e:
        logger.error(f"Échec critique lors de la lecture du fichier RDF : {e}")
        return []

    soup = BeautifulSoup(xml_content, 'xml')
    articles = []

    # Cible tous les types de documents pertinents
    item_tags = soup.find_all(['bib:Article', 'bib:Book', 'bib:BookSection'])
    
    if not item_tags:
        logger.warning("Aucun tag <bib:Article>, <bib:Book>, or <bib:BookSection> trouvé dans le fichier RDF.")
        # Fallback pour trouver des descriptions génériques si les types spécifiques manquent
        item_tags = soup.find_all('rdf:Description')
        if item_tags:
            logger.info(f"Fallback: {len(item_tags)} tags <rdf:Description> génériques trouvés.")
        else:
            logger.warning("Aucun tag <rdf:Description> trouvé non plus. Le fichier est peut-être vide ou mal formé.")
            return []

    logger.info(f"Trouvé {len(item_tags)} items potentiels à parser.")

    for item in item_tags:
        try:
            title_tag = item.find('dc:title')
            if not title_tag or not title_tag.string:
                continue  # Le titre est obligatoire

            title = title_tag.string.strip()
            pmid = generate_pmid_from_title(title)

            # Extraction des auteurs
            authors = [creator.string.strip() for creator in item.find_all('dc:creator') if creator.string]
            authors_str = ", ".join(authors)

            # Extraction de l'année
            year = None
            date_tag = item.find('dc:date')
            if date_tag and date_tag.string and '-' in date_tag.string:
                try:
                    year = int(date_tag.string.split('-')[0])
                except (ValueError, IndexError):
                    logger.warning(f"Impossible de parser l'année depuis: {date_tag.string}")

            # Extraction du journal/publication
            journal_tag = item.find('dcterms:isPartOf')
            journal_title = ""
            if journal_tag and journal_tag.has_attr('rdf:resource'):
                 # Le titre du journal est dans un autre élément rdf:Description
                 journal_resource = soup.find('rdf:Description', {'rdf:about': journal_tag['rdf:resource']})
                 if journal_resource and journal_resource.find('dc:title'):
                     journal_title = journal_resource.find('dc:title').string.strip()

            if not journal_title:
                # Fallback pour d'autres manières de spécifier le journal
                prism_pub = item.find('prism:publicationName')
                if prism_pub and prism_pub.string:
                    journal_title = prism_pub.string.strip()


            # Extraction du PDF
            pdf_path = None
            attachment_tag = item.find('z:attachment')
            if attachment_tag and attachment_tag.has_attr('rdf:resource'):
                attachment_resource = soup.find('rdf:Description', {'rdf:about': attachment_tag['rdf:resource']})
                if attachment_resource:
                    local_path_tag = attachment_resource.find('z:localPath')
                    if local_path_tag and local_path_tag.string and local_path_tag.string.lower().endswith('.pdf'):
                        # Le chemin est relatif, ex: "storage:XYZ/doc.pdf"
                        relative_path = local_path_tag.string.strip().split(':', 1)[-1]
                        # On construit le chemin absolu dans le contexte du conteneur
                        pdf_path = str(Path("/app/zotero-storage/files") / relative_path)


            # Extraction du DOI
            doi = ""
            doi_tag = item.find('bibo:doi')
            if doi_tag and doi_tag.string:
                doi = doi_tag.string.strip()

            article_data = {
                "pmid": pmid,
                "article_id": pmid,
                "title": title,
                "authors": authors_str,
                "year": year,
                "abstract": item.find('dcterms:abstract').string.strip() if item.find('dcterms:abstract') and item.find('dcterms:abstract').string else '',
                "journal": journal_title,
                "doi": doi,
                "url": item.find('z:url').string.strip() if item.find('z:url') and item.find('z:url').string else '',
                "pdf_path": pdf_path,
                "publication_date": f"{year}-01-01" if year else None,
                "relevance_score": 0,
                "has_pdf_potential": bool(pdf_path),
                "attachments": [] # Ajout pour compatibilité
            }
            articles.append(article_data)

        except Exception as e:
            logger.warning(f"Impossible de traiter une entrée RDF: {e}", exc_info=True)
            continue
            
    logger.info(f"Parsing terminé. {len(articles)} articles extraits avec succès via BeautifulSoup.")
    return articles
