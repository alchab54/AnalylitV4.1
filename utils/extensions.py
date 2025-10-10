# utils/extensions.py
import logging

from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from utils.db_base import Base
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Instancier les extensions sans les lier à une application.
# Elles seront liées plus tard dans la factory d'application.
# ✅ CORRECTION CRITIQUE : Utiliser la même Base pour Flask-SQLAlchemy
db = SQLAlchemy(model_class=Base)
migrate = Migrate()

# Initialise l'objet Limiter ici, il sera configuré dans la factory
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["100 per minute"]  # Limite par défaut
)
