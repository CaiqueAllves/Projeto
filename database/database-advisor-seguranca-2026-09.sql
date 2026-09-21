-- ============================================================
-- MARPEX — corrige os avisos do Security Advisor do Supabase (2026-09-21)
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Confirmado ao vivo com a anon key (pública no JS) ANTES desta migração:
--  * bucket pedido-documentos-assinados: anon conseguia LISTAR, ENVIAR e
--    APAGAR arquivos (documentos de qualquer empresa);
--  * solicitacoes_empresa: policy USING(true) pra todos os papéis (anon
--    conseguia escrever).
-- ============================================================

-- 1) Funções sem search_path fixo (function_search_path_mutable) ----------
DO $$
DECLARE f RECORD;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname IN (
            'gerar_numero_processo', 'auth_usuario_id', 'auth_empresa_id', 'auth_is_admin',
            'set_updated_at', 'atualizar_timestamp_parceiros', 'atualizar_timestamp_produtos',
            'auth_is_suporte_admin', 'proximo_numero_sequencial')
    LOOP
        EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.assinatura);
    END LOOP;
END $$;

-- 2) anon não precisa executar as funções SECURITY DEFINER de RLS ---------
-- (as policies são TO authenticated; authenticated continua com EXECUTE,
-- senão a própria RLS pararia de funcionar — por isso os avisos
-- "authenticated_security_definer_function_executable" permanecem e são
-- inofensivos: a função só devolve o empresa_id/usuario_id/admin de quem chama)
REVOKE EXECUTE ON FUNCTION public.auth_empresa_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_is_admin()   FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_usuario_id() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.auth_empresa_id() TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.auth_is_admin()   TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.auth_usuario_id() TO authenticated, service_role;

-- 3) solicitacoes_empresa: policy USING(true) para todos ------------------
-- O app só faz: usuário cria a PRÓPRIA solicitação, lê as próprias, e o admin
-- da empresa-alvo lista as pendentes. Aprovar/recusar roda na Edge Function
-- responder-solicitacao (service_role, ignora RLS).
ALTER TABLE solicitacoes_empresa ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'solicitacoes_empresa' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON solicitacoes_empresa', pol.policyname);
    END LOOP;
END $$;
CREATE POLICY solicitacoes_select_auth ON solicitacoes_empresa FOR SELECT TO authenticated
    USING (usuario_id = auth_usuario_id() OR (empresa_id = auth_empresa_id() AND auth_is_admin()));
CREATE POLICY solicitacoes_insert_auth ON solicitacoes_empresa FOR INSERT TO authenticated
    WITH CHECK (usuario_id = auth_usuario_id());

-- 4) INSERT com WITH CHECK (true) -----------------------------------------
-- empresa_contatos / empresa_financeiro: nenhuma tela do app grava nelas
-- (tabelas legadas) — removido o INSERT irrestrito.
DROP POLICY IF EXISTS auth_insert_contatos   ON empresa_contatos;
DROP POLICY IF EXISTS auth_insert_financeiro ON empresa_financeiro;
-- empresas: INSERT continua liberado (registrarEmpresaPropria — conta sandbox
-- criando a própria empresa), mas só nos moldes que o app usa; impede um
-- usuário de criar empresa já com plano pago/status arbitrário.
DROP POLICY IF EXISTS empresas_insert_auth ON empresas;
CREATE POLICY empresas_insert_auth ON empresas FOR INSERT TO authenticated
    WITH CHECK (status = 'ativo' AND plano = 'free');

-- 5) Storage ---------------------------------------------------------------
-- pedido-documentos-assinados: caminho = {pedido_id}/{arquivo}. Só quem é da
-- empresa dona do pedido lista/envia/apaga (a leitura por URL pública do
-- bucket continua funcionando pra abrir o arquivo).
DROP POLICY IF EXISTS pedido_doc_assinado_select_anon ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_assinado_insert_anon ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_assinado_delete_anon ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_select_auth ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_insert_auth ON storage.objects;
DROP POLICY IF EXISTS pedido_doc_delete_auth ON storage.objects;
CREATE POLICY pedido_doc_select_auth ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'pedido-documentos-assinados' AND EXISTS (
        SELECT 1 FROM pedidos p WHERE p.id::text = (storage.foldername(name))[1]
          AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_doc_insert_auth ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'pedido-documentos-assinados' AND EXISTS (
        SELECT 1 FROM pedidos p WHERE p.id::text = (storage.foldername(name))[1]
          AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_doc_delete_auth ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'pedido-documentos-assinados' AND EXISTS (
        SELECT 1 FROM pedidos p WHERE p.id::text = (storage.foldername(name))[1]
          AND p.empresa_proprietaria_id = auth_empresa_id()));
-- chamados-anexos: sobrou a policy anon de listagem (a authenticated por
-- empresa já existe em database-rls-real-storage.sql).
DROP POLICY IF EXISTS chamados_anexos_select_anon ON storage.objects;
