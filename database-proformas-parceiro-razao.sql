-- ============================================================
-- MARPEX — proformas.parceiro_razao_social (snapshot do remetente terceiro)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: quando o Emissor da proforma é "Terceiro", o nome fica só no
-- campo de texto do formulário (prop-cliente) — o que é persistido de fato
-- é parceiro_id, que por sua vez só faz sentido quando aponta pra um
-- registro real de "empresas". Quando a proforma nasce de um Pedido, o
-- remetente do pedido vem da tabela "parceiros" (BIGINT), não "empresas"
-- (UUID) — as duas tabelas têm espaços de ID diferentes. Guardar o ID errado
-- silenciosamente quebrava a exibição do card (Remetente aparecia como "—").
--
-- destinatario_id já tinha esse mesmo problema resolvido com um snapshot em
-- texto (destinatario_razao_social) — essa coluna faz o mesmo pro emissor.
-- ============================================================

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS parceiro_razao_social TEXT;
