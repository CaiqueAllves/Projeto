-- ========================================================================
-- MIGRAÇÃO: colunas de vínculo/kanban da tabela `proformas`
-- ------------------------------------------------------------------------
-- Contexto: proforma.js (kanban de proformas) passou a gravar e ler
-- processo_gerado_id (link direto para o processo gerado a partir da
-- proforma) e status_atualizado_em (timestamp da última mudança de status),
-- mas a tabela `proformas` nunca teve um SQL versionado neste repositório
-- (ver comentário em database-pedidos.sql). Sem esta migração, marcar uma
-- proforma como finalizada e qualquer troca de status no kanban falham
-- com "column does not exist".
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Todas as colunas são adicionadas com IF NOT EXISTS, então é seguro rodar
-- mais de uma vez.
-- ========================================================================

ALTER TABLE proformas
    -- Vínculo com o processo gerado a partir desta proforma (contraparte de
    -- processos.proforma_id, adicionado em database-processos-campos.sql)
    ADD COLUMN IF NOT EXISTS processo_gerado_id     UUID REFERENCES processos(id),

    -- Timestamp da última mudança de status no kanban
    ADD COLUMN IF NOT EXISTS status_atualizado_em    TIMESTAMPTZ;

COMMENT ON COLUMN proformas.processo_gerado_id  IS 'Processo gerado a partir desta proforma (link reverso de proformas.proforma_id em processos)';
COMMENT ON COLUMN proformas.status_atualizado_em IS 'Data/hora da última alteração de status no kanban de proformas';

CREATE INDEX IF NOT EXISTS idx_proformas_processo_gerado_id ON proformas(processo_gerado_id);
