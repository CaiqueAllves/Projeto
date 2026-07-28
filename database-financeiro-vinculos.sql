-- ========================================================================
-- MIGRAÇÃO: vínculo entre Financeiro (contas_pagar/contas_receber) e
-- Comercial/Operacional (pedidos/processos), e vínculo direto Processo→Pedido
-- ------------------------------------------------------------------------
-- Contexto: contas_pagar e contas_receber hoje só guardam parceiro_id — não
-- há como saber a partir de qual pedido ou processo uma conta se originou,
-- nem gerar a conta a partir deles. processos também não tem vínculo direto
-- com pedidos (só indireto, via proforma_id → pedidos.proforma_id).
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Todas as colunas são adicionadas com IF NOT EXISTS, então é seguro rodar
-- mais de uma vez.
-- ========================================================================

ALTER TABLE contas_pagar
    ADD COLUMN IF NOT EXISTS pedido_id   UUID REFERENCES pedidos(id),
    ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES processos(id);

ALTER TABLE contas_receber
    ADD COLUMN IF NOT EXISTS pedido_id   UUID REFERENCES pedidos(id),
    ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES processos(id);

ALTER TABLE processos
    -- Vínculo direto com o pedido de origem, evitando depender do salto
    -- processo → proforma_id → pedidos.proforma_id para achar o pedido.
    -- Preenchido automaticamente quando o processo nasce de uma proforma
    -- que por sua vez veio de um pedido (ver formularios.js).
    ADD COLUMN IF NOT EXISTS pedido_id UUID REFERENCES pedidos(id);

COMMENT ON COLUMN contas_pagar.pedido_id     IS 'Pedido de origem, quando a conta foi gerada a partir de um Pedido (módulo Comercial)';
COMMENT ON COLUMN contas_pagar.processo_id   IS 'Processo de origem, quando a conta foi gerada a partir de um Processo (módulo Operacional)';
COMMENT ON COLUMN contas_receber.pedido_id   IS 'Pedido de origem, quando a conta foi gerada a partir de um Pedido (módulo Comercial)';
COMMENT ON COLUMN contas_receber.processo_id IS 'Processo de origem, quando a conta foi gerada a partir de um Processo (módulo Operacional)';
COMMENT ON COLUMN processos.pedido_id        IS 'Pedido de origem (direto), propagado automaticamente via proforma quando o processo nasce de uma proforma que veio de um pedido';

CREATE INDEX IF NOT EXISTS idx_contas_pagar_pedido_id     ON contas_pagar(pedido_id);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_processo_id   ON contas_pagar(processo_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_pedido_id   ON contas_receber(pedido_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_processo_id ON contas_receber(processo_id);
CREATE INDEX IF NOT EXISTS idx_processos_pedido_id         ON processos(pedido_id);
