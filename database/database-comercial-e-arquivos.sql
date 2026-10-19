-- Comercial por módulo + limites de arquivo nos buckets (2026-10-19)
--   G) Módulo Comercial passa a valer no banco, igual ao Financeiro: quem não
--      tem o Comercial marcado em Usuários e Permissões não lê nem grava
--      Propostas (oportunidades) nem o histórico delas. Admin tem todos.
--      Padrão de quem nunca foi configurado: SEM Comercial — veja a consulta
--      no fim e libere quem precisar.
--   H) Tamanho máximo e tipos de arquivo aceitos em cada bucket, conferidos
--      pelo próprio Supabase (antes só a tela conferia; pela API dava pra
--      subir qualquer arquivo, de qualquer tamanho, na pasta da empresa).
--
-- Rode DEPOIS de database-permissoes-perfil-modulo.sql (usa auth_tem_modulo).
-- Idempotente.

-- ── G) Comercial ──────────────────────────────────────────────────────
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'oportunidades' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON oportunidades', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY oportunidades_select_auth ON oportunidades FOR SELECT TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));
CREATE POLICY oportunidades_insert_auth ON oportunidades FOR INSERT TO authenticated
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));
CREATE POLICY oportunidades_update_auth ON oportunidades FOR UPDATE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'))
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));
CREATE POLICY oportunidades_delete_auth ON oportunidades FOR DELETE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));

DROP POLICY IF EXISTS oportunidade_historico_select_auth ON oportunidade_historico;
DROP POLICY IF EXISTS oportunidade_historico_insert_auth ON oportunidade_historico;
CREATE POLICY oportunidade_historico_select_auth ON oportunidade_historico FOR SELECT TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));
CREATE POLICY oportunidade_historico_insert_auth ON oportunidade_historico FOR INSERT TO authenticated
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id() AND auth_tem_modulo('comercial'));

-- ── H) Limites dos buckets ────────────────────────────────────────────
-- Documentos da Proforma/Processo: PDF, imagem, Word, Excel — 15 MB
UPDATE storage.buckets SET file_size_limit = 15 * 1024 * 1024,
       allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp',
           'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
           'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
 WHERE id IN ('proforma-documentos-assinados', 'pedido-documentos-assinados', 'pedido-confirmacoes');

-- Anexos de chamados (prints e PDF) — 10 MB
UPDATE storage.buckets SET file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
 WHERE id = 'chamados-anexos';

-- Logos/imagens de marca e fotos de perfil — 2 MB, só imagem (sem SVG,
-- que pode carregar script)
UPDATE storage.buckets SET file_size_limit = 2 * 1024 * 1024,
       allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/gif']
 WHERE id IN ('logos', 'avatars');

-- Documentos da empresa (Perfil: PDF/CSV) — 10 MB
UPDATE storage.buckets SET file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = ARRAY['application/pdf', 'text/csv', 'application/vnd.ms-excel', 'text/plain']
 WHERE id = 'empresa-docs';

-- ── Verificação (só leitura) ──────────────────────────────────────────
-- Limites aplicados
SELECT id, public, file_size_limit / 1024 / 1024 AS limite_mb, allowed_mime_types
  FROM storage.buckets ORDER BY id;

-- Quem fica SEM o Comercial (não-admins que nunca tiveram o módulo marcado)
SELECT u.nome_completo, u.perfil, COALESCE(u.permissoes ->> 'comercial', '(padrão: não)') AS comercial
  FROM usuarios u
 WHERE u.perfil <> 'admin' AND u.ativo AND COALESCE(u.permissoes ->> 'comercial', 'false') <> 'true'
 ORDER BY u.nome_completo;
