CREATE ROLE analylit_user WITH LOGIN PASSWORD 'strong_password';
ALTER ROLE analylit_user CREATEDB;
CREATE DATABASE analylit_db OWNER analylit_user;