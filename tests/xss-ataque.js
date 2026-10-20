// Grava textos maliciosos nos dados de teste e visita as telas; cada payload
// que executar registra "campo@tela" em window.__xss.
const h = require('./helpers.js');
const fs = require('fs');
const P = (campo) => `X"'><img src=x onerror="__xss.push('${campo}')">`;
(async () => {
  await h.garantirServidor();
  const { browser, page } = await h.abrirNavegador({});
  await page.context().addInitScript(() => { window.__xss = []; });
  await h.login(page);
  await h.ir(page, 'proforma.html?semabas=1', 2500);
  const ids = await h.criarDados(page, { processos: 1 });
  const extra = {};
  try {
    const erros = await page.evaluate(async ({ ids, m }) => {
      const P = (c) => `X"'><img src=x onerror="__xss.push('${c}')">`;
      const err = [];
      const upd = async (t, id, campos) => { for (const [k, v] of Object.entries(campos)) { const r = await supabaseClient.from(t).update({ [k]: v }).eq('id', id); if (r.error) err.push(t + '.' + k + ': ' + r.error.message.slice(0, 60)); } };
      for (const [id, n] of [[ids.exp, 'exp'], [ids.imp, 'imp'], [ids.transp, 'transp']])
        await upd('parceiros', id, n === 'transp'
          ? { razao_social: m + ` T');__xss.push('jsctx.transp');//`, nome_fantasia: null }
          : { razao_social: m + ' ' + n + P(n + '.razao'), nome_fantasia: P(n + '.fantasia'), cidade: P(n + '.cidade'), endereco: P(n + '.endereco'), pais: 'Brasil', codigo: P(n + '.codigo') });
      await upd('produtos', ids.produto, { nome: m + ' prod' + P('prod.nome'), descricao: P('prod.descricao'), marca: P('prod.marca') });
      const { data: pf } = await supabaseClient.from('proformas').select('itens').eq('id', ids.proforma).single();
      const itens = (pf.itens || []).map(i => ({ ...i, produto: m + P('pf.item.produto') }));
      await upd('proformas', ids.proforma, { codigo: m + P('pf.codigo'), origem_pais: P('pf.origem'), destino_pais: P('pf.destino'), parceiro_razao_social: P('pf.parceiro_razao'), incoterm_local: P('pf.incoterm_local'), observacoes: P('pf.obs'), itens });
      await upd('processos', ids.processos[0], { numero_processo: m + P('proc.numero'), fronteira_saida: P('proc.fronteira'), container_numero: P('proc.container'), observacoes: P('proc.obs'), itens: itens.map(i => ({ ...i, qtd: 50 })) });
      const u = obterUsuarioLogado();
      const cr = await supabaseClient.from('contas_receber').insert({ empresa_id: u.empresa_id, descricao: m + P('cr.descricao'), valor: 10, data_vencimento: '2026-12-01', status: 'pendente', proforma_id: ids.proforma }).select('id').single();
      if (cr.error) err.push('cr: ' + cr.error.message); 
      const cp = await supabaseClient.from('contas_pagar').insert({ empresa_id: u.empresa_id, descricao: m + P('cp.descricao'), valor: 10, data_vencimento: '2026-12-01', status: 'pendente' }).select('id').single();
      if (cp.error) err.push('cp: ' + cp.error.message);
      const op = await supabaseClient.from('oportunidades').insert({ empresa_proprietaria_id: u.empresa_id, titulo: m + P('op.titulo'), observacoes: P('op.obs'), valor: 100, moeda: 'USD', etapa: 'proposta', cliente_id: ids.imp, remetente_parceiro_id: ids.exp }).select('id').single();
      if (op.error) err.push('op: ' + op.error.message);
      const tf = await supabaseClient.from('tarefas').insert({ empresa_id: u.empresa_id, usuario_id: u.id, usuario_nome: 'x', titulo: m + P('tarefa.titulo'), prioridade: 'media' }).select('id').single();
      if (tf.error) err.push('tarefa: ' + tf.error.message);
      return { err, cr: cr.data?.id, cp: cp.data?.id, op: op.data?.id, tf: tf.data?.id };
    }, { ids, m: ids.marca });
    Object.assign(extra, erros);
    console.log('erros ao gravar:', erros.err);

    const achados = new Set();
    const coletar = async (tela) => { const x = await page.evaluate(() => window.__xss || []).catch(() => []); x.forEach(c => achados.add(c + ' @ ' + tela)); };
    const cobertura = [];
    const visitar = async (url, acao, rotulo) => {
      await h.ir(page, url, 3500);
      if (acao) { await page.evaluate(acao).catch(e => achados.add('(erro ação ' + url + ': ' + e.message.slice(0, 60) + ')')); await page.waitForTimeout(1500); }
      const nome = url.split('?')[0] + (rotulo ? ' [' + rotulo + ']' : '');
      await coletar(nome);
      const vistos = await page.evaluate((m) => (document.body.innerText.match(new RegExp(m, 'g')) || []).length, ids.marca).catch(() => 0);
      // escape em dobro aparece como texto "&amp;", "&quot;"...
      const dobro = await page.evaluate(() => (document.body.innerText.match(/&(amp|quot|lt|gt|#39);/g) || []).length).catch(() => 0);
      // HTML do próprio sistema escapado por engano aparece como texto ("<span class=...")
      const tags = await page.evaluate(() => (document.body.innerText.match(/<(span|i|div|strong|br|em|b)[\s>]/g) || []).length).catch(() => 0);
      cobertura.push(nome + ': ' + vistos + (dobro ? '  ⚠ escape em dobro visível: ' + dobro : '') + (tags ? '  ⚠ HTML aparecendo como texto: ' + tags : ''));
    };
    await visitar('proforma.html?semabas=1');
    await visitar('proforma.html?semabas=1', () => { document.querySelectorAll('[onclick*="profToggle"], .prof-card-toggle, [onclick*="Expandir"]').forEach(b => b.click()); }, 'cards abertos');
    await visitar('proforma.html?semabas=1', () => { _viewMode = 'lista'; profRenderConteudo(_profTodos); }, 'lista');
    await visitar('proforma.html?semabas=1', `profAbrirModalExcluir('${ids.proforma}')`, 'modal excluir');
    await visitar('proforma.html?semabas=1', `profVerDocumentos('${ids.proforma}')`, 'documentos');
    await visitar('proforma.html?semabas=1', `abrirHistorico('proforma','${ids.proforma}','x')`, 'histórico');
    await visitar('processos.html?semabas=1');
    await visitar('processos.html?semabas=1', () => { document.querySelectorAll('.view-btn, [data-view]').forEach(b => b.click()); }, 'outra visão');
    for (const t of ['produtos.html', 'cadastros.html', 'contas-pagar.html', 'contas-receber.html', 'fluxo-caixa.html', 'dre.html', 'pipeline.html', 'proposta.html', 'pipeline-financeiro.html', 'inicio.html', 'relatorios.html', 'relatorios-proforma.html', 'relatorios-processos.html', 'relatorios-produtos.html', 'relatorios-financeiro.html', 'relatorios-comercial.html'])
      await visitar(t + '?semabas=1');
    await visitar(`formularios.html?tab=proposta&id=${ids.proforma}&semabas=1`);
    await visitar(`formularios.html?tab=proposta&id=${ids.proforma}&modo=visualizar&semabas=1`);
    await visitar(`formularios.html?tab=processo&id=${ids.processos[0]}&semabas=1`);
    await visitar(`formularios.html?tab=processo&proforma_id=${ids.proforma}&semabas=1`);
    await visitar(`formularios.html?tab=produto&id=${ids.produto}&semabas=1`);
    await visitar(`formularios.html?tab=empresa&id=${ids.imp}&semabas=1`);
    // listas de sugestão (autocomplete) e clique na sugestão (injeção em onclick)
    const digitar = async (url, abrir, campos, rotulo) => {
      await h.ir(page, url, 3500);
      if (abrir) await page.evaluate(abrir).catch(() => {});
      await page.waitForTimeout(800);
      for (const c of campos) {
        const el = await page.$(c); if (!el) { cobertura.push(rotulo + ' ' + c + ': campo não encontrado'); continue; }
        await page.fill(c, '').catch(() => {}); await page.type(c, 'TSTE2E', { delay: 20 }).catch(() => {});
        await page.waitForTimeout(1500);
        const vistos = await page.evaluate((m) => (document.body.innerText.match(new RegExp(m, 'g')) || []).length, 'TSTE2E').catch(() => 0);
        cobertura.push(rotulo + ' ' + c + ': ' + vistos);
        // clica em cada sugestão visível
        await page.evaluate(() => document.querySelectorAll('.autocomplete-item, [class*=auto] [onclick], [class*=sugest] [onclick]').forEach(x => { try { x.click(); } catch {} })).catch(() => {});
        await page.waitForTimeout(500);
      }
      await coletar(rotulo);
    };
    await digitar('contas-pagar.html?semabas=1', 'cpAbrirModal()', ['#cpFornecedorNome', '#cpProformaNome'], 'contas-pagar sugestões');
    await digitar('contas-receber.html?semabas=1', 'crAbrirModal()', ['#crClienteNome', '#crProformaNome'], 'contas-receber sugestões');
    await digitar('proposta.html?semabas=1', 'propAbrirModal()', ['#propRemetenteNome', '#propDestinatarioNome'], 'proposta sugestões');
    await digitar('formularios.html?tab=proposta&semabas=1', null, ['#prop-emp-dest-busca'], 'form proforma sugestões');
    await digitar('formularios.html?tab=processo&semabas=1', null, ['#proc-emp-dest-busca'], 'form processo sugestões');
    await digitar('formularios.html?tab=produto&semabas=1', null, ['#prod-empresa-busca'], 'form produto sugestões');

    console.log('\nCOBERTURA (vezes que o nome de teste aparece):'); cobertura.forEach(c => console.log('  ' + c));
    console.log('\nEXECUTOU (' + achados.size + '):'); [...achados].sort().forEach(a => console.log('  ' + a));
  } finally {
    await page.evaluate(async (x) => {
      if (x.cr) await supabaseClient.from('contas_receber').delete().eq('id', x.cr);
      if (x.cp) await supabaseClient.from('contas_pagar').delete().eq('id', x.cp);
      if (x.op) { await supabaseClient.from('oportunidade_historico').delete().eq('oportunidade_id', x.op); await supabaseClient.from('oportunidades').delete().eq('id', x.op); }
      if (x.tf) await supabaseClient.from('tarefas').delete().eq('id', x.tf);
    }, extra).catch(() => {});
    await h.limparDados(page, ids);
  }
  await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
