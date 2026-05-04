-- =============================================================================
-- Visão Célula — Migração 005
-- Macrocélulas: código, descrição, líder (membro/discípulo)
-- Validações: unique nome por entidade/igreja, CPF por pastor/membro
-- =============================================================================

-- Novos campos em macrocelulas
ALTER TABLE macrocelulas ADD COLUMN IF NOT EXISTS codigo        VARCHAR(20);
ALTER TABLE macrocelulas ADD COLUMN IF NOT EXISTS descricao     TEXT;
ALTER TABLE macrocelulas ADD COLUMN IF NOT EXISTS lider_membro_id INTEGER;

-- FK para membros (discípulo líder da macro)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'macrocelulas_lider_membro_id_fkey'
    ) THEN
        ALTER TABLE macrocelulas
            ADD CONSTRAINT macrocelulas_lider_membro_id_fkey
            FOREIGN KEY (lider_membro_id) REFERENCES membros(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_macrocelulas_lider ON macrocelulas(lider_membro_id);

-- Constraints UNIQUE: nome por entidade/igreja
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_grupos_pastor_nome_igreja') THEN
        ALTER TABLE grupos_pastor ADD CONSTRAINT uq_grupos_pastor_nome_igreja UNIQUE (nome, igreja_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_ministerios_nome_igreja') THEN
        ALTER TABLE ministerios ADD CONSTRAINT uq_ministerios_nome_igreja UNIQUE (nome, igreja_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_tipos_celula_nome_igreja') THEN
        ALTER TABLE tipos_celula ADD CONSTRAINT uq_tipos_celula_nome_igreja UNIQUE (nome, igreja_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_macrocelulas_nome_igreja') THEN
        ALTER TABLE macrocelulas ADD CONSTRAINT uq_macrocelulas_nome_igreja UNIQUE (nome, igreja_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_celulas_nome_igreja') THEN
        ALTER TABLE celulas ADD CONSTRAINT uq_celulas_nome_igreja UNIQUE (nome, igreja_id);
    END IF;
END $$;

-- Pastor e discípulo: unique por CPF+igreja
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_pastores_cpf_igreja') THEN
        ALTER TABLE pastores ADD CONSTRAINT uq_pastores_cpf_igreja UNIQUE (cpf, igreja_id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_membros_cpf_igreja') THEN
        ALTER TABLE membros ADD CONSTRAINT uq_membros_cpf_igreja UNIQUE (cpf, igreja_id);
    END IF;
END $$;
