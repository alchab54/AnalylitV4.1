#!/usr/bin/env python3
"""
Attendre que PostgreSQL soit prêt
"""

import os
import time
import sys
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

def wait_for_database(max_attempts=30):
    """Attendre que la base soit accessible"""
    
    database_url = os.getenv('DATABASE_URL', 
        'postgresql://analylit_user:strong_password@db:5432/analylit_db')
    
    for attempt in range(max_attempts):
        try:
            engine = create_engine(database_url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            print("✅ Base de données accessible!")
            return True
        except (OperationalError, NameError): # NameError for text not being defined
            print(f"⏳ Tentative {attempt + 1}/{max_attempts} - Base non prête...")
            time.sleep(2)
    
    print("❌ Impossible de se connecter à la base de données")
    return False

if __name__ == "__main__":
    from sqlalchemy import text
    if wait_for_database():
        sys.exit(0)
    else:
        sys.exit(1)
