-- ============================================================
-- MARPEX — Central de Chamados: excluir chamado + anexo nas respostas do suporte
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Continua valendo só pro Administrador (auth_is_suporte_admin(), ver
-- database-chamados-central-admin.sql). chamados_mensagens tem
-- ON DELETE CASCADE, então excluir o chamado leva a conversa junto.
-- ============================================================

DROP POLICY IF EXISTS chamados_delete_suporte ON chamados;
CREATE POLICY chamados_delete_suporte ON chamados FOR DELETE TO authenticated
    USING (auth_is_suporte_admin());

-- O suporte anexa prints nas respostas de chamados de QUALQUER empresa (a
-- policy normal de INSERT só deixa gravar na pasta de chamado da própria
-- empresa) e apaga os arquivos ao excluir o chamado.
DROP POLICY IF EXISTS chamados_anexos_insert_suporte ON storage.objects;
CREATE POLICY chamados_anexos_insert_suporte ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'chamados-anexos' AND auth_is_suporte_admin());

DROP POLICY IF EXISTS chamados_anexos_delete_suporte ON storage.objects;
CREATE POLICY chamados_anexos_delete_suporte ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'chamados-anexos' AND auth_is_suporte_admin());
