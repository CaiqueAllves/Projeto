// Assinatura digital: link → página pública → assinatura → Proforma Aprovada.
module.exports = {
    nome: 'Assinatura digital pelo link',
    async executar({ page, browser, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        const existe = await page.evaluate(async () => !(await supabaseClient.from('assinaturas_proforma').select('id').limit(1)).error);
        if (!existe) h.pular('database-assinatura-digital.sql ainda não foi rodado');
        let ids;
        try {
            ids = await h.criarDados(page);
            const token = await page.evaluate(async (id) => {
                const { data: p } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
                const reg = await anexarPDFProformaAutomatico(p, null);
                const r = await window.supabaseAPI.criarAssinaturaProforma(id, reg?.arquivo_path, '');
                return r.data.token;
            }, ids.proforma);
            // página pública, em outra sessão (sem login)
            const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
            const pub = await ctx.newPage();
            await pub.goto(`${h.BASE}/assinar.html?t=${token}`); await pub.waitForTimeout(3000);
            h.esperar(await pub.isVisible('#asConteudo'), 'Página de assinatura não abriu a Proforma');
            await pub.fill('#asNome', 'Fulano Teste'); await pub.fill('#asDocumento', '123.456.789-00');
            await pub.locator('#asCanvas').scrollIntoViewIfNeeded();
            const box = await pub.locator('#asCanvas').boundingBox();
            await pub.mouse.move(box.x + 30, box.y + 60); await pub.mouse.down();
            await pub.mouse.move(box.x + 150, box.y + 90, { steps: 8 }); await pub.mouse.move(box.x + 260, box.y + 50, { steps: 8 }); await pub.mouse.up();
            await pub.check('#asAceite');
            await pub.click('#asAssinar');
            // espera concluir (baixa o PDF p/ o hash + grava) ou aparecer erro
            await pub.waitForFunction(() => !document.getElementById('asConcluido').hidden || !document.getElementById('asMsg').hidden, null, { timeout: 20000 }).catch(() => {});
            const msgErro = await pub.evaluate(() => document.getElementById('asMsg').hidden ? '' : document.getElementById('asMsg').textContent);
            h.esperar(await pub.isVisible('#asConcluido'), 'Assinatura não foi concluída' + (msgErro ? ': ' + msgErro : ''));
            await ctx.close();
            const st = await page.evaluate(async (id) => ({
                status: (await supabaseClient.from('proformas').select('status').eq('id', id).single()).data.status,
                doc: (await supabaseClient.from('proforma_documentos').select('assinado, assinado_por').eq('proforma_id', id).eq('tipo_documento', 'proforma').maybeSingle()).data,
            }), ids.proforma);
            h.igual(st.status, 'aprovado', 'Proforma não foi para Aprovado após assinar');
            h.esperar(st.doc?.assinado && /Fulano Teste/.test(st.doc.assinado_por), 'Documento não ficou assinado');
            // cartão "Assinado" na janela do card: ver arquivo + comprovante em PDF
            await h.ir(page, 'proforma.html?semabas=1', 3500);
            await page.evaluate((id) => profVerDocumentos(id), ids.proforma);
            await page.waitForSelector('#docJanelaOverlay .doc-assinatura-feita', { timeout: 15000 });
            h.esperar(await page.$('#docJanelaOverlay .doc-assinatura-feita a.doc-assinatura-acao'), 'Cartão assinado sem link para o arquivo');
            const [download] = await Promise.all([
                page.waitForEvent('download', { timeout: 20000 }),
                page.click('#docJanelaOverlay .doc-assinatura-feita button.doc-assinatura-acao'),
            ]);
            const fs = require('fs');
            const pdf = fs.readFileSync(await download.path()).toString('latin1');
            h.esperar(/COMPROVANTE DE ASSINATURA/.test(pdf) && /Fulano Teste/.test(pdf) && /123\.456\.789-00/.test(pdf), 'Comprovante sem os dados do assinante');
            h.semErrosJS(page);
        } finally {
            await page.evaluate(async (id) => supabaseClient.from('assinaturas_proforma').delete().eq('proforma_id', id), ids?.proforma).catch(() => {});
            await h.limparDados(page, ids);
        }
    },
};
