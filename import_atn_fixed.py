#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🚀 IMPORT ATN AVEC CHEMINS CORRIGÉS
"""

import requests
import time
import json

print("🚀 IMPORT ATN - CHEMINS PDFs CORRIGÉS")
print("=" * 50)

API_BASE = "http://localhost:5000"
project_id = "9a89bdfd-1b18-46a4-a051-a930f440b62d"

# Correction RDF avec bons chemins PDFs
print("🔧 Correction chemins PDFs dans RDF...")

try:
    with open("/app/output/Analylit_FIXED_ATN.rdf", "r", encoding="utf-8") as f:
        content = f.read()
    
    # Correction chemins files/ → zotero-storage/
    fixed_content = content.replace("files/", "")  # Supprime files/ des chemins
    fixed_content = fixed_content.replace('rdf:resource="', 'rdf:resource="zotero-storage/')
    
    with open("/app/output/Analylit_PATHS_FIXED.rdf", "w", encoding="utf-8") as f:
        f.write(fixed_content)
    
    print("✅ Chemins PDFs corrigés")
    
    # Import avec chemins corrects
    data = {
        "rdf_file_path": "/app/output/Analylit_PATHS_FIXED.rdf",
        "zotero_storage_path": "/app/zotero-storage"
    }
    
    print(f"📦 RDF: {data['rdf_file_path']}")
    print(f"📁 PDFs: {data['zotero_storage_path']}")
    
    result = requests.post(
        f"{API_BASE}/api/projects/{project_id}/import-zotero-rdf",
        json=data,
        timeout=300
    )
    
    print(f"🎯 Import: {result.status_code}")
    
    if result.status_code in [200, 202]:
        task_data = result.json()
        print(f"✅ Task: {task_data.get('task_id', 'inconnu')}")
        print("🔥 IMPORT ATN AVEC PDFs CORRIGÉS!")
        
        # Surveillance
        print("📊 Surveillance...")
        for i in range(10):
            time.sleep(20)
            
            articles = requests.get(f"{API_BASE}/api/projects/{project_id}/articles").json()
            print(f"[{i+1:02d}] 📚 {len(articles)} articles importés")
            
            if len(articles) > 0:
                print("🎉 VICTOIRE! ARTICLES ATN IMPORTÉS!")
                # Top 3 articles
                for j, art in enumerate(articles[:3]):
                    title = art.get('title', 'Sans titre')[:60]
                    print(f"  {j+1}. {title}...")
                break
    else:
        print(f"❌ Erreur: {result.text}")

except Exception as e:
    print(f"💥 Erreur: {e}")
