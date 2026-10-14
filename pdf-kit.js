// ========================================
// PDF KIT — partes comuns dos PDFs do sistema
// ========================================
// Cabeçalho e rodapé (A4 paisagem, faixa NAVY) usados por pdf-proforma.js,
// pdf-processo.js e pdf-documentos.js — antes cada um tinha a sua cópia.
// Mudou o visual aqui, muda nos três.

const PDF_CORES = {
    NAVY: [10, 40, 90], AZUL: [30, 86, 160], AZUL_MED: [59, 130, 246], AZUL_CLARO: [219, 234, 254],
    CINZA: [100, 116, 139], CINZA_BG: [248, 250, 252], BORDA: [209, 219, 234],
    PRETO: [15, 23, 42], BRANCO: [255, 255, 255], CLARO: [160, 190, 240], CLARO2: [120, 160, 220],
};

function _pdfFaixa(doc, y, altura) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...PDF_CORES.NAVY); doc.setDrawColor(...PDF_CORES.NAVY); doc.rect(0, y, W, altura, 'F');
    doc.setFillColor(...PDF_CORES.AZUL_MED); doc.setDrawColor(...PDF_CORES.AZUL_MED); doc.rect(0, y, 4, altura, 'F');
}

function _pdfTexto(doc, estilo, tamanho, cor, texto, x, y, opcoes) {
    doc.setFont('helvetica', estilo); doc.setFontSize(tamanho); doc.setTextColor(...cor);
    doc.text(texto, x, y, opcoes);
}

// Cabeçalho de 20mm: marca à esquerda (+ "Criado por"), título/número/data à direita.
// Devolve a posição Y onde o conteúdo começa.
function pdfCabecalho(doc, { titulo, numero, criadoPor, dataGeracao, ML = 14 }) {
    const W = doc.internal.pageSize.getWidth();
    _pdfFaixa(doc, 0, 20);
    _pdfTexto(doc, 'bold', 13, PDF_CORES.BRANCO, 'MARPEX', ML + 3, 8.5);
    _pdfTexto(doc, 'normal', 6.5, PDF_CORES.CLARO, 'Gestão de Comércio Exterior', ML + 3, 13);
    _pdfTexto(doc, 'normal', 6, PDF_CORES.CLARO2, 'Criado por: ' + (criadoPor || '—'), ML + 3, 17.5);
    _pdfTexto(doc, 'bold', 11, PDF_CORES.BRANCO, titulo, W - ML, 8.5, { align: 'right' });
    _pdfTexto(doc, 'normal', 8, PDF_CORES.CLARO, numero || '', W - ML, 14, { align: 'right' });
    _pdfTexto(doc, 'normal', 6, PDF_CORES.CLARO2, 'Gerado em: ' + dataGeracao, W - ML, 17.5, { align: 'right' });
    return 23;
}

// Rodapé de 20mm em todas as páginas: marca, "Página X de N" e um texto à direita.
function pdfRodape(doc, { textoDireita = '', ML = 14 } = {}) {
    const W = doc.internal.pageSize.getWidth();
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        _pdfFaixa(doc, 190, 20);
        _pdfTexto(doc, 'bold', 8, PDF_CORES.BRANCO, 'MARPEX', ML + 3, 198);
        _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, 'Gestão de Comércio Exterior', ML + 3, 205);
        _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, `Página ${p} de ${n}`, W / 2, 202, { align: 'center' });
        _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, textoDireita, W - ML, 202, { align: 'right' });
    }
}
