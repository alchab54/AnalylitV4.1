#!/usr/bin/env python3
"""Script de validation avec diagnostic complet"""

import os
import sys
import time
from pathlib import Path

# Ajouter le répertoire racine au PATH
root_dir = Path(__file__).parent.parent
sys.path.insert(0, str(root_dir))

def validate_connection():
    """Validation étape par étape"""
    
    # Test de base
    from backend.server_v4_complete import create_app
    from utils.database import db
    from sqlalchemy import text
    
    test_config = {
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db',
        'SQLALCHEMY_ENGINE_OPTIONS': {
            'pool_size': 1,
            'connect_args': {"options": "-c search_path=analylit_schema,public"}
        }
    }
    
    app = create_app(test_config)
    
    with app.app_context():
        # Étape 1: Connexion
        try:
            result = db.session.execute(text("SELECT 1")).scalar()
            print(f"✅ 1. Connexion: OK ({result})")
        except Exception as e:
            print(f"❌ 1. Connexion: FAILED - {e}")
            return False
        
        # Étape 2: Search path
        try:
            path = db.session.execute(text("SHOW search_path")).scalar()
            print(f"✅ 2. Search path: {path}")
        except Exception as e:
            print(f"❌ 2. Search path: FAILED - {e}")
        
        # Étape 3: Schémas disponibles
        try:
            schemas = db.session.execute(text("""
                SELECT schema_name FROM information_schema.schemata 
                WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')
            """)).fetchall()
            print(f"✅ 3. Schémas disponibles: {[s[0] for s in schemas]}")
        except Exception as e:
            print(f"❌ 3. Schémas: FAILED - {e}")
        
        # Étape 4: Créer schéma de test
        try:
            db.session.execute(text("DROP SCHEMA IF EXISTS analylit_schema CASCADE"))
            db.session.execute(text("CREATE SCHEMA analylit_schema"))
            db.session.commit()
            print("✅ 4. Schéma test créé")
        except Exception as e:
            print(f"❌ 4. Création schéma: FAILED - {e}")
            db.session.rollback()
            return False
        
        # Étape 5: Créer tables
        try:
            db.create_all()
            db.session.commit()
            print("✅ 5. Tables créées")
        except Exception as e:
            print(f"❌ 5. Création tables: FAILED - {e}")
            db.session.rollback()
            return False
        
        # Étape 6: Vérifier tables
        try:
            tables = db.session.execute(text("""
                SELECT tablename FROM pg_tables 
                WHERE schemaname = 'analylit_schema'
                ORDER BY tablename
            """)).fetchall()
            
            table_names = [t[0] for t in tables]
            print(f"✅ 6. Tables dans analylit_schema ({len(table_names)}): {table_names}")
            
            if len(table_names) == 0:
                print("❌ Aucune table trouvée!")
                return False
                
        except Exception as e:
            print(f"❌ 6. Vérification tables: FAILED - {e}")
            return False
        
        print("✅ VALIDATION COMPLÈTE RÉUSSIE")
        return True

if __name__ == "__main__":
    print("=== VALIDATION DE LA CONFIGURATION DB TEST ===")
    success = validate_connection()
    print("=" * 50)
    sys.exit(0 if success else 1)