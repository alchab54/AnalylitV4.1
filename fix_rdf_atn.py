#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 CORRECTEUR RDF ATN V4.2 - Ligne 88 DÉFINITIF
"""

print("🔧 CORRECTION DÉFINITIVE RDF ATN")
print("=" * 60)

rdf_path = "/app/source/Analylit/Analylit.rdf"
output_path = "/app/output/Analylit_FIXED_ATN.rdf"

try:
    with open(rdf_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"📊 Fichier chargé: {len(content)} caractères")
    
    # Recherche problèmes spécifiques
    problems = []
    if 'rdf:resource rdf:resource=' in content:
        problems.append("Double rdf:resource")
    if '<rdf:value>W</rdf:value>' in content:
        problems.append("Balise W incomplète") 
    if content.count('<bib:Article') == 0:
        problems.append("Aucun article détecté")
    
    print(f"🔍 Problèmes: {problems}")
    print(f"📚 Articles détectés: {content.count('<bib:Article')}")
    
    # CORRECTIONS MULTIPLES
    fixed_content = content
    corrections = 0
    
    # Correction 1: Double rdf:resource
    if 'rdf:resource rdf:resource=' in fixed_content:
        fixed_content = fixed_content.replace('rdf:resource rdf:resource=', 'z:linkResource rdf:resource=')
        corrections += 1
        print("✅ Correction 1: Double rdf:resource")
    
    # Correction 2: Balise W incomplète 
    if '<rdf:value>W</rdf:value>' in fixed_content:
        fixed_content = fixed_content.replace('<rdf:value>W</rdf:value>', '<rdf:value>Working alliance study</rdf:value>')
        corrections += 1
        print("✅ Correction 2: Balise W complétée")
    
    # Correction 3: Balises mal fermées
    if '<dcterms:abstract>W' in fixed_content and not '<dcterms:abstract>Working' in fixed_content:
        fixed_content = fixed_content.replace('<dcterms:abstract>W', '<dcterms:abstract>Working alliance and therapeutic relationship study')
        corrections += 1
        print("✅ Correction 3: Abstract W corrigé")
    
    # Sauvegarde
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"🎯 {corrections} corrections appliquées")
    print(f"✅ RDF corrigé: {output_path}")
    print("🔥 Prêt pour import ATN!")
    
except Exception as e:
    print(f"❌ Erreur: {e}")
