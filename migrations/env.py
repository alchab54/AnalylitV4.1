import logging
from logging.config import fileConfig
from pathlib import Path
from flask import current_app

from alembic import context
from sqlalchemy import text

# --- AJOUT POUR LA GESTION DU SCHÉMA ---
# Ajoute le répertoire racine de l'application au path pour trouver 'utils'
import sys
sys.path.append(str(Path(__file__).resolve().parents[1]))
from server_v4_complete import app # Importer l'instance de l'app
from utils.models import SCHEMA

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')


def get_engine():
    try:
        return app.extensions['migrate'].db.engine
    except (TypeError, AttributeError, KeyError):
        # Fallback si l'extension n'est pas encore initialisée
        from sqlalchemy import create_engine
        return create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
def get_engine_url():
    try:
        return get_engine().url.render_as_string(hide_password=False).replace(
            '%', '%%')
    except AttributeError:
        return str(get_engine().url).replace('%', '%%')


# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
target_db = app.extensions['migrate'].db
config.set_main_option('sqlalchemy.url', app.config['SQLALCHEMY_DATABASE_URI'])

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def get_metadata():
    if hasattr(target_db, 'metadatas'):
        return target_db.metadatas[None]
    # --- MODIFICATION POUR LE SCHÉMA ---
    # Assigner le schéma aux métadonnées avant de les retourner
    meta = target_db.metadata
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
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=get_metadata(), literal_binds=True
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """

    # this callback is used to prevent an auto-migration from being generated
    # when there are no changes to the schema
    # reference: http://alembic.zzzcomputing.com/en/latest/cookbook.html
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, 'autogenerate', False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info('No changes in schema detected.')
    
    try:
        conf_args = current_app.extensions['migrate'].configure_args
    except (KeyError, AttributeError):
        conf_args = {} # Fallback si le contexte n'est pas disponible
        
    if conf_args.get("process_revision_directives") is None:
        conf_args["process_revision_directives"] = process_revision_directives

    engine = get_engine()

    with engine.connect() as connection:
        # Configurer la connexion pour utiliser le bon schéma
        if SCHEMA:
            connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))

        # Consolider en un seul appel à context.configure
        context.configure(
            connection=connection,
            target_metadata=get_metadata(),
            include_schemas=True,  # Indiquer à Alembic de prendre en compte les schémas
            **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
