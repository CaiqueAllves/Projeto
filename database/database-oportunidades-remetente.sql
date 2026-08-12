-- ============================================================
-- MARPEX — oportunidades.remetente_parceiro_id
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o formulário de Oportunidade (Pipeline Comercial) tinha
-- só um campo "Cliente" genérico e ambíguo. Separado em Remetente e
-- Destinatário — mesmo padrão já usado em Pedido (pedidos.cliente_id
-- = destinatário, pedidos.remetente_parceiro_id = remetente).
-- "cliente_id" (já existente) passa a representar o Destinatário.
-- ============================================================

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS remetente_parceiro_id BIGINT REFERENCES parceiros(id);
