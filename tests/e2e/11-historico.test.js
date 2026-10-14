// Histórico de alterações registra a mudança de status da Proforma.
module.exports = {
    nome: 'Histórico de alterações',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        const existe = await page.evaluate(async () => !(await supabaseClient.from('historico_alteracoes').select('id').limit(1)).error);
        if (!existe) h.pular('database-historico-alteracoes.sql ainda não foi rodado');
        let ids;
        try {
            ids = await h.criarDados(page);
            await page.evaluate(async (id) => supabaseClient.from('proformas').update({ status: 'enviado' }).eq('id', id), ids.proforma);
            const hist = await page.evaluate(async (id) => (await supabaseClient.from('historico_alteracoes').select('acao, alteracoes').eq('registro_id', id)).data, ids.proforma);
            h.esperar(hist.some(x => x.acao === 'criado'), 'Histórico sem o registro de criação');
            h.esperar(hist.some(x => x.acao === 'alterado' && x.alteracoes?.status?.para === 'enviado'), 'Histórico sem a mudança de status');
            await page.evaluate((id) => abrirHistorico('proforma', id, 'TESTE'), ids.proforma); await page.waitForTimeout(1500);
            h.esperar(/Alterou/.test(await page.innerText('#histCorpo')), 'Janela do histórico não mostrou a alteração');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
