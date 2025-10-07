#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Setup des profils d'analyse pour AnalyLit V4.2"""

from sqlalchemy import create_engine, text
import os
import sys

def main():
    try:
        db_url = os.environ['DATABASE_URL']
        engine = create_engine(db_url)
        
        profiles = [
            ('fast-local', 'RTX Rapide', 'GPU RTX 2060 mode développement', 'phi3:mini', 'phi3:mini', 'llama3:8b', False),
            ('standard-local', 'RTX Standard', 'GPU RTX équilibre optimal', 'phi3:mini', 'llama3:8b', 'llama3:8b', False), 
            ('gpu-performance', 'RTX Maximum', 'Performance maximale RTX 2060', 'llama3:8b', 'llama3:8b', 'llama3:8b', False),
            ('atn-specialized', 'ATN Spécialisé', 'Optimisé Alliance Thérapeutique Numérique', 'phi3:mini', 'llama3:8b', 'llama3:8b', False)
        ]
        
        with engine.connect() as conn:
            for profile in profiles:
                sql = text('''
                    INSERT INTO analylit_schema.analysis_profiles 
                    (id, name, description, preprocess_model, extract_model, synthesis_model, is_custom) 
                    VALUES (:id, :name, :desc, :pre, :ext, :syn, :custom) 
                    ON CONFLICT (id) DO UPDATE SET 
                        name = EXCLUDED.name,
                        description = EXCLUDED.description
                ''')
                conn.execute(sql, {
                    'id': profile[0], 'name': profile[1], 'desc': profile[2],
                    'pre': profile[3], 'ext': profile[4], 'syn': profile[5], 'custom': profile[6]
                })
            conn.commit()
        
        print('✅ 4 Profils RTX 2060 SUPER installés avec succès !')
        return 0
        
    except Exception as e:
        print(f'❌ Erreur installation profils: {e}')
        return 1

if __name__ == '__main__':
    sys.exit(main())
