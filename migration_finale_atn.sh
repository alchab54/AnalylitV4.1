#!/bin/bash
# MIGRATION FINALE ATN V2.2 - UTILISATEUR CORRECT TROUVÉ

echo "🔧 MIGRATION ATN V2.2 - UTILISATEUR CORRECT: analylit_user"
echo "========================================================"

# Migration avec le vrai utilisateur de la base de données
docker-compose -f docker-compose.dev.yml exec test-db psql -U analylit_user -d analylittestdb -c "
-- Ajout des colonnes ATN v2.2 manquantes
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '2.1';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;

-- Vérification finale - affichage des colonnes ajoutées
\echo '✅ COLONNES ATN AJOUTÉES:';
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
  AND column_name LIKE 'atn_%' 
ORDER BY column_name;
"

echo ""
echo "✅ MIGRATION ATN V2.2 TERMINÉE AVEC SUCCÈS"
echo "🚀 Workers peuvent maintenant sauvegarder les scores ATN"
echo "🎯 Relancer: docker-compose -f docker-compose.dev.yml exec web python atn_workflow_GLORY.py"
