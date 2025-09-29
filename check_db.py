from backend.server_v4_complete import create_app
from utils.models import Project
from sqlalchemy import text

app = create_app()
with app.app_context():
    from utils.database import db
    db.session.execute(text('SET search_path TO analylit_schema, public'))
    print('projects OK?', db.session.execute(text('SELECT COUNT(*) FROM projects')).scalar())