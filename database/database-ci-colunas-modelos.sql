-- ============================================================
-- MARPEX — Colunas da Commercial Invoice + Características do Produto
-- (2026-10-21) — Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Cada Commercial Invoice tem particularidades (roupa: cor, tamanho,
-- composição; bebida: teor alcoólico...). Antes de gerar, uma janela deixa
-- escolher as colunas e corrigir os valores de cada item.
--   produtos.caracteristicas — lista livre [{nome, valor}] (Cor: Azul,
--                              Tamanho: M, Teor alcoólico: 40%...)
--   documento_modelos        — seleções de colunas salvas com nome
--                              ("Vestuário", "Bebidas"...), por empresa
-- A escolha de cada Processo fica em processos.documentos.ci_config (JSON já
-- existente — sem coluna nova).
-- Idempotente.
-- ============================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS caracteristicas JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS documento_modelos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id  UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    tipo        TEXT NOT NULL DEFAULT 'commercial',   -- documento a que o modelo se aplica
    nome        TEXT NOT NULL,
    campos      JSONB NOT NULL DEFAULT '[]'::jsonb,    -- [{chave, rotulo, origem, posicao}]
    criado_por  UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (empresa_id, tipo, nome)
);
CREATE INDEX IF NOT EXISTS idx_documento_modelos_empresa ON documento_modelos(empresa_id, tipo);

ALTER TABLE documento_modelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS documento_modelos_select_auth ON documento_modelos;
DROP POLICY IF EXISTS documento_modelos_insert_auth ON documento_modelos;
DROP POLICY IF EXISTS documento_modelos_update_auth ON documento_modelos;
DROP POLICY IF EXISTS documento_modelos_delete_auth ON documento_modelos;
CREATE POLICY documento_modelos_select_auth ON documento_modelos FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY documento_modelos_insert_auth ON documento_modelos FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY documento_modelos_update_auth ON documento_modelos FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY documento_modelos_delete_auth ON documento_modelos FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- Verificação
SELECT
    (SELECT count(*) FROM information_schema.columns WHERE table_name = 'produtos' AND column_name = 'caracteristicas') AS coluna_caracteristicas,
    (SELECT count(*) FROM information_schema.tables  WHERE table_name = 'documento_modelos') AS tabela_modelos;
