-- DANGER: wipes every table in the "vms" database so the backend can rebuild it from scratch.
-- Use this if an earlier failed start left half-created tables behind
-- (symptom: "Found non-empty schema(s) public but no schema history table" or
--  "Detected failed migration").
--   sudo -u postgres psql -d vms -f database/02_reset_database.sql
-- Then start the backend again - Flyway recreates all tables and reference data.

DROP SCHEMA public CASCADE;
CREATE SCHEMA public AUTHORIZATION vms;
GRANT ALL ON SCHEMA public TO vms;
