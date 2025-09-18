#!/bin/sh

# Active la sortie immédiate en cas d'erreur
set -e

echo "Entrypoint démarré. En attente de la base de données..."

# Boucle d'attente pour Postgres
# Utilise les variables d'environnement fournies par docker-compose
# Note : $$POSTGRES_USER est correct pour pg_isready dans un script shell
until pg_isready -h "db" -p 5432 -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  echo "La base de données n'est pas encore prête... en attente."
  sleep 2
done

echo "Base de données prête !"

# Exécute les commandes d'initialisation de l'application
echo "Initialisation de la base de données et seeding..."
python -c 'from server_v4_complete import _init_db_command; _init_db_command()'

# Lance le serveur Gunicorn
echo "Lancement du serveur Gunicorn..."
exec gunicorn server_v4_complete:app \
    -k geventwebsocket.gunicorn.workers.GeventWebSocketWorker \
    -w 3 \
    -b 0.0.0.0:5001 \
    --access-logfile - \
    --error-logfile -