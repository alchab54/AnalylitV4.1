#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

echo "🔄 Création des tables de base de données..."
python -c "
from server_v4_complete import create_app
from utils.database import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    print('Création du schéma analylit_schema...')
    with db.engine.connect() as conn:
        conn.execute(text('CREATE SCHEMA IF NOT EXISTS analylit_schema;'))
        conn.commit()
    
    print('Création de toutes les tables...')
    db.create_all()
    
    print('✅ Tables créées avec succès!')
"

echo "🚀 Démarrage du serveur Gunicorn..."
# Optimisation pour un CPU 8 cœurs : 8 workers pour maximiser l'utilisation du CPU.
exec gunicorn --bind 0.0.0.0:5000 --workers 8 --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker "server_v4_complete:create_app()"
