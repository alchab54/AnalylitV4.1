#!/bin/bash
# Script de reset complet pour résoudre les conflits de migration

echo "🔥 Reset complet de la base de données..."

# Arrêter tous les conteneurs
docker-compose down -v

# Supprimer les volumes persistants
docker volume prune -f

# Supprimer les fichiers de migration problématiques
echo "🗑️  Nettoyage des migrations..."
rm -rf migrations/versions/d3577afd6bd0_*.py

# Recréer la migration proprement
docker-compose up -d db test_db

# Attendre que les bases soient prêtes
sleep 10

# Créer une nouvelle migration propre
docker-compose run --rm migrate flask db init --directory migrations
docker-compose run --rm migrate flask db migrate -m "Clean initial migration"
docker-compose run --rm migrate flask db upgrade

echo "✅ Reset terminé"