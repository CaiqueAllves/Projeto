// Commercial Invoice / Packing List por Processo, anexo automático e confirmação ao substituir.
module.exports = {
    nome: 'Documentos: CI/PL por processo e substituição com aviso',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 2 });
            const r = await page.evaluate(async (ids) => {
                const a = await gerarEAnexarDocumentoProcesso('commercial', ids.processos[0], { baixar: false });
                const b = await gerarEAnexarDocumentoProcesso('commercial', ids.processos[1], { baixar: false });
                const pl = await gerarPDFDocumentoProcesso('packing', ids.processos[0]);
                const plTxt = new TextDecoder('latin1').decode(new Uint8Array(await pl.blob.arrayBuffer()));
                const { data } = await supabaseClient.from('proforma_documentos').select('processo_id, arquivo_path').eq('proforma_id', ids.proforma).eq('tipo_documento', 'commercial');
                return { a: a?.anexado, b: b?.anexado, regs: data, plTxt };
            }, ids);
            h.esperar(r.a && r.b, 'Commercial Invoice não foi anexado');
            h.igual(r.regs.length, 2, 'Commercial Invoice dos 2 processos não ficou separado (rodou database-proforma-documentos-por-processo.sql?)');
            for (const t of ['PACKING LIST', ids.sku, 'Caixas 01 a 05', 'Caixa de papel']) h.esperar(r.plTxt.includes(t), `Packing List sem "${t}"`);
            // gerar de novo pergunta antes de substituir; "Não" mantém
            await page.evaluate((id) => { gerarEAnexarDocumentoProcesso('commercial', id, { baixar: false }); }, ids.processos[0]);
            await page.waitForSelector('.confirmar-overlay', { timeout: 10000 });
            h.igual(await page.textContent('.confirmar-titulo'), 'Substituir documento?', 'Não pediu confirmação antes de substituir');
            await page.click('.confirmar-btn--cancelar');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
