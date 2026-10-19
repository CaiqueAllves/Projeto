// Proxy do chat de suporte com IA (Anthropic). A chave da API fica só aqui
// (variável de ambiente) — nunca no site.
//
// Segurança (varredura 2026-10-19 — antes respondia a qualquer pessoa, sem
// login, e aceitava instruções livres, o que deixava a chave da Anthropic
// usável por terceiros):
//   - exige usuário logado (token da sessão do Supabase, conferido com getUser)
//   - as instruções (system) ficam AQUI; o site só escolhe o modo
//   - limita mensagens, tamanho e frequência de pedidos por usuário
//
// Deploy (painel › Edge Functions › suporte-ia, ou CLI):
//   supabase functions deploy suporte-ia
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { createClient } from 'npm:@supabase/supabase-js@2';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const MAX_MENSAGENS      = 20;      // só as últimas entram na conversa
const MAX_CHARS_MENSAGEM = 4000;
const MAX_CHARS_TOTAL    = 20000;
const LIMITE_PEDIDOS     = 30;      // por usuário, por janela
const JANELA_MS          = 10 * 60 * 1000;

const PROMPTS: Record<string, { system: string; max_tokens: number }> = {
  chat: { max_tokens: 512, system: `Você é um assistente virtual da Marpex, sistema de gestão de comércio exterior brasileiro.
Seu objetivo é ajudar os usuários a usar o sistema de forma clara e eficiente.

O sistema Marpex é organizado em 4 módulos, selecionáveis no topo do menu lateral:

Operacional:
- Início: painel principal com visão geral.
- Empresas: cadastro de empresas parceiras (clientes, fornecedores etc.).
- Produtos: cadastro de produtos.
- Proformas: emissão e gestão de proformas.
- Processos: quadro kanban para gestão de processos de exportação e exportação indireta. Status disponíveis: Aberta, Pendente e Encerrada.
- Relatórios: relatórios do módulo operacional (produtos, proformas, processos).
- Termos: termos e condições.
- Apoio: tabelas de apoio (países e regiões, portos e armadores, aeroportos e cias aéreas, moedas, embalagens e unidades de medida, termos de pagamento, acondicionamento, container, NCM).

Comercial:
- Pipeline: quadro kanban do funil de vendas.
- Pedidos: gestão de pedidos.
- Relatórios: relatórios comerciais.

Financeiro:
- Contas a Pagar / Contas a Receber: gestão financeira de contas.
- Fluxo de Caixa: acompanhamento de entradas e saídas.
- DRE / Balancete: demonstrativo de resultado.
- Relatórios: relatórios financeiros.

Configurações:
- Perfil: dados da conta do usuário.
- Usuários e Permissões: gestão de usuários e permissões de acesso.

Regras de resposta:
- Use português brasileiro claro e amigável
- Seja objetivo e direto, sem enrolação
- Para problemas técnicos ou bugs, oriente o usuário a usar "Reportar um problema" no menu de suporte
- Para ajuda urgente, sugira o WhatsApp disponível no menu
- Formate respostas longas em tópicos quando adequado
- Não invente funcionalidades que não foram mencionadas acima` },
  triagem: { max_tokens: 300, system: `Você é um assistente de triagem de suporte técnico do sistema Marpex (comércio exterior).
Você vai receber o título, módulo e descrição de um chamado aberto por um usuário do sistema.
Gere uma triagem curta e objetiva para a equipe de suporte, em português, seguindo exatamente este formato (sem markdown, sem títulos extras, sem introdução):

Resumo: <1-2 frases resumindo o problema em linguagem técnica objetiva>
Urgência provável: <Baixa, Média ou Alta> — <motivo em poucas palavras>
Possível causa: <hipótese curta, ou "Não é possível identificar com as informações disponíveis">

Seja direto e não invente detalhes que não estão na descrição.` },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });

// limite simples por usuário (memória da instância — barra abuso em sequência)
const pedidos = new Map<string, number[]>();
function dentroDoLimite(userId: string): boolean {
  const agora = Date.now();
  const lista = (pedidos.get(userId) ?? []).filter(t => agora - t < JANELA_MS);
  if (lista.length >= LIMITE_PEDIDOS) { pedidos.set(userId, lista); return false; }
  lista.push(agora);
  pedidos.set(userId, lista);
  return true;
}

async function tratar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY não configurada no servidor' }, 500);

  // 1) usuário logado
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'nao_autorizado' }, 401);
  const cliente = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: erroAuth } = await cliente.auth.getUser();
  if (erroAuth || !user) return json({ error: 'nao_autorizado' }, 401);
  if (!dentroDoLimite(user.id)) return json({ error: 'Muitas perguntas em pouco tempo. Aguarde alguns minutos.' }, 429);

  try {
    const { modo, messages } = await req.json();
    const cfg = PROMPTS[modo === 'triagem' ? 'triagem' : 'chat'];

    // 2) só mensagens de texto, papéis válidos, tamanho limitado
    if (!Array.isArray(messages) || messages.length === 0) return json({ error: 'messages é obrigatório' }, 400);
    const limpas = messages.slice(-MAX_MENSAGENS)
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS_MENSAGEM) }));
    while (limpas.length && limpas[0].role !== 'user') limpas.shift();
    const total = limpas.reduce((t: number, m: any) => t + m.content.length, 0);
    if (!limpas.length) return json({ error: 'messages inválido' }, 400);
    if (total > MAX_CHARS_TOTAL) return json({ error: 'Conversa muito longa — comece uma nova.' }, 413);

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: cfg.max_tokens, system: cfg.system, messages: limpas }),
    });
    const data = await anthropicRes.json();
    return json(data, anthropicRes.status);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
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
