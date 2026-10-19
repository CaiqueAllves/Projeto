// Estágio 2.2 da migração de autenticação (ver auditoria de segurança).
//
// Mesmo motivo do login-usuario: cadastrarContaSupabase() criava a
// empresa/usuário/solicitação direto com a chave `anon`, porque nesse
// momento a pessoa ainda não tem sessão nenhuma (é ela que está sendo
// criada). Pra tirar o `anon` de INSERT em `usuarios`/`empresas`/
// `solicitacoes_empresa`, o cadastro inteiro precisa rodar com
// service_role — daí esta função, réplica fiel de cadastrarContaSupabase
// (supabase-api.js), só que server-side.
//
// Deploy:
//   supabase functions deploy cadastro-usuario --no-verify-jwt
//
// --no-verify-jwt é necessário (é o próprio cadastro, não existe JWT ainda).

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

function gerarChaveEmpresa(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const seg = () => Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${seg()}-${seg()}-${seg()}`;
}

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ sucesso: false, mensagem: 'Cadastro indisponível no momento.' }, 500);
  }

  try {
    const dados = await req.json();
    const { nome, cpf, email, senha, empresa, cnpjEmpresa, chaveEmpresa, aceitouTermos } = dados;

    if (!aceitouTermos) {
      return jsonResponse({ sucesso: false, mensagem: 'Você deve aceitar os termos de uso!' });
    }
    if (!nome || !cpf || !email || !senha) {
      return jsonResponse({ sucesso: false, mensagem: 'Preencha todos os campos obrigatórios!' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: cpfExistente, error: erroCpf } = await admin
      .from('usuarios')
      .select('cpf')
      .eq('cpf', cpf)
      .maybeSingle();
    if (erroCpf) return jsonResponse({ sucesso: false, mensagem: 'Erro ao verificar CPF: ' + erroCpf.message });
    if (cpfExistente) return jsonResponse({ sucesso: false, mensagem: 'Este CPF já está cadastrado!' });

    // E-mail é a identidade no login (Supabase Auth): não pode repetir.
    // Antes só o CPF era conferido — um e-mail repetido permitia tomar a conta
    // de outra pessoa no primeiro login (varredura de segurança 2026-10-19).
    const emailNorm = String(email).trim().toLowerCase();
    const { data: emailExistente, error: erroEmail } = await admin
      .from('usuarios')
      .select('id')
      .ilike('email', emailNorm.replace(/[\\%_]/g, (c) => '\\' + c))
      .limit(1);
    if (erroEmail) return jsonResponse({ sucesso: false, mensagem: 'Erro ao verificar e-mail: ' + erroEmail.message });
    if (emailExistente && emailExistente.length) return jsonResponse({ sucesso: false, mensagem: 'Este e-mail já está cadastrado!' });

    let empresaId: string | null = null;
    let chaveGerada: string | null = null;
    const perfil = 'admin';
    let empresaSolicitadaId: string | null = null;
    let aviso: string | null = null;
    let sandboxInfo: { expira_em: string } | null = null;

    if (chaveEmpresa) {
      const { data: empresaEncontrada } = await admin
        .from('empresas')
        .select('id, razao_social')
        .eq('chave_empresa', String(chaveEmpresa).toUpperCase())
        .maybeSingle();

      if (empresaEncontrada) {
        empresaSolicitadaId = empresaEncontrada.id;
        aviso = `Solicitação enviada para "${empresaEncontrada.razao_social}". Aguarde a aprovação do responsável.`;
      } else {
        aviso = 'Chave não encontrada. Conta criada sem vínculo com empresa.';
      }
    } else if (empresa) {
      chaveGerada = gerarChaveEmpresa();
      const { data: empresaCriada, error: erroEmpresa } = await admin
        .from('empresas')
        .insert({ razao_social: empresa, nome_fantasia: empresa, cnpj: cnpjEmpresa || null, email, status: 'trial', plano: 'free', chave_empresa: chaveGerada })
        .select()
        .single();
      if (erroEmpresa) return jsonResponse({ sucesso: false, mensagem: 'Erro ao criar empresa: ' + erroEmpresa.message });
      empresaId = empresaCriada.id;
    } else {
      const expiraEm = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: empresaCriada, error: erroEmpresa } = await admin
        .from('empresas')
        .insert({
          razao_social: `Conta Sandbox — ${nome}`,
          nome_fantasia: `Conta Sandbox — ${nome}`,
          email,
          status: 'sandbox',
          plano: 'free',
          chave_empresa: gerarChaveEmpresa(),
          expira_em: expiraEm,
        })
        .select()
        .single();
      if (erroEmpresa) return jsonResponse({ sucesso: false, mensagem: 'Erro ao criar conta: ' + erroEmpresa.message });
      empresaId = empresaCriada.id;
      sandboxInfo = { expira_em: expiraEm };
    }

    const { data: novoUsuario, error: erroUsuario } = await admin
      .from('usuarios')
      .insert({ nome_completo: nome, cpf, email, senha_hash: bcrypt.hashSync(senha, 10), perfil, ativo: true })
      .select()
      .single();
    if (erroUsuario) return jsonResponse({ sucesso: false, mensagem: 'Erro ao criar conta: ' + erroUsuario.message });

    if (empresaId) {
      await admin.from('usuarios').update({ empresa_id: empresaId }).eq('id', novoUsuario.id);
    }

    if (empresaSolicitadaId) {
      const { error: erroSol } = await admin
        .from('solicitacoes_empresa')
        .insert({
          usuario_id: novoUsuario.id,
          empresa_id: empresaSolicitadaId,
          nome_usuario: nome,
          email_usuario: email,
        });
      if (!erroSol) {
        await admin.rpc('notificar_admin_email', {
          p_empresa_id: empresaSolicitadaId,
          p_nome_usuario: nome,
          p_email_usuario: email,
        }).catch(() => {});
      }
    }

    return jsonResponse({
      sucesso: true,
      mensagem: 'Conta criada com sucesso!',
      // só o básico — a linha inteira levava senha_hash junto na resposta
      usuario: { id: novoUsuario.id, nome_completo: novoUsuario.nome_completo, email: novoUsuario.email },
      chave_gerada: chaveGerada,
      aviso,
      sandbox: sandboxInfo,
    });
  } catch (err) {
    console.error('[cadastro-usuario] erro:', err);
    return jsonResponse({ sucesso: false, mensagem: 'Erro ao processar cadastro.' }, 500);
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
