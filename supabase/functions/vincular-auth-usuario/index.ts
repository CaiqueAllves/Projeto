// Estágio 2.0/2.1 da migração de autenticação (ver auditoria de segurança).
//
// Chamada pelo login customizado (loginSupabase, supabase-api.js) logo após
// confirmar a senha certa — cria ou atualiza o usuário correspondente no
// Supabase Auth de verdade e linka via usuarios.auth_id, sem exigir troca
// de senha de ninguém.
//
// Deploy (SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontos no
// ambiente de toda Edge Function, não precisa rodar `secrets set` pra eles):
//   supabase functions deploy vincular-auth-usuario --no-verify-jwt
//
// ⚠️ --no-verify-jwt é necessário pq essa função roda durante o próprio
// login, antes de existir qualquer sessão Auth — mas isso também significa
// que QUALQUER UM pode chamá-la direto, sem passar pela tela de login. Por
// isso a validação abaixo NUNCA confia no que o cliente manda: ela sempre
// re-confere a senha recebida contra o bcrypt hash salvo em
// usuarios.senha_hash antes de fazer qualquer coisa. Sem essa reconferência,
// um atacante poderia chamar a função com o id de outra pessoa e uma senha
// à escolha dele pra sequestrar o auth_id daquela conta.

import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'Função não configurada no servidor' }, 500);
  }

  try {
    const { usuarios_id, senha } = await req.json();
    if (!usuarios_id || !senha) {
      return jsonResponse({ error: 'usuarios_id e senha são obrigatórios' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Busca o usuário e RE-CONFERE a senha contra o hash salvo — nunca confia
    // cegamente no que o cliente mandou (ver aviso no topo do arquivo).
    const { data: usuario, error: erroUsuario } = await admin
      .from('usuarios')
      .select('id, email, senha_hash, auth_id')
      .eq('id', usuarios_id)
      .single();

    if (erroUsuario || !usuario) {
      return jsonResponse({ error: 'Usuário não encontrado' }, 404);
    }
    if (!usuario.senha_hash || !bcrypt.compareSync(senha, usuario.senha_hash)) {
      return jsonResponse({ error: 'Senha não confere' }, 401);
    }

    let authId: string | null = usuario.auth_id;

    if (authId) {
      // Já linkado — mantém a senha do Auth sincronizada com a atual (cobre
      // o caso de quem trocou de senha pela tela de Perfil desde o último link).
      const { error: erroUpdate } = await admin.auth.admin.updateUserById(authId, { password: senha });
      if (erroUpdate) throw erroUpdate;
    } else {
      // Ainda não linkado — cria o usuário correspondente no Supabase Auth.
      const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
        email: usuario.email,
        password: senha,
        email_confirm: true,
        user_metadata: { usuarios_id: usuario.id },
      });

      if (erroCriar) {
        // E-mail já cadastrado no Auth por outro caminho — reaproveita o id
        // existente em vez de falhar a migração dessa conta.
        const { data: lista, error: erroLista } = await admin.auth.admin.listUsers();
        if (erroLista) throw erroCriar;
        const existente = lista.users.find((u) => u.email === usuario.email);
        if (!existente) throw erroCriar;
        authId = existente.id;
        const { error: erroSync } = await admin.auth.admin.updateUserById(authId, { password: senha });
        if (erroSync) throw erroSync;
      } else {
        authId = criado.user.id;
      }

      const { error: erroLink } = await admin
        .from('usuarios')
        .update({ auth_id: authId })
        .eq('id', usuario.id);
      if (erroLink) throw erroLink;
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    console.error('[vincular-auth-usuario] erro:', err);
    return jsonResponse({ error: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});
