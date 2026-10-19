// Excluir Proforma leva os Processos junto; restaurar traz de volta.
module.exports = {
    nome: 'Exclusão em cascata e restauração',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            await page.reload(); await page.waitForTimeout(3000);
            await page.evaluate((id) => profAbrirModalExcluir(id), ids.proforma);
            const texto = await page.innerText('#modalExcluirProforma');
            h.esperar(/processo ligado/.test(texto), 'Aviso de exclusão não menciona o processo ligado');
            await page.click('#btnConfirmarExcluirProforma');
            const st = () => page.evaluate(async (ids) => ({
                pf: (await supabaseClient.from('proformas').select('status').eq('id', ids.proforma).single()).data.status,
                pr: (await supabaseClient.from('processos').select('status').eq('id', ids.processos[0]).single()).data.status,
            }), ids);
            // espera o salvamento (rede lenta às vezes passa de 2-3s)
            let agora = await st();
            for (let i = 0; i < 20 && (agora.pf !== 'excluido' || agora.pr !== 'excluido'); i++) { await page.waitForTimeout(500); agora = await st(); }
            h.igual(agora, { pf: 'excluido', pr: 'excluido' }, 'Processo não foi excluído junto');
            await page.evaluate(async (id) => profRestaurar(id), ids.proforma);
            let depois = await st();
            for (let i = 0; i < 20 && (depois.pf === 'excluido' || depois.pr === 'excluido'); i++) { await page.waitForTimeout(500); depois = await st(); }
            h.esperar(depois.pf !== 'excluido' && depois.pr !== 'excluido', 'Restaurar a Proforma não trouxe o Processo');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
