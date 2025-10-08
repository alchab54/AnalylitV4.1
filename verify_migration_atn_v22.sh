#!/bin/bash
# ================================================================
# SCRIPT VÉRIFICATION POST-MIGRATION ANALYLIT ATN V2.2
# ================================================================

echo "🔍 VÉRIFICATION COMPLÈTE POST-MIGRATION"
echo "=" * 40

# Test connexion
echo "1. Test connexion DB..."
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT 'Connexion OK' as status;" 2>/dev/null

# Liste tables
echo "2. Tables existantes:"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\dt;" 2>/dev/null

# Colonnes extractions
echo "3. Colonnes table extractions:"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\d extractions;" 2>/dev/null

# Test ATN columns
echo "4. Test colonnes ATN:"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'extractions' AND column_name LIKE 'atn_%'
ORDER BY column_name;
" 2>/dev/null

# Test insertion (dry run)
echo "5. Test insertion ATN (dry run):"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
EXPLAIN (FORMAT TEXT) 
INSERT INTO extractions (id, project_id, pmid, title, atn_score, atn_category, atn_justifications)
VALUES ('test', 'test_proj', 'test_article', 'Test Article', 75, 'TRÈS PERTINENT ATN', '[]');
" 2>/dev/null

echo ""
echo "🎯 Si tous les tests passent = prêt pour ATN v2.2 !"
echo "❌ Si erreurs = relancer migration complète"
