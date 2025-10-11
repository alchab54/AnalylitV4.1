#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 TEST DIRECT PARSER ATN SUR VOS 327 ARTICLES
"""

print("🚀 TEST DIRECT PARSER ATN")
print("=" * 60)

import sys
sys.path.append('/app')

from rdflib import Graph, URIRef, Namespace
from rdflib.namespace import DCTERMS, RDF
import hashlib

# Namespaces corrects pour votre export
BIB = Namespace("http://purl.org/net/biblio#")
DC = Namespace("http://purl.org/dc/elements/1.1/")
FOAF = Namespace("http://xmlns.com/foaf/0.1/")

rdf_path = "/app/output/Analylit_PATHS_FINAL.rdf"

try:
    print(f"📂 Test parsing: {rdf_path}")
    
    g = Graph()
    g.parse(rdf_path, format="xml")
    print("✅ RDF parsé avec succès!")
    
    # Test recherche bib:Article
    article_count = 0
    articles_sample = []
    
    for subject in g.subjects(RDF.type, BIB.Article):
        article_count += 1
        
        # Extraction basique
        title = str(g.value(subject, DC.title) or f"Article {article_count}")
        date_val = str(g.value(subject, DC.date) or "2024")
        
        # Auteurs
        authors = []
        authors_seq = g.value(subject, BIB.authors)
        if authors_seq:
            for person in g.objects(authors_seq, None):
                surname = str(g.value(person, FOAF.surname) or '')
                given = str(g.value(person, FOAF.givenName) or '')
                if surname:
                    authors.append(f"{given} {surname}".strip())
        
        authors_str = ", ".join(authors[:2]) if authors else "Auteur inconnu"
        
        articles_sample.append({
            "title": title[:80],
            "authors": authors_str,
            "year": date_val[:4]
        })
        
        # Arrêt après échantillon
        if article_count >= 10:
            break
    
    print(f"🎯 ARTICLES BIB:ARTICLE DÉTECTÉS: {article_count}")
    
    if articles_sample:
        print("📚 ÉCHANTILLON ARTICLES ATN:")
        for i, art in enumerate(articles_sample):
            print(f"  {i+1}. {art['title']}")
            print(f"     {art['authors']} ({art['year']})")
        
        print(f"\n✅ PARSER ATN FONCTIONNE!")
        print(f"🔥 {article_count} articles prêts pour import!")
    else:
        print("❌ Aucun bib:Article trouvé")
        
        # Test autres types
        all_types = set()
        for s, p, o in g:
            if p == RDF.type:
                all_types.add(str(o))
        
        print(f"🔍 Types RDF détectés: {sorted(all_types)}")

except Exception as e:
    print(f"❌ Erreur: {e}")
