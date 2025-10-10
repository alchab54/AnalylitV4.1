# utils/db_base.py

from sqlalchemy.orm import declarative_base

# Déclarer la Base ici, une seule fois pour toute l'application.
Base = declarative_base()