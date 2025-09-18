#!/bin/bash
set -e

echo "Entrypoint démarré. En attente de la base de données..."

# Attendre que PostgreSQL soit prêt
while ! nc -z $POSTGRES_HOST $POSTGRES_PORT; do
    sleep 1
done

echo "Base de données prête !"

echo "Initialisation de la base de données et seeding..."

# L'initialisation se fait maintenant automatiquement dans create_app()
# Plus besoin de flask init-db

echo "Démarrage de l'application Flask..."
exec python server_v4_complete.py
