// Remover produto que veio da Proforma ao gerar o Processo: pergunta se é
// stand-by (saldo pendente) ou exclusão da Proforma. Também cobre 2 linhas do
// mesmo produto na Proforma (cada linha recebe a sua quantidade, não o saldo todo).
module.exports = {
    nome: 'Processo: remover item (stand-by x excluir da Proforma)',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page);
            await page.evaluate(async (ids) => {
                const { data: p } = await supabaseClient.from('proformas').select('itens').eq('id', ids.proforma).single();
                const it = p.itens[0];
                await supabaseClient.from('proformas').update({ itens: [{ ...it, qtd: 60 }, { ...it, qtd: 40 }] }).eq('id', ids.proforma);
            }, ids);
            await h.ir(page, 'formularios.html?tab=processo&proforma_id=' + ids.proforma, 5000);
            h.igual(await page.evaluate(() => _procItens.map(i => i.qtd)), [60, 40], 'Cada linha deveria vir com a sua quantidade');

            const remover = async (opcao) => {
                await page.click('#proc-item-card-1 .prop-item-del');
                await page.waitForSelector('.escolher-opcao', { timeout: 5000 });
                await page.click(`.escolher-opcao[data-valor="${opcao}"]`);
                await page.waitForTimeout(400);
            };
            // cancelar não remove
            await page.click('#proc-item-card-1 .prop-item-del');
            await page.waitForSelector('.escolher-opcao');
            await page.click('.escolher-opcoes ~ .confirmar-acoes .confirmar-btn--cancelar');
            await page.waitForTimeout(300);
            h.igual(await page.evaluate(() => _procItens.length), 2, 'Cancelar removeu o item');

            // stand-by: sai do processo, fica como saldo pendente
            await remover('standby');
            let faixa = await page.innerText('#proc-itens-aviso-parcial');
            h.esperar(/stand-by/i.test(faixa) && /40 KG/.test(faixa), 'Faixa de stand-by não mostra o saldo pendente');
            await page.click('#proc-itens-aviso-parcial .proc-standby-btn');   // Incluir neste processo
            await page.waitForTimeout(300);
            h.igual(await page.evaluate(() => _procItens.map(i => i.qtd)), [60, 40], 'Incluir do stand-by não devolveu o item');

            // excluir da Proforma: marca e aplica depois de salvar
            await remover('excluir');
            faixa = await page.innerText('#proc-itens-aviso-parcial');
            h.esperar(/Saem da Proforma ao salvar/i.test(faixa), 'Faixa não avisa que o item sai da Proforma');
            const r = await page.evaluate(async (ids) => {
                // simula o salvar: grava o processo com os itens da tela e aplica as exclusões
                const ins = await supabaseClient.from('processos').insert({ proforma_id: ids.proforma, numero_processo: ids.marca + 'P9',
                    empresa_proprietaria_id: JSON.parse(sessionStorage.getItem('usuarioLogado')).empresa_id, status: 'aberto', tipo: 'exportacao_direta', proposito: 'vendas', emissor_tipo: 'terceiro', itens: _procItens });
                if (ins.error) return { erro: ins.error.message };
                await _procAplicarExclusoesNaProforma(ids.proforma);
                const s = await window.supabaseAPI.buscarSaldoProforma(ids.proforma);
                return { itens: s.proforma.itens.map(i => i.qtd), pct: s.percentual, valor: (await supabaseClient.from('proformas').select('valor_total').eq('id', ids.proforma).single()).data.valor_total };
            }, ids);
            h.esperar(!r.erro, 'Erro ao gravar processo: ' + r.erro);
            h.igual(r.itens, [60], 'Item não saiu da Proforma');
            h.igual(r.pct, 100, 'Proforma deveria ficar 100% embarcada');
            h.igual(Number(r.valor), 300, 'Valor total da Proforma não foi recalculado');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
