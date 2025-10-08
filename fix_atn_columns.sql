
-- Migration manuelle pour ajouter colonnes ATN à la table extractions
-- Date: 08 octobre 2025 - Fix critique colonnes manquantes

-- Ajouter colonnes ATN
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_score DECIMAL(4,2) DEFAULT 0;
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_category VARCHAR(50) DEFAULT 'NON_ÉVALUÉ';
ALTER TABLE extractions ADD COLUMN IF NOT EXISTS atn_justifications TEXT DEFAULT '[]';

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_extractions_atn_score ON extractions(atn_score);
CREATE INDEX IF NOT EXISTS idx_extractions_atn_category ON extractions(atn_category);

-- Vérification colonnes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'extractions' 
AND column_name IN ('atn_score', 'atn_category', 'atn_justifications');
