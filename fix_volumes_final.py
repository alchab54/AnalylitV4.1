#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🔧 CORRECTEUR VOLUMES FINAL - CHEMINS PDFs ATN
"""

print("🔧 CORRECTION VOLUMES PDFs ATN DÉFINITIVE")
print("=" * 60)

import os
import shutil
from pathlib import Path

# Diagnostic volumes actuels
print("🔍 DIAGNOSTIC VOLUMES:")
volumes = {
    "/app/source": "Export Zotero",
    "/app/zotero-storage": "PDFs Storage", 
    "/app/output": "Outputs",
    "/app": "Code source"
}

for path, desc in volumes.items():
    if os.path.exists(path):
        try:
            files = os.listdir(path)
            print(f"✅ {desc}: {path} ({len(files)} éléments)")
            if "storage" in path.lower() and len(files) > 0:
                print(f"   📂 Dossiers PDFs: {files[:5]}")
        except:
            print(f"⚠️ {desc}: {path} (non lisible)")
    else:
        print(f"❌ {desc}: {path} (inexistant)")

# Vérifiez structure export_zotero_atn
source_analylit = "/app/source/Analylit"
if os.path.exists(source_analylit):
    print(f"\n✅ Structure Analylit trouvée: {source_analylit}")
    analylit_files = os.listdir(source_analylit)
    print(f"   📂 Contenu: {analylit_files}")
    
    # Si files/ existe dans Analylit
    files_path = f"{source_analylit}/files"
    if os.path.exists(files_path):
        pdf_folders = os.listdir(files_path)
        print(f"   🎯 PDFs détectés: {len(pdf_folders)} dossiers")
        print(f"   📁 Exemples: {pdf_folders[:5]}")
        
        # Copie vers zotero-storage si nécessaire
        zotero_storage = "/app/zotero-storage"
        if not os.path.exists(zotero_storage) or len(os.listdir(zotero_storage)) == 0:
            print("📋 COPIE VERS ZOTERO-STORAGE...")
            try:
                if os.path.exists(zotero_storage):
                    shutil.rmtree(zotero_storage)
                shutil.copytree(files_path, zotero_storage)
                print("✅ PDFs copiés vers zotero-storage")
            except Exception as copy_err:
                print(f"⚠️ Erreur copie: {copy_err}")

print("\n🎯 CORRECTION RDF CHEMINS:")
rdf_input = "/app/output/Analylit_COMPLETELY_FIXED.rdf"
rdf_output = "/app/output/Analylit_PATHS_FINAL.rdf"

try:
    with open(rdf_input, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Correction chemins vers zotero-storage
    fixed_content = content.replace("file:///app/output/files/", "file:///app/zotero-storage/")
    fixed_content = fixed_content.replace("files/", "zotero-storage/")
    
    with open(rdf_output, 'w', encoding='utf-8') as f:
        f.write(fixed_content)
    
    print(f"✅ Chemins PDFs corrigés: {rdf_output}")
    print("🔥 PRÊT POUR IMPORT FINAL AVEC PDFs!")
    
except Exception as rdf_err:
    print(f"❌ Erreur RDF: {rdf_err}")
