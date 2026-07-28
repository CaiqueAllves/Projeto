-- ============================================================
-- MARPEX — pedidos: exclusão suave (soft delete) + restaurar
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: hoje excluirPedido() faz DELETE físico na linha. Pra
-- igualar ao padrão já usado em Proformas e Processos (exclusão
-- suave com painel de "Excluídos" e restauração em até 7 dias),
-- isso precisa de duas coisas:
--   1. Colunas excluido_em/excluido_por (mesmo padrão de
--      processos/proformas).
--   2. 'excluido' como valor válido de status — o CHECK atual de
--      pedidos.status não inclui esse valor.
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS excluido_em  TIMESTAMPTZ;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS excluido_por TEXT;

COMMENT ON COLUMN pedidos.excluido_em  IS 'Data/hora em que o pedido foi movido para excluídos (soft delete)';
COMMENT ON COLUMN pedidos.excluido_por IS 'Nome/e-mail de quem excluiu o pedido';

-- Recria o CHECK de status incluindo 'excluido'. DROP + ADD (não IF NOT
-- EXISTS) porque é preciso trocar a lista de valores permitidos.
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_status_check;
ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
    CHECK (status IN ('aguardando','confirmado','em_producao','embarcado','entregue','cancelado','excluido'));

CREATE INDEX IF NOT EXISTS idx_pedidos_excluido_em ON pedidos(excluido_em);
