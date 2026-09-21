-- ============================================================
-- MARPEX — fecha os 2 alertas do Supabase: processos e vw_parceiros_completo
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Verificado ao vivo em 2026-09-21 com a anon key (pública no JS):
--  1) processos: dava pra LER os processos de TODAS as empresas — a
--     migração de RLS real (database-rls-real-parte1.sql) nunca cobriu essa
--     tabela.
--  2) vw_parceiros_completo: a view roda com os privilégios do dono, então
--     ignorava a RLS de parceiros e devolvia os parceiros de todas as
--     empresas mesmo sem login.
-- Todo o app já filtra processos por empresa_proprietaria_id, então a
-- policy abaixo (mesmo padrão de pedidos) não muda o comportamento normal.
-- ============================================================

ALTER TABLE processos ENABLE ROW LEVEL SECURITY;

-- Remove QUALQUER policy antiga de processos (não sei os nomes das que
-- existem hoje) e recria só as corretas.
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'processos' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON processos', pol.policyname);
    END LOOP;
END $$;

CREATE POLICY processos_select_auth ON processos FOR SELECT TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY processos_insert_auth ON processos FOR INSERT TO authenticated
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY processos_update_auth ON processos FOR UPDATE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id())
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY processos_delete_auth ON processos FOR DELETE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id());

-- A view passa a rodar com as permissões de quem consulta (respeita a RLS
-- de parceiros). Precisa ser refeito se a view for recriada com DROP+CREATE
-- (ver database-parceiros-comprador-importador.sql).
ALTER VIEW vw_parceiros_completo SET (security_invoker = true);
