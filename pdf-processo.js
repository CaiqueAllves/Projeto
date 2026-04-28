// ========================================
//  GERADOR DE PDF — PROCESSO DE EXPORTAÇÃO
//  Depende de: jsPDF (carregado via CDN)
// ========================================

function gerarPDFProcesso() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W  = 210;   // largura A4
    const ML = 14;    // margem esquerda
    const MR = 196;   // margem direita
    let   Y  = 0;     // cursor vertical

    // ── Cores ─────────────────────────────
    const AZUL      = [30,  86, 160];
    const AZUL_CLARO= [235, 242, 255];
    const CINZA     = [100, 116, 139];
    const CINZA_BG  = [248, 250, 252];
    const BORDA     = [226, 232, 240];
    const PRETO     = [15,  23,  42];

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
        setFont('bold', 7, CINZA);
        doc.text(label.toUpperCase(), x, y);
        setFont('normal', 9, PRETO);
        doc.text(valor || '—', x, y + 5);
    }

    function secHeader(titulo, icone) {
        Y += 4;
        rect(ML, Y, W - ML * 2, 7, AZUL_CLARO);
        setFont('bold', 9, AZUL);
        doc.text((icone ? icone + '  ' : '') + titulo.toUpperCase(), ML + 3, Y + 5);
        Y += 10;
    }

    function val(id) {
        const el = document.getElementById(id);
        if (!el) return '—';
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '—';
        return el.value?.trim() || '—';
    }

    // ════════════════════════════════════════
    // CABEÇALHO
    // ════════════════════════════════════════
    rect(0, 0, W, 28, AZUL);

    setFont('bold', 18, [255, 255, 255]);
    doc.text('MARPEX', ML, 12);

    setFont('normal', 8, [200, 220, 255]);
    doc.text('Gestão de Comércio Exterior', ML, 18);

    setFont('bold', 11, [255, 255, 255]);
    doc.text('PROCESSO DE EXPORTAÇÃO', W - ML, 10, { align: 'right' });

    const codigo = val('proc-codigo');
    setFont('normal', 9, [200, 220, 255]);
    doc.text(codigo !== '—' ? codigo : 'Sem código', W - ML, 17, { align: 'right' });

    const dataGeracao = new Date().toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' });
    setFont('normal', 7, [180, 200, 240]);
    doc.text('Gerado em: ' + dataGeracao, W - ML, 24, { align: 'right' });

    Y = 34;

    // ════════════════════════════════════════
    // BARRA DE STATUS
    // ════════════════════════════════════════
    const statusEl  = document.getElementById('proc-status');
    const statusTxt = statusEl?.options[statusEl.selectedIndex]?.text || '—';
    const statusCor = {
        'Aberto':               [34,  197, 94],
        'Em Andamento':         [59,  130, 246],
        'Aguardando Documentos':[245, 158, 11],
        'Liberado':             [16,  185, 129],
        'Encerrado':            [100, 116, 139],
        'Cancelado':            [239, 68,  68],
    }[statusTxt] || CINZA;

    rect(ML, Y, 40, 7, statusCor, 2);
    setFont('bold', 8, [255, 255, 255]);
    doc.text(statusTxt, ML + 20, Y + 5, { align: 'center' });

    const tipoEl  = document.getElementById('proc-tipo');
    const tipoTxt = tipoEl?.options[tipoEl.selectedIndex]?.text || '—';
    setFont('normal', 8, CINZA);
    doc.text('Tipo: ', ML + 44, Y + 5);
    setFont('bold', 8, PRETO);
    doc.text(tipoTxt, ML + 54, Y + 5);

    const modalEl  = document.getElementById('proc-modal');
    const modalTxt = modalEl?.options[modalEl.selectedIndex]?.text || '—';
    setFont('normal', 8, CINZA);
    doc.text('Modal: ', W - ML - 40, Y + 5);
    setFont('bold', 8, PRETO);
    doc.text(modalTxt, W - ML - 26, Y + 5);

    Y += 12;
    linha(ML, Y, MR, BORDA, 0.3);
    Y += 4;

    // ════════════════════════════════════════
    // EMISSOR
    // ════════════════════════════════════════
    secHeader('Dados do Emissor', '▶');

    const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;
    const emissorNome = emissorTipo === 'usuario'
        ? (window._usuarioLogado?.nome || 'Usuário')
        : val('proc-cliente');
    const docEmissor  = val('proc-documento');

    campo('Emissor',    emissorNome, ML,          Y, 80);
    campo('CNPJ / CPF', docEmissor,  ML + 90,     Y, 50);
    campo('Propósito',  val('proc-proposito') !== '—'
        ? document.getElementById('proc-proposito')?.options[document.getElementById('proc-proposito').selectedIndex]?.text
        : '—',          ML + 145, Y, 50);
    Y += 14;

    // ════════════════════════════════════════
    // EMPRESA DE DESTINO
    // ════════════════════════════════════════
    secHeader('Empresa de Destino', '▶');

    const btnCad    = document.getElementById('btn-emp-dest-cadastrada');
    const modoManual= !btnCad?.classList.contains('ativo');
    const razao     = modoManual ? val('proc-emp-dest-razao')    : val('proc-emp-dest-busca');
    const fantasia  = modoManual ? val('proc-emp-dest-fantasia') : '—';
    const docDest   = modoManual ? val('proc-emp-dest-doc')      : val('proc-emp-dest-auto-doc');
    const idDest    = val('proc-emp-dest-auto-id');

    campo('Razão Social',  razao,    ML,       Y, 90);
    campo('Nome Fantasia', fantasia, ML + 90,  Y, 60);
    campo('CNPJ / CPF',   docDest,  ML + 155, Y, 40);
    Y += 10;
    if (idDest !== '—') {
        campo('Identificação Interna', idDest, ML, Y, 80);
        Y += 10;
    }
    Y += 4;

    // ════════════════════════════════════════
    // ORIGEM / DESTINO
    // ════════════════════════════════════════
    secHeader('Origem / Destino', '▶');

    campo('País de Origem',  val('proc-origem-pais'),   ML,      Y, 55);
    campo('Cidade de Origem',val('proc-origem-cidade'), ML + 60, Y, 55);

    const modal = (document.getElementById('proc-modal')?.value || '');
    if (modal === 'maritimo') {
        campo('Navio',          val('proc-navio'),        ML + 120, Y, 40);
        campo('Porto de Origem',val('proc-porto-origem'), ML + 165, Y, 30);
    } else if (modal === 'aereo') {
        campo('Aeronave',             val('proc-aeronave'),         ML + 120, Y, 35);
        campo('Aeroporto de Origem',  val('proc-aeroporto-origem'), ML + 160, Y, 35);
    } else if (modal === 'terrestre') {
        campo('Aduana de Saída', val('proc-fronteira-saida'), ML + 120, Y, 75);
    }
    Y += 14;

    campo('País de Destino',  val('proc-destino-pais'),   ML,      Y, 55);
    campo('Cidade de Destino',val('proc-destino-cidade'), ML + 60, Y, 55);

    if (modal === 'maritimo') {
        campo('Porto de Destino',    val('proc-porto-destino'),    ML + 120, Y, 75);
    } else if (modal === 'aereo') {
        campo('Aeroporto de Destino',val('proc-aeroporto-destino'),ML + 120, Y, 75);
    } else if (modal === 'terrestre') {
        campo('Aduana de Entrada',   val('proc-fronteira-entrada'),ML + 120, Y, 75);
    }
    Y += 10;

    const estado = val('proc-destino-estado');
    const bairro = val('proc-destino-bairro');
    const ender  = val('proc-destino-endereco');
    const compl  = val('proc-destino-complemento');
    const cep    = val('proc-destino-cep');

    if ([estado, bairro, ender].some(v => v !== '—')) {
        campo('Estado',     estado, ML,       Y, 35);
        campo('Bairro',     bairro, ML + 40,  Y, 50);
        campo('Endereço',   ender,  ML + 95,  Y, 65);
        campo('Complemento',compl,  ML + 163, Y, 32);
        Y += 10;
        campo('CEP', cep, ML, Y, 40);
        Y += 10;
    }

    const responsavel = val('proc-destino-responsavel');
    if (responsavel !== '—') {
        campo('Responsável no Destino', responsavel, ML, Y, 180);
        Y += 10;
    }
    Y += 4;

    // ════════════════════════════════════════
    // INCOTERM & MODAL
    // ════════════════════════════════════════
    secHeader('Incoterm & Modal', '▶');

    campo('Incoterm', val('proc-incoterm'), ML,      Y, 40);
    campo('Modal',    modalTxt,             ML + 50, Y, 40);

    const navio = val('proc-navio');
    if (modal === 'maritimo' && navio !== '—') {
        campo('Navio', navio, ML + 100, Y, 95);
    }
    Y += 14;

    // ════════════════════════════════════════
    // DATAS
    // ════════════════════════════════════════
    const dataAbertura    = val('proc-data-abertura');
    const dataEmbarque    = val('proc-data-embarque');
    const dataChegada     = val('proc-data-chegada');
    const dataCancelamento= val('proc-data-cancelamento');

    const temDatas = [dataAbertura, dataEmbarque, dataChegada, dataCancelamento].some(d => d !== '—');
    if (temDatas) {
        secHeader('Datas', '▶');
        if (dataAbertura    !== '—') { campo('Data de Abertura',     dataAbertura,    ML,       Y, 40); }
        if (dataEmbarque    !== '—') { campo('Data de Embarque',     dataEmbarque,    ML + 50,  Y, 40); }
        if (dataChegada     !== '—') { campo('Data de Chegada',      dataChegada,     ML + 100, Y, 40); }
        if (dataCancelamento!== '—') { campo('Data de Cancelamento', dataCancelamento,ML + 150, Y, 40); }
        Y += 14;
    }

    // ════════════════════════════════════════
    // OBSERVAÇÕES
    // ════════════════════════════════════════
    const obs = val('proc-obs-prazos') !== '—' ? val('proc-obs-prazos') : val('proc-observacoes');
    if (obs !== '—') {
        secHeader('Observações', '▶');
        setFont('normal', 9, PRETO);
        const linhasObs = doc.splitTextToSize(obs, W - ML * 2 - 6);
        doc.text(linhasObs, ML + 3, Y);
        Y += linhasObs.length * 5 + 6;
    }

    // ════════════════════════════════════════
    // DOCUMENTOS
    // ════════════════════════════════════════
    const docsIds = [
        { id: 'doc-num-proforma',   label: 'Proforma Invoice' },
        { id: 'doc-num-commercial', label: 'Commercial Invoice' },
        { id: 'doc-num-packing',    label: 'Packing List' },
        { id: 'doc-num-due',        label: 'DUE' },
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

    const docsPreenchidos = docsIds.filter(d => {
        const v = document.getElementById(d.id)?.value?.trim();
        return v && v !== '';
    });

    if (docsPreenchidos.length > 0) {
        if (Y > 240) { doc.addPage(); Y = 20; }
        secHeader('Numeração de Documentos', '▶');

        const colW = (W - ML * 2) / 3;
        docsPreenchidos.forEach((d, i) => {
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x   = ML + col * colW;
            const yy  = Y + row * 14;
            if (yy > 270) { doc.addPage(); Y = 20; }
            campo(d.label, document.getElementById(d.id).value, x, yy, colW - 4);
        });
        Y += Math.ceil(docsPreenchidos.length / 3) * 14 + 4;
    }

    // ════════════════════════════════════════
    // RODAPÉ
    // ════════════════════════════════════════
    const totalPags = doc.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        linha(ML, 284, MR, BORDA, 0.3);
        setFont('normal', 7, CINZA);
        doc.text('Marpex — Gestão de Comércio Exterior', ML, 289);
        doc.text(`Página ${p} de ${totalPags}`, W / 2, 289, { align: 'center' });
        doc.text(dataGeracao, MR, 289, { align: 'right' });
    }

    // ── Salvar ────────────────────────────
    const nomeArq = `processo_${codigo !== '—' ? codigo : 'sem-codigo'}_${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(nomeArq);
}
