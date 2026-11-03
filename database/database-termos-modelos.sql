-- Termos e Condições por empresa (2026-11-03)
-- Cada empresa envia os próprios Termos em PDF; ao emitir a Proforma escolhe:
-- um dos seus modelos, os Termos base do sistema ou nenhum. O PDF escolhido é
-- anexado ao final da Proforma, como veio.
--   termos_modelos            — biblioteca de modelos da empresa (1 pode ser o padrão)
--   proformas.termos_modelo   — escolha gravada na Proforma: 'base', 'nenhum' ou o id
--                               do modelo (vazio = padrão da empresa). O anexo
--                               automático (o que vai para assinatura) segue esta escolha.
--   bucket termos-modelos     — PDFs privados, pasta {empresa_id}/
-- Enviar, excluir e definir o padrão: administrador ou gerente. Ver e usar: a empresa toda.
-- Idempotente: pode rodar de novo sem erro.

CREATE TABLE IF NOT EXISTS termos_modelos (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id    UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    nome          TEXT NOT NULL,
    idioma        TEXT,
    arquivo_path  TEXT NOT NULL,
    arquivo_nome  TEXT,
    padrao        BOOLEAN NOT NULL DEFAULT false,
    criado_por    UUID,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- no máximo 1 padrão por empresa (sem padrão = Termos base do sistema)
CREATE UNIQUE INDEX IF NOT EXISTS termos_modelos_um_padrao ON termos_modelos (empresa_id) WHERE padrao;

ALTER TABLE termos_modelos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS termos_modelos_sel ON termos_modelos;
DROP POLICY IF EXISTS termos_modelos_ins ON termos_modelos;
DROP POLICY IF EXISTS termos_modelos_upd ON termos_modelos;
DROP POLICY IF EXISTS termos_modelos_del ON termos_modelos;
CREATE POLICY termos_modelos_sel ON termos_modelos FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id());
CREATE POLICY termos_modelos_ins ON termos_modelos FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_pode_excluir());
CREATE POLICY termos_modelos_upd ON termos_modelos FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_pode_excluir())
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_pode_excluir());
CREATE POLICY termos_modelos_del ON termos_modelos FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_pode_excluir());

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS termos_modelo TEXT;
COMMENT ON COLUMN proformas.termos_modelo IS 'Termos no PDF: base | nenhum | id de termos_modelos (vazio = padrão da empresa)';

-- Bucket privado dos PDFs de Termos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('termos-modelos', 'termos-modelos', false, 10 * 1024 * 1024, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false,
    file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS termos_modelos_arq_sel ON storage.objects;
DROP POLICY IF EXISTS termos_modelos_arq_ins ON storage.objects;
DROP POLICY IF EXISTS termos_modelos_arq_del ON storage.objects;
CREATE POLICY termos_modelos_arq_sel ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'termos-modelos' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY termos_modelos_arq_ins ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'termos-modelos' AND (storage.foldername(name))[1] = auth_empresa_id()::text AND auth_pode_excluir());
CREATE POLICY termos_modelos_arq_del ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'termos-modelos' AND (storage.foldername(name))[1] = auth_empresa_id()::text AND auth_pode_excluir());

-- Verificação: tabela, coluna e bucket (3 linhas)
SELECT 'tabela' AS item, count(*)::text AS valor FROM information_schema.tables WHERE table_name = 'termos_modelos'
UNION ALL
SELECT 'coluna proformas.termos_modelo', count(*)::text FROM information_schema.columns WHERE table_name = 'proformas' AND column_name = 'termos_modelo'
UNION ALL
SELECT 'bucket privado', (NOT public)::text FROM storage.buckets WHERE id = 'termos-modelos';
