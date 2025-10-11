#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🎯 CORRECTEUR CHEMINS VOLUMES ATN V4.2 - FINAL
"""

print("🎯 CORRECTION VOLUMES PDFs ATN")
print("=" * 50)

# Modifiez docker-compose.glory.yml
print("📋 MODIFIEZ votre docker-compose.glory.yml")
print()
print("REMPLACEZ cette ligne dans TOUS les services :")
print("❌ - ./export_zotero_atn/Analylit/files:/app/zotero-storage:ro")
print()
print("PAR :")  
print("✅ - ./source/Analylit/files:/app/zotero-storage:ro")
print()

# Vérification volumes actuels
import os
print("🔍 VÉRIFICATION VOLUMES ACTUELS:")

paths_to_check = [
    "/app/source",
    "/app/source/Analylit", 
    "/app/zotero-storage",
    "/app/output"
]

for path in paths_to_check:
    if os.path.exists(path):
        try:
            files = os.listdir(path)
            print(f"✅ {path}: {len(files)} éléments")
            if path == "/app/zotero-storage" and len(files) > 0:
                print(f"   Premiers dossiers: {files[:5]}")
        except:
            print(f"⚠️ {path}: Non lisible")
    else:
        print(f"❌ {path}: Inexistant")

print()
print("🎯 SOLUTION:")
print("1. Copiez vos files/ vers le bon volume:")
print("   C:\\Users\\alich\\Downloads\\Analylit\\export_zotero_atn\\Analylit\\files")
print()
print("2. Ou modifiez docker-compose pour pointer vers source/Analylit/files")
print()
print("3. Redémarrez: docker-compose -f docker-compose.glory.yml restart")
