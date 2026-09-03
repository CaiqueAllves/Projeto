// Estágio 2.2 — necessário por causa da RLS real de `usuarios`.
//
// Aprovar uma solicitação de entrada exige atualizar usuarios.empresa_id
// de OUTRA pessoa (o solicitante) pra uma empresa que ainda não é a dela
// — a policy de UPDATE de `usuarios` (usuarios_update_authenticated, ver
// database-usuarios-rls-real.sql) só permite um admin atualizar colegas
// que JÁ pertencem à empresa dele, então essa transição de empresa não
// passa pela RLS normal. Daí esta função, rodando com service_role.
//
// Diferente de login-usuario/cadastro-usuario, esta função RODA COM
// VERIFICAÇÃO DE JWT (deploy padrão, sem --no-verify-jwt) — só chega até
// aqui quem já está autenticado de verdade. Dentro da função, ainda
// confere que quem está chamando é admin da empresa dona da solicitação,
// nunca confiando soltamente no que o cliente informou.
//
// Deploy:
//   supabase functions deploy responder-solicitacao

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
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

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SERVICE_ROLE_KEY) {
    return jsonResponse({ sucesso: false, mensagem: 'Função indisponível no momento.' }, 500);
  }

  try {
    // Verifica quem está chamando através do próprio JWT recebido (o
    // gateway já rejeitou tokens inválidos antes de chegar aqui, mas ainda
    // precisamos saber QUEM é pra achar o usuário correspondente).
    const authHeader = req.headers.get('Authorization') ?? '';
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: erroAuth } = await anonClient.auth.getUser();
    if (erroAuth || !user) return jsonResponse({ sucesso: false, mensagem: 'Não autenticado' }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: chamador } = await admin
      .from('usuarios')
      .select('id, empresa_id, perfil')
      .eq('auth_id', user.id)
      .single();

    if (!chamador || chamador.perfil !== 'admin') {
      return jsonResponse({ sucesso: false, mensagem: 'Apenas administradores podem responder solicitações.' }, 403);
    }

    const { solicitacao_id, aprovado } = await req.json();
    if (!solicitacao_id) return jsonResponse({ sucesso: false, mensagem: 'solicitacao_id é obrigatório' }, 400);

    const { data: sol, error: errSol } = await admin
      .from('solicitacoes_empresa')
      .select('usuario_id, empresa_id')
      .eq('id', solicitacao_id)
      .single();
    if (errSol || !sol) return jsonResponse({ sucesso: false, mensagem: 'Solicitação não encontrada' }, 404);

    if (sol.empresa_id !== chamador.empresa_id) {
      return jsonResponse({ sucesso: false, mensagem: 'Essa solicitação não pertence à sua empresa.' }, 403);
    }

    const { error: errUpd } = await admin
      .from('solicitacoes_empresa')
      .update({
        status: aprovado ? 'aprovado' : 'rejeitado',
        respondido_em: new Date().toISOString(),
        respondido_por: chamador.id,
      })
      .eq('id', solicitacao_id);
    if (errUpd) return jsonResponse({ sucesso: false, mensagem: 'Erro ao responder solicitação' }, 500);

    if (aprovado) {
      const { error: errUser } = await admin
        .from('usuarios')
        .update({ empresa_id: sol.empresa_id })
        .eq('id', sol.usuario_id);
      if (errUser) return jsonResponse({ sucesso: false, mensagem: 'Erro ao vincular usuário à empresa' }, 500);
    }

    return jsonResponse({ sucesso: true });
  } catch (err) {
    console.error('[responder-solicitacao] erro:', err);
    return jsonResponse({ sucesso: false, mensagem: err instanceof Error ? err.message : 'Erro interno' }, 500);
  }
});
