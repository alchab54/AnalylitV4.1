# Fichier : utils/zotero_parser.py

import logging
from pathlib import Path
import hashlib
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import DCTERMS  # Seul DCTERMS est fiable

logger = logging.getLogger(__name__)

# --- BLINDAGE ANTI-ERREUR D'IMPORT ---
# Définition manuelle et explicite des namespaces et URIs problématiques.
# Ceci rend le code indépendant des versions spécifiques de rdflib.
ZFILES = Namespace("http://www.zotero.org/namespaces/export#")
BIBO_DOC_URI = URIRef("http://purl.org/ontology/bibo/Document")
BIBO_DOI_URI = URIRef("http://purl.org/ontology/bibo/doi")
PRISM_DOI_URI = URIRef("http://prismstandard.org/namespaces/basic/2.0/doi/")
PRISM_PUB_NAME_URI = URIRef("http://prismstandard.org/namespaces/basic/2.0/publicationName")
# --- FIN DU BLINDAGE ---

def parse_zotero_rdf(rdf_path: str, storage_path: str) -> list:
    """
    Parse un fichier Zotero RDF et extrait les métadonnées des articles.
    Version blindée et finale. Indépendante des namespaces rdflib.
    """
    logger.info(f"Début du parsing RDF : {rdf_path}")
    g = Graph()
    try:
        g.parse(rdf_path, format="xml")
    except Exception as e:
        logger.error(f"Échec critique du parsing RDF : {e}")
        return []

    articles = []
    # Itère sur tous les sujets de type "Document" en utilisant l'URI directe
    for s in g.subjects(predicate=URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), object=URIRef("http://purl.org/net/biblio#Article")):
        try:
            title = g.value(s, DCTERMS.title)
            if not title:
                continue

            pmid = hashlib.md5(str(title).encode('utf-8')).hexdigest()[:15]
            
            year_val = g.value(s, DCTERMS.date)
            year = int(str(year_val).split('-')[0]) if year_val and '-' in str(year_val) else None

            abstract = str(g.value(s, DCTERMS.abstract) or '')
            authors_list = [str(o) for o in g.objects(s, DCTERMS.creator)]
            authors = ", ".join(authors_list)
            
            pdf_path = None
            for item in g.objects(s, ZFILES.attachment):
                path_literal = g.value(item, ZFILES.localPath)
                if path_literal and str(path_literal).lower().endswith('.pdf'):
                    pdf_path = str(Path(storage_path) / path_literal.strip())
                    break
                    
            doi_val = g.value(s, BIBO_DOI_URI) or g.value(s, PRISM_DOI_URI)
            
            article_data = {
                "pmid": pmid,
                "article_id": pmid,
                "title": str(title),
                "authors": authors,
                "year": year,
                "abstract": abstract,
                "journal": str(g.value(s, PRISM_PUB_NAME_URI) or ''),
                "doi": str(doi_val or ''),
                "url": str(g.value(s, ZFILES.url) or ''),
                "pdf_path": pdf_path,
                "publication_date": f"{year}-01-01" if year else None,
                "relevance_score": 0,
                "has_pdf_potential": bool(pdf_path),
            }
            articles.append(article_data)

        except Exception as e:
            logger.warning(f"Impossible de traiter l'entrée RDF {s}: {e}")
            continue
            
    logger.info(f"VICTOIRE: {len(articles)} articles extraits du fichier RDF.")
    return articles
