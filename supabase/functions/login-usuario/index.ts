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
// Uma só mensagem para CPF inexistente, senha errada e conta bloqueada — não
// revela qual foi o caso (nem se o CPF existe).
const MSG_FALHA = `CPF ou senha incorretos. Após ${MAX_TENTATIVAS} tentativas erradas o acesso fica bloqueado por ${BLOQUEIO_MINUTOS} minutos.`;

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
    // E-mail já existe no Auth. SÓ reaproveita a conta se ela foi criada para
    // ESTE mesmo usuário (user_metadata.usuarios_id) e ainda não está ligada a
    // outro registro. Antes, qualquer conta com o mesmo e-mail era adotada e
    // tinha a senha trocada — dava para tomar a conta de outra pessoa
    // cadastrando-se com o e-mail dela (varredura de segurança 2026-10-19).
    const { data: lista, error: erroLista } = await admin.auth.admin.listUsers({ perPage: 1000 });
    if (erroLista) throw erroCriar;
    const alvo = String(usuario.email || '').toLowerCase();
    const existente = lista.users.find((u) => String(u.email || '').toLowerCase() === alvo);
    if (!existente) throw erroCriar;
    if (existente.user_metadata?.usuarios_id !== usuario.id) {
      throw new Error('E-mail já pertence a outra conta de acesso — vínculo recusado.');
    }
    const { data: jaLigado } = await admin.from('usuarios').select('id').eq('auth_id', existente.id).neq('id', usuario.id).maybeSingle();
    if (jaLigado) throw new Error('Conta de acesso já ligada a outro usuário — vínculo recusado.');
    authId = existente.id;
    await admin.auth.admin.updateUserById(authId, { password: senha });
  } else {
    authId = criado.user.id;
  }

  await admin.from('usuarios').update({ auth_id: authId }).eq('id', usuario.id);
  return authId;
}

async function tratar(req: Request): Promise<Response> {
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
      return jsonResponse({ sucesso: false, mensagem: MSG_FALHA }, 401);
    }

    const hashSalvo = usuario.senha_hash || '';
    const eraTextoPuro = !!hashSalvo && !/^\$2[aby]\$/.test(hashSalvo);
    const senhaCorreta = eraTextoPuro ? hashSalvo === senha : (hashSalvo ? bcrypt.compareSync(senha, hashSalvo) : false);

    // "Inativo" e "bloqueado" só são revelados a quem acertou a senha — antes
    // apareciam para qualquer um e confirmavam que o CPF existe (varredura de
    // segurança 2026-10-19). Bloqueado continua bloqueado mesmo com a senha certa,
    // e tentativas durante o bloqueio não estendem nem zeram o prazo.
    // Durante o bloqueio a resposta é a MESMA da senha errada (senão a senha
    // certa teria resposta diferente e daria para continuar testando).
    const bloqueado = usuario.bloqueado_ate && new Date() < new Date(usuario.bloqueado_ate);
    if (bloqueado) return jsonResponse({ sucesso: false, mensagem: MSG_FALHA }, 401);
    if (senhaCorreta && !usuario.ativo) {
      return jsonResponse({ sucesso: false, mensagem: 'Usuário inativo. Contate o administrador.' }, 403);
    }

    if (!senhaCorreta) {
      const tentativas = (usuario.tentativas_login || 0) + 1;
      const atualizacao: Record<string, unknown> = { tentativas_login: tentativas };
      if (tentativas >= MAX_TENTATIVAS) {
        atualizacao.bloqueado_ate = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString();
      }
      await admin.from('usuarios').update(atualizacao).eq('id', usuario.id);
      return jsonResponse({ sucesso: false, mensagem: MSG_FALHA }, 401);
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
}

// ── CORS: só o site do sistema (2026-10-19) ──────────────────────────────
// Navegadores em outros sites não conseguem chamar esta função. Não barra
// chamadas fora do navegador (curl, scripts) — essas não mandam Origin e
// continuam dependendo das demais proteções (login, limites, RLS).
const ORIGENS_PERMITIDAS = [/^https:\/\/caiqueallves\.github\.io$/, /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const ORIGEM_PADRAO = 'https://caiqueallves.github.io';

Deno.serve(async (req) => {
  const origem = req.headers.get('Origin') ?? '';
  const resp = await tratar(req);
  const headers = new Headers(resp.headers);
  headers.set('Access-Control-Allow-Origin', ORIGENS_PERMITIDAS.some((r) => r.test(origem)) ? origem : ORIGEM_PADRAO);
  headers.set('Vary', 'Origin');
  return new Response(resp.body, { status: resp.status, headers });
});
