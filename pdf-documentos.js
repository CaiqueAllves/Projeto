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
    const { data: contatos } = parceiroIds.length
        ? await supabaseClient.from('parceiro_contatos').select('parceiro_id, nome, email, telefone, ordem').in('parceiro_id', parceiroIds).order('ordem')
        : { data: [] };
    const contatoDe = id => { const c = (contatos || []).find(x => String(x.parceiro_id) === String(id)); return c ? [c.nome, c.email || c.telefone].filter(Boolean).join(' · ') : ''; };

    // Exportador: parceiro escolhido (Terceiro) ou a própria empresa (Usuário)
    let exportador;
    if (proc.emissor_tipo === 'terceiro' && proc.remetente_parceiro_id) {
        exportador = parc(proc.remetente_parceiro_id);
    } else {
        const usuario = obterUsuarioLogado();
        const emp = await pdfEmpresaPropria(usuario.empresa_id);
        exportador = emp ? { ...emp, documento: emp.cnpj, pais: 'Brasil' } : null;
    }
    const importador = parc(proc.empresa_parceira_id);
    if (exportador && proc.emissor_tipo === 'terceiro') exportador._contato = contatoDe(proc.remetente_parceiro_id);
    if (importador) importador._contato = contatoDe(proc.empresa_parceira_id);

    const itens = (Array.isArray(proc.itens) ? proc.itens : []).filter(it => (it.produto || '').trim());
    const prodIds = [...new Set(itens.map(it => it.produto_id).filter(Boolean))];
    let produtos = {}, embalagens = {}, unitarias = {}, composicao = {}, fabricantes = {};
    if (prodIds.length) {
        // produto completo: marca, GTIN, lote, datas, fabricante e características
        // entram como colunas opcionais da Commercial Invoice (ci-colunas.js)
        const [{ data: prods }, { data: embs }, { data: comps }] = await Promise.all([
            supabaseClient.from('produtos').select('*').in('id', prodIds),
            supabaseClient.from('produto_embalagens').select('*').in('produto_id', prodIds),
            supabaseClient.from('produto_composicao').select('produto_id, ingrediente, nome_tecnico, concentracao_pct, criado_em').in('produto_id', prodIds).order('criado_em'),
        ]);
        (prods || []).forEach(p => { produtos[p.id] = p; });
        (comps || []).forEach(c => { (composicao[c.produto_id] ||= []).push(c); });
        const fabIds = [...new Set((prods || []).map(p => p.empresa_parceira_id).filter(Boolean))];
        if (fabIds.length) {
            const { data: fabs } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia, pais').in('id', fabIds);
            (fabs || []).forEach(f => { fabricantes[f.id] = f; });
        }
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

    return { proc, prof, exportador, importador, itens, produtos, embalagens, unitarias, composicao, fabricantes, numero,
             criadoPor: nomes[proc.criado_por] || nomes[prof?.criado_por] || null };
}

async function gerarPDFDocumentoProcesso(tipo, processoId, opcoes = {}) {
    const cfg = DOC_PDF_CFG[tipo];
    if (!cfg) return null;
    await carregarJsPDFSobDemanda();
    const d = await _docPdfCarregarDados(tipo, processoId);
    const { proc, prof } = d;
    // Mesmo idioma da Proforma de origem (pdf-kit.js → pdfIdioma)
    const I = pdfIdioma(prof?.idioma), t = I.t;
    const titulo = tipo === 'commercial' ? t.commercial_invoice : t.packing_list;
    const vv = s => (s === null || s === undefined || String(s).trim() === '') ? '' : String(s);
    const moeda = d.itens.find(it => it.moeda)?.moeda || proc.moeda || '';
    const doc = pvNovoDocumento();

    const ex = d.exportador || {}, im = d.importador || {};
    const nomeEx = vv(ex.razao_social || ex.nome_fantasia) || '—', nomeIm = vv(im.razao_social || im.nome_fantasia) || '—';
    const cidade = e => [vv(e.cidade), vv(e.estado)].filter(Boolean).join(' / ');
    const rua = e => [[vv(e.endereco), vv(e.numero)].filter(Boolean).join(', '), vv(e.complemento)].filter(Boolean).join(' - ');

    // ── Cabeçalho ──
    let Y = pvCabecalho(doc, {
        emissor: {
            nome: nomeEx,
            linhas: [ex.documento ? `${t.identificacao}: ${ex.documento}` : '', [rua(ex), cidade(ex), vv(ex.pais), ex.cep ? `${t.cep} ${ex.cep}` : ''].filter(Boolean).join(' · '),
                     ex._contato ? `${t.contato}: ${ex._contato}` : ''],
            logo: await pdfCarregarImagem(ex.logo_url),
        },
        titulo, numero: `Nº ${d.numero}`,
        datas: [[t.data, I.data(proc.data_embarque || new Date().toISOString().slice(0, 10))], [t.proforma, vv(prof?.codigo)]],
    });

    // ── Termos ──
    Y = pvFaixaTermos(doc, Y, [
        [t.incoterm_rot, [vv(proc.incoterm), vv(prof?.incoterm_local)].filter(Boolean).join(' · '), 1.5],
        [t.modal, I.modal(proc.modal)], [t.moeda, moeda], [t.processo, vv(proc.numero_processo), 1.6],
    ]);

    // ── Exportador | Importador ──
    const quadroEmpresa = (titulo, nome, e) => ({
        titulo, nome, ultimaCinza: !!e._contato,
        linhas: [e.documento ? `${t.identificacao}: ${e.documento}` : '', [rua(e), cidade(e)].filter(Boolean).join(' · '),
                 [vv(e.pais), vv(e.cep)].filter(Boolean).join(' · '), e._contato ? `${t.contato}: ${e._contato}` : ''].filter(Boolean),
    });
    Y = pvQuadros(doc, Y, [quadroEmpresa(t.exportador, nomeEx, ex), quadroEmpresa(t.importador, nomeIm, im)]);

    // ── Embarque | Pagamento (CI) ──
    const pontoOrigem  = proc.modal === 'maritimo' ? proc.porto_origem  : proc.modal === 'aereo' ? proc.aeroporto_origem  : proc.fronteira_saida;
    const pontoDestino = proc.modal === 'maritimo' ? proc.porto_destino : proc.modal === 'aereo' ? proc.aeroporto_destino : proc.fronteira_entrada;
    const quadroEmbarque = { titulo: t.embarque, chaves: [
        [t.origem, [vv(proc.pais_origem), vv(pontoOrigem)].filter(Boolean).join(' · ')],
        [t.destino, [vv(proc.pais_destino), vv(pontoDestino)].filter(Boolean).join(' · ')],
        ...(proc.data_embarque ? [[t.data_embarque, I.data(proc.data_embarque)]] : []),
        ...(proc.modal === 'maritimo' && proc.container_numero ? [[t.container, `${vv(proc.container_tipo)} ${proc.container_numero}`.trim()]] : []),
    ] };
    Y = pvQuadros(doc, Y, tipo === 'commercial'
        ? [quadroEmbarque, { titulo: t.condicoes_pagamento, chaves: [[t.forma, I.formaPagamento(prof?.forma_pagamento)], [t.prazo, I.prazoPagamento(prof?.prazo_pagamento)],
                                                                     [t.pais_origem_merc, vv(proc.pais_origem) || '—']] }]
        : [quadroEmbarque]);

    // ── Volumes e pesos por item (embalagem de transporte "caixa") ──
    const soma = { vol: 0, pecas: 0, liq: 0, bruto: 0, m3: 0 };
    let semEmbalagem = 0, caixaAtual = 0;
    const totalCaixas = d.itens.reduce((tt, it) => { const q = Number(d.embalagens[it.produto_id]?.quantidade) || 0; return tt + (q ? Math.ceil((Number(it.qtd) || 0) / q) : 0); }, 0);
    const dig = Math.max(2, String(totalCaixas).length), num = n => String(n).padStart(dig, '0');
    const log = d.itens.map(it => {
        const e = d.embalagens[it.produto_id], qtd = Number(it.qtd) || 0, porVol = Number(e?.quantidade) || 0;
        soma.pecas += qtd;
        if (!e || !porVol) { semEmbalagem++; return { e, vols: 0 }; }
        const vols = Math.ceil(qtd / porVol), de = caixaAtual + 1, ate = caixaAtual + vols; caixaAtual = ate;
        const liq = vols * (Number(e.peso_liquido) || 0), bruto = vols * (Number(e.peso_bruto) || 0);
        soma.vol += vols; soma.liq += liq; soma.bruto += bruto;
        soma.m3 += vols * (Number(e.comprimento) || 0) * (Number(e.largura) || 0) * (Number(e.altura) || 0) / 1e6;
        return { e, vols, liq, bruto, marcacao: vols === 1 ? t.caixa(num(de)) : t.caixas(num(de), num(ate)),
                 dims: (e.comprimento || e.largura || e.altura) ? `${I.num(e.comprimento, 0)} x ${I.num(e.largura, 0)} x ${I.num(e.altura, 0)} cm` : '' };
    });
    const temLogistica = soma.vol > 0;
    const stats = temLogistica ? [[t.volumes_rot, t.volumes(I.num(soma.vol, 0))], [t.peso_liquido, `${I.num(soma.liq, 3)} kg`], [t.peso_bruto, `${I.num(soma.bruto, 3)} kg`], [t.cubagem, `${I.num(soma.m3, 3)} m³`]] : [];

    let total = 0;
    if (tipo === 'commercial') {
        Y = pvTituloSecao(doc, Y, t.mercadorias);
        // Campos escolhidos na janela (ci-colunas.js); sem escolha, NCM/HS
        // embaixo do produto, como sempre foi
        const ci = opcoes.ci || proc.documentos?.ci_config || ciConfigPadrao();
        const campos = (ci.campos || []);
        const extras = campos.filter(c => c.posicao === 'coluna').slice(0, CI_MAX_COLUNAS);
        const abaixo = campos.filter(c => !extras.includes(c));
        // colunas extras dividem o que sobra além de 40mm para o produto (de 13 a 34mm cada)
        const wExtra = extras.length ? Math.max(13, Math.min(34, (PV.CW - 102 - 40) / extras.length)) : 0;
        const linhas = d.itens.map((it, i) => {
            const p = d.produtos[it.produto_id] || {};
            const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0); total += tot;
            const sub = abaixo.map(c => { const v = ciValorCampo(d, it, i, c, ci, I); return v ? `${ciRotulo(c, t)}: ${v}` : ''; }).filter(Boolean).join(' · ');
            return [String(i + 1), { txt: vv(p.sku) || '—', negrito: true, cor: PDF_CORES.AZUL }, { txt: vv(it.produto) || '—', sub },
                    ...extras.map(c => ciValorCampo(d, it, i, c, ci, I) || '—'),
                    { txt: I.num(it.qtd, 0), sub: vv(it.unidade) }, I.num(it.preco), { txt: I.num(tot), negrito: true }];
        });
        Y = pvTabela(doc, Y, [{ rot: '#', w: 9 }, { rot: t.col_codigo, w: 21 }, { rot: t.col_produto, w: 0 },
            ...extras.map(c => ({ rot: ciRotulo(c, t).toUpperCase(), w: wExtra })),
            { rot: t.col_qtd, w: 20, al: 'r' }, { rot: t.col_preco_unit, w: 24, al: 'r' }, { rot: t.col_total, w: 28, al: 'r' }],
            linhas, { vazio: t.nenhum_produto, maxTxt: 4, maxSub: 6 });
        Y = pvResumo(doc, Y, {
            stats, extenso: total ? pdfValorPorExtenso(total, moeda, I.cod) : '', rotExtenso: t.total_extenso,
            totais: [[t.total_geral, I.num(total)]], rotuloTotal: `${t.total_geral}${moeda ? ' · ' + moeda : ''}`,
        });
        Y = pvQuadros(doc, Y, [pvQuadroBanco(prof?.dados_bancarios, t, nomeEx)]);
    } else {
        Y = pvTituloSecao(doc, Y, t.volumes_pesos);
        const linhas = d.itens.map((it, i) => {
            const p = d.produtos[it.produto_id] || {}, l = log[i];
            const sub = [p.sku ? `SKU ${p.sku}` : '', (p.hscode || p.ncm) ? `HS ${p.hscode || p.ncm}` : '', vv(l.e?.tipo_embalagem || l.e?.nome), l.dims].filter(Boolean).join(' · ');
            return [{ txt: l.marcacao || '—', negrito: true, cor: PDF_CORES.AZUL }, { txt: vv(it.produto) || '—', sub },
                    I.num(it.qtd, 0), l.vols ? I.num(l.vols, 0) : '—', l.vols ? I.num(l.liq, 3) : '—', l.vols ? I.num(l.bruto, 3) : '—'];
        });
        Y = pvTabela(doc, Y, [{ rot: t.col_marcacao, w: 30 }, { rot: t.col_descricao, w: 0 }, { rot: t.col_qtd_pecas, w: 18, al: 'r' },
            { rot: t.col_volumes, w: 18, al: 'r' }, { rot: t.col_peso_liq, w: 22, al: 'r' }, { rot: t.col_peso_bruto, w: 24, al: 'r' }],
            linhas, { vazio: t.nenhum_produto });
        if (semEmbalagem) {
            Y = pvGarantir(doc, Y, 6);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6.8); doc.setTextColor(180, 83, 9);
            doc.text(doc.splitTextToSize(`${t.atencao}: ${t.aviso_sem_embalagem(semEmbalagem)}`, PV.CW)[0], PV.ML, Y + 1);
            Y += 6;
        }
        Y = pvResumo(doc, Y, { stats: [[t.pecas_rot, I.num(soma.pecas, 0)], ...stats] });
    }

    // ── Declaração (CI) e assinatura do Exportador ──
    pvAssinaturas(doc, Y, [{ nome: nomeEx, rotulo: t.assinatura_exportador }], tipo === 'commercial' ? t.declaracao_ci : '');
    pvRodape(doc, { t, textoDireita: `${titulo} ${d.numero}` });

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
        const doSistema = typeof docArquivoDoSistema === 'function' && docArquivoDoSistema(atual.arquivo_path);
        const quando = atual.enviado_em ? ` em ${new Date(atual.enviado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '';
        const quem = atual.enviado_por ? ` por ${atual.enviado_por}` : '';
        const ok = await confirmarAcao(
            `Já existe 1 PDF ${doSistema ? 'gerado pelo sistema' : 'enviado por upload'}${quando}${quem} para o ${cfg.titulo.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())} deste Processo`
            + ` (${atual.arquivo_nome || 'arquivo'}).`
            + ' Deseja gerar um novo? Se aceitar, o arquivo anterior será sobrescrito.'
            + (assinado ? ' Atenção: o documento atual está ASSINADO — a assinatura será desfeita.' : ''),
            { titulo: 'Substituir documento?', confirmar: 'Sim, gerar e sobrescrever', cancelar: 'Não', perigo: true }
        );
        if (!ok) return null;
    }

    // Commercial Invoice: janela de colunas antes de gerar (ci-colunas.js)
    let ci = null;
    if (tipo === 'commercial' && typeof ciAbrirJanelaColunas === 'function') {
        ci = await ciAbrirJanelaColunas(processoId);
        if (!ci) return null;
    }
    const r = await gerarPDFDocumentoProcesso(tipo, processoId, { ci });
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
