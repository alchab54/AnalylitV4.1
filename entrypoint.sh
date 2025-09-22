#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
# On utilise pg_isready qui est l'outil standard pour ça
until pg_isready -h db -p 5432 -U ${POSTGRES_USER}; do
  >&2 echo "Postgres est indisponible - attente..."
  sleep 1
done
>&2 echo "✅ Base de données prête!"

# Lancer le script de migration Python
echo "🔄 Application des migrations..."
python run_migrations.py

# Lancer la commande principale (Gunicorn)
echo "🚀 Démarrage du serveur Gunicorn..."
exec gunicorn --config gunicorn.conf.py "server_v4_complete:create_app()"