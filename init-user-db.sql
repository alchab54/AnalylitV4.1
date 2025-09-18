CREATE USER analylit_user WITH PASSWORD 'strong_password';
CREATE DATABASE analylit_db OWNER analylit_user;

-- Drop public schema to prevent conflicts
DROP SCHEMA public CASCADE;

-- Create a new schema owned by analylit_user
CREATE SCHEMA analylit_schema AUTHORIZATION analylit_user;

GRANT ALL PRIVILEGES ON DATABASE analylit_db TO analylit_user;
GRANT CREATE ON DATABASE analylit_db TO analylit_user;
GRANT ALL PRIVILEGES ON SCHEMA analylit_schema TO analylit_user;
ALTER ROLE analylit_user SET search_path TO analylit_schema;
ALTER DEFAULT PRIVILEGES IN SCHEMA analylit_schema GRANT ALL PRIVILEGES ON TABLES TO analylit_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA analylit_schema GRANT ALL PRIVILEGES ON SEQUENCES TO analylit_user;