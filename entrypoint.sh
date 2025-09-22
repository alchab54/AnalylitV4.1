#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U ${POSTGRES_USER:-postgres}; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

echo "🔄 Application des migrations..."
export FLASK_APP=app
python -m flask db upgrade

echo "🚀 Démarrage du serveur Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 2 --threads 2 --worker-class gevent "app:create_app()"