-- Estágio 2.2 (parte final) da migração de autenticação — ver auditoria de
-- segurança. Troca a RLS de `usuarios` de `TO anon USING (true)` (não
-- protegia nada de verdade — qualquer um com a chave anon lia/escrevia
-- qualquer linha) por `TO authenticated` usando auth.uid() de verdade.
--
-- Pré-requisito já cumprido: login e cadastro não dependem mais do anon
-- (ver Edge Functions login-usuario/cadastro-usuario, que rodam com
-- service_role e por isso ignoram RLS de qualquer forma).
--
-- Depois de rodar isso: qualquer sessão customizada de antes da migração
-- (sem nunca ter passado pelo login novo) para de conseguir ler dados —
-- mas não fica "quebrada": a rede de segurança em auth.js detecta isso e
-- redireciona pro login com um aviso, então o impacto é só pedir pra
-- logar de novo, não uma tela travada sem explicação.

-- Funções auxiliares (SECURITY DEFINER: rodam ignorando RLS por dentro,
-- evita qualquer recursão ao consultar `usuarios` de dentro de uma policy
-- da própria tabela `usuarios` — padrão recomendado pelo Supabase).
CREATE OR REPLACE FUNCTION auth_empresa_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT empresa_id FROM usuarios WHERE auth_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT perfil = 'admin' FROM usuarios WHERE auth_id = auth.uid()), false)
$$;

-- Remove todas as policies atuais de `usuarios`, seja lá qual for o nome
-- exato hoje, antes de recriar do zero.
DO $$
DECLARE pol RECORD;
BEGIN
    FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = 'usuarios' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON usuarios', pol.policyname);
    END LOOP;
END $$;

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- Vê a própria linha, ou qualquer colega da mesma empresa (lista de time
-- em Usuários e Permissões já mostra os colegas hoje pra qualquer membro).
CREATE POLICY "usuarios_select_authenticated" ON usuarios FOR SELECT TO authenticated
    USING (auth_id = auth.uid() OR empresa_id = auth_empresa_id());

-- Atualiza a própria linha (trocar senha, editar perfil), ou admin
-- atualizando um colega da mesma empresa (redefinir senha, desativar).
CREATE POLICY "usuarios_update_authenticated" ON usuarios FOR UPDATE TO authenticated
    USING (auth_id = auth.uid() OR (empresa_id = auth_empresa_id() AND auth_is_admin()))
    WITH CHECK (auth_id = auth.uid() OR (empresa_id = auth_empresa_id() AND auth_is_admin()));

-- Só admin cria sub-usuário, e só na própria empresa (cadastro de conta
-- nova continua indo pela Edge Function, não passa por aqui).
CREATE POLICY "usuarios_insert_authenticated" ON usuarios FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_is_admin());

-- Sem policy de DELETE (igual já era pro anon hoje — exclusão de usuário
-- continua só via SQL Editor, não pela API).
