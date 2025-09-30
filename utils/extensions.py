# utils/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from utils.db_base import Base

# Instancier les extensions sans les lier à une application.
# Elles seront liées plus tard dans la factory d'application.
# ✅ CORRECTION CRITIQUE : Utiliser la même Base pour Flask-SQLAlchemy
db = SQLAlchemy(model_class=Base)
migrate = Migrate()