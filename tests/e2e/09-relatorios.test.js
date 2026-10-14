// Relatórios: cards por aba, "Mostrar mais" e PDF agrupado.
module.exports = {
    nome: 'Relatórios: cards e PDF por Exportador',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            await h.ir(page, 'relatorios.html?semabas=1', 3500);
            const cards = await page.$$eval('#rel-sec-empresas .report-card', e => e.length);
            h.igual(cards, 9, 'Aba Empresas deveria ter 9 cards');
            const visiveis = await page.$$eval('#rel-sec-empresas .report-card', e => e.filter(x => x.offsetParent).length);
            h.igual(visiveis, 5, '"Mostrar mais" deveria deixar só 5 visíveis');
            await page.evaluate(() => { window.__pdf = ''; window.open = () => ({ document: { write: x => { window.__pdf += x; }, close() {} } }); });
            await page.click('.rel-modulo-tab[data-modulo="proformas"]');
            await page.click(`#rel-sec-proformas .report-card button[onclick="gerarRelatorio('prof-exportador')"]`);
            await page.waitForTimeout(600);
            await page.click('.rel-btn-pdf'); await page.waitForTimeout(400);
            const pdf = await page.evaluate(() => window.__pdf);
            h.esperar(pdf.includes(`${ids.marca} EXPORTADORA`), 'Relatório por Exportador sem o exportador de teste');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
