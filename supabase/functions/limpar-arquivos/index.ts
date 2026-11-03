// Limpeza de arquivos órfãos no Storage.
//
// A remoção automática dos excluídos há mais de 7 dias
// (purgar_excluidos_vencidos — database-melhorias-2026-10.sql) apaga os
// registros do banco de TODAS as empresas e anota os anexos em
// `arquivos_remover`. O navegador só consegue apagar os arquivos da própria
// empresa; esta função, rodando com service_role, apaga o resto.
//
// Só aceita a chamada do agendamento (pg_cron): cabeçalho x-limpeza-segredo
// igual ao segredo LIMPEZA_SEGREDO da função (database-limpeza-agendamento.sql)
// — assim a chave service_role não fica gravada no comando do agendamento.
// A chave service_role no Authorization continua aceita.
//
// Deploy:
//   supabase secrets set LIMPEZA_SEGREDO=<segredo>
//   supabase functions deploy limpar-arquivos --no-verify-jwt

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const LIMPEZA_SEGREDO = Deno.env.get('LIMPEZA_SEGREDO') ?? '';
const LOTE = 500;

Deno.serve(async (req) => {
  const auth = req.headers.get('Authorization') ?? '';
  const segredo = req.headers.get('x-limpeza-segredo') ?? '';
  const porSegredo = LIMPEZA_SEGREDO.length >= 24 && segredo === LIMPEZA_SEGREDO;
  const porChave = !!SERVICE_ROLE_KEY && auth === `Bearer ${SERVICE_ROLE_KEY}`;
  if (!porSegredo && !porChave) {
    return new Response(JSON.stringify({ erro: 'nao_autorizado' }), { status: 401 });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: pendentes, error } = await admin
    .from('arquivos_remover')
    .select('id, bucket, caminho')
    .order('id', { ascending: true })
    .limit(LOTE);
  if (error) return new Response(JSON.stringify({ erro: error.message }), { status: 500 });

  // agrupa por bucket e apaga em blocos de 100
  const porBucket = new Map<string, { ids: number[]; caminhos: string[] }>();
  for (const p of pendentes ?? []) {
    const g = porBucket.get(p.bucket) ?? { ids: [], caminhos: [] };
    g.ids.push(p.id);
    g.caminhos.push(p.caminho);
    porBucket.set(p.bucket, g);
  }

  let removidos = 0;
  const concluidos: number[] = [];
  for (const [bucket, g] of porBucket) {
    for (let i = 0; i < g.caminhos.length; i += 100) {
      const caminhos = g.caminhos.slice(i, i + 100);
      const { error: errRm } = await admin.storage.from(bucket).remove(caminhos);
      // arquivo que já não existe não é erro — o registro sai da fila do mesmo jeito
      if (!errRm) {
        removidos += caminhos.length;
        concluidos.push(...g.ids.slice(i, i + 100));
      }
    }
  }
  if (concluidos.length) await admin.from('arquivos_remover').delete().in('id', concluidos);

  return new Response(JSON.stringify({ ok: true, processados: concluidos.length, removidos }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
