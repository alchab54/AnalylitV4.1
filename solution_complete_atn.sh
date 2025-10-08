#!/bin/bash
# SOLUTION COMPLÈTE ATN V2.2 - CRÉATION TABLES + COLONNES

echo "🔧 SOLUTION COMPLÈTE ATN V2.2"
echo "=============================="

echo "1. Test connexion base de données..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "SELECT current_user, current_database();" || {
    echo "❌ CONNEXION ÉCHOUÉE - ARRÊT"
    exit 1
}

echo ""
echo "2. Lancement Alembic pour créer les tables..."
docker-compose -f docker-compose.dev.yml exec web python -m alembic -c alembic.ini upgrade head

echo ""
echo "3. Vérification table extractions créée..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "\d extractions"

echo ""
echo "4. Ajout colonnes ATN si table existe..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db <<SQL
-- Ajout des colonnes ATN v2.2
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '2.2';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;

-- Vérification finale
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
ORDER BY ordinal_position;
SQL

echo ""
echo "✅ SETUP COMPLET TERMINÉ"
echo "🚀 Lancer: docker-compose -f docker-compose.dev.yml exec web python atn_workflow_GLORY.py"
