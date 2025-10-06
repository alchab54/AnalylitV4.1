import logging
from logging.config import fileConfig
import os
import sys
sys.path.insert(0, '/home/appuser/app')

from pathlib import Path
from alembic import context
from sqlalchemy import engine_from_config, pool, text

# --- AJOUT POUR LA GESTION DU SCHÉMA ---
# Ajoute le répertoire racine de l'application au path pour trouver 'utils'
sys.path.append(str(Path(__file__).resolve().parents[1]))

# ✅ IMPORT DES MODÈLES (c'est ça qui manquait !)
from utils.models import Base, Project, SearchResult, Extraction, AnalysisProfile, RiskOfBias, Grid, ChatMessage, Prompt, Article, GreyLiterature, ProcessingLog, Stakeholder, ScreeningDecision, PRISMARecord, Analysis, Validation, GridField
from utils.extensions import db

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# ✅ CORRECTION: Forcer la lecture de la variable d'environnement DATABASE_URL.
# Cela résout l'erreur "Could not parse SQLAlchemy URL from string '${DATABASE_URL}'"
# en s'assurant que la configuration d'Alembic contient la vraie URL avant d'être utilisée.
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("La variable d'environnement DATABASE_URL n'est pas définie.")
config.set_main_option('sqlalchemy.url', db_url)

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger('alembic.env')
logging.getLogger('alembic').setLevel(logging.DEBUG)

# --- CONFIGURATION CRITIQUE DU SCHÉMA ---
# ✅ OPTIMISATION: Utiliser la variable d'environnement pour le nom du schéma.
SCHEMA = os.getenv("SCHEMA_NAME", "analylit_schema")

def get_metadata_with_schema():
    """Force le schéma sur chaque table de la metadata."""
    meta = db.metadata
    for table in meta.tables.values():
        table.schema = SCHEMA
    return meta

# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = get_metadata_with_schema()


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def create_schema_if_not_exists(connection, schema_name=SCHEMA):
    """Créer le schéma s'il n'existe pas"""
    connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema_name}"))
    connection.execute(text(f"GRANT ALL PRIVILEGES ON SCHEMA {schema_name} TO CURRENT_USER"))

def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    logger.info("Running migrations in online mode...")
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        with connection.begin():
            # ✅ CRÉER LE SCHÉMA AVANT LES MIGRATIONS
            create_schema_if_not_exists(connection)

            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                version_table_schema=SCHEMA,
                include_schemas=True
            )
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()