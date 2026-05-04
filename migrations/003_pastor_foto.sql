-- Migration 003: foto_url para pastores
ALTER TABLE pastores ADD COLUMN IF NOT EXISTS foto_url VARCHAR(200);
