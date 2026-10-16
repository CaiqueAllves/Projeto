// Logo do Exportador e conta bancária escolhida na Proforma: cadastro de
// empresa mostra logo + contas; a Proforma lista as contas do Exportador e
// guarda a cópia dos dados; o PDF sai com o logo e o bloco de dados bancários.
module.exports = {
    nome: 'Logo e contas bancárias no cadastro, Proforma e PDF',
    async executar({ page, h }) {
        await h.ir(page, 'proforma.html?semabas=1', 2500);
        const existe = await page.evaluate(async () => !(await supabaseClient.from('contas_bancarias').select('id').limit(1)).error);
        if (!existe) h.pular('database-logo-marcas-contas-bancarias.sql ainda não foi rodado');
        let ids;
        try {
            ids = await h.criarDados(page);
            // logo (PNG gerado) + 2 contas para o Exportador
            await page.evaluate(async (ids) => {
                const c = document.createElement('canvas'); c.width = 200; c.height = 80;
                const x = c.getContext('2d'); x.fillStyle = '#0f766e'; x.fillRect(0, 0, 200, 80);
                const blob = await new Promise(r => c.toBlob(r, 'image/png'));
                const up = await window.supabaseAPI.enviarImagemLogo(new File([blob], 'logo.png', { type: 'image/png' }), 'logo');
                await supabaseClient.from('parceiros').update({ logo_url: up.url }).eq('id', ids.exp);
                await window.supabaseAPI.salvarContasBancarias(ids.exp, [
                    { apelido: 'Conta USD', banco: 'Banco Teste SA', agencia: '1234', conta: '99887-6', swift: 'TESTBRSPXXX', moeda: 'USD' },
                    { apelido: 'Conta EUR', banco: 'Banco Euro', iban: 'DE89370400440532013000', moeda: 'EUR' },
                ]);
            }, ids);

            // cadastro da empresa: logo e contas carregadas na edição
            await h.ir(page, `formularios.html?tab=empresa&empresa_id=${ids.exp}`, 5000);
            const emp = await page.evaluate(() => ({
                logo: !!document.querySelector('#logo-preview-emp img'),
                banco: document.getElementById('fin-rec-banco')?.value,
                extras: document.querySelectorAll('#emp-contas-extra .conta-bancaria-item').length,
            }));
            h.esperar(emp.logo, 'Logo não aparece no cadastro da empresa');
            h.igual(emp.banco, 'Banco Teste SA', 'Conta principal não carregou');
            h.igual(emp.extras, 1, 'Conta extra não carregou');

            // Proforma: seletor com as contas do Exportador; salvar guarda a cópia
            await h.ir(page, `formularios.html?tab=proposta&id=${ids.proforma}`, 5000);
            const opcoes = await page.$$eval('#prop-conta-bancaria option', os => os.map(o => o.textContent));
            h.esperar(opcoes.some(t => t.includes('Conta USD')) && opcoes.some(t => t.includes('Conta EUR')), 'Seletor sem as contas do Exportador');
            const dados = await page.evaluate(async (id) => {
                const sel = document.getElementById('prop-conta-bancaria');
                sel.value = [...sel.options].find(o => o.textContent.includes('Conta USD')).value;
                const d = _coletarDadosProposta();
                await supabaseClient.from('proformas').update({ conta_bancaria_id: d.conta_bancaria_id, dados_bancarios: d.dados_bancarios }).eq('id', id);
                return d.dados_bancarios;
            }, ids.proforma);
            h.igual(dados?.swift, 'TESTBRSPXXX', 'Cópia dos dados bancários não foi montada');

            const pdf = await h.textoPdfDoBlob(page, `(async()=>{const {data}=await supabaseClient.from('proformas').select('*').eq('id','${ids.proforma}').single();return gerarPDFProformaDados(data,{retornarBlob:true});})()`);
            for (const s of ['DADOS BANC', 'Banco Teste SA', 'TESTBRSPXXX', '/Subtype /Image']) h.esperar(pdf.includes(s), `PDF sem "${s}"`);
            h.semErrosJS(page);
        } finally {
            await page.evaluate(async (exp) => supabaseClient.from('contas_bancarias').delete().eq('parceiro_id', exp), ids?.exp).catch(() => {});
            await h.limparDados(page, ids);
        }
    },
};
