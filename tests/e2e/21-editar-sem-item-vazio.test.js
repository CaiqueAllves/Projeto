// Editar Proforma / Processo não pode criar uma linha de produto em branco a
// mais (a linha inicial de "Proforma nova" corria em paralelo com o
// carregamento da edição). Repete algumas vezes porque era intermitente.
module.exports = {
    nome: 'Editar Proforma/Processo sem item vazio a mais',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            // espera a lista carregar e mais um pouco (a linha extra chegava depois)
            const aguardar = async pfx => {
                await page.waitForFunction(pfx => document.querySelectorAll(`#${pfx}-itens-body .prop-item-card`).length > 0, pfx, { timeout: 15000 }).catch(() => {});
                await page.waitForTimeout(1500);
            };
            const contar = pfx => page.evaluate(pfx => {
                const cards = [...document.querySelectorAll(`#${pfx}-itens-body .prop-item-card`)];
                return { total: cards.length, vazios: cards.filter(c => !(c.querySelector('.prop-item-input')?.value || '').trim()).length };
            }, pfx);
            for (let i = 0; i < 3; i++) {
                await h.ir(page, `formularios.html?tab=proposta&id=${ids.proforma}`, 500);
                await aguardar('prop');
                const p = await contar('prop');
                h.igual(p, { total: 1, vazios: 0 }, `Editar Proforma (tentativa ${i + 1}) com item vazio a mais`);
                await h.ir(page, `formularios.html?tab=processo&id=${ids.processos[0]}`, 500);
                await aguardar('proc');
                const q = await contar('proc');
                h.igual(q, { total: 1, vazios: 0 }, `Editar Processo (tentativa ${i + 1}) com item vazio a mais`);
            }
            await h.ir(page, 'formularios.html?tab=proposta', 3000);
            h.igual((await contar('prop')).total, 1, 'Proforma nova deveria abrir com 1 linha em branco');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
