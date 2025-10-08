#!/bin/bash
# DIAGNOSTIC POSTGRESQL BRUTAL - TOUTE LA VÉRITÉ

echo "🚨 DIAGNOSTIC POSTGRESQL BRUTAL"
echo "==============================="

echo ""
echo "1. Variables d'environnement du conteneur test-db:"
docker-compose -f docker-compose.dev.yml exec test-db env | grep POSTGRES

echo ""
echo "2. Contenu du répertoire de données PostgreSQL:"
docker-compose -f docker-compose.dev.yml exec test-db ls -la /var/lib/postgresql/data/

echo ""
echo "3. Liste de TOUS les utilisateurs PostgreSQL existants:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U postgres -c "\du" 2>/dev/null || echo "ÉCHEC connexion postgres"

echo ""
echo "4. Tentative avec utilisateur par défaut postgres:"
docker-compose -f docker-compose.dev.yml exec test-db psql postgres -c "SELECT current_user;" 2>/dev/null || echo "POSTGRES N'EXISTE PAS"

echo ""
echo "5. Tentative connexion sans utilisateur spécifique:"
docker-compose -f docker-compose.dev.yml exec test-db psql -c "SELECT current_user;" 2>/dev/null || echo "AUCUN UTILISATEUR PAR DÉFAUT"

echo ""
echo "6. Processus PostgreSQL dans le conteneur:"
docker-compose -f docker-compose.dev.yml exec test-db ps aux | grep postgres

echo ""
echo "🎯 FIN DIAGNOSTIC BRUTAL"
