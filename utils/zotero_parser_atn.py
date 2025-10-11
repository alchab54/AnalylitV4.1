
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Parser Zotero RDF ATN V4.2 - Support bib:Article
"""

import logging
from pathlib import Path
import hashlib
from rdflib import Graph, URIRef, Literal, Namespace
from rdflib.namespace import DCTERMS, RDF

logger = logging.getLogger(__name__)

# Namespaces pour votre export Zotero
ZFILES = Namespace("http://www.zotero.org/namespaces/export#")
BIB = Namespace("http://purl.org/net/biblio#")
DC = Namespace("http://purl.org/dc/elements/1.1/")
FOAF = Namespace("http://xmlns.com/foaf/0.1/")

def parse_zotero_rdf(rdf_path: str, storage_path: str) -> list:
    """Parser optimisé pour export Zotero avec bib:Article."""
    logger.info(f"Début parsing RDF ATN : {rdf_path}")
    
    g = Graph()
    try:
        g.parse(rdf_path, format="xml")
        logger.info("✅ RDF parsé avec succès")
    except Exception as e:
        logger.error(f"❌ Erreur parsing RDF : {e}")
        return []

    articles = []
    
    # Recherche bib:Article au lieu de bibo:Document
    for subject in g.subjects(RDF.type, BIB.Article):
        try:
            # Titre obligatoire
            title = g.value(subject, DC.title)
            if not title:
                continue
                
            title_str = str(title).strip()
            
            # ID unique
            pmid = hashlib.md5(title_str.encode('utf-8')).hexdigest()[:15]
            
            # Année
            date_val = g.value(subject, DC.date)
            year = 2024
            try:
                if date_val:
                    year_str = str(date_val).strip()
                    if '-' in year_str:
                        year = int(year_str.split('-')[0])
                    elif year_str.isdigit():
                        year = int(year_str)
            except:
                pass
            
            # Abstract
            abstract = str(g.value(subject, DCTERMS.abstract) or '').strip()
            
            # Auteurs - Structure correcte pour votre RDF
            authors_list = []
            authors_seq = g.value(subject, BIB.authors)
            if authors_seq:
                for person in g.objects(authors_seq, None):
                    if g.value(person, RDF.type) == FOAF.Person:
                        surname = str(g.value(person, FOAF.surname) or '')
                        given = str(g.value(person, FOAF.givenName) or '')
                        if surname or given:
                            full_name = f"{given} {surname}".strip()
                            if full_name:
                                authors_list.append(full_name)
            
            authors_str = ", ".join(authors_list) if authors_list else "Auteur non spécifié"
            
            # Journal
            journal = str(g.value(subject, DCTERMS.isPartOf) or '')
            if journal.startswith('urn:issn:'):
                # Chercher le titre du journal
                for journal_obj in g.subjects(None, URIRef(journal)):
                    journal_title = g.value(journal_obj, DC.title)
                    if journal_title:
                        journal = str(journal_title)
                        break
            
            # DOI
            doi = str(g.value(subject, URIRef("http://purl.org/dc/elements/1.1/identifier")) or '')
            if doi.startswith('DOI '):
                doi = doi[4:]
                
            # Article data
            article_data = {
                "pmid": pmid,
                "article_id": pmid,
                "title": title_str,
                "authors": authors_str,
                "year": year,
                "abstract": abstract[:5000] if abstract else '',
                "journal": journal,
                "doi": doi,
                "url": str(g.value(subject, URIRef("http://purl.org/dc/elements/1.1/identifier")) or ''),
                "publication_date": f"{year}-01-01",
                "relevance_score": 0,
                "has_pdf_potential": True,
                "database_source": "zotero_atn"
            }
            
            articles.append(article_data)
            
        except Exception as parse_err:
            logger.warning(f"⚠️ Erreur article {subject}: {parse_err}")
            continue
    
    logger.info(f"🎯 VICTOIRE: {len(articles)} articles ATN extraits!")
    return articles
