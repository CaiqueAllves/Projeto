// Todas as telas principais abrem sem erro de JavaScript.
module.exports = {
    nome: 'Telas principais abrem sem erro',
    async executar({ page, h }) {
        const telas = ['inicio.html', 'proforma.html', 'processos.html', 'relatorios.html', 'produtos.html',
            'cadastros.html', 'contas-pagar.html', 'contas-receber.html', 'fluxo-caixa.html', 'proposta.html', 'pipeline.html', 'termos.html'];
        for (const t of telas) await h.ir(page, t + '?semabas=1', 2500);
        for (const aba of ['empresa', 'processo', 'proposta', 'produto']) await h.ir(page, 'formularios.html?tab=' + aba, 2500);
        h.semErrosJS(page);
    },
};
