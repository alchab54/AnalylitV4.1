-- Ce script est exécuté après la création automatique de 'analylit_db' par l'image Postgres.

-- Crée un utilisateur (si vous n'utilisez pas l'utilisateur par défaut)
-- L'utilisateur par défaut 'analylit_user' est déjà créé par l'image.

-- Crée la base de données de TEST
CREATE DATABASE analylit_db_test;
GRANT ALL PRIVILEGES ON DATABASE analylit_db_test TO analylit_user;

-- S'assure que l'utilisateur peut créer des extensions dans la BDD de test (utile pour pytest)
\c analylit_db_test
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";