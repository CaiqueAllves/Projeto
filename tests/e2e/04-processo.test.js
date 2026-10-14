// Processo: preenchimento vindo da Proforma, saldo (embarque parcial) e PDF.
module.exports = {
    nome: 'Processo: preenchimento, saldo e PDF',
    async executar({ page, h }) {
        await h.ir(page, 'inicio.html?semabas=1', 1500);
        let ids;
        try {
            ids = await h.criarDados(page, { processos: 1 });
            // novo processo a partir da Proforma: documentos preenchidos e saldo restante (100 - 50)
            await h.ir(page, 'formularios.html?tab=processo&proforma_id=' + ids.proforma, 5000);
            const f = await page.evaluate(() => ({
                expDoc: document.getElementById('proc-documento').value,
                impDoc: document.getElementById('proc-emp-dest-auto-doc').value,
                impCod: document.getElementById('proc-emp-dest-auto-id').value,
                qtd: _procItens.map(i => i.qtd),
            }));
            h.igual(f.expDoc, '11.111.111/0001-11', 'Documento do Exportador não preenchido');
            h.igual(f.impDoc, '22.222.222/0001-22', 'Documento do Importador não preenchido');
            h.esperar(f.impCod.startsWith('IMP-'), 'Código Interno do Importador não preenchido');
            h.igual(f.qtd, [50], 'Saldo da Proforma errado no novo processo');
            // passar do saldo bloqueia sem salvar
            await page.fill('#proc-item-card-0 .prop-item-field--qtd input', '60');
            await page.evaluate(() => {
                document.getElementById('modal-confirmar-salvar').style.display = 'none';
                document.getElementById('proc-tipo').value = 'exportacao_direta';
                document.getElementById('proc-emissor-terceiro').checked = true;
                window.__bloqueado = false;
            });
            // transporte obrigatório vem antes do saldo — preenche o mínimo
            await page.evaluate((imp) => {
                const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
                set('transp-tipo', 'solicitada'); set('transp-razao', 'X'); set('transp-cnpj', '33.333.333/0001-33'); set('transp-tipo-veiculo', 'caminhao_bau');
                set('transp-data-coleta', '2026-10-20'); set('transp-data-entrega', '2026-10-25'); set('transp-frete-moeda', 'REAL'); set('transp-frete-moeda-display', 'REAL'); set('transp-frete-valor', '1.000,00');
                salvarProcesso(new Event('submit'));
            });
            await page.waitForTimeout(2000);
            const bloq = await page.evaluate(() => ({ aviso: document.querySelector('.confirmar-titulo')?.textContent || '', modal: document.getElementById('modal-confirmar-salvar').style.display }));
            h.igual(bloq.aviso, 'Quantidade acima do saldo', 'Não bloqueou quantidade acima do saldo');
            h.esperar(bloq.modal !== 'flex', 'Abriu a confirmação de salvar mesmo acima do saldo');
            await page.click('.confirmar-btn:not(.confirmar-btn--cancelar)').catch(() => {});

            // PDF do processo existente: número, produtos, sem "Selecione", sem Container no Terrestre
            await h.ir(page, 'formularios.html?tab=processo&id=' + ids.processos[0], 5000);
            const pdf = await page.evaluate(() => {
                let out = ''; const o = window.jspdf.jsPDF.API.save; window.jspdf.jsPDF.API.save = function () { out = this.output(); };
                gerarPDFProcesso(); window.jspdf.jsPDF.API.save = o; return out;
            });
            h.esperar(pdf.includes(ids.marca + 'P1'), 'PDF do Processo sem o número do processo');
            h.esperar(pdf.includes('PRODUTOS DO PROCESSO'), 'PDF do Processo sem a seção de produtos');
            h.esperar(!pdf.includes('Selecione'), 'PDF do Processo com "Selecione..."');
            h.esperar(!pdf.includes('CONTAINER'), 'PDF do Processo terrestre mostrando Container');
            h.semErrosJS(page);
        } finally { await h.limparDados(page, ids); }
    },
};
