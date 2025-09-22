DO
$do$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'analylit_user') THEN
      CREATE ROLE analylit_user WITH LOGIN PASSWORD 'strong_password';
   END IF;
END
$do$;

ALTER ROLE analylit_user CREATEDB;

CREATE DATABASE analylit_db OWNER analylit_user IF NOT EXISTS;