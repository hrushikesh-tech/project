-- Create separate database for Keycloak
-- This runs automatically on first TimescaleDB startup via docker-entrypoint-initdb.d
CREATE DATABASE keycloak_db;
