# utils/extensions.py
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# Instancier les extensions sans les lier à une application.
# Elles seront liées plus tard dans la factory d'application.
db = SQLAlchemy()
migrate = Migrate()