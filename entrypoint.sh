#!/bin/sh

# Active la sortie immédiate en cas d'erreur
set -e

echo "Entrypoint démarré. En attente de la base de données..."

# Boucle d'attente pour Postgres
# Utilise les variables d'environnement fournies par docker-compose
# CORRECTION : Utiliser PGPASSWORD et tous les paramètres pour un test de connexion complet.
# NOUVELLE CORRECTION : Utiliser psql pour tenter une vraie connexion, ce qui est plus fiable que pg_isready.

# Exporte le mot de passe pour que psql puisse l'utiliser automatiquement
export PGPASSWORD=$POSTGRES_PASSWORD

# Boucle d'attente avec un nombre maximum de tentatives
max_retries=30
retry_count=0

until psql -h "db" -p "5432" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\q' > /dev/null 2>&1; do
  retry_count=$((retry_count+1))
  if [ $retry_count -ge $max_retries ]; then
    echo "Échec de la connexion à la base de données après $max_retries tentatives. Abandon."
    exit 1
  fi
  echo "La base de données n'est pas encore prête... en attente (tentative $retry_count/$max_retries)."
  sleep 5 # Augmentation du temps d'attente entre les tentatives
done

# (Optionnel mais propre) Supprime la variable de l'environnement
unset PGPASSWORD

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