-- Proposta → Proforma (2026-11-03)
-- O botão "Gerar Proforma" da Proposta fechada grava o vínculo nos dois lados:
--   oportunidades.proforma_id        — já existia; agora é usado
--   proformas.oportunidade_id        — de qual Proposta a Proforma veio
--   proformas.oportunidade_numero    — nº da Proposta, para o card da Proforma
--                                      (quem não tem o Comercial não lê oportunidades)
-- Apagar a Proforma de vez (limpeza da lixeira) só desfaz o vínculo.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS oportunidade_id UUID;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS oportunidade_numero TEXT;

ALTER TABLE proformas DROP CONSTRAINT IF EXISTS proformas_oportunidade_id_fkey;
ALTER TABLE proformas ADD CONSTRAINT proformas_oportunidade_id_fkey
    FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id) ON DELETE SET NULL;

ALTER TABLE oportunidades DROP CONSTRAINT IF EXISTS oportunidades_proforma_id_fkey;
ALTER TABLE oportunidades ADD CONSTRAINT oportunidades_proforma_id_fkey
    FOREIGN KEY (proforma_id) REFERENCES proformas(id) ON DELETE SET NULL;

COMMENT ON COLUMN proformas.oportunidade_id     IS 'Proposta de origem (botão Gerar Proforma)';
COMMENT ON COLUMN proformas.oportunidade_numero IS 'Nº da Proposta de origem';

-- Verificação: 2 linhas
SELECT conname, conrelid::regclass AS tabela, confdeltype AS ao_apagar FROM pg_constraint
 WHERE conname IN ('proformas_oportunidade_id_fkey', 'oportunidades_proforma_id_fkey');
