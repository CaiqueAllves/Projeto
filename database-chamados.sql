-- ============================================================
-- MARPEX — TABELA: chamados (widget de suporte)
-- Execute no SQL Editor do Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS chamados (
    id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_proprietaria_id  UUID REFERENCES empresas(id),
    usuario_id               UUID REFERENCES usuarios(id),
    titulo                   TEXT NOT NULL,
    modulo                   TEXT,
    descricao                TEXT NOT NULL,
    anexo_url                TEXT,
    status                   TEXT DEFAULT 'aberto'
                                 CHECK (status IN ('aberto','em_andamento','resolvido')),
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- Se a tabela já existia sem a coluna de anexo:
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS anexo_url TEXT;

-- ── Row Level Security ───────────────────────────────────────
-- Sistema usa autenticação customizada (role anon), então as policies
-- liberam para anon e restringem por empresa/usuário na aplicação.
-- DROP POLICY IF EXISTS antes de cada CREATE torna o arquivo seguro
-- pra rodar mais de uma vez (CREATE POLICY sozinho não é idempotente).

ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamados_select_anon" ON chamados;
CREATE POLICY "chamados_select_anon" ON chamados
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "chamados_insert_anon" ON chamados;
CREATE POLICY "chamados_insert_anon" ON chamados
    FOR INSERT
    TO anon
    WITH CHECK (true);

DROP POLICY IF EXISTS "chamados_update_anon" ON chamados;
CREATE POLICY "chamados_update_anon" ON chamados
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);

-- ============================================================
-- TABELA: chamados_mensagens (thread de conversa de cada chamado)
-- ============================================================

CREATE TABLE IF NOT EXISTS chamados_mensagens (
    id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    chamado_id   UUID NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
    autor_tipo   TEXT NOT NULL DEFAULT 'usuario' CHECK (autor_tipo IN ('usuario','suporte')),
    usuario_id   UUID REFERENCES usuarios(id),
    usuario_nome TEXT,
    mensagem     TEXT NOT NULL,
    anexo_url    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chamados_mensagens_chamado_id ON chamados_mensagens(chamado_id);

ALTER TABLE chamados_mensagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chamados_mensagens_select_anon" ON chamados_mensagens;
CREATE POLICY "chamados_mensagens_select_anon" ON chamados_mensagens
    FOR SELECT
    TO anon
    USING (true);

DROP POLICY IF EXISTS "chamados_mensagens_insert_anon" ON chamados_mensagens;
CREATE POLICY "chamados_mensagens_insert_anon" ON chamados_mensagens
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- ============================================================
-- STORAGE: bucket para prints/anexos dos chamados
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('chamados-anexos', 'chamados-anexos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chamados_anexos_select_anon" ON storage.objects;
CREATE POLICY "chamados_anexos_select_anon" ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'chamados-anexos');

DROP POLICY IF EXISTS "chamados_anexos_insert_anon" ON storage.objects;
CREATE POLICY "chamados_anexos_insert_anon" ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'chamados-anexos');
