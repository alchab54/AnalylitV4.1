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
from utils.database import init_database
from utils import models # Ensure models are loaded to populate Base.metadata

print('Création du schéma et des tables...')
init_database()
print('✅ Schéma et tables créés avec succès via init_database!')
"

echo "🚀 Démarrage du serveur Gunicorn..."
# Optimisation pour un CPU 8 cœurs : 8 workers pour maximiser l'utilisation du CPU.
exec gunicorn --bind 0.0.0.0:5000 --workers 8 --worker-class geventwebsocket.gunicorn.workers.GeventWebSocketWorker "server_v4_complete:create_app()"
