-- ============================================================
-- MARPEX — impede o usuário de trocar o PRÓPRIO empresa_id/perfil/permissões
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Falha encontrada em 2026-09-21: a policy usuarios_update_authenticated
-- deixa o usuário atualizar a própria linha SEM limitar colunas. Testado
-- com a conta canário: UPDATE usuarios SET empresa_id = <outra empresa>
-- passou na RLS (só foi barrado pelo índice de 1 admin por empresa). Um
-- usuário comum poderia se mover pra outra empresa e ler tudo dela, ou
-- dar a si mesmo mais permissões.
--
-- Correção em duas partes:
--  1) registrar_empresa_propria(): o único fluxo legítimo que muda
--     empresa_id pelo cliente ("cadastrar minha empresa", Perfil) passa a
--     ser uma função no banco, que só CRIA uma empresa nova e vincula o
--     próprio usuário a ela (nunca a uma empresa existente). A aprovação
--     de solicitação de entrada já roda na Edge Function (service_role).
--  2) Trigger: chamadas com JWT 'authenticated' não podem mais mudar
--     empresa_id, auth_id, bloqueio/tentativas de login; ninguém muda o
--     próprio perfil; só admin muda perfil/permissões de colegas. Edge
--     Functions (service_role) e o SQL Editor não são afetados.
-- ============================================================

CREATE OR REPLACE FUNCTION public.registrar_empresa_propria(p_razao_social TEXT, p_cnpj TEXT, p_chave TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
    u usuarios%ROWTYPE;
    nova empresas%ROWTYPE;
BEGIN
    SELECT * INTO u FROM usuarios WHERE auth_id = auth.uid();
    IF NOT FOUND THEN RAISE EXCEPTION 'Não autenticado'; END IF;
    IF coalesce(trim(p_razao_social), '') = '' THEN RAISE EXCEPTION 'Informe a Razão Social.'; END IF;
    -- Só quem ainda não é membro de uma empresa "de verdade": sem empresa, ou
    -- o admin (dono) da empresa atual — sub-usuários não podem sair criando empresa.
    IF u.empresa_id IS NOT NULL AND u.perfil <> 'admin' THEN
        RAISE EXCEPTION 'Somente o administrador da conta pode cadastrar uma nova empresa.';
    END IF;

    INSERT INTO empresas (razao_social, nome_fantasia, cnpj, email, status, plano, chave_empresa)
    VALUES (p_razao_social, p_razao_social, nullif(p_cnpj, ''), u.email, 'ativo', 'free', p_chave)
    RETURNING * INTO nova;

    PERFORM set_config('app.permitir_troca_empresa', '1', true);  -- vale só nesta transação
    UPDATE usuarios SET empresa_id = nova.id WHERE id = u.id;

    RETURN row_to_json(nova);
END $$;
REVOKE EXECUTE ON FUNCTION public.registrar_empresa_propria(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.registrar_empresa_propria(TEXT, TEXT, TEXT) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.usuarios_protege_campos()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
DECLARE
    eh_proprio BOOLEAN;
BEGIN
    -- Só policia chamadas vindas do cliente logado (JWT 'authenticated').
    IF coalesce(auth.role(), '') <> 'authenticated' THEN RETURN NEW; END IF;

    eh_proprio := (OLD.auth_id = auth.uid());

    IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
       AND coalesce(current_setting('app.permitir_troca_empresa', true), '') <> '1' THEN
        RAISE EXCEPTION 'Não é permitido trocar a empresa do usuário diretamente.' USING ERRCODE = '42501';
    END IF;

    IF NEW.auth_id IS DISTINCT FROM OLD.auth_id
       OR NEW.bloqueado_ate IS DISTINCT FROM OLD.bloqueado_ate
       OR NEW.tentativas_login IS DISTINCT FROM OLD.tentativas_login THEN
        RAISE EXCEPTION 'Campo protegido.' USING ERRCODE = '42501';
    END IF;

    IF NEW.perfil IS DISTINCT FROM OLD.perfil THEN
        IF eh_proprio OR NOT auth_is_admin() THEN
            RAISE EXCEPTION 'Você não pode alterar o próprio perfil.' USING ERRCODE = '42501';
        END IF;
    END IF;

    IF NEW.permissoes IS DISTINCT FROM OLD.permissoes AND eh_proprio AND NOT auth_is_admin() THEN
        RAISE EXCEPTION 'Você não pode alterar as próprias permissões.' USING ERRCODE = '42501';
    END IF;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_usuarios_protege_campos ON usuarios;
CREATE TRIGGER trg_usuarios_protege_campos BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION public.usuarios_protege_campos();
