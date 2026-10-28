-- Formulário novo de Contas a Pagar / Receber (2026-10-27)
--   Seção 1 (Dados gerais) = PREVISÃO: data (data_vencimento), moeda, valor e câmbio
--     → moeda_previsto (nova), valor_previsto, cambio_previsto
--   Seção 2 = PAGAMENTO / RECEBIMENTO REALIZADO: data, moeda, valor, câmbio
--     (data_pagamento ou data_recebimento + moeda/valor/cambio da conta),
--     meio de pagamento, nº da nota fiscal / fatura e o comprovante anexado.
--   Status automático: pago/recebido quando a seção 2 tem data e valor.
-- Colunas novas nas duas tabelas + bucket privado "financeiro-comprovantes"
-- (caminho {empresa_id}/{pagar|receber}/arquivo — cada empresa só vê a sua pasta).
-- Lançamento pelo Operacional: os cards de Proforma/Processo abrem o formulário
-- numa janela; quem tem o módulo Operacional (sem o Financeiro) pode CRIAR a
-- conta prevista — sem pagamento/recebimento, meio de pagamento ou comprovante.
-- Ver, editar, registrar o pagamento e excluir continuam só com o Financeiro.
-- Sem estas colunas o sistema salva sem esses campos.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS moeda_previsto   TEXT;
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS meio_pagamento   TEXT;
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS comprovante_path TEXT;
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS comprovante_nome TEXT;

ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS moeda_previsto   TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS meio_pagamento   TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS numero_documento TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS comprovante_path TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS comprovante_nome TEXT;

-- contas existentes: a moeda da previsão é a moeda da conta
UPDATE contas_pagar   SET moeda_previsto = moeda WHERE moeda_previsto IS NULL;
UPDATE contas_receber SET moeda_previsto = moeda WHERE moeda_previsto IS NULL;

COMMENT ON COLUMN contas_pagar.meio_pagamento   IS 'Meio de pagamento (depósito, PIX, boleto, cartão, SWIFT...)';
COMMENT ON COLUMN contas_pagar.numero_documento IS 'Nº da nota fiscal / fatura (comprovante fiscal)';
COMMENT ON COLUMN contas_pagar.comprovante_path IS 'Comprovante anexado (bucket financeiro-comprovantes)';

-- Bucket dos comprovantes
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('financeiro-comprovantes', 'financeiro-comprovantes', false, 10 * 1024 * 1024,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET public = false,
    file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS fin_comprovantes_select_auth ON storage.objects;
DROP POLICY IF EXISTS fin_comprovantes_insert_auth ON storage.objects;
DROP POLICY IF EXISTS fin_comprovantes_delete_auth ON storage.objects;
CREATE POLICY fin_comprovantes_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'financeiro-comprovantes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY fin_comprovantes_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'financeiro-comprovantes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY fin_comprovantes_delete_auth ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'financeiro-comprovantes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);

-- Criar conta: Financeiro (qualquer conta) ou Operacional (só a previsão)
DROP POLICY IF EXISTS contas_pagar_insert_auth ON contas_pagar;
CREATE POLICY contas_pagar_insert_auth ON contas_pagar FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND (
        auth_tem_modulo('financeiro')
        OR (auth_tem_modulo('operacional') AND status IN ('pendente', 'vencido') AND data_pagamento IS NULL
            AND meio_pagamento IS NULL AND numero_documento IS NULL AND comprovante_path IS NULL)));

DROP POLICY IF EXISTS contas_receber_insert_auth ON contas_receber;
CREATE POLICY contas_receber_insert_auth ON contas_receber FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND (
        auth_tem_modulo('financeiro')
        OR (auth_tem_modulo('operacional') AND status IN ('pendente', 'vencido') AND data_recebimento IS NULL
            AND meio_pagamento IS NULL AND numero_documento IS NULL AND comprovante_path IS NULL)));

-- Verificação
SELECT id, public, file_size_limit / 1024 / 1024 AS limite_mb FROM storage.buckets WHERE id = 'financeiro-comprovantes';
