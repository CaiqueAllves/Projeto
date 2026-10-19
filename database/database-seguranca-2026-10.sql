-- Varredura de segurança — outubro/2026 (2026-10-19)
--   A) Tabela empresas: cada usuário enxerga só a PRÓPRIA empresa (antes a
--      policy era USING (true): qualquer pessoa que criasse uma conta lia
--      razão social, CNPJ, e-mail, endereço, plano e a CHAVE DE ACESSO de
--      todos os clientes). O Administrador do suporte continua vendo todas.
--   B) Busca de empresa pela chave (pedido de entrada) vira função que
--      devolve só id + razão social da empresa daquela chave.
--   C) E-mail único em usuarios (sem isso, cadastrar-se com o e-mail de outra
--      pessoa permitia tomar a conta dela no primeiro login — corrigido também
--      nas Edge Functions login-usuario e cadastro-usuario).
--   E) Arquivos de documentos e anexos de chamados ficam PRIVADOS (antes
--      qualquer pessoa com o link baixava, para sempre); o sistema gera links
--      temporários. Para a página de assinatura do Importador (sem login), o
--      link do PDF é gerado quando o link de assinatura é enviado.
--   F) Senha criptografada e controle de login de usuarios saem das
--      respostas da API (qualquer colega da empresa recebia).
--   D) Consultas de verificação (só leitura) no final.
-- Idempotente: pode rodar de novo sem erro.

-- ── A) empresas: só a própria ──────────────────────────────────────────
DROP POLICY IF EXISTS empresas_select_auth ON empresas;
CREATE POLICY empresas_select_auth ON empresas FOR SELECT TO authenticated
    USING (id = auth_empresa_id() OR auth_is_suporte_admin());

-- ── B) busca pela chave de acesso ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.buscar_empresa_por_chave(p_chave TEXT)
RETURNS TABLE (id UUID, razao_social TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT e.id, e.razao_social
      FROM empresas e
     WHERE e.chave_empresa = upper(trim(coalesce(p_chave, '')))
       AND length(trim(coalesce(p_chave, ''))) >= 6
     LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.buscar_empresa_por_chave(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_empresa_por_chave(TEXT) TO authenticated;

-- ── C) e-mail único em usuarios ────────────────────────────────────────
-- Só cria o índice se ainda não houver e-mails repetidos (senão o CREATE
-- falharia); nesse caso, veja a consulta D2 abaixo e resolva os repetidos.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM usuarios WHERE email IS NOT NULL AND trim(email) <> ''
         GROUP BY lower(trim(email)) HAVING count(*) > 1
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unico ON usuarios (lower(trim(email)))
            WHERE email IS NOT NULL AND trim(email) <> '';
    ELSE
        RAISE NOTICE 'Há e-mails repetidos em usuarios — índice único NÃO criado. Veja a consulta D2.';
    END IF;
END $$;

-- ── E) arquivos privados ───────────────────────────────────────────────
-- As regras de leitura por empresa já existem (database-proforma-documentos.sql,
-- database-rls-real-storage.sql, database-chamados-central-admin.sql); com o
-- bucket privado elas passam a valer também para quem tem só o link.
UPDATE storage.buckets SET public = false
 WHERE id IN ('proforma-documentos-assinados', 'chamados-anexos', 'pedido-documentos-assinados', 'pedido-confirmacoes');

ALTER TABLE assinaturas_proforma ADD COLUMN IF NOT EXISTS arquivo_url TEXT;

-- Link temporário do PDF para a página pública de assinatura (só pelo token)
CREATE OR REPLACE FUNCTION public.assinatura_arquivo_url(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT a.arquivo_url
      FROM assinaturas_proforma a
     WHERE a.token = p_token
       AND a.status <> 'cancelado'
       AND length(coalesce(p_token, '')) >= 32
     LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.assinatura_arquivo_url(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinatura_arquivo_url(TEXT) TO anon, authenticated;

-- ── F) usuarios: senha e controle de login fora da API ────────────────
-- Antes, qualquer usuário logado recebia de si mesmo e dos colegas da mesma
-- empresa a senha criptografada (senha_hash), as tentativas de login e o
-- bloqueio. Com o hash na mão dá pra testar senhas fracas offline, sem o
-- limite de tentativas do login. O site nunca lê essas colunas (o login roda
-- na Edge Function, com service_role); ele só GRAVA senha_hash ao criar
-- sub-usuário e ao trocar senha — gravar continua liberado.
-- Leitura passa a ser por coluna: todas, menos as três abaixo.
-- ATENÇÃO: coluna nova em usuarios precisa de
--   GRANT SELECT (coluna) ON public.usuarios TO authenticated;
-- senão o site não consegue lê-la.
REVOKE SELECT ON public.usuarios FROM anon, authenticated;
DO $$
DECLARE
    v_cols TEXT;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO v_cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'usuarios'
       AND column_name NOT IN ('senha_hash', 'tentativas_login', 'bloqueado_ate');
    EXECUTE format('GRANT SELECT (%s) ON public.usuarios TO authenticated', v_cols);
END $$;

-- ── D) verificação (só leitura) ────────────────────────────────────────
-- D1) mais de um usuário ligado à MESMA conta de acesso: sinal de que a falha
--     de tomada de conta pode ter sido usada. Deve voltar vazio.
SELECT auth_id, count(*) AS usuarios, string_agg(cpf || ' / ' || coalesce(email, '—'), ' | ') AS quem
  FROM usuarios WHERE auth_id IS NOT NULL
 GROUP BY auth_id HAVING count(*) > 1;

-- D2) e-mails repetidos em usuarios. Deve voltar vazio.
SELECT lower(trim(email)) AS email, count(*) AS usuarios, string_agg(cpf, ', ') AS cpfs
  FROM usuarios WHERE email IS NOT NULL AND trim(email) <> ''
 GROUP BY lower(trim(email)) HAVING count(*) > 1;

-- D4) colunas de usuarios que o site consegue ler — NÃO deve aparecer
--     senha_hash, tentativas_login nem bloqueado_ate.
SELECT string_agg(column_name, ', ' ORDER BY column_name) AS colunas_legiveis
  FROM information_schema.column_privileges
 WHERE table_schema = 'public' AND table_name = 'usuarios'
   AND grantee = 'authenticated' AND privilege_type = 'SELECT';

-- D3) senhas antigas ainda sem criptografia (bcrypt): são convertidas no
--     próximo login; se sobrar alguma, peça a troca de senha a esse usuário.
SELECT count(*) AS senhas_sem_bcrypt
  FROM usuarios WHERE senha_hash IS NOT NULL AND senha_hash !~ '^\$2[aby]\$';
