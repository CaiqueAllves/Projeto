-- ============================================================
-- MARPEX — buckets avatars e pedido-confirmacoes: fim da listagem ampla
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Aviso restante do Security Advisor (public_bucket_allows_listing): qualquer
-- usuário logado conseguia LISTAR todos os arquivos dos dois buckets. Como os
-- buckets são públicos, abrir o arquivo por URL não depende dessa policy —
-- ela só precisa cobrir o que o próprio usuário envia (o upload usa
-- upsert:true, que precisa enxergar o próprio objeto).
--   avatars:              avatar_{usuario_id}_{timestamp}.{ext}  -> só os do próprio usuário
--   pedido-confirmacoes:  {empresa_id}/{pedido_id}.pdf           -> só os da própria empresa
-- ============================================================

DROP POLICY IF EXISTS avatars_select_auth ON storage.objects;
CREATE POLICY avatars_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'avatars' AND name LIKE 'avatar\_' || auth_usuario_id()::text || '\_%');

DROP POLICY IF EXISTS pedido_confirmacoes_select_auth ON storage.objects;
CREATE POLICY pedido_confirmacoes_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pedido-confirmacoes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);

-- ── pedido-confirmacoes: reenvio da confirmação falhava ────────────────────
-- Achado no teste ao vivo: o upload usa upsert:true, mas o bucket nunca teve
-- policy de UPDATE — então mandar a confirmação DE NOVO pro mesmo pedido dava
-- "new row violates row-level security policy" (o erro é engolido em
-- pedidos.js e o e-mail simplesmente não sai). Também limita o INSERT à pasta
-- da própria empresa (antes qualquer logado podia gravar em qualquer pasta).
DROP POLICY IF EXISTS pedido_confirmacoes_insert_auth ON storage.objects;
CREATE POLICY pedido_confirmacoes_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'pedido-confirmacoes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);

DROP POLICY IF EXISTS pedido_confirmacoes_update_auth ON storage.objects;
CREATE POLICY pedido_confirmacoes_update_auth ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'pedido-confirmacoes' AND (storage.foldername(name))[1] = auth_empresa_id()::text)
    WITH CHECK (bucket_id = 'pedido-confirmacoes' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
