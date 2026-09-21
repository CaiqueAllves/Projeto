-- ============================================================
-- MARPEX — Central de Chamados (tela só do usuário Administrador)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Hoje cada usuário só enxerga os chamados da própria empresa (ver
-- database-rls-real-parte1.sql). A Central de Chamados precisa que UM
-- usuário específico — Administrador@teste.com — veja e atenda TODOS.
-- As policies abaixo são ADICIONAIS (policies permissivas se somam com OU),
-- então nada do que já existe muda para os demais usuários.
-- A checagem usa o e-mail do JWT (o mesmo e-mail de usuarios.email, que é
-- o e-mail da conta no Supabase Auth — ver login-usuario/index.ts), então
-- vale no banco, não só na tela.
-- ============================================================

CREATE OR REPLACE FUNCTION auth_is_suporte_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'administrador@teste.com'
$$;

-- Nome/e-mail de quem abriu o chamado, gravados na hora (o Administrador
-- talvez não consiga ler a linha de usuarios de outra empresa por RLS).
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS usuario_nome  TEXT;
ALTER TABLE chamados ADD COLUMN IF NOT EXISTS usuario_email TEXT;

DROP POLICY IF EXISTS chamados_select_suporte ON chamados;
CREATE POLICY chamados_select_suporte ON chamados FOR SELECT TO authenticated
    USING (auth_is_suporte_admin());

DROP POLICY IF EXISTS chamados_update_suporte ON chamados;
CREATE POLICY chamados_update_suporte ON chamados FOR UPDATE TO authenticated
    USING (auth_is_suporte_admin()) WITH CHECK (auth_is_suporte_admin());

DROP POLICY IF EXISTS chamados_mensagens_select_suporte ON chamados_mensagens;
CREATE POLICY chamados_mensagens_select_suporte ON chamados_mensagens FOR SELECT TO authenticated
    USING (auth_is_suporte_admin());

DROP POLICY IF EXISTS chamados_mensagens_insert_suporte ON chamados_mensagens;
CREATE POLICY chamados_mensagens_insert_suporte ON chamados_mensagens FOR INSERT TO authenticated
    WITH CHECK (auth_is_suporte_admin());

-- Prints anexados (bucket chamados-anexos): o Administrador precisa abrir os de qualquer empresa
DROP POLICY IF EXISTS chamados_anexos_select_suporte ON storage.objects;
CREATE POLICY chamados_anexos_select_suporte ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'chamados-anexos' AND auth_is_suporte_admin());

-- ── Fecha o acesso anônimo aos chamados ──────────────────────────────────
-- Verificado ao vivo em 2026-09-21: com a anon key (pública no JS) dava pra
-- LER todos os chamados de todas as empresas — sobrou uma policy TO anon do
-- database-chamados.sql original. As policies reais (authenticated) já
-- existem; estas linhas só removem as antigas (idempotente).
DROP POLICY IF EXISTS chamados_select_anon ON chamados;
DROP POLICY IF EXISTS chamados_insert_anon ON chamados;
DROP POLICY IF EXISTS chamados_update_anon ON chamados;
DROP POLICY IF EXISTS chamados_mensagens_select_anon ON chamados_mensagens;
DROP POLICY IF EXISTS chamados_mensagens_insert_anon ON chamados_mensagens;
