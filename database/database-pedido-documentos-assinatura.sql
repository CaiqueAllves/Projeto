-- ============================================================
-- MARPEX — pedido_documentos: assinatura digital (anexo do arquivo)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: a tela Documentos tinha um único campo "status" (select
-- com 4 opções). Isso foi separado em duas coisas:
--
-- 1. "Feito" — deixou de ser marcado manualmente aqui. Pros tipos
--    fixos/por modal (Nº AWB, Nº BL, etc.), o sistema agora verifica
--    automaticamente se o campo correspondente já foi preenchido na
--    seção "Documentos" do formulário de Processo (coluna JSONB
--    processos.documentos) — não precisa de coluna nova pra isso.
--
-- 2. "Assinatura" — continua manual (não existe e-signature real no
--    sistema), mas agora o usuário anexa o arquivo do documento já
--    assinado (upload real, não só digitar um nome). "Assinado por"
--    é texto livre digitado; "assinado_em" é a data/hora capturada
--    automaticamente pelo sistema no momento da confirmação.
-- ============================================================

ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS assinado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS assinado_por TEXT;
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS assinado_em TIMESTAMPTZ;
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS arquivo_path TEXT;
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS arquivo_nome TEXT;

-- "assinado_por" é digitado livremente (quem assinou fisicamente o
-- documento, pode ser um terceiro). "enviado_por" é sempre o usuário
-- logado no sistema no momento do upload — capturado automaticamente,
-- nunca digitado. As duas coisas podem ser pessoas diferentes.
ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS enviado_por TEXT;

-- ============================================================
-- STORAGE: bucket para os arquivos dos documentos assinados
-- Mesmo padrão já usado em chamados-anexos (database-chamados.sql).
-- ============================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('pedido-documentos-assinados', 'pedido-documentos-assinados', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "pedido_doc_assinado_select_anon" ON storage.objects;
CREATE POLICY "pedido_doc_assinado_select_anon" ON storage.objects
    FOR SELECT
    TO anon
    USING (bucket_id = 'pedido-documentos-assinados');

DROP POLICY IF EXISTS "pedido_doc_assinado_insert_anon" ON storage.objects;
CREATE POLICY "pedido_doc_assinado_insert_anon" ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'pedido-documentos-assinados');

DROP POLICY IF EXISTS "pedido_doc_assinado_delete_anon" ON storage.objects;
CREATE POLICY "pedido_doc_assinado_delete_anon" ON storage.objects
    FOR DELETE
    TO anon
    USING (bucket_id = 'pedido-documentos-assinados');
