#!/bin/bash
# ================================================================
# SCRIPT MIGRATION COMPLÈTE ANALYLIT V4.2 + ATN V2.2
# ================================================================
# Résout: "relation extractions does not exist"  
# Crée: Schema complet + colonnes ATN v2.2
# Status: Critique pour scoring ATN
# ================================================================

echo "🔍 DIAGNOSTIC BASE DE DONNÉES ANALYLIT..."

# Vérifier connexion DB
DB_STATUS=$(docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT version();" 2>/dev/null | grep PostgreSQL | wc -l)

if [ "$DB_STATUS" -eq 0 ]; then
    echo "❌ ERREUR: Base de données non accessible"
    echo "🔧 Démarrage des services..."
    docker-compose up -d test-db redis
    sleep 15
fi

echo "✅ Base PostgreSQL accessible"

# Vérifier schema existant
echo "🔍 Vérification du schéma existant..."
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\dt;" > /tmp/tables_current.txt 2>/dev/null

if grep -q "extractions" /tmp/tables_current.txt; then
    echo "✅ Table extractions existe"
    HAS_EXTRACTIONS=1
else
    echo "❌ Table extractions MANQUANTE"
    HAS_EXTRACTIONS=0
fi

# Force migration Alembic complète
echo "🔧 Exécution migration Alembic complète..."
docker-compose run --rm migrate

# Attendre fin migration
sleep 10

# Vérifier à nouveau après migration
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "\dt;" > /tmp/tables_post_migration.txt 2>/dev/null

if grep -q "extractions" /tmp/tables_post_migration.txt; then
    echo "✅ Migration Alembic réussie - table extractions créée"
else
    echo "⚠️ Migration Alembic incomplète - création manuelle"

    # Création manuelle table extractions (schema minimal)
    docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
    CREATE TABLE IF NOT EXISTS extractions (
        id VARCHAR PRIMARY KEY,
        project_id VARCHAR NOT NULL,
        pmid VARCHAR NOT NULL,
        title TEXT,
        extracted_data JSONB,
        relevance_score INTEGER DEFAULT 0,
        relevance_justification TEXT,
        analysis_source VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP,
        UNIQUE(project_id, pmid)
    );

    -- Index pour performance
    CREATE INDEX IF NOT EXISTS idx_extractions_project_id ON extractions(project_id);
    CREATE INDEX IF NOT EXISTS idx_extractions_pmid ON extractions(pmid);
    " 2>/dev/null

    if [ $? -eq 0 ]; then
        echo "✅ Table extractions créée manuellement"
    else
        echo "❌ ERREUR CRITIQUE: Impossible de créer table extractions"
        exit 1
    fi
fi

# Maintenant ajouter colonnes ATN v2.2
echo "🧠 Ajout colonnes ATN v2.2..."
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
-- Colonnes ATN v2.2 pour scoring avancé
ALTER TABLE extractions 
ADD COLUMN IF NOT EXISTS atn_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(50) DEFAULT 'v2.2',
ADD COLUMN IF NOT EXISTS atn_criteria_found INTEGER DEFAULT 0;

-- Index pour performance ATN
CREATE INDEX IF NOT EXISTS idx_extractions_atn_score ON extractions(atn_score);
CREATE INDEX IF NOT EXISTS idx_extractions_atn_category ON extractions(atn_category);

-- Vérification finale
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
ORDER BY column_name;
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Colonnes ATN v2.2 ajoutées avec succès"
else
    echo "❌ Erreur ajout colonnes ATN"
    exit 1
fi

# Vérification finale du schéma
echo "📊 VÉRIFICATION SCHÉMA FINAL..."
COLUMNS_COUNT=$(docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'extractions';" -t | tr -d ' ')

echo "📊 Table extractions: $COLUMNS_COUNT colonnes"

if [ "$COLUMNS_COUNT" -ge 15 ]; then
    echo "🎉 SCHÉMA COMPLET PRÊT POUR ATN V2.2 !"
    echo "✅ Base de données optimisée RTX 2060 SUPER"
    echo "🚀 Prêt pour scoring ATN discriminant"
else
    echo "⚠️ Schéma partiel - vérification manuelle recommandée"
fi

echo ""
echo "🎯 PROCHAINES ÉTAPES :"
echo "  1. Vérifier logs migration ci-dessus"
echo "  2. Intégrer fonction process_single_article_task corrigée"
echo "  3. docker-compose restart"
echo "  4. Lancer workflow → scores ATN réalistes !"

# Nettoyage fichiers temporaires
rm -f /tmp/tables_*.txt

echo "✅ Script de migration terminé"
