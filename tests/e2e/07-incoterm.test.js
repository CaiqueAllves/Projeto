// Incoterm exclusivo Marítimo é recusado em outro modal.
module.exports = {
    nome: 'Incoterm marítimo recusado em outro modal',
    async executar({ page, h }) {
        for (const pf of ['prop', 'proc']) {
            await h.ir(page, 'formularios.html?tab=' + (pf === 'prop' ? 'proposta' : 'processo'), 3500);
            await page.evaluate((pf) => {
                const m = document.getElementById(pf + '-modal'); m.value = 'terrestre';
                const i = document.getElementById(pf + '-incoterm'); i.disabled = false; [...i.options].forEach(o => o.disabled = false);
                const idx = [...i.options].findIndex(o => o.value === 'FOB'); i.selectedIndex = idx - 1;
            }, pf);
            await page.focus(`#${pf}-incoterm`); await page.keyboard.press('ArrowDown');
            await page.waitForSelector('.confirmar-overlay', { timeout: 5000 });
            h.igual(await page.textContent('.confirmar-titulo'), 'Incoterm não permitido', `${pf}: FOB com Terrestre não foi recusado`);
            await page.click('.confirmar-btn:not(.confirmar-btn--cancelar)');
            await page.waitForTimeout(300);
            h.esperar((await page.inputValue(`#${pf}-incoterm`)) !== 'FOB', `${pf}: FOB ficou selecionado`);
        }
        h.semErrosJS(page);
    },
};
