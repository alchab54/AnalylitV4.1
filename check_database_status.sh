#!/bin/bash
# VÉRIFICATION ÉTAT BASE DE DONNÉES - DÉMARRAGE EN COURS

echo "🔍 VÉRIFICATION ÉTAT BASE DE DONNÉES"
echo "===================================="

echo "1. État des conteneurs:"
docker-compose -f docker-compose.dev.yml ps

echo ""
echo "2. Logs de démarrage PostgreSQL (dernières 20 lignes):"
docker-compose -f docker-compose.dev.yml logs --tail=20 test-db

echo ""
echo "3. Test connexion utilisateur analylituser:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylituser -d analylittestdb -c "SELECT current_user, version();"

echo ""
echo "4. Si connexion OK, liste des tables:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylituser -d analylittestdb -c "\dt"
