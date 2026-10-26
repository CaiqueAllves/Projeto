// Edge Function: alterar-senha (2026-10-26)
// Troca da própria senha pela tela Perfil, exigindo a SENHA ATUAL — conferida
// aqui no servidor (antes, a tela pedia um "código por e-mail" gerado e
// conferido no próprio navegador: dava para pular, e quem estivesse com a
// sessão de outra pessoa aberta trocava a senha dela).
//   - exige usuário logado (token da sessão, conferido com getUser)
//   - senha atual errada conta para o mesmo bloqueio do login (5 tentativas → 15 min)
//   - grava a nova senha (bcrypt) em usuarios.senha_hash e no Supabase Auth
// O banco recusa troca de senha_hash vinda direto do navegador
// (database-senha-somente-servidor.sql) — só esta função (service_role) troca.
//
// Deploy (deploy padrão, COM verificação de JWT):
//   supabase functions deploy alterar-senha

import { createClient } from 'npm:@supabase/supabase-js@2';
import bcrypt from 'npm:bcryptjs@2.4.3';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const MAX_TENTATIVAS = 5;
const BLOQUEIO_MINUTOS = 15;
const MIN_SENHA = 6;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ sucesso: false, mensagem: 'Method not allowed' }, 405);
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) return json({ sucesso: false, mensagem: 'Troca de senha indisponível no momento.' }, 500);

  try {
    // quem está pedindo: o dono da sessão
    const cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user }, error: erroAuth } = await cliente.auth.getUser();
    if (erroAuth || !user) return json({ sucesso: false, mensagem: 'Sessão expirada. Entre de novo.' }, 401);

    const { senhaAtual, novaSenha } = await req.json();
    if (!senhaAtual || !novaSenha) return json({ sucesso: false, mensagem: 'Informe a senha atual e a nova senha.' }, 400);
    if (String(novaSenha).length < MIN_SENHA) return json({ sucesso: false, mensagem: `A nova senha deve ter no mínimo ${MIN_SENHA} caracteres.` }, 400);
    if (String(novaSenha).length > 200) return json({ sucesso: false, mensagem: 'Senha muito longa.' }, 400);
    if (senhaAtual === novaSenha) return json({ sucesso: false, mensagem: 'A nova senha deve ser diferente da atual.' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const { data: usuario } = await admin.from('usuarios')
      .select('id, auth_id, ativo, senha_hash, tentativas_login, bloqueado_ate')
      .eq('auth_id', user.id).maybeSingle();
    if (!usuario || !usuario.ativo) return json({ sucesso: false, mensagem: 'Usuário não encontrado ou inativo.' }, 403);

    const msgBloqueio = `Muitas tentativas com a senha errada. Tente de novo em ${BLOQUEIO_MINUTOS} minutos.`;
    if (usuario.bloqueado_ate && new Date() < new Date(usuario.bloqueado_ate)) return json({ sucesso: false, mensagem: msgBloqueio }, 429);

    const hash = usuario.senha_hash || '';
    const correta = /^\$2[aby]\$/.test(hash) ? bcrypt.compareSync(String(senhaAtual), hash) : (!!hash && hash === senhaAtual);
    if (!correta) {
      const tentativas = (usuario.tentativas_login || 0) + 1;
      const atualizacao: Record<string, unknown> = { tentativas_login: tentativas };
      if (tentativas >= MAX_TENTATIVAS) atualizacao.bloqueado_ate = new Date(Date.now() + BLOQUEIO_MINUTOS * 60000).toISOString();
      await admin.from('usuarios').update(atualizacao).eq('id', usuario.id);
      return json({ sucesso: false, mensagem: tentativas >= MAX_TENTATIVAS ? msgBloqueio : 'Senha atual incorreta.' }, 401);
    }

    // Auth primeiro: se falhar, nada muda (as duas senhas continuam iguais)
    const { error: erroSenhaAuth } = await admin.auth.admin.updateUserById(user.id, { password: String(novaSenha) });
    if (erroSenhaAuth) return json({ sucesso: false, mensagem: 'Não foi possível trocar a senha. Tente novamente.' }, 500);
    const { error: erroGravar } = await admin.from('usuarios')
      .update({ senha_hash: bcrypt.hashSync(String(novaSenha), 10), tentativas_login: 0, bloqueado_ate: null })
      .eq('id', usuario.id);
    if (erroGravar) return json({ sucesso: false, mensagem: 'Não foi possível trocar a senha. Tente novamente.' }, 500);

    return json({ sucesso: true, mensagem: 'Senha alterada com sucesso!' });
  } catch (err) {
    console.error('[alterar-senha] erro:', err);
    return json({ sucesso: false, mensagem: 'Erro ao trocar a senha. Tente novamente.' }, 500);
  }
}

// ── CORS: só o site do sistema ──
const ORIGENS_PERMITIDAS = [/^https:\/\/caiqueallves\.github\.io$/, /^https:\/\/[a-z0-9-]+\.app\.github\.dev$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const ORIGEM_PADRAO = 'https://caiqueallves.github.io';

Deno.serve(async (req) => {
  const resposta = await tratar(req);
  const origem = req.headers.get('Origin') ?? '';
  const headers = new Headers(resposta.headers);
  headers.set('Access-Control-Allow-Origin', ORIGENS_PERMITIDAS.some((r) => r.test(origem)) ? origem : ORIGEM_PADRAO);
  headers.set('Vary', 'Origin');
  return new Response(resposta.body, { status: resposta.status, headers });
});
