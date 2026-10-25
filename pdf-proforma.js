// ========================================
// PDF — PROFORMA (registro já salvo)
// Usado por proforma.js (lista), formularios.js e documentos.js
// ========================================

// jsPDF sob demanda (revisão de performance) — ~340KB que só servem pra
// gerar PDF; pdf-documentos.js (Commercial Invoice / Packing List) também
// reaproveita esta função.
let _jspdfCarregado = null;
function carregarJsPDFSobDemanda() {
    if (_jspdfCarregado) return _jspdfCarregado;
    _jspdfCarregado = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = () => { _jspdfCarregado = null; reject(new Error('Falha ao carregar jsPDF')); };
        document.head.appendChild(script);
    });
    return _jspdfCarregado;
}

const PDF_PROF_ROTULOS = {
    tipo: { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' },
    proposito: { vendas: 'Vendas', amostra: 'Amostra', troca: 'Troca', doacao: 'Doação', conserto: 'Conserto / Reparo', retorno: 'Retorno', exposicao: 'Exposição / Feira' },
    forma_pagamento: { dinheiro: 'Dinheiro', cheque: 'Cheque', 'cartao-credito': 'Cartão de Crédito', 'cartao-debito': 'Cartão de Débito',
        duplicata: 'Duplicata Mercantil', boleto: 'Boleto Bancário', deposito: 'Depósito Bancário', swift: 'SWIFT', cad: 'CAD',
        '30-advanced': '30% ADVANCED', '70-against-document': '70% AGAINST DOCUMENT', 'sem-pagamento': 'Sem Pagamento',
        'pagamento-posterior': 'Pagamento Posterior', outros: 'Outros' },
    prazo_pagamento: { avista: 'À Vista', 15: '15 dias', 30: '30 dias', 45: '45 dias', 60: '60 dias', 90: '90 dias', 120: '120 dias' },
};

// Completa os dados da Proforma com o cadastro: Exportador (parceiro escolhido
// ou a própria empresa), Importador, e os produtos dos itens (SKU, NCM, HS Code,
// marca, fabricante) + logística (volumes/pesos pela embalagem tipo caixa).
// Só preenche o que estiver vazio — nunca sobrescreve o que veio salvo.
async function _pdfProformaCompletar(d) {
    if (typeof supabaseClient === 'undefined') return d;
    const vazio = v => v === null || v === undefined || String(v).trim() === '';
    const endereco = e => [[e.endereco, e.numero].filter(Boolean).join(', '), e.complemento].filter(Boolean).join(' - ');
    try {
        const ids = [d.emissor_tipo === 'terceiro' ? d.parceiro_id : null, d.destinatario_id, d.importador_final_id].filter(Boolean);
        const { data: parcs } = ids.length ? await supabaseClient.from('parceiros').select('*').in('id', ids) : { data: [] };
        const parc = id => (parcs || []).find(p => String(p.id) === String(id));
        // 1º contato cadastrado de cada empresa (Exportador terceiro e Importador)
        if (ids.length) {
            const { data: cts } = await supabaseClient.from('parceiro_contatos').select('parceiro_id, nome, email, telefone, ordem').in('parceiro_id', ids).order('ordem');
            const contato = id => { const c = (cts || []).find(x => String(x.parceiro_id) === String(id)); return c ? [c.nome, c.email || c.telefone].filter(Boolean).join(' · ') : ''; };
            if (d.emissor_tipo === 'terceiro') d._contato_exp = contato(d.parceiro_id);
            d._contato_imp = contato(d.destinatario_id);
        }

        let exp = d.emissor_tipo === 'terceiro' ? parc(d.parceiro_id) : null;
        if (!exp && d.emissor_tipo !== 'terceiro') {
            const u = obterUsuarioLogado?.();
            const emp = await pdfEmpresaPropria(d.empresa_id || u?.empresa_id);
            if (emp) exp = { ...emp, documento: emp.cnpj };
        }
        if (exp) {
            d._logo_url = exp.logo_url || null;
            if (vazio(d.empresa_nome) && vazio(d.razao_social)) d.empresa_nome = exp.razao_social || exp.nome_fantasia;
            if (vazio(d.documento)) d.documento = exp.documento;
            if (vazio(d.endereco))  d.endereco  = endereco(exp);
            if (vazio(d.cidade))    d.cidade    = exp.cidade;
            if (vazio(d.estado))    d.estado    = exp.estado;
            if (vazio(d.cep))       d.cep       = exp.cep;
        }
        // exportação indireta: importador lá fora (a destinatária é a trading)
        const impFinal = parc(d.importador_final_id);
        if (impFinal) d._importador_final = [impFinal.razao_social || impFinal.nome_fantasia, impFinal.pais].filter(Boolean).join(' · ');
        const imp = parc(d.destinatario_id);
        if (imp) {
            if (vazio(d.destinatario_razao_social)) d.destinatario_razao_social = imp.razao_social || imp.nome_fantasia;
            if (vazio(d.destinatario_doc))      d.destinatario_doc      = imp.documento;
            if (vazio(d.destinatario_endereco)) d.destinatario_endereco = endereco(imp);
            if (vazio(d.destinatario_cidade))   d.destinatario_cidade   = imp.cidade;
            if (vazio(d.destinatario_estado))   d.destinatario_estado   = imp.estado;
            if (vazio(d.destinatario_cep))      d.destinatario_cep      = imp.cep;
            if (vazio(d.destinatario_pais))     d.destinatario_pais     = imp.pais;
        }

        const prodIds = [...new Set((d.itens || []).map(i => i.produto_id).filter(Boolean))];
        if (prodIds.length) {
            const [{ data: prods }, { data: embs }] = await Promise.all([
                supabaseClient.from('produtos').select('id, sku, ncm, hscode, marca, empresa_parceira_id').in('id', prodIds),
                supabaseClient.from('produto_embalagens').select('*').in('produto_id', prodIds),
            ]);
            const fabIds = [...new Set((prods || []).map(p => p.empresa_parceira_id).filter(Boolean))];
            const { data: fabs } = fabIds.length ? await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').in('id', fabIds) : { data: [] };
            const prodPor = {}; (prods || []).forEach(p => { prodPor[p.id] = p; });
            const caixa = {}; (embs || []).filter(e => (e.tipo || 'caixa') === 'caixa').forEach(e => { if (!caixa[e.produto_id]) caixa[e.produto_id] = e; });
            const soma = { vol: 0, liq: 0, bruto: 0, m3: 0, ok: false };
            const I = pdfIdioma(d.idioma);
            d.itens.forEach(it => {
                const p = prodPor[it.produto_id];
                if (!p) return;
                if (vazio(it.sku))     it.sku     = p.sku;
                if (vazio(it.ncm))     it.ncm     = p.ncm;
                if (vazio(it.hs_code)) it.hs_code = p.hscode;
                if (vazio(it.marca))   it.marca   = p.marca;
                if (vazio(it.fabricante)) {
                    const f = (fabs || []).find(x => String(x.id) === String(p.empresa_parceira_id));
                    if (f) it.fabricante = f.razao_social || f.nome_fantasia;
                }
                const e = caixa[it.produto_id], porVol = Number(e?.quantidade) || 0;
                if (e && porVol) {
                    const vols = Math.ceil((Number(it.qtd) || 0) / porVol);
                    soma.vol += vols; soma.liq += vols * (Number(e.peso_liquido) || 0); soma.bruto += vols * (Number(e.peso_bruto) || 0); soma.ok = true;
                    soma.m3 += vols * (Number(e.comprimento) || 0) * (Number(e.largura) || 0) * (Number(e.altura) || 0) / 1e6;
                    if (vazio(it.volume_peso)) it.volume_peso = `${vols} ${I.t.vol_abrev} / ${(vols * (Number(e.peso_bruto) || 0)).toLocaleString(I.loc, { maximumFractionDigits: 2 })} kg`;
                }
            });
            const n3 = v => v.toLocaleString(I.loc, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            if (soma.ok) {
                if (vazio(d.volume_total)) d.volume_total = I.t.volumes(soma.vol);
                if (vazio(d.peso_liquido)) d.peso_liquido = `${n3(soma.liq)} kg`;
                if (vazio(d.peso_bruto))   d.peso_bruto   = `${n3(soma.bruto)} kg`;
                if (vazio(d.cubagem) && soma.m3) d.cubagem = `${n3(soma.m3)} m³`;
            }
        }
    } catch (e) { console.warn('[PDF Proforma] não foi possível completar com o cadastro:', e); }
    return d;
}

// opcoes.retornarBlob: em vez de baixar, devolve o PDF (Blob) — usado pelo
// anexo automático do documento "Nº Proforma Invoice" (ver mais abaixo).
async function gerarPDFProformaDados(d, opcoes = {}) {
    try {
        await carregarJsPDFSobDemanda();
    } catch (e) { if (!opcoes.retornarBlob) mostrarNotificacao('Não foi possível carregar o gerador de PDF. Tente novamente.', 'error'); return null; }

    // A Proforma guarda só os ids/nome das empresas e os itens como foram
    // digitados — completa com o cadastro (endereço, documento, NCM, marca...).
    d = await _pdfProformaCompletar({ ...d, itens: (d.itens || []).map(it => ({ ...it })) });

    // Idioma escolhido na Proforma: títulos, rótulos, valores, números e datas
    const I = pdfIdioma(d.idioma), t = I.t;
    if (I.trocado && !opcoes.retornarBlob) mostrarNotificacao('O PDF saiu em inglês: o idioma escolhido não é suportado pela fonte do PDF.', 'aviso');

    // Nome/descrição de cada item no idioma da Proforma (itens com produto cadastrado)
    const itens = d.itens || [];
    const produtoIds = [...new Set(itens.map(i => i.produto_id).filter(Boolean))];
    if (produtoIds.length > 0 && d.idioma && typeof supabaseClient !== 'undefined') {
        try {
            const { data: produtosDados } = await supabaseClient.from('produtos').select('id, nomes_idiomas').in('id', produtoIds);
            const mapaIdiomas = {};
            (produtosDados || []).forEach(p => { mapaIdiomas[p.id] = p.nomes_idiomas || []; });
            itens.forEach(item => {
                if (!item.produto_id) return;
                const match = (mapaIdiomas[item.produto_id] || []).find(o => o.idioma === d.idioma && (d.idioma !== 'outro' || o.idioma_outro === d.idioma_outro));
                if (match?.nome) item.produto = match.nome;
                if (match?.descricao) item.descricao = match.descricao;
            });
        } catch (e) { /* mantém o texto já salvo no item */ }
    }

    const doc = pvNovoDocumento();
    const vv = s => (s === null || s === undefined || String(s).trim() === '') ? '' : String(s);
    const codigo = vv(d.codigo) || '—';
    const moeda = d.moeda || itens.find(i => i.moeda)?.moeda || d.moeda_principal || '';
    const emissao = d.data_emissao || (d.created_at ? String(d.created_at).slice(0, 10) : new Date().toISOString().slice(0, 10));
    // "Válida até": data salva, ou emissão + validade em dias
    let validaAte = d.data_validade || '';
    if (!validaAte && /^\d+$/.test(String(d.validade_dias || ''))) {
        const dt = new Date(emissao + 'T00:00:00'); dt.setDate(dt.getDate() + Number(d.validade_dias)); validaAte = dt.toISOString().slice(0, 10);
    }
    const nomeExp = vv(d.empresa_nome || d.razao_social) || '—';
    const cidadeExp = [vv(d.cidade), vv(d.estado)].filter(Boolean).join(' / ');
    const enderecoExp = [vv(d.endereco), cidadeExp, vv(d.origem_pais), d.cep ? `${t.cep} ${d.cep}` : ''].filter(Boolean).join(' · ');

    // ── Cabeçalho: Exportador + número e datas ──
    let Y = pvCabecalho(doc, {
        emissor: {
            nome: nomeExp,
            linhas: [d.documento ? `${t.identificacao}: ${d.documento}` : '', enderecoExp, d._contato_exp ? `${t.contato}: ${d._contato_exp}` : ''],
            logo: await pdfCarregarImagem(d._logo_url),
        },
        titulo: t.proforma_invoice,
        numero: `Nº ${codigo}`,
        datas: [[t.emissao, I.data(emissao)], [t.valida_ate, validaAte ? I.data(validaAte) : '']],
    });

    // ── Termos ──
    const pontoOrigem  = d.modal === 'maritimo' ? d.porto_origem  : d.modal === 'aereo' ? d.aeroporto_origem  : d.fronteira_saida;
    const pontoDestino = d.modal === 'maritimo' ? d.porto_destino : d.modal === 'aereo' ? d.aeroporto_destino : d.fronteira_entrada;
    Y = pvFaixaTermos(doc, Y, [
        [t.incoterm_rot, [vv(d.incoterm), vv(d.incoterm_local)].filter(Boolean).join(' · '), 1.5],
        [t.modal, I.modal(d.modal)], [t.moeda, moeda], [t.tipo, I.tipo(d.tipo), 1.2], [t.proposito, I.proposito(d.proposito)],
    ]);

    // ── Exportador | Importador (indireta: Vendedor | Comprador — quem exporta é a trading) ──
    const indireta = d.tipo === 'exportacao_indireta';
    const cidadeImp = [vv(d.destinatario_cidade), vv(d.destinatario_estado)].filter(Boolean).join(' / ');
    Y = pvQuadros(doc, Y, [
        { titulo: indireta ? t.vendedor : t.exportador, nome: nomeExp, ultimaCinza: !!d._contato_exp,
          linhas: [d.documento ? `${t.identificacao}: ${d.documento}` : '', [vv(d.endereco), cidadeExp].filter(Boolean).join(' · '),
                   [vv(d.origem_pais), vv(d.cep)].filter(Boolean).join(' · '), d._contato_exp ? `${t.contato}: ${d._contato_exp}` : ''].filter(Boolean) },
        // exportação indireta: a destinatária é a trading (compradora), não o importador
        { titulo: indireta ? t.comprador : t.importador, nome: vv(d.destinatario_razao_social) || '—', ultimaCinza: !!d._contato_imp,
          linhas: [d.destinatario_doc ? `${t.identificacao_fiscal}: ${d.destinatario_doc}` : '', [vv(d.destinatario_endereco), cidadeImp].filter(Boolean).join(' · '),
                   [vv(d.destinatario_pais || d.destino_pais), vv(d.destinatario_cep)].filter(Boolean).join(' · '), d._contato_imp ? `${t.contato}: ${d._contato_imp}` : ''].filter(Boolean) },
    ]);

    // ── Embarque | Condições de pagamento ──
    Y = pvQuadros(doc, Y, [
        { titulo: t.embarque, chaves: [
            [t.origem, [vv(d.origem_pais), vv(pontoOrigem)].filter(Boolean).join(' · ')],
            [t.destino, [vv(d.destino_pais), vv(pontoDestino)].filter(Boolean).join(' · ')],
            ...(d.previsao_embarque ? [[t.previsao_embarque, I.data(d.previsao_embarque)]] : []),
            ...(indireta && d._importador_final ? [[t.importador_final, d._importador_final]] : []),
            ...(indireta ? [[t.operacao, t.fim_especifico]] : []),
        ] },
        { titulo: t.condicoes_pagamento, chaves: [
            [t.forma, I.formaPagamento(d.forma_pagamento)],
            [t.prazo, I.prazoPagamento(d.prazo_pagamento)],
            [t.validade_proposta, d.validade_dias ? (/^\d+$/.test(String(d.validade_dias)) ? t.dias(d.validade_dias) : String(d.validade_dias)) : '—'],
        ] },
    ]);

    // ── Itens ──
    Y = pvTituloSecao(doc, Y, t.itens);
    let subtotal = 0;
    const linhas = itens.map((it, i) => {
        const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0); subtotal += tot;
        const sub = [it.descricao && it.descricao !== it.produto ? it.descricao : '', it.ncm ? `${t.col_ncm} ${it.ncm}` : '', it.hs_code ? `HS ${it.hs_code}` : '',
                     it.marca ? `${t.col_marca.charAt(0) + t.col_marca.slice(1).toLowerCase()} ${it.marca}` : '', it.fabricante ? `${t.col_fabricante.charAt(0) + t.col_fabricante.slice(1).toLowerCase()} ${it.fabricante}` : '']
                    .filter(Boolean).join(' · ');
        return [String(i + 1), { txt: vv(it.sku || it.codigo) || '—', negrito: true, cor: PDF_CORES.AZUL }, { txt: vv(it.produto) || '—', sub },
                { txt: Number(it.qtd || 0).toLocaleString(I.loc), sub: vv(it.unidade) }, I.num(it.preco), { txt: I.num(tot), negrito: true }];
    });
    Y = pvTabela(doc, Y, [
        { rot: '#', w: 9 }, { rot: t.col_codigo, w: 21 }, { rot: t.col_descricao, w: 0 },
        { rot: t.col_qtd, w: 20, al: 'r' }, { rot: t.col_valor_unit, w: 24, al: 'r' }, { rot: t.col_total, w: 28, al: 'r' },
    ], linhas);

    // ── Logística + total por extenso | Totais ──
    const frete = Number(d.frete_valor) || 0, seguro = Number(d.seguro_valor) || 0;
    const total = subtotal + frete + seguro;
    Y = pvResumo(doc, Y, {
        stats: [[t.volumes_rot, vv(d.volume_total)], [t.peso_liquido, vv(d.peso_liquido)], [t.peso_bruto, vv(d.peso_bruto)], [t.cubagem, vv(d.cubagem)]]
            .filter(([, v]) => v),
        extenso: total ? pdfValorPorExtenso(total, moeda, I.cod) : '', rotExtenso: t.total_extenso,
        totais: [[t.subtotal, I.num(subtotal)], ...(frete ? [[t.frete, I.num(frete)]] : []), ...(seguro ? [[t.seguro, I.num(seguro)]] : []), [t.total_geral, I.num(total)]],
        rotuloTotal: `${t.total_geral}${moeda ? ' · ' + moeda : ''}`,
    });

    // ── Dados bancários | Observações ──
    const obs = [vv(d.condicoes_obs), vv(d.observacoes)].filter(Boolean).join('\n');
    Y = pvQuadros(doc, Y, [
        pvQuadroBanco(d.dados_bancarios, t, nomeExp),
        obs ? { titulo: t.observacoes, texto: obs } : null,
    ], 0.56);

    // ── Assinaturas (no pé da página) ──
    pvAssinaturas(doc, Y, [
        { nome: nomeExp, rotulo: indireta ? t.assinatura_vendedor : t.assinatura_exportador },
        { nome: vv(d.destinatario_razao_social) || '—', rotulo: indireta ? t.assinatura_aceite_comprador : t.assinatura_aceite },
    ]);

    pvRodape(doc, { t, textoDireita: `${t.proforma_invoice} ${codigo}` });

    if (opcoes.retornarBlob) return doc.output('blob');
    doc.save(`proforma_${codigo}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ========================================
// ANEXO AUTOMÁTICO — "Nº Proforma Invoice"
// ========================================
// O PDF da Proforma é gerado pelo próprio sistema, então ele mesmo anexa o
// arquivo ao documento "Nº Proforma Invoice" (tela Documentos), registrando
// quem criou e quando. Nunca sobrescreve um arquivo enviado pelo usuário nem
// um documento já assinado — só substitui a versão anterior gerada pelo sistema.
const PDF_PROFORMA_PREFIXO_SISTEMA = 'proforma_sistema_';

async function anexarPDFProformaAutomatico(d, registroAtual) {
    if (!d?.id) return null;
    try {
        if (registroAtual === undefined) {
            const { data } = await supabaseClient.from('proforma_documentos')
                .select('*').eq('proforma_id', d.id).eq('tipo_documento', 'proforma').maybeSingle();
            registroAtual = data || null;
        }
        const anterior = registroAtual?.arquivo_path || '';
        const doSistema = anterior.split('/').pop().startsWith(PDF_PROFORMA_PREFIXO_SISTEMA);
        if (registroAtual?.assinado || (anterior && !doSistema)) return null;

        const blob = await gerarPDFProformaDados(d, { retornarBlob: true });
        if (!blob) return null;
        const path = `${d.id}/${PDF_PROFORMA_PREFIXO_SISTEMA}${Date.now()}.pdf`;
        const { error } = await supabaseClient.storage.from('proforma-documentos-assinados')
            .upload(path, blob, { contentType: 'application/pdf' });
        if (error) { console.warn('[Proforma] anexo automático:', error.message); return null; }

        const res = await window.supabaseAPI.anexarDocumentoProforma(d.id, 'proforma', null, path, `Proforma_${d.codigo || d.id}.pdf`);
        if (!res.sucesso) { supabaseClient.storage.from('proforma-documentos-assinados').remove([path]).catch(() => {}); return null; }
        if (anterior) supabaseClient.storage.from('proforma-documentos-assinados').remove([anterior]).catch(() => {});
        return res.data;
    } catch (e) {
        console.warn('[Proforma] anexo automático falhou:', e);
        return null;
    }
}
