-- ================================================================ 
-- COLONNES ATN V2.2 - À EXÉCUTER DANS POSTGRESQL
-- ================================================================ 
ALTER TABLE extractions 
ADD COLUMN IF NOT EXISTS atn_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS atn_category VARCHAR(100) DEFAULT '',
ADD COLUMN IF NOT EXISTS atn_justifications JSONB DEFAULT '[]';

-- Optionnel: Index pour requêtes optimisées
CREATE INDEX IF NOT EXISTS idx_extractions_atn_score ON extractions(atn_score);
CREATE INDEX IF NOT EXISTS idx_extractions_atn_category ON extractions(atn_category);

-- Vérification
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'extractions' AND column_name LIKE 'atn_%';