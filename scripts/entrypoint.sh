#!/bin/bash
set -e

echo "🔍 Attente de la base de données..."
until pg_isready -h db -p 5432 -U "${POSTGRES_USER:-postgres}"; do
  echo "Base de données indisponible - attente..."
  sleep 2
done

echo "✅ Base de données prête!"

# ✅ CORRECTION: Ce script attend maintenant simplement que la base de données soit prête,
# puis exécute la commande passée au conteneur (définie dans docker-compose.yml).
echo "▶️ Exécution de la commande du conteneur..."
exec "$@"
