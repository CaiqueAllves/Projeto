-- ============================================================
-- MARPEX — Previsto × Revisado × Pago nas Contas (2026-10-20)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Cabeçalho do Plano de Contas: MOEDA · CÂMBIO DATA ABERTURA · VALOR PREVISTO
-- · CÂMBIO DATA ATUALIZADA · VALOR REVISADO · CÂMBIO DATA DE PAGAMENTO · VALOR
-- PAGO. Cada conta passa a guardar os três momentos:
--   Previsto  — valor_previsto + cambio_previsto + previsto_em (abertura;
--               preenchido sozinho ao criar a conta, editável)
--   Revisado  — valor_revisado + cambio_revisado + revisado_em (opcional)
--   Pago      — valor + cambio (o que já existia: valor da conta e câmbio do
--               pagamento/recebimento)
-- O DRE usa isso no Previsto × Realizado (7.16 do Plano de Contas).
-- Contas que já existem ganham o previsto = valor/câmbio atuais, com a data
-- de criação. Idempotente.
-- ============================================================

DO $$
DECLARE t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['contas_pagar', 'contas_receber'] LOOP
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS valor_previsto  NUMERIC(15,2)', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS cambio_previsto NUMERIC(18,6)', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS previsto_em     DATE', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS valor_revisado  NUMERIC(15,2)', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS cambio_revisado NUMERIC(18,6)', t);
        EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS revisado_em     DATE', t);
        -- valores e taxas nunca negativos
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_previsto_revisado_validos') THEN
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK ((valor_previsto IS NULL OR valor_previsto >= 0) AND (valor_revisado IS NULL OR valor_revisado >= 0) AND (cambio_previsto IS NULL OR cambio_previsto > 0) AND (cambio_revisado IS NULL OR cambio_revisado > 0))', t, t || '_previsto_revisado_validos');
        END IF;
        -- contas existentes: previsto = situação atual
        EXECUTE format('UPDATE %I SET valor_previsto = valor, cambio_previsto = cambio, previsto_em = criado_em::date WHERE valor_previsto IS NULL', t);
    END LOOP;
END $$;

-- Verificação: contas sem previsto (deve voltar 0 nas duas)
SELECT 'contas_pagar' AS tabela, count(*) FILTER (WHERE valor_previsto IS NULL) AS sem_previsto, count(*) AS total FROM contas_pagar
UNION ALL
SELECT 'contas_receber', count(*) FILTER (WHERE valor_previsto IS NULL), count(*) FROM contas_receber;
