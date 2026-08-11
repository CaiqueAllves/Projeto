-- ============================================================
-- MARPEX — Pedido pode gerar 1 ou mais Proformas (1:N)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: pedidos.proforma_id apontava pra uma única proforma
-- (1:1). Agora a ponta N (proformas) passa a apontar de volta
-- pra ponta 1 (pedido), igual já funciona em proformas →
-- processos. pedidos.proforma_id continua existindo como
-- referência de "proforma mais recente", só deixa de ser a
-- fonte de verdade pra saber quantas proformas um pedido gerou.
-- ============================================================

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos(id);
CREATE INDEX IF NOT EXISTS idx_proformas_pedido_id ON proformas(pedido_id);

-- Backfill: proformas já geradas antes dessa coluna existir, usando o
-- vínculo reverso que já existe em pedidos.proforma_id.
UPDATE proformas p
SET pedido_id = ped.id
FROM pedidos ped
WHERE ped.proforma_id = p.id AND p.pedido_id IS NULL;
