-- =============================================================================
-- Visão Célula — Migração 002
-- Tabela ministerios + colunas adicionais em membros e grupos_pastor
-- =============================================================================

-- Ministérios (vinculados à igreja)
CREATE TABLE IF NOT EXISTS ministerios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(100) NOT NULL,
    igreja_id   INTEGER NOT NULL REFERENCES igrejas(id) ON DELETE CASCADE,
    ativo       BOOLEAN DEFAULT TRUE,
    criado_em   TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ministerios_igreja ON ministerios(igreja_id);

-- Grupos de pastor: adicionar coluna ativo se não existir
ALTER TABLE grupos_pastor ADD COLUMN IF NOT EXISTS ativo BOOLEAN DEFAULT TRUE;
ALTER TABLE grupos_pastor ADD COLUMN IF NOT EXISTS descricao VARCHAR(200);

-- Membros: colunas extras para o formulário completo de discípulo
ALTER TABLE membros ADD COLUMN IF NOT EXISTS ministerio_id     INTEGER REFERENCES ministerios(id);
ALTER TABLE membros ADD COLUMN IF NOT EXISTS instrucao         VARCHAR(30);
ALTER TABLE membros ADD COLUMN IF NOT EXISTS identidade        VARCHAR(25);
ALTER TABLE membros ADD COLUMN IF NOT EXISTS dizimista         BOOLEAN DEFAULT FALSE;
ALTER TABLE membros ADD COLUMN IF NOT EXISTS carteira_emitida  BOOLEAN DEFAULT FALSE;
ALTER TABLE membros ADD COLUMN IF NOT EXISTS ultimo_acesso     TIMESTAMP;
ALTER TABLE membros ADD COLUMN IF NOT EXISTS codigo            VARCHAR(20);

CREATE INDEX IF NOT EXISTS idx_membros_ministerio ON membros(ministerio_id);

-- Pastores: adicionar campo ministerio de liderança
ALTER TABLE pastores ADD COLUMN IF NOT EXISTS ministerio_id INTEGER REFERENCES ministerios(id);
