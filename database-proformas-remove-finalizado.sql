-- ============================================================
-- MARPEX — remove a etapa "Finalizado" do kanban de Proformas
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o kanban de Proformas tinha 5 colunas (enviado, aprovado,
-- pendente, encerrado, finalizado) e foi reduzido pra 4, na nova ordem
-- pendente | enviado | aprovado | encerrado. "Finalizado" deixou de
-- existir — proformas que já estavam nesse status (por terem gerado
-- um Processo) precisam ser migradas pra "encerrado" antes de apertar
-- o CHECK, senão a constraint falha pra essas linhas.
-- ============================================================

UPDATE proformas
SET status = 'encerrado', status_atualizado_em = NOW()
WHERE status = 'finalizado';

ALTER TABLE proformas DROP CONSTRAINT IF EXISTS proformas_status_check;
ALTER TABLE proformas ADD CONSTRAINT proformas_status_check
    CHECK (status IN ('enviado', 'aprovado', 'pendente', 'encerrado', 'excluido'));
