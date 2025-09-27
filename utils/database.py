# utils/database.py

import os
import logging
from functools import wraps
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

logger = logging.getLogger(__name__)

# --- Variables globales (non initialisées) ---
engine = None
SessionFactory = None

# Base est maintenant importée directement, et sa définition de schéma sera gérée
# par le fichier models.py en fonction de l'environnement.
from .db_base import Base

# Créez l'instance ici, mais ne la liez à aucune application.
# Elle sera liée dans create_app() pour l'application principale,
# et dans run_migrations.py pour le script de migration.
db = SQLAlchemy()
migrate = Migrate()

def init_database(database_url=None, is_test: bool = False):
    """Initialise le moteur et la factory de session."""
    global engine, SessionFactory
    if engine:
        return engine

    if not database_url:
        if is_test:
            database_url = os.getenv("DATABASE_URL", "postgresql://user:pass@db/analylit_db_test")
        else:
            database_url = os.getenv("DATABASE_URL", "postgresql://user:pass@db/analylit_db")
    
    if is_test:
        os.environ['TESTING'] = 'true'
        logger.info(f"Initialisation en mode TEST avec la base de données : {database_url.split('@')[-1]}")
    else:
        os.environ['TESTING'] = 'false' # Ensure it's explicitly false for non-test environments
        logger.info(f"Initialisation en mode PROD/DEV avec la base de données : {database_url.split('@')[-1]}")

    try:
        engine = create_engine(database_url, pool_pre_ping=True)
        
        # Import models here to ensure SCHEMA is correctly set based on os.environ['TESTING']
        from . import models
        
        # Conditionally create schema only if it's defined (i.e., not in test mode)
        if models.SCHEMA:
            with engine.connect() as connection:
                connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {models.SCHEMA}"))
                connection.commit()
        
        Base.metadata.create_all(bind=engine)
        SessionFactory = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        logger.info("✅ Base de données initialisée avec succès.")
    except Exception as e:
        logger.critical(f"❌ ERREUR D'INITIALISATION DB : {e}", exc_info=True)
        engine = None
        raise
    return engine

def get_session():
    """Récupère une session de la factory."""
    if not SessionFactory:
        raise RuntimeError("La base de données n'est pas initialisée. Appelez init_database().")
    return SessionFactory()

def with_db_session(func):
    @wraps(func)
    def wrapper(*args, **kwargs): # The user is asking to fix the error, which is caused by the database not being initialized.
        # CORRECTION: Éviter l'importation circulaire en n'important pas 'app' directement.
        # Flask-SQLAlchemy gère automatiquement la session dans le contexte d'une requête.
        # Le décorateur passe simplement db.session à la fonction décorée.
        # Le contexte d'application est déjà actif pour une requête API.
        # Le décorateur reste utile pour standardiser la signature des fonctions
        # qui attendent une session en premier argument.
        return func(db.session, *args, **kwargs)
    return wrapper

def seed_default_data(session):
    """Seed la DB avec des données par défaut."""
    from utils.models import AnalysisProfile, Project
    try:
        if not session.query(AnalysisProfile).filter_by(name='Standard').first():
            session.add(AnalysisProfile(name='Standard', is_custom=False))
        if not session.query(Project).filter_by(name='Projet par défaut').first():
            session.add(Project(name='Projet par défaut'))
        session.commit()
    except Exception as e:
        logger.error(f"Erreur pendant le seeding : {e}")
        session.rollback()

def get_paginated_search_results(session, project_id: str, page: int, per_page: int, sort_by: str, sort_order: str) -> dict:
    """
    Récupère les résultats de recherche paginés et triés pour un projet.
    Cette fonction centralise la logique de pagination qui était dans server_v4_complete.py.
    """
    from .models import SearchResult  # Import local pour éviter les imports circulaires

    query = session.query(SearchResult).filter_by(project_id=project_id)

    # Logique de tri
    valid_sort_columns = ['article_id', 'title', 'authors', 'publication_date', 'journal', 'database_source']
    if sort_by in valid_sort_columns:
        column_to_sort = getattr(SearchResult, sort_by)
        if sort_order.lower() == 'desc':
            query = query.order_by(column_to_sort.desc())
        else:
            query = query.order_by(column_to_sort.asc())

    # Compter le total avant la pagination
    total = query.count()

    # Appliquer la pagination
    paginated_query = query.offset((page - 1) * per_page).limit(per_page)

    return {
        "results": [r.to_dict() for r in paginated_query.all()],
        "total": total
    }
