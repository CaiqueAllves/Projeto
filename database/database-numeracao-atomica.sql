-- Numeração de Proforma (PRO…) e Processo (PROC…) sem repetição
--
-- Antes: o sistema contava/olhava o maior número existente e somava 1 no
-- navegador. Duas pessoas salvando ao mesmo tempo recebiam o MESMO número e
-- a segunda gravação falhava ("duplicate key ... proformas_codigo_key").
-- Além disso a unicidade era no banco inteiro, mas a contagem era por
-- empresa — empresas diferentes podiam colidir no mesmo número.
--
-- Agora:
--   1) o número é único POR EMPRESA (cada empresa tem a sua sequência);
--   2) o número sai do contador atômico proximo_numero_sequencial()
--      (database-oportunidades-numero-proposta.sql), já usado na Proposta;
--   3) o contador começa do maior número já usado por cada empresa no ano.
-- Idempotente: pode rodar de novo sem erro.

-- 1) Unicidade por empresa
ALTER TABLE proformas DROP CONSTRAINT IF EXISTS proformas_codigo_key;
ALTER TABLE processos DROP CONSTRAINT IF EXISTS processos_numero_processo_key;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proformas_empresa_codigo_key') THEN
        ALTER TABLE proformas ADD CONSTRAINT proformas_empresa_codigo_key UNIQUE (empresa_id, codigo);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'processos_empresa_numero_key') THEN
        ALTER TABLE processos ADD CONSTRAINT processos_empresa_numero_key UNIQUE (empresa_proprietaria_id, numero_processo);
    END IF;
END $$;

-- 2) Contador começa do maior número já usado (por empresa, no ano corrente)
INSERT INTO contadores_numeracao (empresa_id, tipo, ano, ultimo)
SELECT empresa_id, 'proforma', EXTRACT(YEAR FROM NOW())::int,
       MAX(NULLIF(regexp_replace(substr(codigo, 8), '\D', '', 'g'), '')::int)
  FROM proformas
 WHERE empresa_id IS NOT NULL
   AND codigo ~ ('^PRO' || EXTRACT(YEAR FROM NOW())::int || '[0-9]{6}$')
 GROUP BY empresa_id
HAVING MAX(NULLIF(regexp_replace(substr(codigo, 8), '\D', '', 'g'), '')::int) IS NOT NULL
ON CONFLICT (empresa_id, tipo, ano)
DO UPDATE SET ultimo = GREATEST(contadores_numeracao.ultimo, EXCLUDED.ultimo);

INSERT INTO contadores_numeracao (empresa_id, tipo, ano, ultimo)
SELECT empresa_proprietaria_id, 'processo', EXTRACT(YEAR FROM NOW())::int,
       MAX(NULLIF(regexp_replace(substr(numero_processo, 9), '\D', '', 'g'), '')::int)
  FROM processos
 WHERE empresa_proprietaria_id IS NOT NULL
   AND numero_processo ~ ('^PROC' || EXTRACT(YEAR FROM NOW())::int || '[0-9]{6}$')
 GROUP BY empresa_proprietaria_id
HAVING MAX(NULLIF(regexp_replace(substr(numero_processo, 9), '\D', '', 'g'), '')::int) IS NOT NULL
ON CONFLICT (empresa_id, tipo, ano)
DO UPDATE SET ultimo = GREATEST(contadores_numeracao.ultimo, EXCLUDED.ultimo);

-- limpeza de um contador de teste criado ao verificar a função
DELETE FROM contadores_numeracao WHERE tipo = '__teste__';
