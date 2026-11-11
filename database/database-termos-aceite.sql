-- Registro do aceite dos Termos de Uso e da Política de Privacidade (2026-11-06)
-- Antes o cadastro exigia marcar "Aceito os termos", mas nada era gravado: não
-- havia como provar quem aceitou, quando e qual versão. Agora cada aceite vira
-- uma linha com a versão, a data/hora, o IP e o navegador.
--   • no cadastro: a função cadastro-usuario grava (origem 'cadastro')
--   • ao mudar a versão dos Termos: o sistema pede o aceite de novo no primeiro
--     acesso e grava pela função registrar_aceite_termos (origem 'atualizacao')
-- Idempotente: pode rodar de novo sem erro.

CREATE TABLE IF NOT EXISTS termos_aceites (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id  UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    versao      TEXT NOT NULL,
    origem      TEXT NOT NULL DEFAULT 'atualizacao',   -- 'cadastro' | 'atualizacao'
    ip          TEXT,
    user_agent  TEXT,
    aceito_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS termos_aceites_usuario ON termos_aceites (usuario_id, versao);

-- Leitura: o próprio usuário vê os seus aceites. Gravação: só pelas funções
-- (SECURITY DEFINER) — ninguém insere/edita/apaga direto pela API.
ALTER TABLE termos_aceites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS termos_aceites_sel ON termos_aceites;
CREATE POLICY termos_aceites_sel ON termos_aceites FOR SELECT TO authenticated
    USING (usuario_id = auth_usuario_id());

-- Já aceitou esta versão?
CREATE OR REPLACE FUNCTION termos_aceite_atual(p_versao TEXT)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM termos_aceites WHERE usuario_id = auth_usuario_id() AND versao = p_versao)
$$;

-- Grava o aceite do usuário logado (IP lido do cabeçalho da requisição)
CREATE OR REPLACE FUNCTION registrar_aceite_termos(p_versao TEXT, p_user_agent TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_usuario UUID := auth_usuario_id();
    v_ip TEXT;
BEGIN
    IF v_usuario IS NULL OR coalesce(trim(p_versao), '') = '' THEN RETURN false; END IF;
    BEGIN
        v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
    EXCEPTION WHEN OTHERS THEN v_ip := NULL; END;
    IF NOT EXISTS (SELECT 1 FROM termos_aceites WHERE usuario_id = v_usuario AND versao = p_versao) THEN
        INSERT INTO termos_aceites (usuario_id, versao, origem, ip, user_agent)
        VALUES (v_usuario, left(p_versao, 40), 'atualizacao', nullif(trim(v_ip), ''), left(p_user_agent, 400));
    END IF;
    RETURN true;
END $$;

REVOKE ALL ON FUNCTION termos_aceite_atual(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION registrar_aceite_termos(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION termos_aceite_atual(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION registrar_aceite_termos(TEXT, TEXT) TO authenticated;

-- Verificação (1 linha): tabela criada, RLS ligada, as 2 funções existem
SELECT
    (SELECT count(*) FROM information_schema.tables WHERE table_name = 'termos_aceites') AS tabela,
    (SELECT relrowsecurity FROM pg_class WHERE relname = 'termos_aceites')               AS rls,
    (SELECT count(*) FROM pg_proc WHERE proname IN ('termos_aceite_atual', 'registrar_aceite_termos')) AS funcoes;
