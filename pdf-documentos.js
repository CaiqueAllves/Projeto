// ========================================
// PDF — COMMERCIAL INVOICE e PACKING LIST (por Processo / embarque)
// Mesmo padrão visual dos PDFs de Proforma (pdf-proforma.js) e Processo
// (pdf-processo.js): jsPDF, A4 paisagem, cabeçalho NAVY com "Criado por".
// Gerados a partir dos dados SALVOS do Processo (+ Proforma de origem,
// produtos e produto_embalagens). Ao gerar, o sistema também anexa o arquivo
// ao documento daquele Processo (tela Documentos), como na Proforma Invoice.
// Depende de: carregarJsPDFSobDemanda (pdf-proforma.js), supabase-api.js.
// ========================================

const DOC_PDF_CFG = {
    commercial: { titulo: 'COMMERCIAL INVOICE', prefixo: 'CI', label: 'Nº Commercial Invoice', arquivo: 'Commercial_Invoice' },
    packing:    { titulo: 'PACKING LIST',       prefixo: 'PL', label: 'Nº Packing List',       arquivo: 'Packing_List' },
};

// Junta tudo que os dois documentos precisam a partir do Processo salvo.
async function _docPdfCarregarDados(tipo, processoId) {
    const { data: proc, error } = await supabaseClient.from('processos').select('*').eq('id', processoId).single();
    if (error || !proc) throw new Error('Processo não encontrado.');

    const [{ data: prof }, nomes] = await Promise.all([
        proc.proforma_id
            ? supabaseClient.from('proformas').select('*').eq('id', proc.proforma_id).maybeSingle()
            : Promise.resolve({ data: null }),
        window.supabaseAPI.buscarNomesUsuarios([proc.criado_por]),
    ]);
    // Processos antigos (antes de gravar criado_por) usam quem criou a Proforma
    if (!proc.criado_por && prof?.criado_por) Object.assign(nomes, await window.supabaseAPI.buscarNomesUsuarios([prof.criado_por]));

    const parceiroIds = [proc.emissor_tipo === 'terceiro' ? proc.remetente_parceiro_id : null, proc.empresa_parceira_id].filter(Boolean);
    const { data: parceiros } = parceiroIds.length
        ? await supabaseClient.from('parceiros').select('*').in('id', parceiroIds)
        : { data: [] };
    const parc = id => (parceiros || []).find(p => String(p.id) === String(id)) || null;

    // Exportador: parceiro escolhido (Terceiro) ou a própria empresa (Usuário)
    let exportador;
    if (proc.emissor_tipo === 'terceiro' && proc.remetente_parceiro_id) {
        exportador = parc(proc.remetente_parceiro_id);
    } else {
        const usuario = obterUsuarioLogado();
        const { data: emp } = await supabaseClient.from('empresas')
            .select('razao_social, nome_fantasia, cnpj, endereco, numero, complemento, cidade, estado, cep')
            .eq('id', usuario.empresa_id).maybeSingle();
        exportador = emp ? { ...emp, documento: emp.cnpj, pais: 'Brasil' } : null;
    }
    const importador = parc(proc.empresa_parceira_id);

    const itens = (Array.isArray(proc.itens) ? proc.itens : []).filter(it => (it.produto || '').trim());
    const prodIds = [...new Set(itens.map(it => it.produto_id).filter(Boolean))];
    let produtos = {}, embalagens = {}, unitarias = {};
    if (prodIds.length) {
        const [{ data: prods }, { data: embs }] = await Promise.all([
            supabaseClient.from('produtos').select('id, sku, nome, descricao, ncm, hscode').in('id', prodIds),
            supabaseClient.from('produto_embalagens').select('*').in('produto_id', prodIds),
        ]);
        (prods || []).forEach(p => { produtos[p.id] = p; });
        // Embalagem de transporte (caixa) — a primeira cadastrada de cada produto
        (embs || []).filter(e => (e.tipo || 'caixa') === 'caixa')
            .forEach(e => { if (!embalagens[e.produto_id]) embalagens[e.produto_id] = e; });
        // Embalagem unitária (peça) — peso unitário do Packing List
        (embs || []).filter(e => e.tipo === 'unitaria')
            .forEach(e => { if (!unitarias[e.produto_id]) unitarias[e.produto_id] = e; });
    }

    // Número do documento: o que estiver no Processo, ou gerado (CI-/PL-<processo>)
    const cfg = DOC_PDF_CFG[tipo];
    let numero = String(proc.documentos?.[tipo] || '').trim();
    if (!numero) {
        numero = `${cfg.prefixo}-${proc.numero_processo || proc.id.slice(0, 8)}`;
        const documentos = { ...(proc.documentos || {}), [tipo]: numero };
        await supabaseClient.from('processos').update({ documentos }).eq('id', proc.id);
        proc.documentos = documentos;
    }

    return { proc, prof, exportador, importador, itens, produtos, embalagens, unitarias, numero,
             criadoPor: nomes[proc.criado_por] || nomes[prof?.criado_por] || null };
}

async function gerarPDFDocumentoProcesso(tipo, processoId, opcoes = {}) {
    const cfg = DOC_PDF_CFG[tipo];
    if (!cfg) return null;
    await carregarJsPDFSobDemanda();
    const d = await _docPdfCarregarDados(tipo, processoId);
    const { proc, prof } = d;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, ML = 14;
    let Y = 0;

    const NAVY=[10,40,90], AZUL=[30,86,160], AZUL_MED=[59,130,246];
    const AZUL_CLARO=[219,234,254], CINZA=[100,116,139], CINZA_BG=[248,250,252];
    const BORDA=[209,219,234], PRETO=[15,23,42], BRANCO=[255,255,255], AMBAR=[180,83,9];

    const sf = (style, size, color) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...(color || PRETO)); };
    const rx = (x, y, w, h, cor) => { doc.setFillColor(...cor); doc.setDrawColor(...cor); doc.rect(x, y, w, h, 'F'); };
    const pg = h => { if (Y + h > 183) { doc.addPage(); Y = 20; } };
    const vv = s => (s === null || s === undefined || String(s).trim() === '') ? '—' : String(s);
    const fmtN = (n, dec = 2) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    const fd = s => s ? new Date(String(s).length === 10 ? s + 'T00:00:00' : s).toLocaleDateString('pt-BR') : '—';
    const modalTxt = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' }[proc.modal] || vv(proc.modal);
    const dataGeracao = new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const moeda = d.itens.find(it => it.moeda)?.moeda || proc.moeda || '—';

    // ── CABEÇALHO ─────────────────────────────
    rx(0, 0, W, 20, NAVY); rx(0, 0, 4, 20, AZUL_MED);
    sf('bold', 13, BRANCO); doc.text('MARPEX', ML + 3, 8.5);
    sf('normal', 6.5, [160, 190, 240]); doc.text('Gestão de Comércio Exterior', ML + 3, 13);
    sf('normal', 6, [120, 160, 220]); doc.text('Criado por: ' + (d.criadoPor || '—'), ML + 3, 17.5);
    sf('bold', 11, BRANCO); doc.text(cfg.titulo, W - ML, 8.5, { align: 'right' });
    sf('normal', 8, [160, 190, 240]); doc.text(d.numero, W - ML, 14, { align: 'right' });
    sf('normal', 6, [120, 160, 220]); doc.text('Gerado em: ' + dataGeracao, W - ML, 17.5, { align: 'right' });
    Y = 23;

    // ── BARRA INFO ────────────────────────────
    doc.setFillColor(...CINZA_BG); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.rect(ML, Y, W - ML * 2, 10, 'FD');
    const info = [
        ['Data', fd(proc.data_embarque || new Date().toISOString().slice(0, 10))],
        ['Processo', vv(proc.numero_processo)],
        ['Proforma', vv(prof?.codigo)],
        ['Incoterm', vv(proc.incoterm)],
        ['Modal', modalTxt],
        ['Moeda', moeda],
    ];
    const cw = (W - ML * 2) / info.length;
    info.forEach(([l, v], i) => {
        if (i) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.2); doc.line(ML + cw * i, Y + 1.5, ML + cw * i, Y + 8.5); }
        const cx = ML + cw * i + cw / 2;
        sf('bold', 5.5, CINZA); doc.text(l.toUpperCase(), cx, Y + 4, { align: 'center' });
        sf('bold', 7, AZUL); doc.text(doc.splitTextToSize(v, cw - 4)[0], cx, Y + 8.5, { align: 'center' });
    });
    Y += 13;

    // ── BANDA: EXPORTADOR | IMPORTADOR | EMBARQUE ─
    const endereco = e => e ? [[e.endereco, e.numero].filter(Boolean).join(', '), e.complemento].filter(Boolean).join(' - ') : '';
    const cidade = e => e ? [e.cidade, e.estado].filter(Boolean).join(' / ') : '';
    const empRows = e => [
        ['Empresa', vv(e?.razao_social || e?.nome_fantasia)],
        ['Identificação', vv(e?.documento)],
        ['Endereço', vv(endereco(e))],
        ['Cidade', vv(cidade(e))],
        ['CEP', vv(e?.cep)],
        ['País', vv(e?.pais)],
    ];
    const pontoOrigem  = proc.modal === 'maritimo' ? proc.porto_origem  : proc.modal === 'aereo' ? proc.aeroporto_origem  : proc.fronteira_saida;
    const pontoDestino = proc.modal === 'maritimo' ? proc.porto_destino : proc.modal === 'aereo' ? proc.aeroporto_destino : proc.fronteira_entrada;
    const rotuloPonto  = proc.modal === 'maritimo' ? 'Porto' : proc.modal === 'aereo' ? 'Aeroporto' : 'Fronteira';
    const embarqueRows = [
        ['País de Origem', vv(proc.pais_origem)],
        [`${rotuloPonto} Origem`, vv(pontoOrigem)],
        ['País de Destino', vv(proc.pais_destino)],
        [`${rotuloPonto} Destino`, vv(pontoDestino)],
        ...(tipo === 'commercial'
            ? [['Pagamento', vv([prof?.forma_pagamento, prof?.prazo_pagamento].filter(Boolean).join(' · '))]]
            : [['Embarque', fd(proc.data_embarque)]]),
        ...(proc.modal === 'maritimo' && proc.container_numero ? [['Container', vv(`${proc.container_tipo || ''} ${proc.container_numero}`.trim())]] : []),
    ];
    const colW = (W - ML * 2 - 6) / 3, bandHdr = 7, lblW = 25;
    const cols = [[ML, 'EXPORTADOR', empRows(d.exportador)], [ML + colW + 3, 'IMPORTADOR', empRows(d.importador)], [ML + (colW + 3) * 2, 'EMBARQUE', embarqueRows]];
    const bandH = bandHdr + Math.max(...cols.map(c => c[2].length)) * 5 + 3;
    cols.forEach(([x, titulo, rows]) => {
        doc.setFillColor(...BRANCO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.rect(x, Y, colW, bandH, 'FD');
        rx(x, Y, colW, bandHdr, NAVY); rx(x, Y, 3, bandHdr, AZUL_MED);
        sf('bold', 6.5, BRANCO); doc.text(titulo, x + colW / 2, Y + 4.8, { align: 'center' });
        rows.forEach(([l, v], i) => {
            const yy = Y + bandHdr + 4 + i * 5;
            sf('bold', 5.5, CINZA); doc.text(l.toUpperCase() + ':', x + 3, yy);
            sf('normal', 6.5, PRETO); doc.text(doc.splitTextToSize(v, colW - lblW - 6)[0], x + lblW + 3, yy);
        });
    });
    Y += bandH + 5;

    // ── TABELA DE ITENS ───────────────────────
    rx(ML, Y, 3, 6, AZUL); rx(ML + 3, Y, W - ML * 2 - 3, 6, AZUL_CLARO);
    sf('bold', 7.5, AZUL); doc.text(tipo === 'commercial' ? 'MERCADORIAS' : 'VOLUMES E PESOS', ML + 7, Y + 4.2);
    Y += 8;

    const ncmDe = it => { const p = d.produtos[it.produto_id]; return p?.ncm || p?.hscode || '—'; };
    let colsTab, linhas, totais, aviso = '';
    if (tipo === 'commercial') {
        colsTab = [['#', 8, 'l'], ['PRODUTO', 0, 'l'], ['NCM / HS', 30, 'l'], ['QTD', 22, 'r'], ['UN.', 16, 'l'], ['PREÇO UNIT.', 32, 'r'], ['TOTAL', 40, 'r']];
        const somaMoeda = {};
        linhas = d.itens.map((it, i) => {
            const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0);
            somaMoeda[it.moeda || '—'] = (somaMoeda[it.moeda || '—'] || 0) + tot;
            return [String(i + 1), it.produto, ncmDe(it), fmtN(it.qtd, 0), vv(it.unidade), fmtN(it.preco), `${fmtN(tot)} ${it.moeda || ''}`.trim()];
        });
        totais = ['TOTAL GERAL', Object.entries(somaMoeda).map(([m, v]) => `${fmtN(v)} ${m}`).join('  +  ') || '—'];
    } else {
        // Colunas pedidas: SKU | HS Code | Marcação/numeração das caixas | Tipo de
        // embalagem | Descrição | Qtd. de peças | Peso líq./bruto unitário | Dimensões
        colsTab = [['CÓDIGO SKU', 24, 'l'], ['HS CODE', 22, 'l'], ['MARCAÇÃO / NUMERAÇÃO', 32, 'l'], ['TIPO DE EMBALAGEM', 30, 'l'],
                   ['DESCRIÇÃO DO PRODUTO', 0, 'l'], ['QTD. DE PEÇAS', 20, 'r'], ['PESO LÍQ. UNIT. (KG)', 24, 'r'], ['PESO BRUTO UNIT. (KG)', 25, 'r'], ['DIMENSÕES (CM)', 30, 'l']];
        const soma = { vol: 0, pecas: 0, liq: 0, bruto: 0, m3: 0 };
        let semEmbalagem = 0, caixaAtual = 0;
        // total de caixas antes, pra saber quantos dígitos usar na numeração
        const totalCaixas = d.itens.reduce((t, it) => {
            const q = Number(d.embalagens[it.produto_id]?.quantidade) || 0;
            return t + (q ? Math.ceil((Number(it.qtd) || 0) / q) : 0);
        }, 0);
        const dig = Math.max(2, String(totalCaixas).length);
        const num = n => String(n).padStart(dig, '0');
        const hsDe = it => { const p = d.produtos[it.produto_id]; return p?.hscode || p?.ncm || '—'; };
        linhas = d.itens.map(it => {
            const p = d.produtos[it.produto_id];
            const e = d.embalagens[it.produto_id];
            const u = d.unitarias[it.produto_id];
            const qtd = Number(it.qtd) || 0;
            const porVol = Number(e?.quantidade) || 0;
            soma.pecas += qtd;

            // Peso unitário: embalagem unitária; sem ela, peso da caixa ÷ peças por caixa
            const unitLiq   = Number(u?.peso_liquido) || (porVol ? (Number(e.peso_liquido) || 0) / porVol : 0);
            const unitBruto = Number(u?.peso_bruto)   || (porVol ? (Number(e.peso_bruto)   || 0) / porVol : 0);

            let marcacao = '—', dims = '—';
            if (e && porVol) {
                const vols = Math.ceil(qtd / porVol);
                const de = caixaAtual + 1, ate = caixaAtual + vols;
                caixaAtual = ate;
                marcacao = vols === 1 ? `Caixa ${num(de)}` : `Caixas ${num(de)} a ${num(ate)}`;
                soma.vol += vols;
                soma.liq += vols * (Number(e.peso_liquido) || 0);
                soma.bruto += vols * (Number(e.peso_bruto) || 0);
                soma.m3 += vols * ((Number(e.comprimento) || 0) * (Number(e.largura) || 0) * (Number(e.altura) || 0)) / 1e6;
                if (e.comprimento || e.largura || e.altura) dims = `${fmtN(e.comprimento, 0)} x ${fmtN(e.largura, 0)} x ${fmtN(e.altura, 0)}`;
            } else {
                semEmbalagem++;
            }
            return [
                vv(p?.sku), hsDe(it), marcacao, vv(e?.tipo_embalagem || e?.nome),
                it.produto, fmtN(qtd, 0),
                unitLiq ? fmtN(unitLiq, 3) : '—', unitBruto ? fmtN(unitBruto, 3) : '—', dims,
            ];
        });
        totais = ['TOTAIS', `${fmtN(soma.vol, 0)} volumes  ·  ${fmtN(soma.pecas, 0)} peças  ·  Peso líquido ${fmtN(soma.liq, 3)} kg  ·  Peso bruto ${fmtN(soma.bruto, 3)} kg  ·  ${fmtN(soma.m3, 3)} m³`];
        if (semEmbalagem) aviso = `${semEmbalagem} produto(s) sem embalagem de transporte (caixa) cadastrada — marcação, pesos e dimensões não calculados. Cadastre em Produtos › Logística.`;
    }

    // largura da coluna "PRODUTO" = o que sobra
    const fixo = colsTab.reduce((t, c) => t + c[1], 0);
    colsTab = colsTab.map(c => c[1] ? c : [c[0], W - ML * 2 - fixo, c[2]]);
    const xsTab = []; colsTab.reduce((x, c) => { xsTab.push(x); return x + c[1]; }, ML);
    const cabecalho = () => {
        sf('bold', 5.8, BRANCO);
        const rotulos = colsTab.map(([l, w]) => doc.splitTextToSize(l, w - 3));
        const h = Math.max(...rotulos.map(r => r.length)) > 1 ? 10 : 7;
        rx(ML, Y, W - ML * 2, h, AZUL);
        sf('bold', 5.8, BRANCO);
        colsTab.forEach(([, w, al], i) => doc.text(rotulos[i], al === 'r' ? xsTab[i] + w - 2 : xsTab[i] + 2, Y + (h === 7 ? 4.8 : 4.2), { align: al === 'r' ? 'right' : 'left' }));
        Y += h;
    };
    cabecalho();
    if (!linhas.length) {
        sf('normal', 8, CINZA); doc.text('Nenhum produto cadastrado neste processo.', ML + 3, Y + 5); Y += 8;
    }
    linhas.forEach((ln, r) => {
        if (Y + 7 > 183) { doc.addPage(); Y = 20; cabecalho(); }
        if (r % 2 === 0) rx(ML, Y, W - ML * 2, 7, CINZA_BG);
        sf('normal', 7, PRETO);
        ln.forEach((v, i) => {
            const [, w, al] = colsTab[i];
            const t = doc.splitTextToSize(String(v), w - 3)[0];
            doc.text(t, al === 'r' ? xsTab[i] + w - 2 : xsTab[i] + 2, Y + 4.8, { align: al === 'r' ? 'right' : 'left' });
        });
        Y += 7;
    });
    pg(10);
    rx(ML, Y, W - ML * 2, 8, NAVY);
    sf('bold', 7, [160, 190, 240]); doc.text(totais[0], ML + 3, Y + 5.3);
    sf('bold', 8, BRANCO); doc.text(totais[1], W - ML - 2, Y + 5.3, { align: 'right' });
    Y += 11;
    if (aviso) {
        pg(8);
        sf('normal', 6.5, AMBAR); doc.text(doc.splitTextToSize('Atenção: ' + aviso, W - ML * 2)[0], ML, Y + 3);
        Y += 7;
    }

    // ── ASSINATURAS ───────────────────────────
    pg(30); Y += 12;
    const sigW = (W - ML * 2 - 30) / 2, sigX2 = ML + sigW + 30;
    doc.setDrawColor(...CINZA); doc.setLineWidth(0.3);
    doc.line(ML, Y, ML + sigW, Y); doc.line(sigX2, Y, sigX2 + sigW, Y);
    sf('bold', 6.5, PRETO);
    doc.text(vv(d.exportador?.razao_social || d.exportador?.nome_fantasia), ML + sigW / 2, Y + 4, { align: 'center' });
    doc.text(vv(d.importador?.razao_social || d.importador?.nome_fantasia), sigX2 + sigW / 2, Y + 4, { align: 'center' });
    sf('normal', 6, CINZA);
    doc.text('Exportador — Assinatura do Responsável', ML + sigW / 2, Y + 8, { align: 'center' });
    doc.text('Importador — Assinatura do Responsável', sigX2 + sigW / 2, Y + 8, { align: 'center' });

    // ── RODAPÉ ────────────────────────────────
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p); rx(0, 190, W, 20, NAVY); rx(0, 190, 4, 20, AZUL_MED);
        sf('bold', 8, BRANCO); doc.text('MARPEX', ML + 3, 198);
        sf('normal', 7, [160, 190, 240]); doc.text('Gestão de Comércio Exterior', ML + 3, 205);
        sf('normal', 7, [160, 190, 240]); doc.text(`Página ${p} de ${n}`, W / 2, 202, { align: 'center' });
        sf('normal', 7, [160, 190, 240]); doc.text(`${cfg.titulo} ${d.numero}`, W - ML, 202, { align: 'right' });
    }

    const nomeArquivo = `${cfg.arquivo}_${d.numero.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    return { blob: doc.output('blob'), nomeArquivo, numero: d.numero, proformaId: proc.proforma_id };
}

// Registro atual do documento daquele Processo (pra avisar antes de substituir)
async function _docPdfRegistroAtual(tipo, processoId) {
    const { data: proc } = await supabaseClient.from('processos').select('proforma_id').eq('id', processoId).maybeSingle();
    if (!proc?.proforma_id) return { proformaId: null, atual: null };
    const { data: regs } = await supabaseClient.from('proforma_documentos')
        .select('*').eq('proforma_id', proc.proforma_id).eq('tipo_documento', tipo);
    const atual = (regs || []).find(x => String(x.processo_id) === String(processoId))
        || (regs || []).find(x => x.processo_id === undefined || x.processo_id === null);
    return { proformaId: proc.proforma_id, atual: atual || null };
}

// Gera, baixa e anexa ao documento daquele Processo (tela Documentos). Se já
// existe um arquivo anexado, PERGUNTA antes de substituir (Não = cancela tudo).
// Substituir um documento assinado desfaz a assinatura (o arquivo é outro).
async function gerarEAnexarDocumentoProcesso(tipo, processoId, { baixar = true, perguntar = true } = {}) {
    const cfg = DOC_PDF_CFG[tipo];
    const { atual } = await _docPdfRegistroAtual(tipo, processoId);
    if (perguntar && atual?.arquivo_path) {
        const assinado = !!atual.assinado;
        const ok = await confirmarAcao(
            `Já existe um ${cfg.titulo.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())} anexado a este Processo`
            + ` (${atual.arquivo_nome || 'arquivo'}${atual.enviado_por ? `, enviado por ${atual.enviado_por}` : ''}).`
            + (assinado ? ' Ele já está ASSINADO — substituir desfaz a assinatura.' : '')
            + ' Deseja gerar um novo PDF e substituir o arquivo atual?',
            { titulo: 'Substituir documento?', confirmar: 'Sim, substituir', cancelar: 'Não', perigo: assinado }
        );
        if (!ok) return null;
    }

    const r = await gerarPDFDocumentoProcesso(tipo, processoId);
    if (!r) return null;

    if (baixar) {
        const url = URL.createObjectURL(r.blob);
        const a = document.createElement('a');
        a.href = url; a.download = r.nomeArquivo;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    if (!r.proformaId) return { ...r, anexado: false, motivo: 'Processo sem Proforma de origem' };

    // O usuário já confirmou a substituição (ou não havia arquivo)
    const prefixo = `${tipo}_sistema_`;
    const anterior = atual?.arquivo_path || '';

    const path = `${r.proformaId}/${prefixo}${processoId}_${Date.now()}.pdf`;
    const { error } = await supabaseClient.storage.from('proforma-documentos-assinados')
        .upload(path, r.blob, { contentType: 'application/pdf' });
    if (error) return { ...r, anexado: false, motivo: error.message };

    const res = await window.supabaseAPI.anexarDocumentoProforma(r.proformaId, tipo, null, path, r.nomeArquivo, processoId);
    if (!res.sucesso) {
        supabaseClient.storage.from('proforma-documentos-assinados').remove([path]).catch(() => {});
        return { ...r, anexado: false, motivo: res.mensagem };
    }
    let registro = res.data;
    if (atual?.assinado) {
        const des = await window.supabaseAPI.marcarDocumentoAssinado(r.proformaId, tipo, false, null, null, null, null, processoId);
        if (des.sucesso) registro = des.data;
    }
    if (anterior) supabaseClient.storage.from('proforma-documentos-assinados').remove([anterior]).catch(() => {});
    return { ...r, anexado: true, substituiu: !!anterior, registro, path };
}
