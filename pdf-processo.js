// ========================================
//  GERADOR DE PDF — PROCESSO DE EXPORTAÇÃO
//  Depende de: jsPDF (carregado via CDN)
//  Paisagem, mesma paleta/linguagem visual do PDF de Proforma — cobre todos
//  os campos do formulário de Processo (lê direto do DOM via document.getElementById).
// ========================================

function gerarPDFProcesso() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    const W = 297, ML = 14, MR = 283;
    let Y = 0;

    // ── Cores (mesma paleta do PDF de Proforma) ──
    const NAVY       = [10,  40,  90];
    const AZUL       = [30,  86, 160];
    const AZUL_MED   = [59, 130, 246];
    const AZUL_CLARO = [219, 234, 254];
    const CINZA      = [100, 116, 139];
    const CINZA_BG   = [248, 250, 252];
    const BORDA      = [209, 219, 234];
    const PRETO      = [15,  23,  42];
    const BRANCO     = [255, 255, 255];

    // ── Helpers ───────────────────────────
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
        setFont('bold', 6, CINZA);
        doc.text(label.toUpperCase(), x, y);
        setFont('normal', 8, PRETO);
        const v = String(valor || '—');
        doc.text(w ? doc.splitTextToSize(v, w)[0] : v, x, y + 4.2);
    }

    // Ponto de quebra de página — deixa 20mm de folga pro rodapé (que fica
    // fixo em y=190 numa página A4 paisagem de 210mm de altura).
    function pg(h) { if (Y + h > 183) { doc.addPage(); Y = 20; } }

    function secHeader(titulo) {
        pg(11);
        Y += 4;
        rect(ML, Y, W - ML * 2, 7, AZUL_CLARO);
        setFont('bold', 8, AZUL);
        doc.text(titulo.toUpperCase(), ML + 3, Y + 5);
        Y += 10;
    }

    function val(id) {
        const el = document.getElementById(id);
        if (!el) return '—';
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '—';
        return el.value?.trim() || '—';
    }

    function raw(id) {
        const el = document.getElementById(id);
        return el ? (el.value || '').trim() : '';
    }

    function fmtData(iso) {
        return iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    }

    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const codigo = val('proc-codigo');

    // ════════════════════════════════════════
    // CABEÇALHO
    // ════════════════════════════════════════
    rect(0, 0, W, 20, NAVY);
    rect(0, 0, 4, 20, AZUL_MED);
    setFont('bold', 13, BRANCO); doc.text('MARPEX', ML + 3, 8.5);
    setFont('normal', 6.5, [160, 190, 240]); doc.text('Gestão de Comércio Exterior', ML + 3, 14);
    setFont('bold', 11, BRANCO); doc.text('PROCESSO DE EXPORTAÇÃO', W - ML, 8.5, { align: 'right' });
    setFont('normal', 8, [160, 190, 240]); doc.text(codigo !== '—' ? codigo : 'Sem código', W - ML, 14, { align: 'right' });
    setFont('normal', 6, [120, 160, 220]); doc.text('Gerado em: ' + dataGeracao, W - ML, 17.5, { align: 'right' });
    Y = 23;

    // ════════════════════════════════════════
    // BARRA INFO (6 campos)
    // ════════════════════════════════════════
    const statusTxt = val('proc-status');
    const tipoTxt    = val('proc-tipo');
    const propositoTxt = val('proc-proposito');
    const incotermTxt  = val('proc-incoterm');
    const modalTxt      = val('proc-modal');

    doc.setFillColor(...CINZA_BG); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.rect(ML, Y, W - ML * 2, 10, 'FD');
    const cw6 = (W - ML * 2) / 6;
    for (let i = 1; i <= 5; i++) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.2); doc.line(ML + cw6 * i, Y + 1.5, ML + cw6 * i, Y + 8.5); }
    [
        { label: 'Status', valor: statusTxt },
        { label: 'Tipo', valor: tipoTxt },
        { label: 'Propósito', valor: propositoTxt },
        { label: 'Incoterm', valor: incotermTxt },
        { label: 'Modal', valor: modalTxt },
        { label: 'Abertura', valor: fmtData(raw('proc-data-abertura')) },
    ].forEach((info, i) => {
        const cx = ML + cw6 * i + cw6 / 2;
        setFont('bold', 5.5, CINZA); doc.text(info.label.toUpperCase(), cx, Y + 4, { align: 'center' });
        setFont('bold', 7, AZUL); doc.text(doc.splitTextToSize(info.valor, cw6 - 4)[0], cx, Y + 8.5, { align: 'center' });
    });
    Y += 14;

    // ════════════════════════════════════════
    // EMISSOR | EMPRESA DE DESTINO
    // ════════════════════════════════════════
    const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value || 'usuario';
    const emissorNome = emissorTipo === 'usuario'
        ? (val('proc-emissor-pedido-remetente') !== '—' ? val('proc-emissor-pedido-remetente') : (window._usuarioLogado?.nome || 'Usuário'))
        : val('proc-cliente');
    const emissorLabel = emissorTipo === 'usuario' ? 'Usuário (Própria Empresa)' : 'Terceiro (Intermediário)';

    const colW2 = (W - ML * 2 - 6) / 2;
    const col1 = ML, col2 = ML + colW2 + 6;
    const bandHdr = 7;

    function bandRow(label, valor, cx, y, w) {
        setFont('bold', 5.5, CINZA); doc.text(label.toUpperCase() + ':', cx + 2, y + 3.2);
        setFont('normal', 6, PRETO); doc.text(doc.splitTextToSize(String(valor || '—'), w - 30)[0], cx + 30, y + 3.2);
    }

    pg(38);
    const bY1 = Y;
    [[col1, 'EMISSOR'], [col2, 'EMPRESA DE DESTINO']].forEach(([cx, titulo]) => {
        doc.setFillColor(...BRANCO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.rect(cx, bY1, colW2, 34, 'FD');
        rect(cx, bY1, colW2, bandHdr, NAVY); rect(cx, bY1, 3, bandHdr, AZUL_MED);
        setFont('bold', 6.5, BRANCO); doc.text(titulo, cx + colW2 / 2, bY1 + 4.8, { align: 'center' });
    });

    bandRow('Emissor', emissorNome, col1, bY1 + bandHdr + 0, colW2);
    bandRow('Tipo', emissorLabel, col1, bY1 + bandHdr + 5, colW2);
    bandRow('Identificação', val('proc-documento-tipo') !== '—' ? val('proc-documento-tipo') : '—', col1, bY1 + bandHdr + 10, colW2);
    bandRow('Documento', val('proc-documento'), col1, bY1 + bandHdr + 15, colW2);
    bandRow('Propósito', propositoTxt, col1, bY1 + bandHdr + 20, colW2);

    bandRow('Destinatário', val('proc-emp-dest-busca'), col2, bY1 + bandHdr + 0, colW2);
    bandRow('Documento', val('proc-emp-dest-auto-doc'), col2, bY1 + bandHdr + 5, colW2);
    bandRow('Código Interno', val('proc-emp-dest-auto-id'), col2, bY1 + bandHdr + 10, colW2);
    bandRow('Responsável', val('proc-destino-responsavel'), col2, bY1 + bandHdr + 15, colW2);
    bandRow('Contato', [val('proc-destino-responsavel-contato'), val('proc-destino-responsavel-email')].filter(v => v !== '—').join(' / ') || '—', col2, bY1 + bandHdr + 20, colW2);

    Y = bY1 + 38;

    // ════════════════════════════════════════
    // ORIGEM | DESTINO (endereço completo + dados do modal)
    // ════════════════════════════════════════
    const modalVal = raw('proc-modal');
    const modalRotaOrigem = modalVal === 'maritimo' ? ['Navio', val('proc-navio')]
        : modalVal === 'aereo' ? ['Aeronave', val('proc-aeronave')]
        : modalVal === 'terrestre' ? ['Fronteira de Saída', val('proc-fronteira-saida')]
        : null;
    const modalPontoOrigem = modalVal === 'maritimo' ? ['Porto de Origem', val('proc-porto-origem')]
        : modalVal === 'aereo' ? ['Aeroporto de Origem', val('proc-aeroporto-origem')]
        : null;
    const modalPontoDestino = modalVal === 'maritimo' ? ['Porto de Destino', val('proc-porto-destino')]
        : modalVal === 'aereo' ? ['Aeroporto de Destino', val('proc-aeroporto-destino')]
        : modalVal === 'terrestre' ? ['Fronteira de Entrada', val('proc-fronteira-entrada')]
        : null;

    const enderecoLinha = (endereco, numero, complemento) => {
        const rua = [endereco, numero].filter(v => v && v !== '—').join(', ');
        return (rua + (complemento && complemento !== '—' ? ` - ${complemento}` : '')) || null;
    };

    const origemRows = [
        ['País', val('proc-origem-pais')],
        ['Endereço', enderecoLinha(val('proc-origem-endereco'), val('proc-origem-numero'), val('proc-origem-complemento'))],
        ['Bairro', val('proc-origem-bairro')],
        ['Cidade / Estado', [val('proc-origem-cidade'), val('proc-origem-estado')].filter(v => v !== '—').join(' / ') || '—'],
        ['CEP', val('proc-origem-cep')],
    ];
    if (modalRotaOrigem)  origemRows.push(modalRotaOrigem);
    if (modalPontoOrigem) origemRows.push(modalPontoOrigem);

    const destinoRows = [
        ['País', val('proc-destino-pais')],
        ['Endereço', enderecoLinha(val('proc-destino-endereco'), val('proc-destino-numero'), val('proc-destino-complemento'))],
        ['Bairro', val('proc-destino-bairro')],
        ['Cidade / Estado', [val('proc-destino-cidade'), val('proc-destino-estado')].filter(v => v !== '—').join(' / ') || '—'],
        ['CEP', val('proc-destino-cep')],
    ];
    if (modalPontoDestino) destinoRows.push(modalPontoDestino);

    const maxRows = Math.max(origemRows.length, destinoRows.length);
    const bandH2 = bandHdr + maxRows * 5 + 2;
    pg(bandH2 + 4);
    const bY2 = Y;
    [[col1, 'ORIGEM'], [col2, 'DESTINO']].forEach(([cx, titulo]) => {
        doc.setFillColor(...BRANCO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.rect(cx, bY2, colW2, bandH2, 'FD');
        rect(cx, bY2, colW2, bandHdr, NAVY); rect(cx, bY2, 3, bandHdr, AZUL_MED);
        setFont('bold', 6.5, BRANCO); doc.text(titulo, cx + colW2 / 2, bY2 + 4.8, { align: 'center' });
    });
    origemRows.forEach(([l, v], i) => bandRow(l, v, col1, bY2 + bandHdr + i * 5, colW2));
    destinoRows.forEach(([l, v], i) => bandRow(l, v, col2, bY2 + bandHdr + i * 5, colW2));
    Y = bY2 + bandH2 + 4;

    // Intermediários de rota (portos/aeroportos/fronteiras extras) — só se houver
    if (Array.isArray(window._intermediarios) && window._intermediarios.some(i => i.valor?.trim())) {
        const nomes = { porto: 'Porto', aeroporto: 'Aeroporto', fronteira: 'Fronteira' };
        const txt = window._intermediarios.filter(i => i.valor?.trim()).map(i => `${nomes[i.tipo] || i.tipo}: ${i.valor}`).join('  •  ');
        pg(8);
        campo('Intermediários de Rota', txt, ML, Y, W - ML * 2);
        Y += 8;
    }

    // ════════════════════════════════════════
    // ENDEREÇO DE COLETA (se preenchido e diferente da origem)
    // ════════════════════════════════════════
    const coletaMesmo = document.getElementById('proc-origem-coleta-mesmo')?.checked;
    const coletaCampos = ['proc-origem-coleta-cep', 'proc-origem-coleta-estado', 'proc-origem-coleta-cidade', 'proc-origem-coleta-bairro', 'proc-origem-coleta-endereco'];
    const temColeta = !coletaMesmo && coletaCampos.some(id => val(id) !== '—');
    if (temColeta) {
        secHeader('Endereço de Coleta');
        campo('Endereço', enderecoLinha(val('proc-origem-coleta-endereco'), val('proc-origem-coleta-numero'), val('proc-origem-coleta-complemento')), ML, Y, 90);
        campo('Bairro', val('proc-origem-coleta-bairro'), ML + 95, Y, 45);
        campo('Cidade / Estado', [val('proc-origem-coleta-cidade'), val('proc-origem-coleta-estado')].filter(v => v !== '—').join(' / ') || '—', ML + 145, Y, 45);
        campo('CEP', val('proc-origem-coleta-cep'), ML + 195, Y, 35);
        Y += 12;
        campo('Horário de Coleta', val('proc-origem-coleta-horario'), ML, Y, 60);
        campo('Horário de Intervalo', val('proc-origem-coleta-intervalo'), ML + 65, Y, 60);
        Y += 14;
    }

    // ════════════════════════════════════════
    // DATAS & CONTAINER
    // ════════════════════════════════════════
    secHeader('Datas & Container');
    campo('Data de Abertura', fmtData(raw('proc-data-abertura')), ML, Y, 42);
    campo('Data de Embarque', fmtData(raw('proc-data-embarque')), ML + 46, Y, 42);
    campo('Data de Chegada', fmtData(raw('proc-data-chegada')), ML + 92, Y, 42);
    campo('Data de Cancelamento', fmtData(raw('proc-data-cancelamento')), ML + 138, Y, 45);
    campo('Container', val('proc-container-tipo'), ML + 187, Y, 30);
    campo('Nº do Container', val('proc-container-num'), ML + 221, Y, 62);
    Y += 14;

    // ════════════════════════════════════════
    // TRANSPORTADORA
    // ════════════════════════════════════════
    const transpCampos = ['transp-razao', 'transp-cnpj', 'transp-placa', 'transp-motorista', 'transp-frete-valor', 'transp-seguro'];
    if (transpCampos.some(id => val(id) !== '—')) {
        secHeader('Transportadora');
        campo('Contratação', val('transp-tipo'), ML, Y, 42);
        campo('Razão Social', val('transp-razao'), ML + 46, Y, 60);
        campo('Documento Fiscal', val('transp-cnpj'), ML + 110, Y, 45);
        campo('Nº de Coleta', val('transp-num-coleta'), ML + 159, Y, 45);
        campo('Tipo de Veículo', val('transp-tipo-veiculo'), ML + 208, Y, 75);
        Y += 12;
        campo('Placa', val('transp-placa'), ML, Y, 30);
        campo('Motorista', val('transp-motorista'), ML + 34, Y, 55);
        campo('CNH do Motorista', val('transp-motorista-cnh'), ML + 93, Y, 40);
        campo('Contato do Motorista', val('transp-motorista-contato'), ML + 137, Y, 50);
        Y += 12;
        campo('Data de Coleta', fmtData(raw('transp-data-coleta')), ML, Y, 40);
        campo('Entrega Prevista', fmtData(raw('transp-data-entrega')), ML + 44, Y, 40);
        const freteMoeda = val('transp-frete-moeda-display');
        const freteValor = val('transp-frete-valor');
        const freteTxt = freteValor !== '—' ? `${freteMoeda !== '—' ? freteMoeda + ' ' : ''}${freteValor}` : '—';
        campo('Valor do Frete', freteTxt, ML + 88, Y, 45);
        campo('Incoterm do Frete', val('transp-frete-incoterm'), ML + 137, Y, 30);
        campo('Seguro', val('transp-seguro'), ML + 171, Y, 112);
        Y += 12;
        if (val('transp-obs') !== '—') {
            const ls = doc.splitTextToSize(val('transp-obs'), W - ML * 2 - 6);
            pg(ls.length * 4.5 + 6);
            setFont('bold', 6, CINZA); doc.text('OBSERVAÇÕES DE TRANSPORTE', ML, Y);
            Y += 4;
            setFont('normal', 7.5, PRETO); doc.text(ls, ML, Y);
            Y += ls.length * 4.5 + 4;
        }
        Y += 2;
    }

    // ════════════════════════════════════════
    // ETAPAS DO PROCESSO
    // ════════════════════════════════════════
    const etapas = Array.isArray(window._etapas) ? window._etapas : [];
    if (etapas.length > 0) {
        secHeader('Etapas do Processo');
        const cFeitoW = 18, cDataW = 30, cRespW = 60;
        const cNomeW = W - ML * 2 - cFeitoW - cDataW - cRespW;
        const xFeito = ML, xNome = xFeito + cFeitoW, xData = xNome + cNomeW, xResp = xData + cDataW;

        rect(ML, Y, W - ML * 2, 7, AZUL);
        setFont('bold', 6, BRANCO);
        doc.text('FEITO', xFeito + cFeitoW / 2, Y + 4.8, { align: 'center' });
        doc.text('ETAPA', xNome + 2, Y + 4.8);
        doc.text('DATA', xData + 2, Y + 4.8);
        doc.text('RESPONSÁVEL', xResp + 2, Y + 4.8);
        Y += 7;

        etapas.forEach((e, i) => {
            pg(8);
            const rowH = 7;
            if (i % 2 === 0) rect(ML, Y, W - ML * 2, rowH, CINZA_BG);
            setFont('bold', 8, e.concluida ? [34, 197, 94] : CINZA);
            doc.text(e.concluida ? 'SIM' : '—', xFeito + cFeitoW / 2, Y + 4.8, { align: 'center' });
            setFont('normal', 7.5, PRETO);
            doc.text(doc.splitTextToSize(e.nome || '—', cNomeW - 4)[0], xNome + 2, Y + 4.8);
            doc.text(fmtData(e.data), xData + 2, Y + 4.8);
            doc.text(doc.splitTextToSize(e.responsavel || '—', cRespW - 4)[0], xResp + 2, Y + 4.8);
            Y += rowH;
        });
        Y += 6;
    }

    // ════════════════════════════════════════
    // NUMERAÇÃO DE DOCUMENTOS
    // ════════════════════════════════════════
    const docsIds = [
        { id: 'doc-num-proforma',   label: 'Proforma Invoice' },
        { id: 'doc-num-commercial', label: 'Commercial Invoice' },
        { id: 'doc-num-packing',    label: 'Packing List' },
        { id: 'doc-num-due',        label: 'DUE' },
        { id: 'doc-num-le',         label: 'LE' },
        { id: 'doc-num-certorigem', label: 'Certificado de Origem' },
        { id: 'doc-num-ctn',        label: 'CTN' },
        { id: 'doc-num-nfe',        label: 'NF de Exportação' },
        { id: 'doc-num-awb',        label: 'AWB' },
        { id: 'doc-num-manifesto',  label: 'Manifesto de Carga' },
        { id: 'doc-num-fcl',        label: 'FCL' },
        { id: 'doc-num-lcl',        label: 'LCL' },
        { id: 'doc-num-bl',         label: 'BL — Bill of Lading' },
        { id: 'doc-num-apolice',    label: 'Apólice de Seguro' },
        { id: 'doc-num-crt',        label: 'CRT' },
        { id: 'doc-num-micdta',     label: 'MIC/DTA — TIF' },
    ];
    const docsPreenchidos = docsIds.filter(d => (document.getElementById(d.id)?.value || '').trim());

    if (docsPreenchidos.length > 0) {
        secHeader('Numeração de Documentos');
        const cols = 4;
        const colW = (W - ML * 2) / cols;
        docsPreenchidos.forEach((d, i) => {
            const col = i % cols, row = Math.floor(i / cols);
            const x = ML + col * colW, yy = Y + row * 12;
            pg(12);
            campo(d.label, document.getElementById(d.id).value.trim(), x, yy, colW - 4);
        });
        Y += Math.ceil(docsPreenchidos.length / cols) * 12 + 4;
    }

    // ════════════════════════════════════════
    // OBSERVAÇÕES
    // ════════════════════════════════════════
    const obsGerais = val('proc-observacoes');
    const obsPrazos = val('proc-obs-prazos');
    if (obsGerais !== '—' || obsPrazos !== '—') {
        secHeader('Observações');
        [[obsGerais, 'Observações Gerais'], [obsPrazos, 'Observações de Prazos e Status']].forEach(([txt, tit]) => {
            if (txt === '—') return;
            const ls = doc.splitTextToSize(txt, W - ML * 2 - 6);
            pg(ls.length * 4.5 + 8);
            setFont('bold', 6.5, CINZA); doc.text(tit.toUpperCase(), ML + 3, Y);
            Y += 4;
            setFont('normal', 8, PRETO); doc.text(ls, ML + 3, Y);
            Y += ls.length * 4.5 + 4;
        });
    }

    // ════════════════════════════════════════
    // RODAPÉ
    // ════════════════════════════════════════
    const totalPags = doc.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        rect(0, 190, W, 20, NAVY);
        rect(0, 190, 4, 20, AZUL_MED);
        setFont('bold', 8, BRANCO); doc.text('MARPEX', ML + 3, 198);
        setFont('normal', 7, [160, 190, 240]); doc.text('Gestão de Comércio Exterior', ML + 3, 205);
        setFont('normal', 7, [160, 190, 240]); doc.text(`Página ${p} de ${totalPags}`, W / 2, 202, { align: 'center' });
        setFont('normal', 7, [160, 190, 240]); doc.text(dataGeracao, W - ML, 202, { align: 'right' });
    }

    // ── Salvar ────────────────────────────
    const nomeArq = `processo_${codigo !== '—' ? codigo : 'sem-codigo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeArq);
}
