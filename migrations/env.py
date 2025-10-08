# migrations/env.py

import logging
from logging.config import fileConfig
import os
import sys
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# --- CONFIGURATION DU PATH ---
# Ajoute le répertoire racine de l'application au path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# --- IMPORT DE LA VÉRITÉ ---
# C'est la seule chose qui compte : la Base déclarative de vos modèles.
from utils.models import Base

# --- CONFIGURATION ALEMBIC ---
config = context.config

# Assurez-vous que l'URL de la base de données est bien lue
db_url = os.getenv('DATABASE_URL')
if not db_url:
    raise ValueError("DATABASE_URL n'est pas définie.")
config.set_main_option('sqlalchemy.url', db_url)

# Configuration du logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# --- LA LIGNE LA PLUS IMPORTANTE ---
# Dites à Alembic que la définition de vos tables vient de vos modèles. Point.
target_metadata = Base.metadata

def run_migrations_offline():
    """Mode hors ligne."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Mode en ligne."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
