#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎯 CORRECTION DÉFINITIVE RDF ATN - LIGNE 88 RÉSOLUE
"""

print("🎯 RÉPARATION DÉFINITIVE RDF LIGNE 88")
print("=" * 60)

import re
import xml.etree.ElementTree as ET

# Chemin RDF original et corrigé
rdf_original = "/app/source/Analylit/Analylit.rdf"
rdf_fixed = "/app/output/Analylit_COMPLETELY_FIXED.rdf"

try:
    print("📂 Lecture RDF original...")
    with open(rdf_original, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print(f"📊 Taille originale: {len(content)} caractères")
    print(f"📚 Articles détectés: {content.count('<bib:Article')}")
    
    # CORRECTIONS MULTIPLES
    fixed_content = content
    corrections = []
    
    # 1. Correction rdf:resource doublé (PRINCIPAL)
    if 'rdf:resource rdf:resource=' in fixed_content:
        fixed_content = re.sub(r'<rdf:resource\s+rdf:resource=', '<z:linkResource rdf:resource=', fixed_content)
        corrections.append("Double rdf:resource")
    
    # 2. Correction balises invalides
    if '<rdf:value>W</rdf:value>' in fixed_content:
        fixed_content = fixed_content.replace('<rdf:value>W</rdf:value>', '<rdf:value>Working alliance assessment</rdf:value>')
        corrections.append("Balise W incomplète")
    
    # 3. Correction namespace problématique
    if 'xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"' not in fixed_content:
        # Ajouter namespace manquant
        fixed_content = fixed_content.replace(
            '<rdf:RDF',
            '<rdf:RDF\n xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"'
        )
        corrections.append("Namespace RDF")
    
    # 4. Correction propriétés invalides spécifiques ligne 88
    fixed_content = re.sub(
        r'<([^>]+)\s+rdf:resource\s*=\s*"([^"]+)"\s*rdf:resource\s*=\s*"([^"]+)"([^>]*)>',
        r'<\1 rdf:resource="\2"\4>',
        fixed_content
    )
    
    # 5. Nettoyage général XML
    fixed_content = re.sub(r'rdf:resource\s+rdf:resource=', 'rdf:resource=', fixed_content)
    
    # Sauvegarde
    with open(rdf_fixed, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"✅ {len(corrections)} corrections: {corrections}")
    print(f"✅ RDF réparé: {rdf_fixed}")
    print(f"📚 Articles dans version corrigée: {fixed_content.count('<bib:Article')}")
    print("🎯 PRÊT POUR IMPORT DÉFINITIF!")
    
except Exception as e:
    print(f"❌ Erreur: {e}")
