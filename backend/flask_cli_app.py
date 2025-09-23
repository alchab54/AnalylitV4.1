from server_v4_complete import create_app
from utils.database import db
from flask_migrate import Migrate

app = create_app()
migrate = Migrate(app, db)
