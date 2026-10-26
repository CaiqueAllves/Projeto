-- Senha só pelo servidor (2026-10-26)
-- A troca de senha passou a exigir a SENHA ATUAL, conferida na Edge Function
-- alterar-senha (supabase/functions/alterar-senha). Esta regra impede o
-- caminho antigo: gravar usuarios.senha_hash direto pela API REST com a sessão
-- do usuário aberta (sem saber a senha atual).
-- Só troca a função do trigger de database-usuarios-protege-empresa-id.sql,
-- acrescentando a regra da senha. Criação de usuário (INSERT pelo admin) e as
-- Edge Functions (service_role) continuam funcionando.
-- Idempotente: pode rodar de novo sem erro.

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

    -- Senha: só a Edge Function alterar-senha (confere a senha atual) troca.
    -- Antes dava para gravar senha_hash direto pela API com a sessão aberta.
    IF NEW.senha_hash IS DISTINCT FROM OLD.senha_hash THEN
        RAISE EXCEPTION 'Para trocar a senha use a tela Perfil (pede a senha atual).' USING ERRCODE = '42501';
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
