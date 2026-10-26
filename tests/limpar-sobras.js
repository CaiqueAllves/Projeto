// Apaga dados de teste (marca "TSTE2E…") que sobraram de uma rodada
// interrompida. Uso: MARPEX_CPF=… MARPEX_SENHA=… node limpar-sobras.js
const h = require('./helpers.js');
(async () => {
    await h.garantirServidor();
    const { browser, page } = await h.abrirNavegador({});
    await h.login(page);
    console.log(await page.evaluate(async () => {
        const out = {};
        const ids = async (t, col) => ((await supabaseClient.from(t).select('id').like(col, 'TSTE2E%')).data || []).map(r => r.id);
        // contas, oportunidades e tarefas de teste primeiro (apontam para Proformas/Processos/parceiros de teste)
        for (const [t, col] of [['contas_receber', 'descricao'], ['contas_pagar', 'descricao'], ['oportunidades', 'titulo'], ['tarefas', 'titulo']]) {
            const r = await supabaseClient.from(t).delete().like(col, 'TSTE2E%').select('id');
            if (r.data?.length) out[t] = r.data.length;
        }
        const pfIds = await ids('proformas', 'codigo');
        if (pfIds.length) {
            const { data: docs } = await supabaseClient.from('proforma_documentos').select('arquivo_path').in('proforma_id', pfIds);
            const paths = (docs || []).map(d => d.arquivo_path).filter(Boolean);
            if (paths.length) await supabaseClient.storage.from('proforma-documentos-assinados').remove(paths);
            await supabaseClient.from('proforma_documentos').delete().in('proforma_id', pfIds);
            await supabaseClient.from('processos').delete().in('proforma_id', pfIds);
            out.proformas = (await supabaseClient.from('proformas').delete().in('id', pfIds)).error?.message || pfIds.length;
        }
        const prIds = await ids('produtos', 'nome');
        if (prIds.length) {
            await supabaseClient.from('produto_embalagens').delete().in('produto_id', prIds);
            out.produtos = (await supabaseClient.from('produtos').delete().in('id', prIds)).error?.message || prIds.length;
        }
        const pcIds = await ids('parceiros', 'razao_social');
        if (pcIds.length) out.parceiros = (await supabaseClient.from('parceiros').delete().in('id', pcIds)).error?.message || pcIds.length;
        return out;
    }));
    await browser.close();
    process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
