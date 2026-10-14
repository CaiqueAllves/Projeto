// Proformas e Processos salvos ao mesmo tempo recebem números diferentes.
module.exports = {
    nome: 'Numeração sem repetição (salvamentos simultâneos)',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        const r = await page.evaluate(async () => {
            const d = { tipo: 'exportacao_direta', proposito: 'vendas', emissor_tipo: 'usuario', documento: '1', documento_tipo: 'cpf', destinatario_razao_social: 'TSTE2E NUM', itens: [] };
            const profs = await Promise.all([1, 2, 3].map(() => window.supabaseAPI.salvarProposta(d)));
            const dp = { tipo: 'exportacao_direta', proposito: 'vendas', emissor_tipo: 'usuario', status: 'aberto' };
            const procs = await Promise.all([1, 2].map(() => window.supabaseAPI.salvarProcesso(dp)));
            await supabaseClient.from('processos').delete().in('id', procs.filter(x => x.sucesso).map(x => x.data.id));
            await supabaseClient.from('proformas').delete().in('id', profs.filter(x => x.sucesso).map(x => x.data.id));
            return { profs: profs.map(x => x.sucesso ? x.data.codigo : 'ERRO ' + x.mensagem), procs: procs.map(x => x.sucesso ? x.data.numero_processo : 'ERRO ' + x.mensagem) };
        });
        h.esperar(r.profs.every(c => !c.startsWith('ERRO')), 'Falha ao salvar Proforma: ' + r.profs.join(', '));
        h.esperar(r.procs.every(c => !c.startsWith('ERRO')), 'Falha ao salvar Processo: ' + r.procs.join(', '));
        h.igual(new Set(r.profs).size, 3, 'Números de Proforma repetidos');
        h.igual(new Set(r.procs).size, 2, 'Números de Processo repetidos');
    },
};
