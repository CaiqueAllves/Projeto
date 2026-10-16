// PDF da Proforma completa Exportador/Importador e produtos pelo cadastro.
module.exports = {
    nome: 'PDF da Proforma com dados do cadastro',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        let ids;
        try {
            ids = await h.criarDados(page);
            const t = await h.textoPdfDoBlob(page, `(async()=>{const {data}=await supabaseClient.from('proformas').select('*').eq('id','${ids.proforma}').single();return gerarPDFProformaDados(data,{retornarBlob:true});})()`);
            for (const trecho of ['PROFORMA INVOICE', `${ids.marca} EXPORTADORA`, `${ids.marca} IMPORTADORA`, '22.222.222/0001-22', ids.sku, '0901.21.00', 'Exporta', 'Cart', 'Documento gerado pelo Marpex']) {
                h.esperar(t.includes(trecho), `PDF da Proforma sem "${trecho}"`);
            }
            h.esperar(!t.includes('exportacao_direta') && !t.includes('cartao-credito'), 'PDF com códigos internos em vez de texto legível');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
