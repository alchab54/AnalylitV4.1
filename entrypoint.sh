#!/bin/sh

# Arrête le script si une commande échoue
set -e

echo "Waiting for database to be ready..."

# La variable PGPASSWORD est automatiquement utilisée par les outils client PostgreSQL.
# L'exportation garantit qu'elle est disponible pour la commande.
export PGPASSWORD=$POSTGRES_PASSWORD

# Boucle jusqu'à ce que la base de données soit prête à accepter des connexions
while ! pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "Database is unavailable - sleeping"
  sleep 2
done

echo "Database is ready. Initializing schema and seeding data..."
python -c 'from server_v4_complete import _init_db_command; _init_db_command()'

echo "Starting Gunicorn server..."
# Utilise 'exec' pour que Gunicorn devienne le processus principal (PID 1),
# ce qui permet de recevoir correctement les signaux de Docker (ex: pour arrêter le conteneur).
exec gunicorn server_v4_complete:app -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker -w 3 -b 0.0.0.0:5001 --access-logfile - --error-logfile -
