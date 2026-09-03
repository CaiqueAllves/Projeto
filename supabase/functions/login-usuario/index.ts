// Estágio 2.2 da migração de autenticação (ver auditoria de segurança).
//
// Antes desta função, loginSupabase() buscava o usuário por CPF direto com
// a chave `anon` — e é exatamente essa consulta que travava o Estágio 2.2:
// pra tirar o `anon` de `usuarios` de vez (pré-requisito pra RLS real com
// auth.uid()), o próprio login precisa parar de depender dele. Esta função
// resolve isso rodando com `service_role` (ignora RLS) e faz TODA a
// verificação que antes era client-side: achar por CPF, checar ativo/
// bloqueio, comparar a senha (bcrypt) e contar tentativas — de quebra,
// fecha outra falha da auditoria: o bloqueio por tentativas era só
// client-side (dava pra ignorar batendo direto na API REST). Aqui não tem
// como pular: quem quiser tentar senha é obrigado a passar por aqui.
//
// Ao confirmar a senha certa, também linka/atualiza o usuário no Supabase
// Auth (mesma lógica de vincular-auth-usuario, inlinada aqui pra não
// precisar de mais um round-trip) — o cliente, de posse do "sucesso: true",
// chama supabaseClient.auth.signInWithPassword() ele mesmo (endpoint
// público, não precisa de service_role) pra estabelecer a sessão real.
//
// Deploy:
//   supabase functions deploy login-usuario --no-verify-jwt
//
// --no-verify-jwt é necessário (é o próprio login, não existe JWT ainda).
// Diferente de vincular-auth-usuario, aqui não tem "re-conferir contra o
// que já existe" — a senha É o dado sendo verificado, então a proteção é
// outra: nunca revela se o CPF existe ou não (mensagem genérica sempre),
// nunca aumenta o número de tentativas permitidas, e bloqueia depois de
// MAX_TENTATIVAS erradas.

import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;

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

// Cria/atualiza o usuário correspondente no Supabase Auth e linka via
// usuarios.auth_id — mesma lógica de vincular-auth-usuario/index.ts.
async function vincularAuth(admin: ReturnType<typeof createClient>, usuario: any, senha: string) {
  let authId: string | null = usuario.auth_id;

  if (authId) {
    await admin.auth.admin.updateUserById(authId, { password: senha });
    return authId;
  }

  const { data: criado, error: erroCriar } = await admin.auth.admin.createUser({
    email: usuario.email,
    password: senha,
    email_confirm: true,
    user_metadata: { usuarios_id: usuario.id },
  });

  if (erroCriar) {
    const { data: lista, error: erroLista } = await admin.auth.admin.listUsers();
    if (erroLista) throw erroCriar;
    const existente = lista.users.find((u) => u.email === usuario.email);
    if (!existente) throw erroCriar;
    authId = existente.id;
    await admin.auth.admin.updateUserById(authId, { password: senha });
  } else {
    authId = criado.user.id;
  }

  await admin.from('usuarios').update({ auth_id: authId }).eq('id', usuario.id);
  return authId;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ sucesso: false, mensagem: 'Login indisponível no momento.' }, 500);
  }

  try {
    const { cpf, senha } = await req.json();
    if (!cpf || !senha) {
      return jsonResponse({ sucesso: false, mensagem: 'CPF e senha são obrigatórios' }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: usuario, error } = await admin
      .from('usuarios')
      .select('id, cpf, nome_completo, email, perfil, ativo, bloqueado_ate, tentativas_login, senha_hash, empresa_id, avatar_url, auth_id, empresas(razao_social, status, expira_em)')
      .eq('cpf', cpf)
      .single();

    if (error || !usuario) {
      return jsonResponse({ sucesso: false, mensagem: 'CPF ou senha incorretos' }, 401);
    }

    if (!usuario.ativo) {
      return jsonResponse({ sucesso: false, mensagem: 'Usuário inativo. Contate o administrador.' }, 403);
    }

    if (usuario.bloqueado_ate && new Date() < new Date(usuario.bloqueado_ate)) {
      const minutos = Math.ceil((new Date(usuario.bloqueado_ate).getTime() - Date.now()) / 60000);
      return jsonResponse({ sucesso: false, mensagem: `Usuário bloqueado. Tente novamente em ${minutos} minutos.` }, 403);
    }

    const hashSalvo = usuario.senha_hash || '';
    const eraTextoPuro = !!hashSalvo && !/^\$2[aby]\$/.test(hashSalvo);
    const senhaCorreta = eraTextoPuro ? hashSalvo === senha : (hashSalvo ? bcrypt.compareSync(senha, hashSalvo) : false);

    if (!senhaCorreta) {
      const tentativas = (usuario.tentativas_login || 0) + 1;
      const atualizacao: Record<string, unknown> = { tentativas_login: tentativas };
      if (tentativas >= MAX_TENTATIVAS) {
        atualizacao.bloqueado_ate = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString();
      }
      await admin.from('usuarios').update(atualizacao).eq('id', usuario.id);
      return jsonResponse({ sucesso: false, mensagem: 'CPF ou senha incorretos' }, 401);
    }

    const atualizacaoSucesso: Record<string, unknown> = {
      tentativas_login: 0,
      bloqueado_ate: null,
      ultimo_login: new Date().toISOString(),
    };
    if (eraTextoPuro) atualizacaoSucesso.senha_hash = bcrypt.hashSync(senha, 10); // upgrade transparente
    await admin.from('usuarios').update(atualizacaoSucesso).eq('id', usuario.id);

    try {
      await vincularAuth(admin, usuario, senha);
    } catch (erroVinculo) {
      // Não derruba o login por causa disso — best-effort, ver comentário no topo.
      console.warn('[login-usuario] Falha ao vincular Auth:', erroVinculo);
    }

    return jsonResponse({
      sucesso: true,
      mensagem: 'Login realizado com sucesso!',
      usuario: {
        id: usuario.id,
        cpf: usuario.cpf,
        nome: usuario.nome_completo,
        email: usuario.email,
        perfil: usuario.perfil,
        empresa: usuario.empresas?.razao_social || '',
        empresa_id: usuario.empresa_id,
        empresa_status: usuario.empresas?.status || null,
        empresa_expira_em: usuario.empresas?.expira_em || null,
        avatar_url: usuario.avatar_url || null,
      },
    });
  } catch (err) {
    console.error('[login-usuario] erro:', err);
    return jsonResponse({ sucesso: false, mensagem: 'Erro ao processar login. Tente novamente.' }, 500);
  }
});
