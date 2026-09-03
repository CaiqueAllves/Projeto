// ========================================
//  GERADOR DE PDF — PEDIDO
//  Depende de: jsPDF (carregado via CDN)
//  Template inicial — layout será refinado depois.
// ========================================

async function gerarPDFPedido(pedido) {
    try {
        await carregarJsPDFSobDemanda();
    } catch (e) { if (typeof pedAviso === 'function') pedAviso('Não foi possível carregar o gerador de PDF.', 'erro'); return; }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W  = 210;
    const ML = 14;
    const MR = 196;
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

    function setFont(style, size, color) {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...(color || PRETO));
    }

    function linha(x1, y, x2, cor, espessura) {
        doc.setDrawColor(...(cor || BORDA));
        doc.setLineWidth(espessura || 0.3);
        doc.line(x1, y, x2, y);
    }

    function rect(x, y, w, h, cor, raio) {
        doc.setFillColor(...cor);
        doc.setDrawColor(...cor);
        if (raio) doc.roundedRect(x, y, w, h, raio, raio, 'F');
        else      doc.rect(x, y, w, h, 'F');
    }

    function campo(label, valor, x, y, w) {
        setFont('bold', 7, CINZA);
        doc.text(label.toUpperCase(), x, y);
        setFont('normal', 9, PRETO);
        const linhas = doc.splitTextToSize(valor || '—', w);
        doc.text(linhas, x, y + 5);
    }

    function secHeader(titulo) {
        Y += 4;
        rect(ML, Y, W - ML * 2, 7, AZUL_CLARO);
        setFont('bold', 9, AZUL);
        doc.text(titulo.toUpperCase(), ML + 3, Y + 5);
        Y += 10;
    }

    function fmtMoeda(v, moeda) {
        return `${moeda || 'USD'} ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    }

    function fmtData(iso) {
        return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    }

    // Endereço vem como objeto (endereco/numero/complemento/bairro/cidade/
    // estado/cep/pais) buscado no cadastro do parceiro (ou da própria
    // empresa) na hora de salvar — pode ser null se a busca falhou.
    function fmtEndereco(e) {
        if (!e) return null;
        const rua = [e.endereco, e.numero].filter(Boolean).join(', ');
        return (rua + (e.complemento ? ` - ${e.complemento}` : '')) || null;
    }

    // ════════════════════════════════════════
    // CABEÇALHO
    // ════════════════════════════════════════
    rect(0, 0, W, 28, NAVY);
    rect(0, 0, 4, 28, AZUL_MED);

    setFont('bold', 18, BRANCO);
    doc.text('MARPEX', ML, 12);

    setFont('normal', 8, [160, 190, 240]);
    doc.text('Gestão de Comércio Exterior', ML, 18);

    setFont('bold', 11, BRANCO);
    doc.text('PEDIDO', W - ML, 10, { align: 'right' });

    setFont('normal', 9, [160, 190, 240]);
    doc.text(pedido.numero || 'Sem número', W - ML, 17, { align: 'right' });

    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    setFont('normal', 7, [120, 160, 220]);
    doc.text('Gerado em: ' + dataGeracao, W - ML, 24, { align: 'right' });

    Y = 34;

    // ════════════════════════════════════════
    // STATUS
    // ════════════════════════════════════════
    const statusLabel = {
        aguardando: 'Aguardando', confirmado: 'Confirmado', em_producao: 'Em produção',
        embarcado: 'Embarcado', entregue: 'Entregue', cancelado: 'Cancelado',
    }[pedido.status] || pedido.status || '—';
    const statusCor = {
        aguardando: [100, 116, 139], confirmado: [59, 130, 246], em_producao: [234, 88, 12],
        embarcado: [124, 58, 237], entregue: [34, 197, 94], cancelado: [239, 68, 68],
    }[pedido.status] || CINZA;

    rect(ML, Y, 40, 7, statusCor, 2);
    setFont('bold', 8, BRANCO);
    doc.text(statusLabel, ML + 20, Y + 5, { align: 'center' });

    setFont('normal', 8, CINZA);
    doc.text('Data de criação: ', ML + 46, Y + 5);
    setFont('bold', 8, PRETO);
    doc.text(fmtData(pedido.data_pedido), ML + 80, Y + 5);

    setFont('normal', 8, CINZA);
    doc.text('Entrega prevista: ', W - ML - 60, Y + 5);
    setFont('bold', 8, PRETO);
    doc.text(fmtData(pedido.data_entrega_prevista), W - ML - 24, Y + 5);

    Y += 12;
    linha(ML, Y, MR, BORDA, 0.3);
    Y += 4;

    // ════════════════════════════════════════
    // EMISSOR / DESTINATÁRIO
    // ════════════════════════════════════════
    const emissorLabel = pedido.emissorTipo === 'terceiro' ? 'Terceiro (Intermediário)' : 'Própria Empresa';

    secHeader(`Empresa Remetente — ${emissorLabel}`);
    campo('Empresa', pedido.remetenteNome || 'Própria empresa', ML, Y, 110);
    campo('Documento Fiscal', pedido.remetenteDocumento, ML + 120, Y, 62);
    Y += 12;
    campo('Endereço', fmtEndereco(pedido.remetenteEndereco), ML, Y, 172);
    Y += 12;
    campo('Cidade / Estado', pedido.remetenteEndereco ? [pedido.remetenteEndereco.cidade, pedido.remetenteEndereco.estado].filter(Boolean).join(' / ') : null, ML, Y, 80);
    campo('CEP', pedido.remetenteEndereco?.cep, ML + 90, Y, 40);
    campo('País', pedido.remetenteEndereco?.pais, ML + 135, Y, 47);
    Y += 14;

    secHeader('Empresa Destinatário');
    campo('Empresa', pedido.clienteNome, ML, Y, 110);
    campo('Documento Fiscal', pedido.clienteDocumento, ML + 120, Y, 62);
    Y += 12;
    campo('Endereço', fmtEndereco(pedido.clienteEndereco), ML, Y, 172);
    Y += 12;
    campo('Cidade / Estado', pedido.clienteEndereco ? [pedido.clienteEndereco.cidade, pedido.clienteEndereco.estado].filter(Boolean).join(' / ') : null, ML, Y, 80);
    campo('CEP', pedido.clienteEndereco?.cep, ML + 90, Y, 40);
    campo('País', pedido.clienteEndereco?.pais, ML + 135, Y, 47);
    Y += 14;

    // ════════════════════════════════════════
    // ITENS DO PEDIDO
    // ════════════════════════════════════════
    const itens = pedido.itens || [];
    if (itens.length > 0) {
        secHeader('Itens do Pedido');

        const PROD_W  = 74;
        const QTD_W   = 22;
        const UN_W    = 18;
        const PRECO_W = 32;
        const TOTAL_W = 36;

        const xProd  = ML;
        const xQtd   = xProd + PROD_W;
        const xUn    = xQtd  + QTD_W;
        const xPreco = xUn   + UN_W;
        const xTotal = xPreco + PRECO_W;

        function cabecalho() {
            rect(ML, Y, W - ML * 2, 8, AZUL);
            setFont('bold', 7, BRANCO);
            doc.text('PRODUTO',    xProd + 2,          Y + 5.5);
            doc.text('QTD',        xQtd + QTD_W - 2,   Y + 5.5, { align: 'right' });
            doc.text('UN',         xUn + 2,            Y + 5.5);
            doc.text('PREÇO UNIT.',xPreco + 2,         Y + 5.5);
            doc.text('TOTAL',      MR - 1,             Y + 5.5, { align: 'right' });
            Y += 9;
        }

        cabecalho();

        itens.forEach((item, i) => {
            if (Y > 265) { doc.addPage(); Y = 20; cabecalho(); }

            const linhasProd = doc.splitTextToSize(item.produto_nome || '—', PROD_W - 4);
            const altura = Math.max(linhasProd.length * 4.5, 7) + 2;

            if (i % 2 === 0) rect(ML, Y - 1, W - ML * 2, altura, CINZA_BG);

            setFont('normal', 8, PRETO);
            doc.text(linhasProd, xProd + 2, Y + 3.5);
            doc.text(String(item.quantidade ?? '—'), xQtd + QTD_W - 2, Y + 3.5, { align: 'right' });
            doc.text(item.unidade_medida || 'UN', xUn + 2, Y + 3.5);
            doc.text(Number(item.preco_unitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }), xPreco + 2, Y + 3.5);
            doc.text(fmtMoeda((item.quantidade || 0) * (item.preco_unitario || 0), pedido.moeda), MR - 1, Y + 3.5, { align: 'right' });

            Y += altura;
        });

        Y += 4;
        linha(ML, Y, MR, BORDA, 0.3);
        Y += 6;

        setFont('bold', 10, AZUL);
        doc.text('TOTAL GERAL:', xPreco, Y);
        doc.text(fmtMoeda(pedido.valor_total, pedido.moeda), MR, Y, { align: 'right' });
        Y += 10;
    }

    // ════════════════════════════════════════
    // OBSERVAÇÕES
    // ════════════════════════════════════════
    if (pedido.observacoes) {
        if (Y > 250) { doc.addPage(); Y = 20; }
        secHeader('Observações');
        setFont('normal', 9, PRETO);
        const linhasObs = doc.splitTextToSize(pedido.observacoes, W - ML * 2);
        doc.text(linhasObs, ML, Y);
        Y += linhasObs.length * 5 + 4;
    }

    // ════════════════════════════════════════
    // RODAPÉ
    // ════════════════════════════════════════
    const totalPags = doc.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        rect(0, 277, W, 20, NAVY);
        rect(0, 277, 4, 20, AZUL_MED);
        setFont('bold', 8, BRANCO);
        doc.text('MARPEX', ML + 3, 285);
        setFont('normal', 7, [160, 190, 240]);
        doc.text('Gestão de Comércio Exterior', ML + 3, 292);
        doc.text(`Página ${p} de ${totalPags}`, W / 2, 289, { align: 'center' });
        doc.text(dataGeracao, W - ML, 289, { align: 'right' });
    }

    doc.save(`pedido_${pedido.numero || 'sem-numero'}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
