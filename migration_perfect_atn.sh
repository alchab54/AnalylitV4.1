#!/bin/bash
# MIGRATION ATN V2.2 FINALE - NOMS CORRECTS GITHUB

echo "🔧 MIGRATION ATN V2.2 - NOMS GITHUB CORRECTS"
echo "=============================================="

# Test de connexion d'abord
echo "1. Test connexion utilisateur analylit_user..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "SELECT current_user, current_database();"

if [ $? -eq 0 ]; then
    echo "✅ Connexion réussie, ajout des colonnes..."

    # Ajout des colonnes ATN (syntaxe corrigée)
    docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db <<SQL
-- Ajout des colonnes ATN v2.2
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '2.2';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;

-- Vérification
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
  AND column_name LIKE 'atn_%' 
ORDER BY column_name;
SQL

    echo ""
    echo "✅ MIGRATION ATN V2.2 RÉUSSIE"
else
    echo "❌ CONNEXION ÉCHOUÉE - vérifier noms utilisateur/base"
fi

echo ""
echo "🚀 Tester ensuite: docker-compose -f docker-compose.dev.yml exec web python atn_workflow_GLORY.py"
