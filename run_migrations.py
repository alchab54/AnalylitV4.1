import logging
from flask_migrate import upgrade
from server_v4_complete import create_app, db

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

log.info("Creating app for migrations...")
app = create_app()

with app.app_context():
    log.info("Initializing DB for migrations...")
    db.init_app(app)
    log.info("Applying database migrations...")
    upgrade()
    log.info("Migrations applied successfully.")