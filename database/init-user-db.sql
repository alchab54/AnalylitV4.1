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

-- Se connecter à la base 'postgres' pour vérifier si 'analylit_db' existe
\c postgres

-- Créer la base de données uniquement si elle n'existe pas
DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_database WHERE datname = 'analylit_db') THEN
      CREATE DATABASE analylit_db WITH OWNER = analylit_user;
   END IF;
END
$do$;

-- Donner tous les privilèges à l'utilisateur sur sa base de données (après sa création)
GRANT ALL PRIVILEGES ON DATABASE analylit_db TO analylit_user;