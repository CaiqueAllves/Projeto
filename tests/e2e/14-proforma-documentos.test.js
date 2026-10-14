// Janela "Documentos" do card da Proforma (substituiu o menu Documentos):
// lista os documentos da Proforma e dos Processos e permite assinar ali mesmo.
module.exports = {
    nome: 'Documentos da Proforma no card (assinar pela janela)',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            await page.evaluate(async (id) => {
                const { data: p } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
                await anexarPDFProformaAutomatico(p, null);
            }, ids.proforma);
            await h.ir(page, 'proforma.html?semabas=1', 3500);
            h.esperar(!(await page.$('#menu-documentos')), 'Menu "Documentos" ainda aparece');
            await page.evaluate((id) => profToggleCard(id), ids.proforma);   // botões ficam no card aberto
            await page.waitForTimeout(400);
            const botao = `button[onclick="profVerDocumentos('${ids.proforma}')"]`;
            h.esperar(await page.$(botao), 'Botão de documentos não aparece no card');
            await page.click(botao);
            await page.waitForSelector('#docJanelaOverlay .doc-pedido-tabela', { timeout: 15000 });
            const txt = await page.innerText('#docJanelaOverlay');
            h.esperar(/Proforma Invoice/.test(txt), 'Janela sem a Proforma Invoice');
            h.esperar(/Commercial Invoice/.test(txt) && txt.includes(ids.marca + 'P1'), 'Janela sem os documentos do Processo');
            h.esperar(await page.$('#docJanelaOverlay .doc-btn-whats'), 'Sem o botão de enviar link de assinatura');

            // assina a Proforma Invoice pelo modal (reaproveita o PDF já anexado)
            await page.click(`#docJanelaOverlay .doc-assinatura-marcar[onclick*="'proforma'"]`);
            await page.waitForSelector('#docModalAssinatura', { state: 'visible' });
            await page.fill('#docModalAssinadoPor', 'Assinante Teste');
            await page.click('#docModalAssinatura .doc-modal-btn-confirmar');
            await page.waitForFunction(() => /Assinante Teste/.test(document.getElementById("docJanelaOverlay").innerText), null, { timeout: 15000 });
            const doc = await page.evaluate(async (id) => (await supabaseClient.from('proforma_documentos')
                .select('assinado, assinado_por').eq('proforma_id', id).eq('tipo_documento', 'proforma').maybeSingle()).data, ids.proforma);
            h.esperar(doc?.assinado && doc.assinado_por === 'Assinante Teste', 'Assinatura não foi gravada');

            // fechar a janela atualiza o status do card
            await page.click('#docJanelaOverlay .hist-fechar');
            await page.waitForTimeout(1500);
            const status = await page.evaluate((id) => _profTodos.find(p => p.id === id)?.status, ids.proforma);
            h.igual(status, 'aprovado', 'Card não atualizou para Aprovado ao fechar');

            // link antigo da tela Documentos redireciona e abre a janela
            await h.ir(page, `documentos.html?proforma_id=${ids.proforma}&semabas=1`, 4000);
            h.esperar(page.url().includes('proforma.html'), 'documentos.html não redirecionou');
            await page.waitForSelector('#docJanelaOverlay.aberto .doc-pedido-tabela', { timeout: 15000 });
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
