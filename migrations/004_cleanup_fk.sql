-- Limpa inativos órfãos
DELETE FROM ministerios WHERE ativo = FALSE;
DELETE FROM grupos_pastor WHERE ativo = FALSE;
-- FK com SET NULL para permitir exclusão sem erro
ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_ministerio_id_fkey;
ALTER TABLE membros ADD CONSTRAINT membros_ministerio_id_fkey
    FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE SET NULL;
ALTER TABLE pastores DROP CONSTRAINT IF EXISTS pastores_ministerio_id_fkey;
ALTER TABLE pastores ADD CONSTRAINT pastores_ministerio_id_fkey
    FOREIGN KEY (ministerio_id) REFERENCES ministerios(id) ON DELETE SET NULL;
ALTER TABLE celulas DROP CONSTRAINT IF EXISTS celulas_macrocelula_id_fkey;
ALTER TABLE celulas ADD CONSTRAINT celulas_macrocelula_id_fkey
    FOREIGN KEY (macrocelula_id) REFERENCES macrocelulas(id) ON DELETE SET NULL;
ALTER TABLE membros DROP CONSTRAINT IF EXISTS membros_celula_id_fkey;
ALTER TABLE membros ADD CONSTRAINT membros_celula_id_fkey
    FOREIGN KEY (celula_id) REFERENCES celulas(id) ON DELETE SET NULL;
