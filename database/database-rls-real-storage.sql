-- Estágio 2.2, Storage (storage.objects) — mesma migração de anon pra
-- authenticated, mas usando o primeiro segmento do caminho do arquivo
-- (storage.foldername) pra confirmar que o pedido/chamado dono do arquivo
-- pertence à empresa de quem está pedindo, já que os buckets não separam
-- por pasta de empresa diretamente:
--   pedido-documentos-assinados/{pedidoId}/{arquivo}
--   chamados-anexos/{chamadoId}/{arquivo}
--   avatars/{arquivo} (sem dono rastreável no caminho — só fecha o anon)

-- pedido-documentos-assinados
DROP POLICY IF EXISTS pedido_doc_assinado_select_anon ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_assinado_insert_anon ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_assinado_delete_anon ON storage.objects;

CREATE POLICY pedido_doc_assinado_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'pedido-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_proprietaria_id = auth_empresa_id()
        )
    );

CREATE POLICY pedido_doc_assinado_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'pedido-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_proprietaria_id = auth_empresa_id()
        )
    );

CREATE POLICY pedido_doc_assinado_delete_auth ON storage.objects FOR DELETE TO authenticated
    USING (
        bucket_id = 'pedido-documentos-assinados'
        AND EXISTS (
            SELECT 1 FROM pedidos p
            WHERE p.id::text = (storage.foldername(name))[1]
              AND p.empresa_proprietaria_id = auth_empresa_id()
        )
    );

-- chamados-anexos
DROP POLICY IF EXISTS chamados_anexos_select_anon ON storage.objects;
DROP POLICY IF EXISTS chamados_anexos_insert_anon ON storage.objects;

CREATE POLICY chamados_anexos_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (
        bucket_id = 'chamados-anexos'
        AND EXISTS (
            SELECT 1 FROM chamados c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND c.empresa_proprietaria_id = auth_empresa_id()
        )
    );

CREATE POLICY chamados_anexos_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'chamados-anexos'
        AND EXISTS (
            SELECT 1 FROM chamados c
            WHERE c.id::text = (storage.foldername(name))[1]
              AND c.empresa_proprietaria_id = auth_empresa_id()
        )
    );

-- avatars — sem dono rastreável no caminho do arquivo hoje, só fecha o
-- anon (continua sem restrição por usuário dentro do bucket).
DROP POLICY IF EXISTS "upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "public avatars" ON storage.objects;

CREATE POLICY avatars_select_auth ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars');
CREATE POLICY avatars_insert_auth ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars');
