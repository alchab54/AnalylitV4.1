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
    
    test_db_url = os.getenv('TEST_DATABASE_URL', 'postgresql://analylit_user:strong_password@analylit_test_db:5432/analylit_test_db')
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': test_db_url,
        'SQLALCHEMY_ENGINE_OPTIONS': {
            "connect_args": {
                "options": "-csearch_path=analylit_schema,public"
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
            
            # Vérifier les tables
            tables = db.session.execute(text("""
                SELECT tablename 
                FROM pg_tables 
                WHERE schemaname = 'analylit_schema'
                ORDER BY tablename
            """)).scalars().all()
            
            print(f"✅ Tables trouvées dans 'analylit_schema' ({len(tables)}):")
            for table in tables:
                print(f"  - {table}")
                
            return True
            
        except Exception as e:
            print(f"❌ Erreur: {e}")
            return False

if __name__ == "__main__":
    print("--- Lancement du script de validation de la base de données de test ---")
    success = validate_test_db()
    print("--- Fin du script ---")
    sys.exit(0 if success else 1)