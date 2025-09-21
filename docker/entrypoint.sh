#!/bin/sh
set -e

# Attendre que la base de données soit prête
until pg_isready -h db -p 5432 -U ${POSTGRES_USER}; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"

# Appliquer les migrations de la base de données
echo "Applying database migrations..."
flask db upgrade

# Lancer la commande principale du conteneur
echo "Starting Gunicorn..."
exec gunicorn --bind 0.0.0.0:5000 --workers 4 --threads 2 --worker-class gevent "app:create_app()"