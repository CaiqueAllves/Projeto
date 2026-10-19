-- Validações no banco (2026-10-19) — item 4 da revisão de segurança
-- Antes, valores e status só eram conferidos na tela: pela API dava pra
-- gravar valor negativo ou um status inventado (só na própria empresa).
--
-- Cada regra só FICA no banco se todos os dados atuais já a cumprem. Se
-- algum registro antigo estiver fora (ex.: um status antigo), a regra é
-- desfeita e aparece um aviso "NÃO aplicada" na aba de mensagens — assim
-- nenhum registro existente fica impossível de editar. Veja a consulta no
-- fim para saber quais valores estão fora, corrija e rode de novo.
-- Idempotente.

CREATE OR REPLACE FUNCTION pg_temp.aplicar_regra(p_tabela TEXT, p_nome TEXT, p_condicao TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
    IF to_regclass('public.' || p_tabela) IS NULL THEN
        RETURN p_nome || ': tabela não existe (ignorada)';
    END IF;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', p_tabela, p_nome);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', p_tabela, p_nome, p_condicao);
    BEGIN
        EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', p_tabela, p_nome);
        RETURN p_nome || ': aplicada';
    EXCEPTION WHEN check_violation THEN
        EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', p_tabela, p_nome);
        RAISE NOTICE 'Regra % NÃO aplicada: há registros fora dela em %', p_nome, p_tabela;
        RETURN p_nome || ': NÃO aplicada (há dados antigos fora da regra)';
    END;
END $$;

DO $$
BEGIN
    -- valores: nunca negativos (vazio continua permitido)
    PERFORM pg_temp.aplicar_regra('proformas',      'proformas_valor_nao_negativo',      'valor_total IS NULL OR valor_total >= 0');
    PERFORM pg_temp.aplicar_regra('processos',      'processos_valor_nao_negativo',      'valor_total IS NULL OR valor_total >= 0');
    PERFORM pg_temp.aplicar_regra('contas_pagar',   'contas_pagar_valor_nao_negativo',   'valor IS NULL OR valor >= 0');
    PERFORM pg_temp.aplicar_regra('contas_receber', 'contas_receber_valor_nao_negativo', 'valor IS NULL OR valor >= 0');
    PERFORM pg_temp.aplicar_regra('oportunidades',  'oportunidades_valor_nao_negativo',  'valor IS NULL OR valor >= 0');
    -- status: só os que o sistema usa (inclui os antigos ainda reconhecidos pelas telas)
    PERFORM pg_temp.aplicar_regra('proformas', 'proformas_status_valido',
        $c$status IS NULL OR status IN ('pendente','enviado','aprovado','recusado','encerrado','finalizado','cancelado','excluido')$c$);
    PERFORM pg_temp.aplicar_regra('processos', 'processos_status_valido',
        $c$status IS NULL OR status IN ('aberto','pendente','em_andamento','andamento','aguardando_documentos','concluido','encerrado','finalizado','cancelado','excluido')$c$);
    PERFORM pg_temp.aplicar_regra('contas_pagar', 'contas_pagar_status_valido',
        $c$status IS NULL OR status IN ('pendente','pago','vencido','cancelado','parcial')$c$);
    PERFORM pg_temp.aplicar_regra('contas_receber', 'contas_receber_status_valido',
        $c$status IS NULL OR status IN ('pendente','recebido','vencido','cancelado','parcial')$c$);
END $$;

-- ── Verificação (só leitura) ──────────────────────────────────────────
-- 9 linhas "regra ativa" = tudo aplicado. Linhas "fora da regra" mostram
-- os valores que impediram alguma regra (corrija e rode de novo).
SELECT conrelid::regclass::text AS tabela, conname AS item, 'regra ativa' AS situacao
  FROM pg_constraint
 WHERE conname IN ('proformas_valor_nao_negativo','processos_valor_nao_negativo','contas_pagar_valor_nao_negativo',
                   'contas_receber_valor_nao_negativo','oportunidades_valor_nao_negativo','proformas_status_valido',
                   'processos_status_valido','contas_pagar_status_valido','contas_receber_status_valido')
UNION ALL
SELECT 'proformas', 'status ' || status, 'fora da regra: ' || count(*) FROM proformas
 WHERE status IS NOT NULL AND status NOT IN ('pendente','enviado','aprovado','recusado','encerrado','finalizado','cancelado','excluido') GROUP BY status
UNION ALL
SELECT 'processos', 'status ' || status, 'fora da regra: ' || count(*) FROM processos
 WHERE status IS NOT NULL AND status NOT IN ('aberto','pendente','em_andamento','andamento','aguardando_documentos','concluido','encerrado','finalizado','cancelado','excluido') GROUP BY status
UNION ALL
SELECT 'contas_pagar', 'status ' || status, 'fora da regra: ' || count(*) FROM contas_pagar
 WHERE status IS NOT NULL AND status NOT IN ('pendente','pago','vencido','cancelado','parcial') GROUP BY status
UNION ALL
SELECT 'contas_receber', 'status ' || status, 'fora da regra: ' || count(*) FROM contas_receber
 WHERE status IS NOT NULL AND status NOT IN ('pendente','recebido','vencido','cancelado','parcial') GROUP BY status
ORDER BY 3, 1;

-- ── Limite de tentativas de cadastro (item 5) ─────────────────────────
-- A Edge Function cadastro-usuario anota cada tentativa (IP + hora) e recusa
-- depois de 10 na mesma hora vindas do mesmo IP. Evita criação de contas em
-- massa e "testar" CPFs/e-mails cadastrados em sequência. Só a função
-- (service_role) usa esta tabela: RLS ligada e sem policies.
CREATE TABLE IF NOT EXISTS public.cadastro_tentativas (
    id        BIGSERIAL PRIMARY KEY,
    ip        TEXT NOT NULL,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cadastro_tentativas_ip_data ON public.cadastro_tentativas (ip, criado_em);
ALTER TABLE public.cadastro_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cadastro_tentativas FROM anon, authenticated;
