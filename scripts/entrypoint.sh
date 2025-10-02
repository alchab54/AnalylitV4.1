#!/bin/bash
set -e

# Utiliser une variable d'environnement pour le nom d'hôte de la DB.
# 'db' sera la valeur par défaut si DB_HOST n'est pas définie.
DB_HOST=${DB_HOST:-db}
DB_PORT=${DB_PORT:-5432}
DB_USER=${POSTGRES_USER:-postgres}

# Vérifier si la commande pg_isready existe
if ! command -v pg_isready &> /dev/null; then
    echo "⚠️  'pg_isready' non trouvé. Le conteneur va démarrer sans attendre la base de données."
else
    echo "🔍 Attente de la base de données sur ${DB_HOST}:${DB_PORT}..."
    # Boucle jusqu'à ce que la base de données soit prête
    until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -q; do
      echo "   Base de données indisponible - nouvelle tentative dans 2s..."
      sleep 2
    done
    echo "✅ Base de données prête !"
fi

# Exécute la commande principale passée au conteneur (CMD dans Dockerfile ou command dans docker-compose)
echo "▶️  Exécution de la commande principale : $@"
exec "$@"
