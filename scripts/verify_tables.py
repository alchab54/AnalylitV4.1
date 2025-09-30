#!/usr/bin/env python3
"""
Vérifier et créer les tables si nécessaire
"""
import os
import sys
from sqlalchemy import create_engine, text

# Ajouter le chemin de l'app
sys.path.append('/home/appuser/app')
sys.path.append('.')

def verify_and_create_tables():
    """Vérifier que les tables existent, les créer si nécessaire"""
    
    database_url = os.getenv('DATABASE_URL', 
        'postgresql://analylit_user:strong_password@db:5432/analylit_db')
    
    print(f"🔍 Vérification des tables...")
    print(f"📊 Base: {database_url}")
    
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Vérifier le schéma
        schema_check = conn.execute(text(
            "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'analylit_schema'"
        )).fetchone()
        
        if not schema_check:
            print("📁 Création du schéma analylit_schema...")
            conn.execute(text("CREATE SCHEMA analylit_schema"))
            conn.execute(text("GRANT ALL PRIVILEGES ON SCHEMA analylit_schema TO analylit_user"))
            conn.commit()
        else:
            print("✅ Schéma analylit_schema existe")
        
        # Vérifier les tables
        tables_check = conn.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'analylit_schema'
            ORDER BY table_name
        """)).fetchall()
        
        existing_tables = [row[0] for row in tables_check]
        required_tables = ['projects', 'search_results', 'extractions', 'analysis_profiles', 'risk_of_bias', 'grid_fields', 'articles', 'chat_messages', 'extraction_grids', 'grey_literature', 'processing_log', 'prisma_records', 'screening_decisions', 'stakeholders', 'validations', 'analyses', 'prompts']
        
        print(f"📋 Tables existantes: {existing_tables}")
        
        missing_tables = [t for t in required_tables if t not in existing_tables]
        
        if missing_tables:
            print(f"⚠️ Tables manquantes: {missing_tables}")
            print("🔧 Création via SQLAlchemy...")
            
            # Import et création
            from utils.models import Base
            Base.metadata.create_all(engine)
            
            # Vérifier à nouveau
            tables_check = conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'analylit_schema'
                ORDER BY table_name
            """)).fetchall()
            
            final_tables = [row[0] for row in tables_check]
            print(f"📊 Tables après création: {final_tables}")
            
            if 'projects' in final_tables:
                print("✅ Tables créées avec succès!")
            else:
                print("❌ Échec de création des tables")
                return False
        else:
            print("✅ Toutes les tables sont présentes!")
        
        return True

if __name__ == "__main__":
    try:
        success = verify_and_create_tables()
        if success:
            print("🎉 Vérification terminée avec succès!")
            sys.exit(0)
        else:
            print("❌ Vérification échouée!")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
