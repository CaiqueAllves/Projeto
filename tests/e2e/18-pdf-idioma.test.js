// PDFs no idioma da Proforma: Proforma, Commercial Invoice e Packing List
// saem com rótulos e valores traduzidos (aqui, inglês); Chinês cai para inglês.
module.exports = {
    nome: 'PDFs no idioma da Proforma',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            const txt = await page.evaluate(async (ids) => {
                const ler = async b => new TextDecoder('latin1').decode(new Uint8Array(await b.arrayBuffer()));
                await supabaseClient.from('proformas').update({ idioma: 'en' }).eq('id', ids.proforma);
                const { data: p } = await supabaseClient.from('proformas').select('*').eq('id', ids.proforma).single();
                const prof = await ler(await gerarPDFProformaDados(p, { retornarBlob: true }));
                const ci = await ler((await gerarPDFDocumentoProcesso('commercial', ids.processos[0])).blob);
                const pl = await ler((await gerarPDFDocumentoProcesso('packing', ids.processos[0])).blob);
                const zh = await ler(await gerarPDFProformaDados({ ...p, idioma: 'zh' }, { retornarBlob: true }));
                return { prof, ci, pl, zh };
            }, ids);
            for (const s of ['PAYMENT TERMS', 'Credit Card', 'At sight', 'GRAND TOTAL', 'Page 1 of 1', '500.00'])
                h.esperar(txt.prof.includes(s), `Proforma em inglês sem "${s}"`);
            h.esperar(!txt.prof.includes('CONDIÇÕES') && !txt.prof.includes('Cartão'), 'Proforma em inglês com texto em português');
            for (const s of ['GOODS', 'Credit Card', 'GRAND TOTAL']) h.esperar(txt.ci.includes(s), `Commercial Invoice sem "${s}"`);
            for (const s of ['PACKAGES AND WEIGHTS', 'Boxes 01 to 05']) h.esperar(txt.pl.includes(s), `Packing List sem "${s}"`);
            h.esperar(txt.zh.includes('PAYMENT TERMS'), 'Chinês deveria sair em inglês');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
