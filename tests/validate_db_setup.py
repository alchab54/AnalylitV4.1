#!/usr/bin/env python3
"""Script de validation de la configuration DB pour les tests"""

import os
import sys
from pathlib import Path

# Ajouter le répertoire racine au PATH
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

from backend.server_v4_complete import create_app
from utils.database import db
from sqlalchemy import text

def validate_test_db():
    """Valide que la configuration de test fonctionne"""
    # ✅ CORRECTION CRITIQUE : URL de test dédiée
    test_db_url = 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db'
    # ✅ CORRECTION : Configuration complète avec search_path
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            "connect_args": {
                "options": "-c search_path=analylit_schema,public"
            }
        }
    })
    
    with app.app_context():
        try:
            # Test de connexion
            result = db.session.execute(text("SELECT 1")).scalar()
            print(f"✅ Connexion DB: OK (result={result})")
            
            # Test du search_path
            search_path = db.session.execute(text("SHOW search_path")).scalar()
            print(f"✅ Search path: {search_path}")
            
            # CRÉER LE SCHÉMA ET LES TABLES (même logique que conftest.py)
            try:
                db.session.execute(text("CREATE SCHEMA IF NOT EXISTS analylit_schema"))
                db.session.commit()
                print("✅ Schéma créé")
            except Exception as e:
                print(f"⚠️ Schéma existe déjà: {e}")
                db.session.rollback()
            
            # FORCER la création des tables
            try:
                db.create_all()
                db.session.commit()
                print("✅ Tables forcées avec db.create_all()")
            except Exception as e:
                print(f"⚠️ Erreur create_all: {e}")
                db.session.rollback()
            
            # Vérifier les tables APRÈS création forcée
            tables = db.session.execute(text("""
                SELECT schemaname, tablename 
                FROM pg_tables 
                WHERE schemaname = 'analylit_schema'
                ORDER BY tablename
            """)).fetchall()
            
            print(f"✅ Tables trouvées dans 'analylit_schema' ({len(tables)}):")
            for schema, table in tables:
                print(f"  - {schema}.{table}")
            
            if len(tables) == 0:
                print("❌ PROBLÈME: Aucune table trouvée même après db.create_all()")
                # Diagnostique supplémentaire
                all_tables = db.session.execute(text("""
                    SELECT schemaname, tablename 
                    FROM pg_tables 
                    WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
                    ORDER BY schemaname, tablename
                """)).fetchall()
                print(f"📋 Toutes les tables dans la DB ({len(all_tables)}):")
                for schema, table in all_tables:
                    print(f"  - {schema}.{table}")
                return False
                
            return True
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False

if __name__ == "__main__":
    print("--- Lancement du script de validation AMÉLIORÉ ---")
    success = validate_test_db()
    print("--- Fin du script ---")
    sys.exit(0 if success else 1)