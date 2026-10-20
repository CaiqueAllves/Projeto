-- ============================================================
-- MARPEX — Câmbio nas Contas a Pagar / Receber (2026-10-20)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Cada conta em moeda estrangeira guarda a taxa em R$ por 1 unidade da
-- moeda, preenchida com a PTAX do Banco Central da data de pagamento /
-- recebimento (editável). O DRE e o Bloco 7 (indicadores, resultado por
-- operação) convertem tudo para R$ por ela. Antes, o DRE somava valores de
-- moedas diferentes como se fossem iguais.
-- É também a primeira parte do Previsto × Revisado × Pago do Plano de Contas
-- (aqui: o câmbio do pagamento/recebimento).
-- Idempotente.
-- ============================================================

ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS cambio NUMERIC(18,6);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS cambio NUMERIC(18,6);

-- taxa sempre positiva (vazio = real ou ainda não informado)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_pagar_cambio_positivo') THEN
        ALTER TABLE contas_pagar ADD CONSTRAINT contas_pagar_cambio_positivo CHECK (cambio IS NULL OR cambio > 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contas_receber_cambio_positivo') THEN
        ALTER TABLE contas_receber ADD CONSTRAINT contas_receber_cambio_positivo CHECK (cambio IS NULL OR cambio > 0);
    END IF;
END $$;

-- Verificação: contas em moeda estrangeira ainda sem câmbio (o DRE usa a
-- PTAX da data para elas, como estimativa, até a taxa ser informada)
SELECT 'contas_pagar' AS tabela, moeda, count(*) AS sem_cambio FROM contas_pagar
 WHERE coalesce(moeda, 'BRL') <> 'BRL' AND cambio IS NULL GROUP BY moeda
UNION ALL
SELECT 'contas_receber', moeda, count(*) FROM contas_receber
 WHERE coalesce(moeda, 'BRL') <> 'BRL' AND cambio IS NULL GROUP BY moeda;
