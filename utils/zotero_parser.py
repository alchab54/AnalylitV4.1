# Fichier : utils/zotero_parser.py

import logging
from pathlib import Path
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import DCTERMS, BIBO, PRISM

logger = logging.getLogger(__name__)

# Définition des namespaces Zotero/RDF
ZFILES = Namespace("http://www.zotero.org/namespaces/export#")

def parse_zotero_rdf(rdf_path: str, storage_path: str) -> list:
    """
    Parse un fichier Zotero RDF et extrait les métadonnées des articles,
    en cherchant les PDF associés dans le dossier de stockage.
    """
    logger.info(f"Parsing du fichier RDF : {rdf_path}")
    g = Graph()
    try:
        g.parse(rdf_path, format="xml")
    except Exception as e:
        logger.error(f"Impossible de parser le fichier RDF : {e}")
        return []

    articles = []
    # Trouve tous les sujets qui sont de type bibo:Document
    for s in g.subjects(predicate=URIRef("http://www.w3.org/1999/02/22-rdf-syntax-ns#type"), object=BIBO.Document):
        try:
            title = g.value(s, DCTERMS.title)
            # Génère un PMID simple basé sur le hash du titre pour l'unicité
            pmid = hashlib.md5(str(title).encode('utf-8')).hexdigest()[:15]
            
            year_val = g.value(s, DCTERMS.date)
            year = int(str(year_val).split('-')[0]) if year_val else None

            abstract_val = g.value(s, DCTERMS.abstract)
            abstract = str(abstract_val) if abstract_val else ''

            # Recherche des auteurs
            authors_list = [str(o) for o in g.objects(s, DCTERMS.creator)]
            authors = ", ".join(authors_list)
            
            # Recherche du PDF
            pdf_path = None
            for item in g.objects(s, ZFILES.attachment):
                path_literal = g.value(item, ZFILES.localPath)
                if path_literal and str(path_literal).endswith('.pdf'):
                    # Construit le chemin complet du PDF dans le conteneur
                    pdf_path = str(Path(storage_path) / path_literal)
                    break
            
            article_data = {
                "pmid": pmid,
                "article_id": pmid,
                "title": str(title) if title else "Titre non disponible",
                "authors": authors,
                "year": year,
                "abstract": abstract,
                "journal": str(g.value(s, PRISM.publicationName) or ''),
                "doi": str(g.value(s, BIBO.doi) or ''),
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
            
    logger.info(f"{len(articles)} articles extraits du fichier RDF.")
    return articles
