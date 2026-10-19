-- Permissões por perfil e por módulo valendo no BANCO (2026-10-19)
-- Antes, perfil (admin/gerente/usuário) e módulos marcados em Usuários e
-- Permissões só existiam na tela: pela API, qualquer usuário da empresa lia,
-- alterava e excluía tudo.
--
-- Regras (definidas pelo usuário):
--   A) Excluir Proforma, Processo, Conta a Pagar e Conta a Receber: só admin
--      e gerente. Vale para o DELETE e para a exclusão "suave" (status
--      'excluido') e a restauração de Proforma/Processo.
--   B) Sem o módulo Financeiro: continua vendo os valores de Proformas e
--      Processos, mas não lê, cria, altera nem exclui Contas a Pagar/Receber.
--      Admin tem todos os módulos. Padrão para quem nunca foi configurado:
--      só Operacional (o mesmo da tela Usuários e Permissões).
--
-- Rode DEPOIS de database-seguranca-2026-10.sql. Idempotente.

-- ── Funções de apoio ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auth_pode_excluir()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT COALESCE((SELECT perfil IN ('admin', 'gerente') FROM usuarios WHERE auth_id = auth.uid()), false)
$$;

CREATE OR REPLACE FUNCTION public.auth_tem_modulo(p_modulo TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT COALESCE((
        SELECT CASE
                 WHEN u.perfil = 'admin' THEN true
                 WHEN u.permissoes ->> p_modulo IN ('true', 'false') THEN (u.permissoes ->> p_modulo)::boolean
                 ELSE p_modulo = 'operacional'
               END
          FROM usuarios u WHERE u.auth_id = auth.uid()
    ), false)
$$;

REVOKE EXECUTE ON FUNCTION public.auth_pode_excluir()      FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auth_tem_modulo(TEXT)    FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.auth_pode_excluir()      TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.auth_tem_modulo(TEXT)    TO authenticated, service_role;

-- ── A) Excluir: só admin e gerente ────────────────────────────────────
DROP POLICY IF EXISTS proformas_delete_auth ON proformas;
CREATE POLICY proformas_delete_auth ON proformas FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_pode_excluir());

DROP POLICY IF EXISTS processos_delete_auth ON processos;
CREATE POLICY processos_delete_auth ON processos FOR DELETE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() AND auth_pode_excluir());

-- Exclusão suave / restauração (mudar status de/para 'excluido').
-- Sem usuário logado (service_role, SQL Editor, rotinas do banco) passa.
CREATE OR REPLACE FUNCTION public.proteger_exclusao_suave()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF auth.uid() IS NULL THEN RETURN NEW; END IF;
    IF (COALESCE(NEW.status, '') = 'excluido') <> (COALESCE(OLD.status, '') = 'excluido')
       AND NOT auth_pode_excluir() THEN
        RAISE EXCEPTION 'Apenas o administrador ou o gerente pode excluir ou restaurar.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_exclusao_proformas ON proformas;
CREATE TRIGGER trg_proteger_exclusao_proformas BEFORE UPDATE OF status ON proformas
    FOR EACH ROW EXECUTE FUNCTION public.proteger_exclusao_suave();
DROP TRIGGER IF EXISTS trg_proteger_exclusao_processos ON processos;
CREATE TRIGGER trg_proteger_exclusao_processos BEFORE UPDATE OF status ON processos
    FOR EACH ROW EXECUTE FUNCTION public.proteger_exclusao_suave();

-- ── B) Contas: só quem tem o Financeiro (e excluir só admin/gerente) ──
DROP POLICY IF EXISTS contas_pagar_select_auth ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_insert_auth ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_update_auth ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_delete_auth ON contas_pagar;
CREATE POLICY contas_pagar_select_auth ON contas_pagar FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_pagar_insert_auth ON contas_pagar FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_pagar_update_auth ON contas_pagar FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_pagar_delete_auth ON contas_pagar FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro') AND auth_pode_excluir());

DROP POLICY IF EXISTS contas_receber_select_auth ON contas_receber;
DROP POLICY IF EXISTS contas_receber_insert_auth ON contas_receber;
DROP POLICY IF EXISTS contas_receber_update_auth ON contas_receber;
DROP POLICY IF EXISTS contas_receber_delete_auth ON contas_receber;
CREATE POLICY contas_receber_select_auth ON contas_receber FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_receber_insert_auth ON contas_receber FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_receber_update_auth ON contas_receber FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));
CREATE POLICY contas_receber_delete_auth ON contas_receber FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro') AND auth_pode_excluir());

-- ── Verificação (só leitura) ──────────────────────────────────────────
-- Quem fica SEM o Financeiro depois desta migração (não-admins que nunca
-- tiveram o módulo marcado). Libere em Usuários e Permissões quem precisar.
SELECT u.nome_completo, u.perfil, COALESCE(u.permissoes ->> 'financeiro', '(padrão: não)') AS financeiro
  FROM usuarios u
 WHERE u.perfil <> 'admin' AND COALESCE(u.permissoes ->> 'financeiro', 'false') <> 'true'
 ORDER BY u.nome_completo;
