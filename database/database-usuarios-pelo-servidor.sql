-- Usuários: criação pelo servidor, limite do plano no banco e painel de planos (2026-11-12)
-- -------------------------------------------------------------------------------------
-- Antes: o administrador criava sub-usuários direto pela API (a senha era cifrada
-- no navegador) e o limite do plano só era conferido na tela — dava para passar
-- do limite chamando a API; a busca de CPF/e-mail repetido só via a própria
-- empresa; usuários desativados contavam no limite; toda empresa nasce no plano
-- "free" (1 usuário) e o plano só mudava por SQL.
-- Agora:
--   • plano_limite_usuarios(): limite em UM lugar (free = 2: 1 admin + 1)
--   • criar_usuario_empresa(): o admin cria o usuário; o banco confere perfil,
--     CPF/e-mail em todo o sistema e o limite (só usuários ATIVOS contam) e grava
--     a senha cifrada (bcrypt, o mesmo formato que o login confere)
--   • gatilho: reativar um usuário também respeita o limite
--   • a inclusão direta em usuarios pela API deixa de existir (cadastro de conta
--     nova continua pela Edge Function cadastro-usuario, que usa a service_role)
--   • admin_listar_empresas() / admin_definir_plano(): painel do dono da Marpex
--     (auth_is_suporte_admin — a mesma conta da Central de Chamados)
-- Rode também o database-gratuito-15-dias.sql (período gratuito e modo só leitura) — a ordem é livre.
-- Idempotente: pode rodar de novo sem erro.

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS aviso_vencimento_em TIMESTAMPTZ;   -- aviso de fim do período gratuito (e-mail)

-- ── Limite de usuários por plano (total, contando o administrador) ─────────
CREATE OR REPLACE FUNCTION plano_limite_usuarios(p_plano TEXT, p_extras INTEGER)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE lower(coalesce(p_plano, 'free'))
               WHEN 'free'         THEN 2
               WHEN 'basico'       THEN 1
               WHEN 'regular'      THEN 3
               WHEN 'profissional' THEN 5
               WHEN 'empresa'      THEN 100000      -- sem limite prático
               ELSE 2
           END + greatest(coalesce(p_extras, 0), 0)
$$;

-- Vagas da empresa: limite, ativos e se ainda cabe mais um
CREATE OR REPLACE FUNCTION empresa_vagas_usuarios(p_empresa UUID)
RETURNS TABLE (limite INTEGER, ativos INTEGER) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT plano_limite_usuarios(e.plano, e.usuarios_extras_pagos),
           (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id AND u.ativo)
      FROM empresas e WHERE e.id = p_empresa
$$;

-- ── Criar usuário (só o administrador da empresa) ─────────────────────────
CREATE OR REPLACE FUNCTION criar_usuario_empresa(
    p_nome TEXT, p_cpf TEXT, p_email TEXT, p_senha TEXT, p_perfil TEXT, p_data_nasc DATE DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
    v_empresa UUID := auth_empresa_id();
    v_cpf     TEXT := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
    v_email   TEXT := lower(trim(coalesce(p_email, '')));
    v_nome    TEXT := trim(coalesce(p_nome, ''));
    v_perfil  TEXT := coalesce(nullif(trim(p_perfil), ''), 'usuario');
    v_limite  INTEGER; v_ativos INTEGER; v_id UUID;
BEGIN
    IF v_empresa IS NULL OR NOT auth_is_admin() THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Só o administrador da empresa pode adicionar usuários.');
    END IF;
    IF v_perfil NOT IN ('usuario', 'gerente') THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Perfil inválido. Cada empresa tem um único administrador.');
    END IF;
    IF v_nome = '' OR v_email = '' OR coalesce(p_senha, '') = '' THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Preencha nome, CPF, e-mail e senha.');
    END IF;
    IF length(v_cpf) <> 11 THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'CPF inválido — digite os 11 dígitos.');
    END IF;
    IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'E-mail inválido.');
    END IF;
    IF length(p_senha) < 6 THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'A senha deve ter no mínimo 6 caracteres.');
    END IF;
    -- CPF/e-mail em TODO o sistema (a tela só enxerga a própria empresa)
    IF EXISTS (SELECT 1 FROM usuarios WHERE regexp_replace(cpf, '\D', '', 'g') = v_cpf) THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Este CPF já tem uma conta no Marpex.');
    END IF;
    IF EXISTS (SELECT 1 FROM usuarios WHERE lower(email) = v_email) THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Este e-mail já tem uma conta no Marpex.');
    END IF;
    SELECT limite, ativos INTO v_limite, v_ativos FROM empresa_vagas_usuarios(v_empresa);
    IF v_ativos >= v_limite THEN
        RETURN jsonb_build_object('sucesso', false, 'limite', v_limite,
            'mensagem', format('Limite de %s usuário(s) ativo(s) do seu plano atingido. Desative alguém ou fale com a Marpex para contratar vagas extras.', v_limite));
    END IF;

    INSERT INTO usuarios (nome_completo, cpf, email, senha_hash, perfil, ativo, empresa_id, data_nascimento, permissoes)
    VALUES (v_nome, v_cpf, v_email, crypt(p_senha, gen_salt('bf', 10)), v_perfil, true, v_empresa, p_data_nasc,
            '{"operacional": true, "comercial": false, "financeiro": false}'::jsonb)
    RETURNING id INTO v_id;
    RETURN jsonb_build_object('sucesso', true, 'id', v_id);
END $$;

REVOKE ALL ON FUNCTION criar_usuario_empresa(TEXT, TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION criar_usuario_empresa(TEXT, TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
REVOKE ALL ON FUNCTION empresa_vagas_usuarios(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION empresa_vagas_usuarios(UUID) TO authenticated;

-- ── Reativar usuário também respeita o limite ─────────────────────────────
CREATE OR REPLACE FUNCTION usuarios_limite_ao_reativar()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_limite INTEGER; v_ativos INTEGER;
BEGIN
    IF NEW.ativo AND NOT coalesce(OLD.ativo, false) AND NEW.empresa_id IS NOT NULL THEN
        SELECT limite, ativos INTO v_limite, v_ativos FROM empresa_vagas_usuarios(NEW.empresa_id);
        IF v_ativos >= v_limite THEN
            RAISE EXCEPTION 'Limite de % usuário(s) ativo(s) do plano atingido — desative outro usuário ou contrate vagas extras.', v_limite
                USING ERRCODE = 'P0001';
        END IF;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_usuarios_limite_ao_reativar ON usuarios;
CREATE TRIGGER trg_usuarios_limite_ao_reativar BEFORE UPDATE OF ativo ON usuarios
    FOR EACH ROW EXECUTE FUNCTION usuarios_limite_ao_reativar();

-- ── Fim da inclusão direta pela API (agora só pela função acima) ──────────
DROP POLICY IF EXISTS "usuarios_insert_authenticated" ON usuarios;

-- ── Painel do dono da Marpex (Central) ─────────────────────────────────────
-- (expira_em = fim do período gratuito de 15 dias — database-gratuito-15-dias.sql)
DROP FUNCTION IF EXISTS admin_listar_empresas();
CREATE OR REPLACE FUNCTION admin_listar_empresas()
RETURNS TABLE (id UUID, razao_social TEXT, cnpj TEXT, plano TEXT, usuarios_extras_pagos INTEGER, status TEXT,
               criado_em TIMESTAMPTZ, expira_em TIMESTAMPTZ, usuarios_ativos INTEGER, usuarios_total INTEGER, limite INTEGER, administrador TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT auth_is_suporte_admin() THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
    RETURN QUERY
    SELECT e.id, e.razao_social::text, e.cnpj::text, coalesce(e.plano, 'free')::text, coalesce(e.usuarios_extras_pagos, 0)::int,
           e.status::text, e.created_at, e.expira_em,
           (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id AND u.ativo),
           (SELECT count(*)::int FROM usuarios u WHERE u.empresa_id = e.id),
           plano_limite_usuarios(e.plano, e.usuarios_extras_pagos),
           (SELECT u.nome_completo || ' <' || u.email || '>' FROM usuarios u WHERE u.empresa_id = e.id AND u.perfil = 'admin' LIMIT 1)
      FROM empresas e
     ORDER BY e.created_at DESC NULLS LAST;
END $$;

-- Plano pago tira o vencimento (sai do modo só leitura); voltar ao Gratuito não
-- devolve prazo — para isso use admin_prorrogar_avaliacao.
CREATE OR REPLACE FUNCTION admin_definir_plano(p_empresa UUID, p_plano TEXT, p_extras INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF NOT auth_is_suporte_admin() THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
    IF p_plano NOT IN ('free', 'basico', 'regular', 'profissional', 'empresa') THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Plano inválido.');
    END IF;
    IF coalesce(p_extras, 0) < 0 OR coalesce(p_extras, 0) > 1000 THEN
        RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Vagas extras inválidas.');
    END IF;
    UPDATE empresas
       SET plano = p_plano, usuarios_extras_pagos = coalesce(p_extras, 0),
           expira_em = CASE WHEN p_plano = 'free' THEN expira_em ELSE NULL END,
           status    = CASE WHEN p_plano = 'free' THEN status ELSE 'ativo' END
     WHERE id = p_empresa AND status IS DISTINCT FROM 'sandbox';
    IF NOT FOUND THEN RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Empresa não encontrada (ou conta sem empresa).'); END IF;
    RETURN jsonb_build_object('sucesso', true);
END $$;

-- Prorrogar o período gratuito: +N dias a partir do vencimento (ou de hoje, se já venceu)
CREATE OR REPLACE FUNCTION admin_prorrogar_avaliacao(p_empresa UUID, p_dias INTEGER)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_novo TIMESTAMPTZ;
BEGIN
    IF NOT auth_is_suporte_admin() THEN RAISE EXCEPTION 'Sem permissão.' USING ERRCODE = '42501'; END IF;
    IF coalesce(p_dias, 0) < 1 OR p_dias > 365 THEN RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Informe de 1 a 365 dias.'); END IF;
    UPDATE empresas
       SET expira_em = greatest(coalesce(expira_em, now()), now()) + make_interval(days => p_dias),
           aviso_vencimento_em = NULL
     WHERE id = p_empresa AND coalesce(plano, 'free') = 'free' AND status IS DISTINCT FROM 'sandbox'
     RETURNING expira_em INTO v_novo;
    IF v_novo IS NULL THEN RETURN jsonb_build_object('sucesso', false, 'mensagem', 'Só empresas no plano Gratuito têm período a prorrogar.'); END IF;
    RETURN jsonb_build_object('sucesso', true, 'expira_em', v_novo);
END $$;

REVOKE ALL ON FUNCTION admin_prorrogar_avaliacao(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_prorrogar_avaliacao(UUID, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION admin_listar_empresas() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION admin_definir_plano(UUID, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_listar_empresas() TO authenticated;
GRANT EXECUTE ON FUNCTION admin_definir_plano(UUID, TEXT, INTEGER) TO authenticated;

-- Verificação (1 linha): funções criadas, inclusão direta fechada, limite do free
SELECT
    (SELECT count(*) FROM pg_proc WHERE proname IN ('plano_limite_usuarios', 'empresa_vagas_usuarios', 'criar_usuario_empresa',
            'usuarios_limite_ao_reativar', 'admin_listar_empresas', 'admin_definir_plano', 'admin_prorrogar_avaliacao')) AS funcoes, -- 7
    (SELECT count(*) FROM pg_policies WHERE tablename = 'usuarios' AND cmd = 'INSERT')                 AS insert_direto, -- 0
    plano_limite_usuarios('free', 0)                                                                    AS limite_free;   -- 2
