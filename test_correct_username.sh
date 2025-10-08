#!/bin/bash
# TEST AVEC LE BON UTILISATEUR (UNDERSCORE)

echo "🔍 TEST AVEC UTILISATEUR CORRECT: analylit_user"
echo "=============================================="

echo "1. Test connexion utilisateur analylit_user:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "
SELECT current_user, current_database(), version();
"

echo ""
echo "2. Liste des tables existantes:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "\dt"

echo ""
echo "3. Structure table extractions:"
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "\d extractions"

echo ""
echo "✅ SI ÇA MARCHE: analylit_user est le bon nom!"
echo "🚀 ALORS: mise à jour des scripts avec analylit_user"
