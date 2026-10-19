-- Bucket "empresa-docs" (Perfil › Documentos da Empresa) — 2026-10-19
-- A tela de Perfil lista/envia/baixa/apaga documentos da empresa neste
-- bucket, mas ele nunca foi criado no Supabase: a seção mostrava sempre
-- "Nenhum documento enviado ainda" e todo envio falhava.
-- Caminho dos arquivos: empresa-docs/{empresa_id}/{arquivo}
-- Privado, 10 MB, PDF/CSV; cada empresa só enxerga a própria pasta.
-- Idempotente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('empresa-docs', 'empresa-docs', false, 10 * 1024 * 1024,
        ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET public = false,
    file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS empresa_docs_select_auth ON storage.objects;
DROP POLICY IF EXISTS empresa_docs_insert_auth ON storage.objects;
DROP POLICY IF EXISTS empresa_docs_delete_auth ON storage.objects;
CREATE POLICY empresa_docs_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'empresa-docs' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY empresa_docs_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'empresa-docs' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY empresa_docs_delete_auth ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'empresa-docs' AND (storage.foldername(name))[1] = auth_empresa_id()::text);

-- Verificação
SELECT id, public, file_size_limit / 1024 / 1024 AS limite_mb, allowed_mime_types FROM storage.buckets WHERE id = 'empresa-docs';
