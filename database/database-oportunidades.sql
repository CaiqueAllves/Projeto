-- ============================================================
-- MARPEX — TABELA: oportunidades (Pipeline Comercial)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: pipeline.js e supabase-api.js sempre assumiram que
-- "oportunidades" já existia ao vivo (mesmo padrão de suposição
-- errada que já aconteceu antes com contas_pagar/contas_receber),
-- mas a tabela nunca foi criada de fato — só o código já esperava
-- por ela. database-pedidos.sql já deixava isso documentado:
-- "oportunidade_id UUID, -- sem FK: oportunidades ainda não tem
-- SQL versionado neste repo".
-- ============================================================

CREATE TABLE IF NOT EXISTS oportunidades (
    id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_proprietaria_id  UUID REFERENCES empresas(id),
    cliente_id               BIGINT REFERENCES parceiros(id),  -- parceiros.id é bigint nesta base, não uuid
    proforma_id              UUID REFERENCES proformas(id),
    titulo                   TEXT NOT NULL,
    valor                    NUMERIC(15,2),
    moeda                    TEXT DEFAULT 'USD',
    etapa                    TEXT NOT NULL DEFAULT 'lead'
                                 CHECK (etapa IN ('lead','proposta','negociacao','fechado','perdido')),
    probabilidade            INTEGER DEFAULT 50,
    responsavel              TEXT,
    data_prevista            DATE,
    observacoes              TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS empresa_proprietaria_id UUID REFERENCES empresas(id);
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES parceiros(id);
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS proforma_id UUID REFERENCES proformas(id);
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS titulo TEXT;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS valor NUMERIC(15,2);
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'USD';
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS etapa TEXT DEFAULT 'lead';
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS probabilidade INTEGER DEFAULT 50;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS responsavel TEXT;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS data_prevista DATE;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- O CHECK de etapa não pode ser adicionado via ADD COLUMN IF NOT EXISTS numa
-- coluna já existente. Adiciona defensivamente, ignorando se já existir.
DO $$ BEGIN
    ALTER TABLE oportunidades ADD CONSTRAINT oportunidades_etapa_check
        CHECK (etapa IN ('lead','proposta','negociacao','fechado','perdido'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_oportunidades_cliente_id ON oportunidades(cliente_id);

-- Agora que oportunidades existe de verdade, fecha o vínculo reverso que
-- pedidos.oportunidade_id já tinha, mas sem FK (ver database-pedidos.sql).
DO $$ BEGIN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_oportunidade_id_fkey
        FOREIGN KEY (oportunidade_id) REFERENCES oportunidades(id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- Row Level Security — mesmo padrão anon do resto do app (auth
-- customizada, sem sessão real do Supabase Auth — não usar auth.uid()).
-- ============================================================

ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "oportunidades_select_anon" ON oportunidades;
CREATE POLICY "oportunidades_select_anon" ON oportunidades FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "oportunidades_insert_anon" ON oportunidades;
CREATE POLICY "oportunidades_insert_anon" ON oportunidades FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "oportunidades_update_anon" ON oportunidades;
CREATE POLICY "oportunidades_update_anon" ON oportunidades FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "oportunidades_delete_anon" ON oportunidades;
CREATE POLICY "oportunidades_delete_anon" ON oportunidades FOR DELETE TO anon USING (true);
