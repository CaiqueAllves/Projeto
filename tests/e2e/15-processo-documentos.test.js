// Botão "Documentos" no card de Processo: abre a janela só com os documentos
// daquele embarque (sem os dos outros Processos da mesma Proforma).
module.exports = {
    nome: 'Documentos do Processo no card',
    async executar({ page, h }) {
        await h.ir(page, 'processos.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 2 });
            await h.ir(page, 'processos.html?semabas=1', 3500);
            await page.evaluate((id) => procToggleCard(id), ids.processos[0]);   // botões ficam no card aberto
            await page.waitForTimeout(400);
            const botao = `.proc-card-btns button[data-action="documentos"][data-id="${ids.processos[0]}"]`;
            h.esperar(await page.$(botao), 'Botão de documentos não aparece no card do Processo');
            await page.click(botao);
            await page.waitForSelector('#docJanelaOverlay .doc-pedido-tabela', { timeout: 15000 });
            const txt = await page.innerText('#docJanelaOverlay');
            h.esperar(txt.includes(ids.marca + 'P1'), 'Janela sem os documentos deste Processo');
            h.esperar(!txt.includes(ids.marca + 'P2'), 'Janela mostrando documentos de outro Processo');
            h.esperar(/Commercial Invoice/.test(txt) && /Proforma Invoice/.test(txt), 'Faltam documentos na janela');
            // anexar pela janela grava no Processo certo
            await page.setInputFiles(`#docJanelaOverlay label.doc-anexo-btn input[onchange*="commercial@${ids.processos[0]}"]`,
                { name: 'ci-teste.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 teste') });
            await page.waitForFunction(() => /ci-teste\.pdf/.test(document.getElementById('docJanelaOverlay').innerText), null, { timeout: 15000 });
            const reg = await page.evaluate(async (ids) => (await supabaseClient.from('proforma_documentos')
                .select('processo_id, arquivo_nome').eq('proforma_id', ids.proforma).eq('tipo_documento', 'commercial')).data, ids);
            h.igual(reg.length, 1, 'Anexo não foi gravado');
            h.igual(reg[0].processo_id, ids.processos[0], 'Anexo foi para o Processo errado');
            await page.click('#docJanelaOverlay .hist-fechar');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
