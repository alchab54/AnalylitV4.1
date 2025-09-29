import logging
from logging.config import fileConfig
import os
from pathlib import Path
from alembic import context
from sqlalchemy import engine_from_config, pool, text

# --- AJOUT POUR LA GESTION DU SCHÉMA ---
# Ajoute le répertoire racine de l'application au path pour trouver 'utils'
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))

# ✅ CORRECTION: Simplification radicale pour la fiabilité.
# Nous allons créer une app minimale juste pour Alembic.
from backend.server_v4_complete import create_app
from utils.database import db
from utils.models import SCHEMA # Importer notre variable de schéma

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# ✅ CORRECTION: 1. Créer l'application d'abord.
# Fournir une configuration minimale pour qu'Alembic puisse se connecter à la DB.
app = create_app({
    'SQLALCHEMY_DATABASE_URI': os.getenv('DATABASE_URL', 'postgresql://analylit_user:strong_password@db:5432/analylit_db'),
    'SQLALCHEMY_TRACK_MODIFICATIONS': False
})

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')


# add your model's MetaData object here
# for 'autogenerate' support
# ✅ CORRECTION: 2. Utiliser le contexte de l'application pour garantir que tout est initialisé.
# Cela lie les modèles à l'instance SQLAlchemy et configure l'URL pour Alembic.
with app.app_context():
    # Importer les modèles ici pour qu'ils soient enregistrés dans les métadonnées de `db`
    from utils import models
    target_metadata = db.metadata
    config.set_main_option('sqlalchemy.url', app.config.get('SQLALCHEMY_DATABASE_URI'))



def get_metadata_with_schema():
    """
    Retourne les métadonnées de la base de données en s'assurant que le schéma est défini.
    C'est l'étape cruciale pour qu'Alembic sache où créer/modifier les tables.
    """
    meta = target_metadata
    meta.schema = SCHEMA
    return meta


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
        target_metadata=get_metadata_with_schema(),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        # ✅ CORRECTION FINALE: Isoler toute la logique de migration dans une transaction
        # et s'assurer que le schéma est créé et utilisé.
        with context.begin_transaction():
            if SCHEMA:
                logger.info(f"Création/Vérification du schéma : {SCHEMA}")
                connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
            
            context.configure(
                connection=connection,
                target_metadata=get_metadata_with_schema(),
                # ✅ AJOUT CRITIQUE: Spécifier où stocker la table de versions d'Alembic.
                version_table_schema=SCHEMA,
                include_schemas=True, # Nécessaire pour que version_table_schema fonctionne
            )
            
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()