// Transporte: obrigatórios, transportadoras cadastradas e "Própria do Cliente".
module.exports = {
    nome: 'Transporte: obrigatórios e transportadoras',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page);
            await h.ir(page, 'formularios.html?tab=processo', 4000);
            await page.evaluate(() => {
                document.getElementById('proc-tipo').value = 'exportacao_direta';
                document.getElementById('proc-emissor-usuario').checked = true;
                document.getElementById('modal-confirmar-salvar').style.display = 'none';
                const sec = document.getElementById('transp-tipo').closest('.form-section');
                if (!sec.classList.contains('active')) sec.querySelector('.section-title').click();
                window.__notas = []; const o = window.mostrarNotificacao; window.mostrarNotificacao = (m, t) => { window.__notas.push(m); o(m, t); };
                salvarProcesso(new Event('submit'));
            });
            await page.waitForTimeout(1200);
            const nota = await page.evaluate(() => window.__notas[0] || '');
            h.esperar(/transportadora|Razão Social/i.test(nota), 'Salvou sem os campos obrigatórios do Transporte: ' + nota);
            // autocomplete: busca pela transportadora cadastrada e preenche o documento
            await page.fill('#transp-razao', ids.marca.slice(0, 10)); await page.waitForTimeout(900);
            await page.dispatchEvent('#transp-nome-lista .autocomplete-item', 'mousedown');
            h.igual(await page.inputValue('#transp-cnpj'), '33.333.333/0001-33', 'Documento da transportadora não preenchido');
            // máscara contábil
            await page.fill('#transp-frete-valor', ''); await page.type('#transp-frete-valor', '550000');
            h.igual(await page.inputValue('#transp-frete-valor'), '5.500,00', 'Máscara do frete');
            // Própria do Cliente usa o Importador
            await page.evaluate(() => { document.getElementById('proc-emp-dest-busca').value = 'IMP X'; document.getElementById('proc-emp-dest-auto-doc').value = '22.222.222/0001-22'; });
            await page.selectOption('#transp-tipo', 'propria'); await page.waitForTimeout(300);
            h.igual(await page.inputValue('#transp-razao'), 'IMP X', '"Própria do Cliente" não usou o Importador');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
