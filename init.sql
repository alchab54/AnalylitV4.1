-- init.sql - Script d'initialisation de la base
CREATE SCHEMA IF NOT EXISTS analylit_schema;
GRANT ALL PRIVILEGES ON SCHEMA analylit_schema TO analylit_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analylit_schema TO analylit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analylit_schema TO analylit_user;

-- Assurer que le schéma par défaut est correct pour l'utilisateur
ALTER USER analylit_user SET search_path = analylit_schema, public;