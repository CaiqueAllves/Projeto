-- ============================================================
-- MARPEX — oportunidades: exclusão suave (Excluídos, restaurável)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: excluirOportunidade() fazia DELETE físico. A nova tela
-- "Proposta" (proposta.html) ganha um painel "Excluídos" igual o de
-- Pedidos, com restauração em até 7 dias.
--
-- Diferente de Pedidos (que reaproveita a própria coluna `status` pra
-- marcar exclusão, perdendo o status anterior ao restaurar), aqui o
-- sinal de exclusão é só `excluido_em` — a coluna `etapa` nunca muda
-- por causa disso. Restaurar devolve a Proposta pra etapa exata em que
-- estava antes de excluir, e o CHECK de `etapa` (oportunidades_etapa_check,
-- em database-oportunidades.sql) não precisa mudar.
-- ============================================================

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS excluido_em  TIMESTAMPTZ;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS excluido_por TEXT;

CREATE INDEX IF NOT EXISTS idx_oportunidades_excluido_em ON oportunidades(excluido_em);
