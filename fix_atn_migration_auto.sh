#!/bin/bash

# ================================================================
# 🚀 MIGRATION ATN AUTOMATIQUE FIXED - COLONNES MANQUANTES
# ================================================================
# Basé sur: migration_complete_atn_v22.sh (Ali Chabaane)
# Fix: Colonnes ATN manquantes pour workers
# Date: 08 octobre 2025 15:18
# ================================================================

echo "🚨 MIGRATION ATN AUTOMATIQUE - FIX WORKERS"
echo "===========================================" 

# Arrêt des services pour migration propre
echo "🔧 Arrêt services pour migration sécurisée..."
docker-compose down

# Démarrage uniquement base + redis
echo "⚡ Démarrage base de données..."
docker-compose up -d test-db redis
sleep 15

# Test connexion avec bon utilisateur
echo "🔍 Test connexion analylit_user..."
DB_STATUS=$(docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT version();" 2>/dev/null | grep PostgreSQL | wc -l)

if [ "$DB_STATUS" -eq 0 ]; then
    echo "❌ ERREUR: Connexion DB impossible"
    exit 1
fi

echo "✅ Base PostgreSQL accessible avec analylit_user"

# Vérifier colonnes ATN existantes
echo "🔍 Vérification colonnes ATN actuelles..."
COLONNES_ATN=$(docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'extractions' AND column_name LIKE 'atn_%';" -t | tr -d ' ')

echo "📊 Colonnes ATN existantes: $COLONNES_ATN"

if [ "$COLONNES_ATN" -ge 5 ]; then
    echo "✅ Colonnes ATN déjà présentes - pas de migration nécessaire"
    echo "🎯 Redémarrage services complets..."
    docker-compose up -d
    exit 0
fi

# Migration colonnes ATN manquantes
echo "🧠 AJOUT COLONNES ATN MANQUANTES..."
docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "
-- Colonnes ATN v2.2 critiques pour workers
ALTER TABLE extractions 
ADD COLUMN IF NOT EXISTS atn_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT 'NON_ÉVALUÉ',
ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS atn_algorithm_version VARCHAR(50) DEFAULT 'v2.2',
ADD COLUMN IF NOT EXISTS atn_criteria_found INTEGER DEFAULT 0;

-- Index performance ATN  
CREATE INDEX IF NOT EXISTS idx_extractions_atn_score ON extractions(atn_score);
CREATE INDEX IF NOT EXISTS idx_extractions_atn_category ON extractions(atn_category);

-- Vérification ajout
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'extractions' AND column_name LIKE 'atn_%'
ORDER BY column_name;
" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Colonnes ATN ajoutées avec succès"
else
    echo "❌ ERREUR ajout colonnes ATN"
    exit 1
fi

# Vérification finale
FINAL_COUNT=$(docker-compose exec -T test-db psql -U analylit_user -d analylit_test_db -c "SELECT count(*) FROM information_schema.columns WHERE table_name = 'extractions';" -t | tr -d ' ')

echo "📊 VÉRIFICATION FINALE: $FINAL_COUNT colonnes totales"

if [ "$FINAL_COUNT" -ge 15 ]; then
    echo "🎉 MIGRATION RÉUSSIE - SCHÉMA COMPLET!"
    echo "✅ Workers peuvent maintenant fonctionner"
    echo ""
    echo "🚀 Redémarrage services complets..."
    docker-compose up -d
    sleep 20
    echo ""
    echo "🎯 WORKFLOW PEUT MAINTENANT ÊTRE RELANCÉ:"
    echo "  python atn_workflow_FIXED.py"
else
    echo "❌ Migration incomplète"
    exit 1
fi

echo "✅ Migration automatique terminée avec succès"
