#!/bin/bash
set -e

echo "Entrypoint démarré. En attente de la base de données..."

# Attendre que PostgreSQL soit prêt
while ! nc -z "$POSTGRES_HOST" "$POSTGRES_PORT"; do
    sleep 1
done

echo "Base de données prête !"

echo "Initialisation de la base de données et seeding..."

# Exécute l'initialisation de la base de données de manière explicite
python -c 'from utils.database import init_database; init_database()'

echo "Démarrage de l'application Flask avec Gunicorn..."
# Start Gunicorn
exec "$@"