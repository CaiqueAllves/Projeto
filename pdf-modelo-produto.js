// ========================================
//  GERADOR DE PDF — GUIA DE PREENCHIMENTO (Modelo de Produtos)
//  Depende de: jsPDF (CDN) + PROD_MODELO_CAMPOS (produtos.js)
//  Mesma paleta de cores usada em pdf-pedido.js/pdf-proforma.js/pdf-processo.js.
// ========================================

function gerarPDFModeloProduto() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const W  = 297;
    const ML = 14;
    const MR = 283;
    let   Y  = 0;

    const NAVY       = [10,  40,  90];
    const AZUL       = [30,  86, 160];
    const AZUL_MED   = [59, 130, 246];
    const AZUL_CLARO = [219, 234, 254];
    const CINZA      = [100, 116, 139];
    const CINZA_BG   = [248, 250, 252];
    const BORDA      = [209, 219, 234];
    const PRETO      = [15,  23,  42];
    const BRANCO     = [255, 255, 255];
    const VERMELHO   = [220, 38, 38];

    function setFont(style, size, color) {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...(color || PRETO));
    }

    function rect(x, y, w, h, cor) {
        doc.setFillColor(...cor);
        doc.rect(x, y, w, h, 'F');
    }

    function linha(x1, y, x2, cor, espessura) {
        doc.setDrawColor(...(cor || BORDA));
        doc.setLineWidth(espessura || 0.3);
        doc.line(x1, y, x2, y);
    }

    // ── Cabeçalho ──────────────────────────────────────────────
    rect(0, 0, W, 26, NAVY);
    rect(0, 26, W, 1.2, AZUL_MED);
    setFont('bold', 15, BRANCO);
    doc.text('GUIA DE PREENCHIMENTO — IMPORTAÇÃO DE PRODUTOS', ML, 15);
    setFont('normal', 9, [160, 190, 240]);
    doc.text('Marpex · Colunas reconhecidas pelo upload em lote da tela Produtos', ML, 21);

    Y = 36;
    setFont('normal', 9.5, CINZA);
    const intro = doc.splitTextToSize(
        'Use este guia como referência ao preencher a planilha de importação (arquivo .xlsx baixado junto com este PDF). ' +
        'Cada linha abaixo corresponde a uma coluna da planilha — o nome da coluna deve ser mantido exatamente como mostrado ' +
        'em "Coluna na planilha" para o sistema reconhecer o campo automaticamente.',
        W - ML * 2
    );
    doc.text(intro, ML, Y);
    Y += intro.length * 4.2 + 6;

    // ── Tabela ─────────────────────────────────────────────────
    const HEAD = ['Coluna na planilha', 'Obrigatório', 'Tipo', 'Exemplo', 'Observação'];
    const WIDTHS = [40, 24, 20, 42, MR - ML - (40 + 24 + 20 + 42)];
    const XPOS = [ML];
    for (let i = 1; i < WIDTHS.length; i++) XPOS.push(XPOS[i - 1] + WIDTHS[i - 1]);

    function cabecalhoTabela() {
        rect(ML, Y, MR - ML, 8, AZUL_CLARO);
        setFont('bold', 8.5, AZUL);
        HEAD.forEach((h, i) => doc.text(h.toUpperCase(), XPOS[i] + 2, Y + 5.5));
        Y += 8;
    }

    cabecalhoTabela();

    function secaoHeader(nome) {
        if (Y + 7 > 195) { doc.addPage(); Y = 16; cabecalhoTabela(); }
        rect(ML, Y, MR - ML, 6.5, NAVY);
        setFont('bold', 8, BRANCO);
        doc.text(nome.toUpperCase(), ML + 2, Y + 4.6);
        Y += 6.5;
    }

    let secaoAtual = null;
    let idx = 0;
    PROD_MODELO_CAMPOS.forEach((c) => {
        if (c.secao !== secaoAtual) {
            secaoAtual = c.secao;
            idx = 0;
            secaoHeader(secaoAtual);
        }

        const exemploLinhas = doc.splitTextToSize(String(c.exemplo), WIDTHS[3] - 4);
        const obsLinhas     = doc.splitTextToSize(c.obs, WIDTHS[4] - 4);
        const maxLinhas     = Math.max(exemploLinhas.length, obsLinhas.length);
        const alturaLinha   = Math.max(9, maxLinhas * 4.2 + 3);

        if (Y + alturaLinha > 195) {
            doc.addPage();
            Y = 16;
            cabecalhoTabela();
            secaoHeader(secaoAtual);
            idx = 0;
        }

        if (idx % 2 === 0) rect(ML, Y, MR - ML, alturaLinha, CINZA_BG);
        idx++;

        setFont('bold', 9, PRETO);
        doc.text(c.coluna, XPOS[0] + 2, Y + 6);

        setFont('bold', 8.5, c.obrigatorio ? VERMELHO : CINZA);
        doc.text(c.obrigatorio ? 'Sim' : 'Não', XPOS[1] + 2, Y + 6);

        setFont('normal', 8.5, CINZA);
        doc.text(c.tipo, XPOS[2] + 2, Y + 6);

        setFont('normal', 8.5, PRETO);
        doc.text(exemploLinhas, XPOS[3] + 2, Y + 6);

        setFont('normal', 8, CINZA);
        doc.text(obsLinhas, XPOS[4] + 2, Y + 6);

        linha(ML, Y + alturaLinha, MR, BORDA, 0.2);
        Y += alturaLinha;
    });

    Y += 8;
    if (Y > 179) { doc.addPage(); Y = 16; }
    rect(ML, Y, MR - ML, 16, AZUL_CLARO);
    setFont('bold', 8.5, AZUL);
    doc.text('DICA', ML + 3, Y + 6);
    setFont('normal', 8.5, PRETO);
    doc.text('Só "SKU" e "Nome" são obrigatórios — os demais campos podem ficar em branco e assumem os padrões indicados.', ML + 20, Y + 6);
    doc.text('Cada linha da planilha (abaixo do cabeçalho) vira um produto novo ao ser enviada em "Upload" na tela Produtos.', ML + 20, Y + 11);

    // ── Rodapé ─────────────────────────────────────────────────
    const paginas = doc.internal.getNumberOfPages();
    for (let p = 1; p <= paginas; p++) {
        doc.setPage(p);
        rect(0, 202, W, 8, NAVY);
        setFont('normal', 7.5, [160, 190, 240]);
        doc.text('Marpex · Guia de Preenchimento — Modelo de Produtos', ML, 207);
        setFont('normal', 7.5, [120, 160, 220]);
        doc.text(`Página ${p} de ${paginas}`, MR, 207, { align: 'right' });
    }

    doc.save('guia-preenchimento-produtos.pdf');
}
