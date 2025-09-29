# utils/database.py

import logging
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base

# Importer les instances centralisées
from .extensions import db

logger = logging.getLogger(__name__)

# La factory de session reste utile pour les tâches asynchrones
engine = create_engine("postgresql://user:password@db/mydatabase") # URL de base, sera surchargée
SessionFactory = None

def with_db_session(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Utiliser l'objet db importé depuis extensions
        session = db.session
        try:
            result = func(session, *args, **kwargs)
            session.commit()
            return result
        except Exception as e:
            logger.error(f"Erreur de session DB: {e}", exc_info=True)
            session.rollback()
            raise
    return wrapper
