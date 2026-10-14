// Proforma com 2 Processos: cada embarque tem os seus documentos (NF-e, CRT/BL…),
// separados em blocos; anexo de um não aparece no outro; anexo antigo sem
// processo vai para "Sem processo definido" e pode ser movido para um Processo.
module.exports = {
    nome: 'Documentos com N processos (blocos por embarque)',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 2 });
            await page.evaluate(async (ids) => {
                await supabaseClient.from('processos').update({ modal: 'maritimo' }).eq('id', ids.processos[1]);
                // anexo "antigo": NF-e sem processo_id (de antes da divisão)
                await supabaseClient.from('proforma_documentos').insert({ proforma_id: ids.proforma, tipo_documento: 'nfe', arquivo_path: ids.proforma + '/nfe_antiga.pdf', arquivo_nome: 'nfe_antiga.pdf' });
            }, ids);
            await h.ir(page, 'proforma.html?semabas=1', 3500);
            await page.evaluate((id) => profVerDocumentos(id), ids.proforma);
            await page.waitForSelector('#docJanelaOverlay .doc-bloco', { timeout: 15000 });

            const blocos = await page.$$eval('#docJanelaOverlay .doc-bloco', els => els.map(e => ({ cls: e.className, txt: e.innerText })));
            h.igual(blocos.length, 4, 'Esperava blocos: Proforma, 2 Processos e Sem processo definido');
            const [bProf, bP1, bP2, bOrf] = blocos;
            h.esperar(/Proforma Invoice/.test(bProf.txt) && !/Nota Fiscal/.test(bProf.txt), 'Bloco da Proforma deveria ter só a Proforma Invoice');
            h.esperar(bP1.txt.includes(ids.marca + 'P1') && /CRT/.test(bP1.txt) && !/BL — Bill/.test(bP1.txt), 'Bloco do P1 (terrestre) com documentos errados');
            h.esperar(bP2.txt.includes(ids.marca + 'P2') && /BL — Bill/.test(bP2.txt) && !/CRT/.test(bP2.txt), 'Bloco do P2 (marítimo) com documentos errados');
            h.esperar(/Sem processo definido/.test(bOrf.txt) && /nfe_antiga/.test(bOrf.txt), 'Anexo antigo não apareceu para escolher o processo');

            // anexar NF-e no P1 não aparece no P2
            await page.setInputFiles(`#docJanelaOverlay label.doc-anexo-btn input[onchange*="nfe@${ids.processos[0]}"]`,
                { name: 'nfe-p1.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 nfe') });
            await page.waitForFunction(() => /nfe-p1\.pdf/.test(document.getElementById('docJanelaOverlay').innerText), null, { timeout: 15000 });
            const p2 = await page.$$eval('#docJanelaOverlay .doc-bloco', els => els[2].innerText);
            h.esperar(!/nfe-p1/.test(p2), 'NF-e do P1 apareceu no P2');

            // mover o anexo antigo para o P2
            await page.selectOption('#docJanelaOverlay .doc-orfao-select', ids.processos[1]);
            await page.waitForFunction(() => !/Sem processo definido/.test(document.getElementById('docJanelaOverlay').innerText), null, { timeout: 15000 });
            const regs = await page.evaluate(async (id) => (await supabaseClient.from('proforma_documentos')
                .select('processo_id, arquivo_nome').eq('proforma_id', id).eq('tipo_documento', 'nfe')).data, ids.proforma);
            const porNome = Object.fromEntries(regs.map(r => [r.arquivo_nome, r.processo_id]));
            h.igual(porNome['nfe-p1.pdf'], ids.processos[0], 'NF-e do P1 gravada no processo errado');
            h.igual(porNome['nfe_antiga.pdf'], ids.processos[1], 'Anexo antigo não foi movido para o P2');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
