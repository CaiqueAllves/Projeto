-- Contas a Pagar / Receber: detalhe da categoria "Outros" e anexos adicionais (2026-10-30)
--   categoria_detalhe   : texto digitado quando a Categoria é uma das "Outros/Outras"
--                         (aparece na tabela, no Histórico e em Relatórios Financeiros).
--   comprovantes_extras : até 2 comprovantes além do principal, [{ "path", "nome" }]
--                         no mesmo bucket financeiro-comprovantes.
-- O Operacional continua só lançando a previsão, sem anexos.
-- Sem estas colunas o sistema salva sem esses campos.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS categoria_detalhe   TEXT;
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS comprovantes_extras JSONB;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS categoria_detalhe   TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS comprovantes_extras JSONB;

COMMENT ON COLUMN contas_pagar.categoria_detalhe     IS 'Descrição digitada quando a Categoria é "Outros/Outras"';
COMMENT ON COLUMN contas_pagar.comprovantes_extras   IS 'Até 2 comprovantes adicionais: [{path, nome}]';
COMMENT ON COLUMN contas_receber.categoria_detalhe   IS 'Descrição digitada quando a Categoria é "Outros/Outras"';
COMMENT ON COLUMN contas_receber.comprovantes_extras IS 'Até 2 comprovantes adicionais: [{path, nome}]';

-- Criar conta: Financeiro (qualquer conta) ou Operacional (só a previsão, sem anexos)
DROP POLICY IF EXISTS contas_pagar_insert_auth ON contas_pagar;
CREATE POLICY contas_pagar_insert_auth ON contas_pagar FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND (
        auth_tem_modulo('financeiro')
        OR (auth_tem_modulo('operacional') AND status IN ('pendente', 'vencido') AND data_pagamento IS NULL
            AND meio_pagamento IS NULL AND numero_documento IS NULL AND comprovante_path IS NULL
            AND comprovantes_extras IS NULL)));

DROP POLICY IF EXISTS contas_receber_insert_auth ON contas_receber;
CREATE POLICY contas_receber_insert_auth ON contas_receber FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND (
        auth_tem_modulo('financeiro')
        OR (auth_tem_modulo('operacional') AND status IN ('pendente', 'vencido') AND data_recebimento IS NULL
            AND meio_pagamento IS NULL AND numero_documento IS NULL AND comprovante_path IS NULL
            AND comprovantes_extras IS NULL)));

-- Verificação: 4 linhas
SELECT table_name, column_name, data_type FROM information_schema.columns
 WHERE table_name IN ('contas_pagar', 'contas_receber')
   AND column_name IN ('categoria_detalhe', 'comprovantes_extras')
 ORDER BY table_name, column_name;
