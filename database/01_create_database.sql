-- Run ONCE as the PostgreSQL superuser when you use a locally installed PostgreSQL:
--   sudo -u postgres psql -f database/01_create_database.sql
-- (Docker users do not need this - docker compose creates the database automatically.)

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'vms') THEN
        CREATE ROLE vms LOGIN PASSWORD 'vms123';
    END IF;
END $$;

SELECT 'CREATE DATABASE vms OWNER vms'
 WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'vms')\gexec
