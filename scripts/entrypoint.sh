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
# C'est la méthode standard et robuste pour gérer le schéma de la base de données.
echo "🔄 Skip migrations pour les tests..."
# flask db upgrade  # Commenté temporairement

echo "🚀 Démarrage du serveur Gunicorn..."
# La commande Gunicorn est maintenant gérée par le `command` dans docker-compose.yml,
# qui utilise le fichier de configuration gunicorn.conf.py pour plus de flexibilité.
exec "$@"
