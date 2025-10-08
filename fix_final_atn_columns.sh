#!/bin/bash
# FIX DÉFINITIF ATN - AJOUT COLONNES SUR BASE EXISTANTE

echo "🔧 FIX DÉFINITIF ATN - AJOUT COLONNES"
echo "===================================="

echo "1. Vérification structure actuelle table extractions..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "\d extractions"

echo ""
echo "2. Ajout IMMÉDIAT des colonnes ATN..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db <<SQL
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '2.2';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;
SQL

echo ""
echo "3. Vérification colonnes ajoutées..."
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylit_test_db -c "
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
  AND column_name LIKE 'atn_%' 
ORDER BY column_name;
"

echo ""
echo "✅ COLONNES ATN AJOUTÉES À LA TABLE EXISTANTE"
echo "🚀 Les workers peuvent maintenant sauvegarder !"
