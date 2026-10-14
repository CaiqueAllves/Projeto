// Botão "Documentos" no card da Proforma abre a janela com os documentos dela.
module.exports = {
    nome: 'Documentos da Proforma no card',
    async executar({ page, h }) {
        await h.ir(page, 'documentos.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            await page.evaluate(async (id) => {
                const { data: p } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
                await anexarPDFProformaAutomatico(p, null);
            }, ids.proforma);
            await h.ir(page, 'proforma.html?semabas=1', 3500);
            await page.evaluate((id) => profToggleCard(id), ids.proforma);   // botões ficam no card aberto
            await page.waitForTimeout(400);
            const botao = `button[onclick="profVerDocumentos('${ids.proforma}')"]`;
            h.esperar(await page.$(botao), 'Botão de documentos não aparece no card');
            await page.click(botao);
            await page.waitForTimeout(2500);
            const txt = await page.innerText('#profDocsOverlay');
            h.esperar(/Proforma Invoice/.test(txt), 'Janela sem a Proforma Invoice');
            h.esperar(/Anexado/.test(txt), 'Proforma Invoice deveria aparecer como anexada');
            h.esperar(/Commercial Invoice/.test(txt) && txt.includes(ids.marca + 'P1'), 'Janela sem os documentos do Processo');
            h.esperar(await page.$('#profDocsOverlay a.prof-doc-ver'), 'Sem link para ver o arquivo');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
