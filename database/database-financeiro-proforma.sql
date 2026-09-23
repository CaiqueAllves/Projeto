-- ========================================================================
-- MIGRAÇÃO: Financeiro (contas_pagar/contas_receber) reancorado em Proforma
-- ------------------------------------------------------------------------
-- Contexto: com o fim do Pedido, Financeiro passa a usar Proforma como
-- âncora (em vez de Pedido) — ver database-financeiro-vinculos.sql pras
-- colunas antigas de pedido_id/processo_id, que ficam no banco sem uso.
--
-- Cliente/Fornecedor do Financeiro (contas_pagar/receber.parceiro_id) e o
-- Remetente/Destinatário da Proforma (proformas.parceiro_id/destinatario_id)
-- já são o MESMO tipo (BIGINT, referenciam "parceiros") — confirmado ao vivo
-- (achado em 2026-09-23; a suposição anterior de que a Proforma apontava
-- pra uma tabela "empresas" UUID estava errada, ver [[project_proforma_parceiro_vs_empresas]]).
-- Por isso NÃO precisa de coluna nova nenhuma pra Cliente/Fornecedor — só
-- proforma_id mesmo, pra travar Cliente/Processo a partir da Proforma
-- escolhida, exatamente como pedido_id fazia antes.
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Todas as colunas são adicionadas com IF NOT EXISTS, então é seguro rodar
-- mais de uma vez.
-- ========================================================================

ALTER TABLE contas_pagar
    ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proformas(id);

ALTER TABLE contas_receber
    ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proformas(id);

COMMENT ON COLUMN contas_pagar.proforma_id   IS 'Proforma de origem, quando a conta foi gerada a partir de uma Proforma (módulo Comercial) — substitui pedido_id como âncora';
COMMENT ON COLUMN contas_receber.proforma_id IS 'Proforma de origem, quando a conta foi gerada a partir de uma Proforma (módulo Comercial) — substitui pedido_id como âncora';

CREATE INDEX IF NOT EXISTS idx_contas_pagar_proforma_id    ON contas_pagar(proforma_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_proforma_id  ON contas_receber(proforma_id);
