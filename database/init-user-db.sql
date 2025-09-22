-- Création du rôle utilisateur (adapté)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_roles WHERE rolname = 'analylit_user'
   ) THEN
      CREATE ROLE analylit_user WITH LOGIN PASSWORD 'strong_password';
   END IF;
END
$do$;

-- Vérifier si la base existe avant de créer
CREATE DATABASE analylit_db WITH OWNER = analylit_user;