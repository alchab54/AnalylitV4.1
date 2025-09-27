-- Création du rôle utilisateur (adapté)
-- ===================================================================
-- == ANALYLIT V4.1 - SCRIPT D'INITIALISATION POSTGRESQL ==
-- ===================================================================
--
-- Ce script est exécuté automatiquement par l'image Docker de PostgreSQL
-- APRÈS la création de la base de données et de l'utilisateur définis
-- dans `docker-compose.yml` (POSTGRES_DB, POSTGRES_USER).
--
-- Le script se connecte automatiquement à la base `analylit_db`.

-- Créer le schéma applicatif pour une meilleure organisation des tables.
-- L'utilisateur 'analylit_user' en devient propriétaire.
CREATE SCHEMA IF NOT EXISTS analylit_schema AUTHORIZATION analylit_user;

-- S'assurer que l'utilisateur a tous les droits sur son schéma.
GRANT ALL PRIVILEGES ON SCHEMA analylit_schema TO analylit_user;