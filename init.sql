-- init.sql - Script d'initialisation PostgreSQL
CREATE SCHEMA IF NOT EXISTS analylit_schema;
GRANT ALL PRIVILEGES ON SCHEMA analylit_schema TO analylit_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analylit_schema TO analylit_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analylit_schema TO analylit_user;
ALTER USER analylit_user SET search_path = analylit_schema, public;
