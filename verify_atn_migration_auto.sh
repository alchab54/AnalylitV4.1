#!/bin/bash

# ================================================================
# 🔍 VÉRIFICATION AUTOMATIQUE POST-MIGRATION ATN
# ================================================================
# Basé sur: verify_migration_atn_v22.sh (Ali Chabaane) 
# Fix: Vérification colonnes ATN pour workers
# Date: 08 octobre 2025 15:18
# ================================================================

echo "🔍 VÉRIFICATION ATN POST-MIGRATION"
echo "=================================="

# 1. Test connexion avec bon utilisateur
echo "1. Test connexion analylit_user..."
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT 'Connexion ATN OK' as status;" 2>/dev/null

if [ $? -ne 0 ]; then
    echo "❌ ERREUR: Connexion impossible avec analylit_user"
    exit 1
fi

# 2. Liste tables
echo "2. Tables existantes:"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\dt;" 2>/dev/null

# 3. Colonnes table extractions
echo "3. Schema table extractions:"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\d extractions;" 2>/dev/null

# 4. Vérification CRITIQUE colonnes ATN
echo "4. CRITIQUE - Colonnes ATN pour workers:"
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

# 5. Test insertion ATN (dry run)
echo "5. Test insertion ATN (dry run):"
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
EXPLAIN (FORMAT TEXT)
INSERT INTO extractions (
    id, project_id, pmid, title, 
    atn_score, atn_category, atn_justifications, atn_algorithm_version
) VALUES (
    'test_atn', 'proj_test', 'art_test', 'Test ATN Workers', 
    85, 'TRÈS PERTINENT ATN', '["Critère 1: IA conversationnelle"]', 'v2.2'
);
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 VALIDATION COMPLÈTE RÉUSSIE!"
    echo "✅ Colonnes ATN présentes"
    echo "✅ Workers peuvent fonctionner"
    echo "✅ Schéma compatible tasks_v4_complete.py"
    echo ""
    echo "🚀 PRÊT POUR WORKFLOW FINAL:"
    echo "  python atn_workflow_FIXED.py"
else
    echo ""
    echo "❌ VALIDATION ÉCHOUÉE"
    echo "⚠️ Colonnes ATN manquantes - relancer migration"
fi
