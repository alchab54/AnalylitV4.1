-- Vérifier si la base existe avant de créer (PostgreSQL ne supporte pas IF NOT EXISTS dans CREATE DATABASE)
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_database WHERE datname = 'analylit_db'
   ) THEN
      PERFORM dblink_exec('dbname=postgres', 'CREATE DATABASE analylit_db OWNER analylit_user');
   END IF;
END
$do$;

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