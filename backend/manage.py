import os
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask.cli import FlaskGroup

from utils.database import db # Import the global db instance

# Create the Flask app directly for CLI
app = Flask(__name__)

# Configure the app
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', "postgresql://user:pass@db/analylit_db")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize db with the app
db.init_app(app)

# Initialize migrate with the app and db
migrate = Migrate(app, db)

# Create a FlaskGroup for CLI commands
cli = FlaskGroup(app)

if __name__ == '__main__':
    cli()
