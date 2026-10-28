// Ligação Operacional → Financeiro: abrir Conta a Receber / a Pagar pelo
// Processo e pela Proforma puxa Proforma, Processo, Cliente, valor e moeda
// (inclusive moeda gravada por descrição, ex. "Dólar Americano").
module.exports = {
    nome: 'Financeiro puxa os dados do Operacional',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            await page.evaluate(async (ids) => {
                const { data: p } = await supabaseClient.from('proformas').select('itens').eq('id', ids.proforma).single();
                const itens = p.itens.map(i => ({ ...i, moeda: 'Dólar Americano' }));
                await supabaseClient.from('proformas').update({ itens, moeda_principal: 'Dólar Americano' }).eq('id', ids.proforma);
                const { data: pr } = await supabaseClient.from('processos').select('itens').eq('id', ids.processos[0]).single();
                await supabaseClient.from('processos').update({ itens: pr.itens.map(i => ({ ...i, moeda: 'Dólar Americano' })), documentos: { commercial: 'CI-TESTE-001' } }).eq('id', ids.processos[0]);
            }, ids);
            const ler = (pfx) => page.evaluate((pfx) => {
                const v = id => document.getElementById(pfx + id)?.value || '';
                return { proforma: v('ProformaId'), processo: v('ProcessoId'), processoNome: v('ProcessoNome'),
                         cliente: v('ClienteNome') || v('FornecedorNome'), moeda: v('PrevMoeda'), valor: v('PrevValor'), ci: v('CommercialInvoice') };   // seção 1 (previsão) do formulário
            }, pfx);

            // Conta a Receber aberta pelo Processo
            await h.ir(page, `contas-receber.html?semabas=1&gerar_processo_id=${ids.processos[0]}`, 4500);
            let r = await ler('cr');
            h.igual(r.proforma, ids.proforma, 'Receber pelo Processo: Proforma não veio');
            h.igual(r.processo, ids.processos[0], 'Receber pelo Processo: vínculo com o Processo não veio');
            h.esperar(/IMPORTADORA/.test(r.cliente), 'Receber pelo Processo: Cliente (Importador) não veio');
            h.igual(r.moeda, 'USD', 'Receber pelo Processo: moeda "Dólar Americano" não virou USD');
            h.igual(r.valor, '250,00', 'Receber pelo Processo: valor do embarque não veio');
            h.igual(r.ci, 'CI-TESTE-001', 'Receber pelo Processo: Commercial Invoice do Processo não veio');

            // Conta a Receber aberta pela Proforma
            await h.ir(page, `contas-receber.html?semabas=1&gerar_proforma_id=${ids.proforma}`, 4500);
            r = await ler('cr');
            h.igual(r.processo, ids.processos[0], 'Receber pela Proforma: Processo único não foi selecionado');
            h.igual(r.ci, 'CI-TESTE-001', 'Receber pela Proforma: Commercial Invoice não foi selecionada');
            h.igual(r.moeda, 'USD', 'Receber pela Proforma: moeda não veio');

            // Conta a Pagar aberta pelo Processo
            await h.ir(page, `contas-pagar.html?semabas=1&gerar_processo_id=${ids.processos[0]}`, 4500);
            r = await ler('cp');
            h.igual(r.proforma, ids.proforma, 'Pagar pelo Processo: Proforma não veio');
            h.igual(r.processo, ids.processos[0], 'Pagar pelo Processo: vínculo com o Processo não veio');
            h.igual(r.moeda, 'USD', 'Pagar pelo Processo: moeda não veio');
            h.igual(r.ci, 'CI-TESTE-001', 'Pagar pelo Processo: Commercial Invoice não veio');
            await page.screenshot({ path: process.env.SHOT_DIR ? process.env.SHOT_DIR + '/cp-ci.png' : '/dev/null' }).catch(() => {});

            // moeda inválida não derruba a lista
            const seguro = await page.evaluate(() => { try { return finFormatarValor(10, '') + ' | ' + finFormatarValor(10, 'REAL/BRASIL'); } catch (e) { return 'ERRO ' + e.message; } });
            h.esperar(!seguro.startsWith('ERRO'), 'Formatador quebra com moeda inválida: ' + seguro);
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
