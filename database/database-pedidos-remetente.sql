-- ============================================================
-- MARPEX — pedidos.remetente_parceiro_id (empresa emissora terceira)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o usuário do sistema pode atuar só como intermediário
-- entre duas empresas terceiras (ex: uma transportadora), então o
-- pedido ganha um "Emissor" igual ao padrão já usado na Proforma:
-- própria empresa (padrão, remetente_parceiro_id nulo) ou terceiro
-- (remetente_parceiro_id preenchido).
--
-- Nota: parceiros.id é BIGINT nesta base (não uuid — confirmado ao
-- rodar este script; database-parceiros.sql, que declara id como
-- uuid, nunca foi executado de fato contra este projeto).
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

-- Rede de segurança: o script anterior (versão errada, com UUID) pode ter
-- deixado cliente_id ausente se o DROP rodou mas o ADD com FK incompatível
-- falhou no meio da transação. Isso garante que a coluna exista de volta.
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES parceiros(id);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS remetente_parceiro_id BIGINT REFERENCES parceiros(id);

COMMENT ON COLUMN pedidos.remetente_parceiro_id IS 'Empresa remetente (emissor terceiro), quando o usuário atua como intermediário. Nulo = emitido pela própria empresa da conta (empresa_proprietaria_id)';

CREATE INDEX IF NOT EXISTS idx_pedidos_remetente_parceiro_id ON pedidos(remetente_parceiro_id);
