// ========================================
//  GERADOR DE PDF — PROCESSO DE EXPORTAÇÃO
//  Depende de: jsPDF (CDN) + pdf-kit.js (componentes pv* do layout vertical)
//  A4 vertical, mesmo layout da Proforma / Commercial Invoice / Packing List.
//  Documento interno (português, com "Criado por"). Lê os campos do formulário
//  de Processo (document.getElementById), então sai com o que está na tela.
// ========================================

function gerarPDFProcesso() {
    const doc = pvNovoDocumento();
    const t = PDF_IDIOMAS.pt;

    function val(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        // Select sem escolha mostraria o texto do placeholder ("Selecione...")
        if (el.tagName === 'SELECT') return el.value ? (el.options[el.selectedIndex]?.text || '') : '';
        return el.value?.trim() || '';
    }
    const raw = id => (document.getElementById(id)?.value || '').trim();
    const fmtData = iso => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR') : '';
    const fmtNum = n => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const juntar = (...p) => p.filter(Boolean).join(' · ');
    const preenchidas = linhas => linhas.filter(([, v]) => v && String(v).trim());

    // ── Cabeçalho ──
    const codigo = val('proc-codigo');
    const numeroProc = window._procNumero || '';
    const _u = (typeof obterUsuarioLogado === 'function') ? obterUsuarioLogado() : null;
    const criadoPor = window._procCriadoPorNome || _u?.nome || _u?.email || '';
    const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value || 'usuario';
    const emissorNome = emissorTipo === 'usuario'
        ? (val('proc-emissor-pedido-remetente') || window._usuarioLogado?.nome || 'Própria empresa')
        : val('proc-cliente');
    const docExportador = val('proc-documento');

    let Y = pvCabecalho(doc, {
        emissor: { nome: emissorNome || '—', linhas: [docExportador ? `${val('proc-documento-tipo') || 'Documento'}: ${docExportador}` : '', criadoPor ? `Criado por: ${criadoPor}` : ''] },
        titulo: 'PROCESSO DE EXPORTAÇÃO',
        numero: numeroProc ? `Nº ${numeroProc}` : 'Processo não salvo',
        datas: [['Abertura', fmtData(raw('proc-data-abertura'))], ['Proforma', codigo]],
    });

    // ── Termos ──
    Y = pvFaixaTermos(doc, Y, [
        ['Status', val('proc-status')], ['Tipo', val('proc-tipo'), 1.3], ['Propósito', val('proc-proposito')],
        ['Incoterm', val('proc-incoterm')], ['Modal', val('proc-modal')],
    ]);

    // ── Exportador | Importador ──
    Y = pvQuadros(doc, Y, [
        { titulo: 'EXPORTADOR', chaves: preenchidas([
            ['Empresa', emissorNome],
            ['Tipo', emissorTipo === 'usuario' ? 'Própria empresa' : 'Terceiro (intermediário)'],
            [val('proc-documento-tipo') || 'Documento', docExportador],
        ]) },
        { titulo: 'IMPORTADOR', chaves: preenchidas([
            ['Empresa', val('proc-emp-dest-busca')],
            ['Documento', val('proc-emp-dest-auto-doc')],
            ['Código interno', val('proc-emp-dest-auto-id')],
            ['Responsável', val('proc-destino-responsavel')],
            ['Contato', juntar(val('proc-destino-responsavel-contato'), val('proc-destino-responsavel-email'))],
        ]) },
    ]);

    // ── Origem | Destino (endereço + ponto do modal) ──
    const modal = raw('proc-modal');
    const endereco = p => [[val(`proc-${p}-endereco`), val(`proc-${p}-numero`)].filter(Boolean).join(', '), val(`proc-${p}-complemento`)].filter(Boolean).join(' - ');
    const cidade = p => [val(`proc-${p}-cidade`), val(`proc-${p}-estado`)].filter(Boolean).join(' / ');
    const pontoOrigem = modal === 'maritimo' ? [['Porto de origem', val('proc-porto-origem')], ['Navio', val('proc-navio')]]
        : modal === 'aereo' ? [['Aeroporto de origem', val('proc-aeroporto-origem')], ['Aeronave', val('proc-aeronave')]]
        : modal === 'terrestre' ? [['Fronteira de saída', val('proc-fronteira-saida')]] : [];
    const pontoDestino = modal === 'maritimo' ? [['Porto de destino', val('proc-porto-destino')]]
        : modal === 'aereo' ? [['Aeroporto de destino', val('proc-aeroporto-destino')]]
        : modal === 'terrestre' ? [['Fronteira de entrada', val('proc-fronteira-entrada')]] : [];
    Y = pvQuadros(doc, Y, [
        { titulo: 'ORIGEM', chaves: preenchidas([['País', val('proc-origem-pais')], ['Endereço', endereco('origem')], ['Bairro', val('proc-origem-bairro')],
            ['Cidade / Estado', cidade('origem')], ['CEP', val('proc-origem-cep')], ...pontoOrigem]) },
        { titulo: 'DESTINO', chaves: preenchidas([['País', val('proc-destino-pais')], ['Endereço', endereco('destino')], ['Bairro', val('proc-destino-bairro')],
            ['Cidade / Estado', cidade('destino')], ['CEP', val('proc-destino-cep')], ...pontoDestino]) },
    ]);

    // Intermediários de rota + endereço de coleta (só se houver)
    const intermediarios = (Array.isArray(window._intermediarios) ? window._intermediarios : []).filter(i => i.valor?.trim())
        .map(i => `${{ porto: 'Porto', aeroporto: 'Aeroporto', fronteira: 'Fronteira' }[i.tipo] || i.tipo}: ${i.valor}`).join('  •  ');
    const coletaMesmo = document.getElementById('proc-origem-coleta-mesmo')?.checked;
    const coleta = coletaMesmo ? [] : preenchidas([
        ['Endereço de coleta', juntar([val('proc-origem-coleta-endereco'), val('proc-origem-coleta-numero')].filter(Boolean).join(', '), val('proc-origem-coleta-complemento'))],
        ['Bairro / Cidade', juntar(val('proc-origem-coleta-bairro'), [val('proc-origem-coleta-cidade'), val('proc-origem-coleta-estado')].filter(Boolean).join(' / '))],
        ['CEP', val('proc-origem-coleta-cep')],
        ['Horário / Intervalo', juntar(val('proc-origem-coleta-horario'), val('proc-origem-coleta-intervalo'))],
    ]);
    if (intermediarios || coleta.length) {
        Y = pvQuadros(doc, Y, [{ titulo: 'ROTA E COLETA', chaves: [...(intermediarios ? [['Intermediários de rota', intermediarios]] : []), ...coleta] }]);
    }

    // ── Datas & Container (Container só no Marítimo; Abertura já está no topo) ──
    const datas = preenchidas([
        ['Data de embarque', fmtData(raw('proc-data-embarque'))],
        ['Data de chegada', fmtData(raw('proc-data-chegada'))],
        ['Data de cancelamento', fmtData(raw('proc-data-cancelamento'))],
        ...(modal === 'maritimo' ? [['Container', val('proc-container-tipo')], ['Nº do container', val('proc-container-num')]] : []),
    ]);
    if (datas.length) Y = pvQuadros(doc, Y, [{ titulo: modal === 'maritimo' ? 'DATAS E CONTAINER' : 'DATAS', grade: datas }]);

    // ── Produtos do Processo ──
    const itensProc = (typeof _procItens !== 'undefined' ? _procItens : []).filter(it => (it.produto || '').trim());
    if (itensProc.length) {
        Y = pvTituloSecao(doc, Y, 'PRODUTOS DO PROCESSO');
        const totais = {};
        const linhas = itensProc.map(it => {
            const pr = (window._procProdutosInfo || {})[it.produto_id];
            const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0);
            totais[it.moeda || '—'] = (totais[it.moeda || '—'] || 0) + tot;
            return [{ txt: it.produto, sub: pr?.ncm || pr?.hscode ? `NCM ${pr.ncm || pr.hscode}` : '' },
                    { txt: Number(it.qtd || 0).toLocaleString('pt-BR'), sub: it.unidade || '' }, fmtNum(it.preco),
                    { txt: `${fmtNum(tot)} ${it.moeda || ''}`.trim(), negrito: true }];
        });
        Y = pvTabela(doc, Y, [{ rot: 'PRODUTO', w: 0 }, { rot: 'QTD', w: 24, al: 'r' }, { rot: 'PREÇO UNIT.', w: 28, al: 'r' }, { rot: 'TOTAL', w: 36, al: 'r' }], linhas);
        const moedas = Object.keys(totais);
        Y = pvResumo(doc, Y, {
            totais: [['Total geral', Object.entries(totais).map(([m, v]) => `${fmtNum(v)}${moedas.length > 1 ? ' ' + m : ''}`).join(' + ')]],
            rotuloTotal: `TOTAL GERAL${moedas.length === 1 && moedas[0] !== '—' ? ' · ' + moedas[0] : ''}`,
        });
    }

    // ── Transportadora ──
    const freteValor = val('transp-frete-valor');
    const transporte = preenchidas([
        ['Contratação', val('transp-tipo')], ['Razão social', val('transp-razao')], ['Documento fiscal', val('transp-cnpj')],
        ['Nº de coleta', val('transp-num-coleta')], ['Tipo de veículo', val('transp-tipo-veiculo')], ['Placa', val('transp-placa')],
        ['Motorista', val('transp-motorista')], ['CNH do motorista', val('transp-motorista-cnh')], ['Contato do motorista', val('transp-motorista-contato')],
        ['Data de coleta', fmtData(raw('transp-data-coleta'))], ['Entrega prevista', fmtData(raw('transp-data-entrega'))],
        ['Valor do frete', freteValor ? juntar(val('transp-frete-moeda-display'), freteValor).replace(' · ', ' ') : ''], ['Seguro', val('transp-seguro')],
    ]);
    if (['transp-razao', 'transp-cnpj', 'transp-placa', 'transp-motorista', 'transp-frete-valor', 'transp-seguro'].some(id => val(id))) {
        Y = pvQuadros(doc, Y, [{ titulo: 'TRANSPORTADORA', grade: transporte, texto: val('transp-obs') ? `Observações: ${val('transp-obs')}` : '' }]);
    }

    // ── Etapas do Processo ──
    const etapas = Array.isArray(window._etapas) ? window._etapas : [];
    if (etapas.length) {
        Y = pvTituloSecao(doc, Y, 'ETAPAS DO PROCESSO');
        Y = pvTabela(doc, Y, [{ rot: 'FEITO', w: 16 }, { rot: 'ETAPA', w: 0 }, { rot: 'DATA', w: 26 }, { rot: 'RESPONSÁVEL', w: 50 }],
            etapas.map(e => [{ txt: e.concluida ? 'SIM' : '—', negrito: true, cor: e.concluida ? [22, 163, 74] : PDF_CORES.CINZA },
                             e.nome || '—', fmtData(e.data) || '—', e.responsavel || '—']));
    }

    // ── Numeração de documentos ──
    // Com arquivo anexado, o campo mostra o nome do arquivo e o número fica em
    // data-numero (formularios.js → _docAtualizarCampoVisual)
    const numeroDoc = id => { const el = document.getElementById(id); if (!el) return ''; return (el.dataset.anexo ? (el.dataset.numero || '') : (el.value || '')).trim(); };
    const documentos = [
        ['Proforma Invoice', 'proforma'], ['Commercial Invoice', 'commercial'], ['Packing List', 'packing'], ['DUE', 'due'],
        ['LE', 'le'], ['Certificado de Origem', 'certorigem'], ['CTN', 'ctn'], ['NF de Exportação', 'nfe'],
        ['AWB', 'awb'], ['Manifesto de Carga', 'manifesto'], ['FCL', 'fcl'], ['LCL', 'lcl'], ['BL — Bill of Lading', 'bl'],
        ['Apólice de Seguro', 'apolice'], ['CRT', 'crt'], ['MIC/DTA — TIF', 'micdta'],
    ].map(([rot, id]) => [rot, numeroDoc('doc-num-' + id)]).filter(([, v]) => v);
    if (documentos.length) Y = pvQuadros(doc, Y, [{ titulo: 'NUMERAÇÃO DE DOCUMENTOS', grade: documentos }]);

    // ── Observações ──
    const obs = [val('proc-observacoes'), val('proc-obs-prazos') ? `Prazos e status: ${val('proc-obs-prazos')}` : ''].filter(Boolean).join('\n');
    if (obs) Y = pvQuadros(doc, Y, [{ titulo: 'OBSERVAÇÕES', texto: obs }]);

    pvRodape(doc, { t, textoDireita: `PROCESSO ${numeroProc || ''}`.trim() });

    const nomeArq = `processo_${numeroProc || codigo || 'sem-codigo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeArq);
}
