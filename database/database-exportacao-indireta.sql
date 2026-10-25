-- Exportação indireta (2026-10-23)
--   Na indireta a Proforma é a venda da empresa para uma TRADING / Comercial
--   Exportadora (a destinatária da Proforma); quem exporta é a trading.
--   parceiros.modelo 'trading'       — novo modelo no cadastro de empresas
--   proformas.importador_final_id    — importador lá fora (destinatário final), opcional
--   processos.trading_id             — trading que exporta (exportador da CI / Packing List)
--   processos.nf_remessa_data        — data da NF de remessa com fim específico de
--                                      exportação: a trading tem 180 dias para exportar
--                                      e enviar o Memorando de Exportação
--   (Nº da NF de remessa e do Memorando ficam em processos.documentos: nfremessa / memorando)
-- Sem estas colunas o sistema salva sem esses campos.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE parceiros DROP CONSTRAINT IF EXISTS parceiros_modelo_check;
ALTER TABLE parceiros ADD CONSTRAINT parceiros_modelo_check
    CHECK (modelo IN ('empresa', 'company', 'transportadora', 'outros', 'trading'));
COMMENT ON COLUMN parceiros.modelo IS 'Modelo escolhido no cadastro: empresa (Fabricante/Fornecedor BR), company (estrangeira), transportadora, trading (comercial exportadora BR), outros (empresa intermediária)';

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS importador_final_id BIGINT REFERENCES parceiros(id) ON DELETE SET NULL;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS trading_id          BIGINT REFERENCES parceiros(id) ON DELETE SET NULL;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS nf_remessa_data     DATE;

COMMENT ON COLUMN proformas.importador_final_id IS 'Exportação indireta: importador no exterior (a destinatária da Proforma é a trading)';
COMMENT ON COLUMN processos.trading_id          IS 'Exportação indireta: trading / comercial exportadora que exporta';
COMMENT ON COLUMN processos.nf_remessa_data     IS 'Exportação indireta: data da NF de remessa com fim específico (prazo de 180 dias do Memorando de Exportação)';
