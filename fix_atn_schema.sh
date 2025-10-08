#!/bin/bash
# MIGRATION SCHÉMA ATN V2.2 - COLONNES MANQUANTES

echo "🔧 MIGRATION ATN V2.2 - AJOUT COLONNES EXTRACTIONS"
echo "=================================================="

# Se connecter à la base de données et ajouter les colonnes
docker-compose -f docker-compose.dev.yml exec test-db psql -U appuser -d test_db -c "
-- Ajout des colonnes ATN v2.2 si elles n'existent pas
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';  
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;

-- Vérification
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
  AND column_name IN ('atn_score', 'atn_category', 'atn_justifications');
"

echo ""
echo "✅ MIGRATION ATN V2.2 TERMINÉE"
echo "🚀 Les workers peuvent maintenant sauvegarder les scores ATN"
