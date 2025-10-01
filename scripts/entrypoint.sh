#!/bin/bash
set -e

# ✅ CORRECTION: Utiliser une variable d'environnement pour le nom d'hôte de la DB.
# 'db' sera la valeur par défaut si la variable n'est pas définie.
DB_HOST=${DB_HOST:-db}

echo "🔍 Attente de la base de données..."
until pg_isready -h "$DB_HOST" -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

# ✅ CORRECTION: Ce script attend maintenant simplement que la base de données soit prête,
# puis exécute la commande passée au conteneur (définie dans docker-compose.yml).
echo "▶️ Exécution de la commande du conteneur..."
exec "$@"
