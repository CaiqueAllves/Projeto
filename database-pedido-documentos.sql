-- ============================================================
-- MARPEX — pedido_documentos (status de documentos por pedido)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: a tela Documentos (documentos.html) não tinha nenhuma
-- lógica por trás — era um esqueleto sem JS. A nova versão mostra,
-- por Pedido, quais documentos existem (Proforma, Processo,
-- Packing List, e outros específicos por modal de transporte —
-- mesma lista já usada nos campos "Nº ..." do formulário de
-- Processo) e o status de cada um. Não existe assinatura digital
-- real nesta app — o status é marcado manualmente pelo usuário.
-- ============================================================

CREATE TABLE IF NOT EXISTS pedido_documentos (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id      UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,   -- ex: 'proforma','processo','packing_list','awb'... ou um tipo customizado
    tipo_label     TEXT,            -- só preenchido quando tipo_documento é customizado (fora da lista fixa)
    status         TEXT NOT NULL DEFAULT 'em_andamento',
    observacoes    TEXT,
    atualizado_em  TIMESTAMPTZ DEFAULT NOW(),
    atualizado_por UUID REFERENCES usuarios(id),
    UNIQUE (pedido_id, tipo_documento)
);

ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS tipo_label TEXT;
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS observacoes TEXT;

DO $$ BEGIN
    ALTER TABLE pedido_documentos ADD CONSTRAINT pedido_documentos_status_check
        CHECK (status IN ('nao_gerado', 'em_andamento', 'pendente_assinatura', 'assinado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_pedido_documentos_pedido_id ON pedido_documentos(pedido_id);

-- ── RLS: padrão anon já usado no resto do sistema (auth customizada) ──
ALTER TABLE pedido_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_documentos_select_anon" ON pedido_documentos;
CREATE POLICY "pedido_documentos_select_anon" ON pedido_documentos FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "pedido_documentos_insert_anon" ON pedido_documentos;
CREATE POLICY "pedido_documentos_insert_anon" ON pedido_documentos FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_documentos_update_anon" ON pedido_documentos;
CREATE POLICY "pedido_documentos_update_anon" ON pedido_documentos FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_documentos_delete_anon" ON pedido_documentos;
CREATE POLICY "pedido_documentos_delete_anon" ON pedido_documentos FOR DELETE TO anon USING (true);
