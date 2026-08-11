-- ============================================================
-- MARPEX — corrige proformas_status_check (permitir encerrado/finalizado)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: a tabela `proformas` nunca teve SQL versionado neste
-- repositório (criada direto no Supabase). A constraint
-- `proformas_status_check` só permitia um subconjunto de status —
-- tentar mover uma proforma pra "Encerrado" ou "Finalizado" no
-- kanban falhava com "violates check constraint
-- proformas_status_check". O kanban (proforma.js: KANBAN_COLS)
-- usa 5 status: enviado, aprovado, pendente, encerrado, finalizado.
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE proformas DROP CONSTRAINT IF EXISTS proformas_status_check;

ALTER TABLE proformas ADD CONSTRAINT proformas_status_check
    CHECK (status IN ('enviado', 'aprovado', 'pendente', 'encerrado', 'finalizado', 'excluido'));
