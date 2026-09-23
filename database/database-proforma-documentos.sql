-- ============================================================
-- MARPEX — proforma_documentos (status de documentos por Proforma)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: com o fim do Pedido, o ciclo passa a ser Proforma → N
-- Processos (sem Pedido no meio). A tela Documentos e a seção
-- "Pendências do Sistema" (Início) reagrupam por Proforma em vez de
-- Pedido. Esta tabela substitui pedido_documentos (que fica no banco,
-- sem uso, junto do resto do que for de Pedido nesta etapa) — mesmo
-- shape (status manual + assinatura com upload real + anexo
-- desacoplado da assinatura, ver database-pedido-documentos*.sql),
-- só trocando a chave de pedido_id pra proforma_id.
--
-- RLS já nasce no padrão real (auth.uid()/auth_empresa_id()), sem
-- passar pela fase antiga "anon true" que pedido_documentos teve —
-- ver database-usuarios-rls-real.sql pra a função auth_empresa_id().
-- ============================================================

CREATE TABLE IF NOT EXISTS proforma_documentos (
    id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    proforma_id    UUID NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    tipo_documento TEXT NOT NULL,   -- ex: 'proforma','processo','packing_list','awb'... ou um tipo customizado
    tipo_label     TEXT,            -- só preenchido quando tipo_documento é customizado (fora da lista fixa)
    status         TEXT NOT NULL DEFAULT 'em_andamento',
    observacoes    TEXT,
    assinado       BOOLEAN NOT NULL DEFAULT false,
    assinado_por   TEXT,
    assinado_em    TIMESTAMPTZ,
    arquivo_path   TEXT,
    arquivo_nome   TEXT,
    enviado_por    TEXT,
    enviado_em     TIMESTAMPTZ,
    atualizado_em  TIMESTAMPTZ DEFAULT NOW(),
    atualizado_por UUID REFERENCES usuarios(id),
    UNIQUE (proforma_id, tipo_documento)
);

DO $$ BEGIN
    ALTER TABLE proforma_documentos ADD CONSTRAINT proforma_documentos_status_check
        CHECK (status IN ('nao_gerado', 'em_andamento', 'pendente_assinatura', 'assinado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_proforma_documentos_proforma_id ON proforma_documentos(proforma_id);

-- ── RLS real (auth.uid() via auth_empresa_id(), join por proformas.empresa_id) ──
ALTER TABLE proforma_documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS proforma_documentos_select_auth ON proforma_documentos;
DROP POLICY IF EXISTS proforma_documentos_insert_auth ON proforma_documentos;
DROP POLICY IF EXISTS proforma_documentos_update_auth ON proforma_documentos;
DROP POLICY IF EXISTS proforma_documentos_delete_auth ON proforma_documentos;

CREATE POLICY proforma_documentos_select_auth ON proforma_documentos FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM proformas p WHERE p.id = proforma_documentos.proforma_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY proforma_documentos_insert_auth ON proforma_documentos FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM proformas p WHERE p.id = proforma_documentos.proforma_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY proforma_documentos_update_auth ON proforma_documentos FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM proformas p WHERE p.id = proforma_documentos.proforma_id AND p.empresa_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM proformas p WHERE p.id = proforma_documentos.proforma_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY proforma_documentos_delete_auth ON proforma_documentos FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM proformas p WHERE p.id = proforma_documentos.proforma_id AND p.empresa_id = auth_empresa_id()));

-- ============================================================
-- STORAGE: bucket para os arquivos dos documentos assinados/anexados
-- Mesmo padrão de pedido-documentos-assinados (database-rls-real-storage.sql),
-- trocando o join de pedidos/empresa_proprietaria_id pra proformas/empresa_id.
-- Caminho: proforma-documentos-assinados/{proformaId}/{arquivo}
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('proforma-documentos-assinados', 'proforma-documentos-assinados', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS proforma_doc_assinado_select_auth ON storage.objects;
DROP POLICY IF EXISTS proforma_doc_assinado_insert_auth ON storage.objects;
DROP POLICY IF EXISTS proforma_doc_assinado_delete_auth ON storage.objects;

CREATE POLICY proforma_doc_assinado_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'proforma-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM proformas p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_id = auth_empresa_id()
        )
    );

CREATE POLICY proforma_doc_assinado_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'proforma-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM proformas p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_id = auth_empresa_id()
        )
    );

CREATE POLICY proforma_doc_assinado_delete_auth ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'proforma-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM proformas p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_id = auth_empresa_id()
        )
    );
