#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

echo "🔄 Création des tables de base de données..."
# Au lieu d'utiliser flask db upgrade (qui pose problème), 
# on crée les tables directement via SQLAlchemy
python -c "
from server_v4_complete import create_app
from utils.database import db

app = create_app()
with app.app_context():
    print('Création du schéma analylit_schema...')
    db.engine.execute('CREATE SCHEMA IF NOT EXISTS analylit_schema;')
    
    print('Création de toutes les tables...')
    db.create_all()
    
    print('✅ Tables créées avec succès!')
"

echo "🚀 Démarrage du serveur Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 2 --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker "server_v4_complete:create_app()"
