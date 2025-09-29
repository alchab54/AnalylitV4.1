#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

echo "🔄 Application des migrations de la base de données..."
# Utilise Flask-Migrate pour appliquer les migrations.
# La commande 'upgrade' amène la base de données à la dernière version définie dans les fichiers de migration.
# ✅ CORRECTION : On "tamponne" d'abord la base de données avec la dernière version.
# Si la base de données est nouvelle, cela n'a aucun effet.
# Si les tables existent déjà, cela empêche Alembic de tenter de les recréer.
flask db stamp head
# Ensuite, on applique les nouvelles migrations (s'il y en a).
flask db upgrade

echo "✅ Migrations terminées."

# Démarrer Gunicorn uniquement si l'argument est "start-web"
if [ "$1" = "start-web" ]; then
# ✅ CORRECTION FINALE : Exécuter les migrations OU démarrer le serveur, mais pas les deux.
if [ "$1" = "migrate-only" ]; then
    echo "🔄 Application des migrations de la base de données..."
    # On "tamponne" d'abord la base de données avec la dernière version pour éviter les erreurs de recréation.
    flask db stamp head
    # Ensuite, on applique les nouvelles migrations.
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
