#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

# ✅ CORRECTION FINALE : Exécuter les migrations OU démarrer le serveur, mais pas les deux.
if [ "$1" = "migrate-only" ]; then
  echo "🔄 Application des migrations de la base de données..."
  # ✅ CORRECTION: Vérifier si des migrations existent avant stamp
  if flask db current >/dev/null 2>&1; then
    echo "Stamping existing migrations..."
    flask db stamp head
  else
    echo "Initialisation première migration..."
    flask db upgrade
  fi
  # Appliquer les nouvelles migrations
  flask db upgrade
  echo "✅ Migrations terminées. Le conteneur va s'arrêter."
elif [ "$1" = "start-web" ]; then
    echo "🚀 Démarrage du serveur Gunicorn..."
    # La commande Gunicorn est maintenant gérée par le `command` dans docker-compose.yml,
    # qui utilise le fichier de configuration gunicorn.conf.py pour plus de flexibilité.
    exec gunicorn --conf backend/config/gunicorn.conf.py api.gunicorn_entry:app
else
    echo "❌ Argument non reconnu: '$1'. Utiliser 'migrate-only' ou 'start-web'."
    exit 1
fi
