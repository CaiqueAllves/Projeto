-- ============================================================
-- MARPEX — TABELA: apoio_ncm
-- Execute no SQL Editor do Supabase
-- ============================================================
DROP TABLE IF EXISTS apoio_ncm CASCADE;
-- ============================================================

CREATE TABLE apoio_ncm (
    id                  UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at          TIMESTAMPTZ     DEFAULT NOW(),

    -- Código e descrições
    ncm                 TEXT            NOT NULL,               -- ex: "01012100"
    descricao           TEXT            NOT NULL,               -- descrição do nível atual
    descricao_concat    TEXT,                                   -- caminho completo concatenado
    utrib_abrev         TEXT,                                   -- ex: "KG", "UN", "L"
    utrib_descricao     TEXT                                    -- ex: "Quilograma", "Unidade"
);

-- ── Índices ──────────────────────────────────────────────────
CREATE UNIQUE INDEX idx_apoio_ncm_codigo    ON apoio_ncm(ncm);
CREATE        INDEX idx_apoio_ncm_descricao ON apoio_ncm USING gin(to_tsvector('portuguese', coalesce(descricao_concat, descricao)));

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- NCM é tabela de referência global (somente leitura).
-- O sistema usa autenticação customizada (role anon), então a policy precisa
-- permitir anon. service_role gerencia inserções via painel do Supabase.

ALTER TABLE apoio_ncm ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apoio_ncm_select_anon" ON apoio_ncm
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "apoio_ncm_select_autenticados" ON apoio_ncm
    FOR SELECT
    TO authenticated
    USING (true);

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
