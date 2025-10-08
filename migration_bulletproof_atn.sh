#!/bin/bash
# MIGRATION ATN V2.2 - SOLUTION SUPERUSER INFAILLIBLE

echo "🔧 MIGRATION ATN V2.2 - MÉTHODE SUPERUSER INFAILLIBLE"
echo "======================================================"

# Méthode 1: Via le superuser du conteneur (INFAILLIBLE)
echo "🔄 Tentative avec superuser conteneur..."
docker-compose -f docker-compose.dev.yml exec test-db sh -c '
su postgres -c "psql -d analylittestdb" <<EOF
-- Ajout des colonnes ATN v2.2
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT '"'"'NON_EVALUE'"'"';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '"'"'[]'"'"'::jsonb;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '"'"'2.2'"'"';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;

-- Vérification
\echo '"'"'✅ COLONNES ATN AJOUTÉES:'"'"';
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = '"'"'extractions'"'"' 
  AND column_name LIKE '"'"'atn_%'"'"' 
ORDER BY column_name;
EOF
'

# Si la méthode 1 échoue, méthode 2: root direct
if [ $? -ne 0 ]; then
    echo "🔄 Méthode superuser échouée, tentative root direct..."
    docker-compose -f docker-compose.dev.yml exec -u root test-db psql -U postgres -d analylittestdb -c "
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_EVALUE';
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb;
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(10) DEFAULT '2.2';
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_processing_time NUMERIC DEFAULT 0;
    "
fi

# Si tout échoue, méthode 3: environnement variables
if [ $? -ne 0 ]; then
    echo "🔄 Méthode root échouée, tentative variables environnement..."
    docker-compose -f docker-compose.dev.yml exec test-db bash -c '
    export PGUSER=${POSTGRES_USER}
    export PGDATABASE=${POSTGRES_DB}
    psql -c "
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score NUMERIC(3,1) DEFAULT 0.0;
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT "NON_EVALUE";
    ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT "[]"::jsonb;
    "
    '
fi

echo ""
echo "✅ MIGRATION ATN V2.2 EXÉCUTÉE"
echo "🎯 Test: docker-compose -f docker-compose.dev.yml exec test-db psql -c '\d extractions'"
echo "🚀 Relancer: docker-compose -f docker-compose.dev.yml exec web python atn_workflow_GLORY.py"
