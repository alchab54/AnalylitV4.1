#!/bin/bash
set -e
export PATH="/home/appuser/.local/bin:${PATH}"

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U ${POSTGRES_USER:-postgres}; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

echo "🔄 Application des migrations..."
export FLASK_APP=server_v4_complete.py
python -m flask db upgrade
python -m flask db upgrade

echo "🚀 Démarrage du serveur Gunicorn..."
exec gunicorn --config gunicorn.conf.py "server_v4_complete:app"