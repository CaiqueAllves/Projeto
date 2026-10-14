// Formulário do Processo no celular: seções recolhidas, atalhos e validação abrindo a seção.
module.exports = {
    nome: 'Formulários no celular',
    mobile: true,
    async executar({ page, h }) {
        await h.ir(page, 'formularios.html?tab=processo', 4500);
        const st = () => page.evaluate(() => ({
            abertas: document.querySelectorAll('.tab-content.active .form-section.active').length,
            chips: document.querySelectorAll('.fm-chip').length,
            largura: document.documentElement.scrollWidth,
        }));
        const ini = await st();
        h.igual(ini.abertas, 1, 'Deveria começar só com 1 seção aberta');
        h.esperar(ini.chips >= 5, 'Barra de atalhos das seções não apareceu');
        h.igual(ini.largura, 390, 'Página mais larga que a tela');
        await page.click('.fm-chip[data-i="2"]'); await page.waitForTimeout(400);
        h.igual((await st()).abertas, 1, 'Abrir pelo atalho deveria fechar as outras');
        await page.evaluate(() => { document.getElementById('proc-tipo').value = 'exportacao_direta'; document.getElementById('proc-emissor-usuario').checked = true; salvarProcesso(new Event('submit')); });
        await page.waitForTimeout(1200);
        const aberta = await page.evaluate(() => document.querySelector('.tab-content.active .form-section.active .section-title')?.textContent.trim());
        h.esperar(/Transporte/.test(aberta || ''), 'Validação não abriu a seção Transporte: ' + aberta);
        h.semErrosJS(page);
    },
};
