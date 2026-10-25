// ========================================
// RESUMO (botão "Ver" dos cards de Proforma e Processo)
// ========================================
// Painel lateral, só leitura, na própria tela (sem abrir aba): mostra só o que
// está preenchido — partes, condições, itens com totais, vínculos
// Proforma ↔ Processos e documentos feitos. O formulário completo continua a
// um clique (Editar / Formulário completo). Usado por proforma.html e
// processos.html; depende de auth.js (escHtml), pdf-kit.js (_pdfCodigoMoeda),
// doc-tipos.js, documentos.js (docAbrirJanela) e historico.js (abrirHistorico).

const RES_STATUS = {
    proforma: { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', encerrado: 'Encerrado', recusado: 'Encerrado', finalizado: 'Encerrado' },
    processo: { aberto: 'Aberto', aberta: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos',
                concluido: 'Concluído', cancelado: 'Cancelado', standby: 'Stand-by' },
};
const RES_TIPO = { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' };
const RES_MODAL_ICONE = { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' };

let _resAtual = null;   // { tipo, id } do resumo aberto

function _resPainel() {
    let ov = document.getElementById('resumoOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'resumoOverlay';
    ov.className = 'resumo-overlay';
    ov.innerHTML = `
        <div class="resumo-painel" role="dialog" aria-modal="true" aria-labelledby="resumoTitulo">
            <header class="resumo-cab">
                <div class="resumo-cab-txt">
                    <span class="resumo-cab-tipo" id="resumoTipo"></span>
                    <h2 id="resumoTitulo"></h2>
                    <div class="resumo-cab-sub" id="resumoSub"></div>
                </div>
                <button class="resumo-fechar" type="button" title="Fechar" onclick="fecharResumo()"><i class="fa-solid fa-xmark"></i></button>
            </header>
            <div class="resumo-corpo" id="resumoCorpo"></div>
            <footer class="resumo-rodape" id="resumoRodape"></footer>
        </div>`;
    ov.addEventListener('click', e => { if (e.target === ov) fecharResumo(); });
    document.addEventListener('keydown', e => {
        // Esc fecha o painel — mas não quando há uma janela por cima dele
        if (e.key !== 'Escape' || !ov.classList.contains('aberto')) return;
        if (document.querySelector('.hist-overlay.aberto, .confirmar-overlay')) return;
        fecharResumo();
    });
    document.body.appendChild(ov);
    return ov;
}

function fecharResumo() {
    document.getElementById('resumoOverlay')?.classList.remove('aberto');
    document.body.classList.remove('resumo-aberto');
    _resAtual = null;
}

// ── formatação ───────────────────────────
const _resData = v => {
    if (!v) return '';
    const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v + 'T12:00:00') : new Date(v);
    return isNaN(d) ? '' : d.toLocaleDateString('pt-BR');
};
const _resNum = (v, casas = 2) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
const _resQtd = v => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });
const _resMoeda = m => (typeof _pdfCodigoMoeda === 'function' && _pdfCodigoMoeda(m)) || String(m || '').trim() || '—';
// forma/prazo de pagamento: mesmo rótulo do PDF da Proforma (pdf-proforma.js)
const _resRotulo = (campo, v) => (typeof PDF_PROF_ROTULOS !== 'undefined' && PDF_PROF_ROTULOS[campo]?.[v]) || v || '';
const _resVazio = v => v === null || v === undefined || String(v).trim() === '';
const _resDoc = (doc, tipo) => {
    const d = String(doc || '').replace(/\D/g, '');
    if (d.length === 14) return 'CNPJ ' + d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
    if (d.length === 11) return 'CPF ' + d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
    return doc ? `${tipo ? String(tipo).toUpperCase() + ' ' : ''}${doc}` : '';
};

// Campo "rótulo: valor" — some quando o valor está vazio
function _resCampo(rotulo, valor, { html = false } = {}) {
    if (_resVazio(valor)) return '';
    return `<div class="resumo-campo"><span>${escHtml(rotulo)}</span><strong>${html ? valor : escHtml(valor)}</strong></div>`;
}

function _resSecao(titulo, icone, conteudo) {
    if (!conteudo || !String(conteudo).trim()) return '';
    return `<section class="resumo-secao"><h3><i class="fa-solid ${icone}"></i> ${escHtml(titulo)}</h3>${conteudo}</section>`;
}

function _resParte(rotulo, p) {
    if (!p || (!p.nome && !p.doc)) return '';
    const local = [p.cidade, p.estado, p.pais].filter(Boolean).join(' / ');
    return `<div class="resumo-parte">
        <span class="resumo-parte-rot">${escHtml(rotulo)}</span>
        <strong>${escHtml(p.nome || '—')}</strong>
        ${p.doc ? `<small>${escHtml(p.doc)}</small>` : ''}
        ${local ? `<small><i class="fa-solid fa-location-dot"></i> ${escHtml(local)}</small>` : ''}
    </div>`;
}

const _resDeParceiro = (pc, fallbackNome, fallbackDoc, fallbackTipo) => pc
    ? { nome: pc.nome_fantasia || pc.razao_social, doc: _resDoc(pc.documento), cidade: pc.cidade, estado: pc.estado, pais: pc.pais }
    : (fallbackNome || fallbackDoc ? { nome: fallbackNome, doc: _resDoc(fallbackDoc, fallbackTipo) } : null);

// Origem/destino conforme o modal (porto, aeroporto ou fronteira)
function _resRota(r) {
    const local = {
        maritimo:  [r.porto_origem, r.porto_destino],
        aereo:     [r.aeroporto_origem, r.aeroporto_destino],
        terrestre: [r.fronteira_saida, r.fronteira_entrada],
    }[r.modal] || [];
    const origem  = [local[0], r.origem_pais  || r.pais_origem].filter(Boolean).join(' — ');
    const destino = [local[1], r.destino_pais || r.pais_destino].filter(Boolean).join(' — ');
    return { origem, destino };
}

function _resItens(itens) {
    const lista = (Array.isArray(itens) ? itens : []).filter(it => it && (it.produto || Number(it.qtd ?? it.quantidade)));
    if (!lista.length) return '';
    const totais = {};
    const linhas = lista.map(it => {
        const qtd = Number(it.qtd ?? it.quantidade) || 0;
        const preco = Number(it.preco ?? it.preco_unitario) || 0;
        const moeda = _resMoeda(it.moeda);
        totais[moeda] = (totais[moeda] || 0) + qtd * preco;
        return `<tr>
            <td>${escHtml(it.produto || '—')}${it.ncm ? `<small>NCM ${escHtml(it.ncm)}</small>` : ''}</td>
            <td class="num">${_resQtd(qtd)} ${escHtml(it.unidade || '')}</td>
            <td class="num">${escHtml(moeda)} ${_resNum(preco)}</td>
            <td class="num">${escHtml(moeda)} ${_resNum(qtd * preco)}</td>
        </tr>`;
    }).join('');
    const tot = Object.entries(totais).map(([m, v]) => `<div class="resumo-total"><span>Total ${escHtml(m)}</span><strong>${escHtml(m)} ${_resNum(v)}</strong></div>`).join('');
    return `<div class="resumo-tabela-wrap"><table class="resumo-tabela">
        <thead><tr><th>Produto</th><th class="num">Qtd</th><th class="num">Preço</th><th class="num">Total</th></tr></thead>
        <tbody>${linhas}</tbody></table></div>${tot}`;
}

// Documentos feitos (gerados, anexados ou com Nº preenchido) e assinatura
function _resDocumentos(processos, docs, processoId = null) {
    if (typeof docTiposDaProforma !== 'function') return '';
    const salvos = {};
    (docs || []).forEach(r => { salvos[docChaveRegistro(r)] = r; });
    const tipos = docTiposDaProforma(processos, salvos)
        .filter(t => !t.semProcesso && !t.orfao && (!processoId || t.grupo === processoId || t.id === 'proforma'));
    const feitos = tipos.map(t => {
        const reg = docRegistroDaLinha(salvos, t, processos);
        const feito = !!reg?.assinado || !!reg?.arquivo_path || (!t.custom && docFeitoAutomatico(processos, t.id, t.processoId));
        return feito ? { t, reg } : null;
    }).filter(Boolean);
    const lista = feitos.length
        ? `<ul class="resumo-docs">${feitos.map(({ t, reg }) => `<li>
                <span><i class="fa-solid fa-file-lines"></i> ${escHtml(String(t.label).replace(/^Nº /, ''))}${!processoId && t.processoNumero ? ` <small>${escHtml(t.processoNumero)}</small>` : ''}</span>
                ${reg?.assinado
                    ? '<em class="resumo-tag resumo-tag--ok"><i class="fa-solid fa-signature"></i> Assinado</em>'
                    : '<em class="resumo-tag resumo-tag--aviso">Sem assinatura</em>'}
            </li>`).join('')}</ul>`
        : '<p class="resumo-nada">Nenhum documento feito ainda.</p>';
    return `<p class="resumo-contagem">${feitos.length} de ${tipos.length} documento${tipos.length === 1 ? '' : 's'} feito${feitos.length === 1 ? '' : 's'}</p>${lista}`;
}

async function _resParceiros(ids) {
    const lista = [...new Set(ids.filter(Boolean))];
    if (!lista.length) return {};
    const { data } = await supabaseClient.from('parceiros').select('*').in('id', lista);
    return Object.fromEntries((data || []).map(p => [p.id, p]));
}

function _resPropria(doc, docTipo) {
    const u = obterUsuarioLogado() || {};
    return { nome: u.empresa || '(Própria empresa)', doc: _resDoc(doc, docTipo) };
}

// ── etapas do Processo (clicar no círculo conclui / reabre) ──
let _resEtapas = null;   // { processoId, ctx, lista }

function _resEtapasHtml(lista) {
    const r = etapasResumo(lista);
    return `
        <div class="resumo-progresso"><div style="width:${r.pct}%"></div></div>
        <p class="resumo-contagem">${r.feitas} de ${r.total} etapa${r.total === 1 ? '' : 's'} concluída${r.feitas === 1 ? '' : 's'}${r.proxima ? ` · Próxima: <strong>${escHtml(r.proxima.nome)}</strong>` : ''}</p>
        ${r.atrasadas.length ? `<p class="resumo-alerta"><i class="fa-solid fa-triangle-exclamation"></i> ${r.atrasadas.length} etapa${r.atrasadas.length > 1 ? 's' : ''} atrasada${r.atrasadas.length > 1 ? 's' : ''}</p>` : ''}
        <ul class="resumo-etapas">${lista.filter(e => e && String(e.nome || '').trim()).map(e => {
            const sit = etapaSituacao(e);
            const prazoTxt = sit ? `<small class="resumo-etapa-origem ${sit.atrasada ? 'atrasada' : sit.vence ? 'vence' : ''}">${sit.atrasada ? '<i class="fa-solid fa-triangle-exclamation"></i> ' : ''}${escHtml(etapaSituacaoTexto(e))}</small>` : '';
            const origem = !e.concluida ? '' : e.auto ? `<i class="fa-solid fa-bolt"></i> automática — ${escHtml(e.auto)}`
                : e.por ? `por ${escHtml(e.por)}${e.em ? ' em ' + new Date(e.em).toLocaleDateString('pt-BR') : ''}` : '';
            return `<li class="${e.concluida ? 'ok' : ''}${r.proxima === e ? ' proxima' : ''}${sit?.atrasada ? ' atrasada' : ''}">
                <button type="button" class="resumo-etapa-check" data-etapa="${escHtml(e.id)}" title="${e.concluida ? 'Reabrir etapa' : 'Concluir etapa'}">
                    <i class="fa-${e.concluida ? 'solid fa-circle-check' : 'regular fa-circle'}"></i></button>
                <span class="resumo-etapa-txt">${escHtml(e.nome)}${origem ? `<small class="resumo-etapa-origem${e.auto ? ' auto' : ''}">${origem}</small>` : ''}${prazoTxt}</span>
                ${e.data ? `<small class="resumo-etapa-data">${escHtml(_resData(e.data))}</small>` : ''}</li>`;
        }).join('')}</ul>`;
}

async function _resMarcarEtapa(etapaId) {
    const st = _resEtapas;
    const e = st?.lista.find(x => String(x.id) === String(etapaId));
    if (!e) return;
    if (e.auto && e.concluida && !(await confirmarAcao(
        `"${e.nome}" foi concluída automaticamente (${e.auto}). Reabrir mesmo assim? Ela deixa de ser atualizada sozinha.`,
        { titulo: 'Reabrir etapa', confirmar: 'Reabrir', cancelar: 'Não' }))) return;
    const anterior = st.lista;
    st.lista = st.lista.map(x => x === e ? etapaMarcar(x, !x.concluida) : x);
    const box = document.getElementById('resumoEtapas');
    if (box) box.innerHTML = _resEtapasHtml(st.lista);
    const { error } = await supabaseClient.from('processos').update({ etapas: st.lista }).eq('id', st.processoId);
    if (error) {
        st.lista = anterior;
        if (box && _resEtapas === st) box.innerHTML = _resEtapasHtml(anterior);
        mostrarNotificacao('Não foi possível salvar a etapa: ' + error.message, 'erro');
        return;
    }
    if (typeof procAtualizarEtapasCard === 'function') procAtualizarEtapasCard(st.processoId, st.lista);
}

// ── abrir ────────────────────────────────
async function abrirResumo(tipo, id) {
    const ov = _resPainel();
    _resAtual = { tipo, id };
    document.getElementById('resumoTipo').textContent = tipo === 'proforma' ? 'Proforma' : 'Processo';
    document.getElementById('resumoTitulo').textContent = 'Carregando...';
    document.getElementById('resumoSub').innerHTML = '';
    document.getElementById('resumoCorpo').innerHTML = '<div class="resumo-carregando"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    document.getElementById('resumoRodape').innerHTML = '';
    ov.classList.add('aberto');
    document.body.classList.add('resumo-aberto');

    try {
        if (tipo === 'proforma') await _resProforma(id);
        else await _resProcesso(id);
    } catch (e) {
        if (_resAtual?.id !== id) return;
        document.getElementById('resumoTitulo').textContent = 'Não foi possível abrir';
        document.getElementById('resumoCorpo').innerHTML = `<p class="resumo-nada">${escHtml(e.message || e)}</p>`;
    }
}

function _resCabecalho(numero, statusTxt, statusCls, info) {
    document.getElementById('resumoTitulo').textContent = numero || '—';
    document.getElementById('resumoSub').innerHTML =
        `<span class="resumo-status resumo-status--${escHtml(statusCls || '')}">${escHtml(statusTxt || '—')}</span>`
        + info.filter(Boolean).map(t => `<span>${escHtml(t)}</span>`).join('');
}

function _resRodape(botoes) {
    document.getElementById('resumoRodape').innerHTML = botoes.map(b =>
        `<button type="button" class="resumo-btn${b.principal ? ' resumo-btn--principal' : ''}" data-acao="${b.acao}"><i class="fa-solid ${b.icone}"></i> ${escHtml(b.texto)}</button>`).join('');
    document.querySelectorAll('#resumoRodape [data-acao]').forEach((el, i) => el.addEventListener('click', botoes[i].fn));
}

async function _resProforma(id) {
    const [{ data: p, error }, { data: procs }, docsRes] = await Promise.all([
        supabaseClient.from('proformas').select('*').eq('id', id).single(),
        supabaseClient.from('processos').select('id, numero_processo, status, modal, tipo, itens, documentos').eq('proforma_id', id).neq('status', 'excluido'),
        window.supabaseAPI.buscarDocumentosProformas([id]),
    ]);
    if (error) throw error;
    const [parc, nomes] = await Promise.all([
        _resParceiros([p.parceiro_id, p.destinatario_id, p.importador_final_id]),
        window.supabaseAPI.buscarNomesUsuarios([p.criado_por]),
    ]);
    if (_resAtual?.id !== id) return;
    const processos = procs || [];

    _resCabecalho(p.codigo, RES_STATUS.proforma[p.status] || p.status, p.status, [
        RES_TIPO[p.tipo] || p.tipo,
        p.data_emissao ? `Emitida em ${_resData(p.data_emissao)}` : '',
        nomes[p.criado_por] ? `por ${nomes[p.criado_por]}` : '',
    ]);

    const exportador = p.emissor_tipo === 'terceiro'
        ? _resDeParceiro(parc[p.parceiro_id], p.parceiro_razao_social)
        : _resPropria(p.documento, p.documento_tipo);
    const importador = _resDeParceiro(parc[p.destinatario_id], p.destinatario_razao_social, p.destinatario_doc, p.destinatario_doc_tipo);
    // Exportação indireta: a destinatária é a trading (compradora); o importador lá fora é opcional
    const indireta = p.tipo === 'exportacao_indireta';
    const partesHtml = indireta
        ? _resParte('Exportador', exportador) + _resParte('Trading (compradora)', importador) + _resParte('Importador final', _resDeParceiro(parc[p.importador_final_id]))
        : _resParte('Exportador', exportador) + _resParte('Importador', importador);
    const rota = _resRota(p);

    const saldo = processos.length ? calcularSaldoProforma(p.itens, processos) : null;
    const vinculos = processos.length
        ? `<p class="resumo-contagem">${processos.length} processo${processos.length > 1 ? 's' : ''} · ${saldo.percentual}% embarcado</p>
           <div class="resumo-links">${processos.map(pr => `<button type="button" class="resumo-link" data-processo="${escHtml(pr.id)}">
                <i class="fa-solid ${RES_MODAL_ICONE[pr.modal] || 'fa-route'}"></i> ${escHtml(pr.numero_processo || 'Processo')}
                <em>${escHtml(RES_STATUS.processo[pr.status] || pr.status || '')}</em></button>`).join('')}</div>`
        : '<p class="resumo-nada">Nenhum processo gerado ainda.</p>';

    document.getElementById('resumoCorpo').innerHTML = [
        _resSecao('Partes', 'fa-people-arrows', `<div class="resumo-partes">${partesHtml}</div>`),
        _resSecao('Condições', 'fa-handshake', `<div class="resumo-grade">${[
            _resCampo('Incoterm', [p.incoterm, p.incoterm_local].filter(Boolean).join(' — ')),
            _resCampo('Modal', DOC_MODAL_LABEL[p.modal] || p.modal),
            _resCampo('Moeda', p.moeda_principal),
            _resCampo('Origem', rota.origem),
            _resCampo('Destino', rota.destino),
            _resCampo('Forma de pagamento', _resRotulo('forma_pagamento', p.forma_pagamento)),
            _resCampo('Prazo de pagamento', _resRotulo('prazo_pagamento', p.prazo_pagamento)),
            _resCampo('Previsão de embarque', _resData(p.previsao_embarque)),
            _resCampo('Validade', _resData(p.data_validade) || (p.validade_dias ? `${p.validade_dias} dias` : '')),
            _resCampo('Frete', Number(p.frete_valor) ? _resNum(p.frete_valor) : ''),
            _resCampo('Seguro', Number(p.seguro_valor) ? _resNum(p.seguro_valor) : ''),
        ].join('')}</div>`),
        _resSecao('Itens', 'fa-boxes-stacked', _resItens(p.itens)),
        _resSecao('Processos', 'fa-diagram-project', vinculos),
        _resSecao('Documentos', 'fa-folder-open', _resDocumentos(processos, docsRes?.data, null)),
        _resSecao('Observações', 'fa-note-sticky', [p.condicoes_obs, p.observacoes].filter(v => !_resVazio(v)).map(v => `<p class="resumo-obs">${escHtml(v)}</p>`).join('')),
    ].join('');
    document.querySelectorAll('#resumoCorpo [data-processo]').forEach(b => b.addEventListener('click', () => abrirResumo('processo', b.dataset.processo)));

    _resRodape([
        { acao: 'editar', icone: 'fa-pen', texto: 'Editar', principal: true, fn: () => window.open(`formularios.html?tab=proposta&id=${encodeURIComponent(id)}`, '_blank') },
        { acao: 'documentos', icone: 'fa-folder-open', texto: 'Documentos', fn: () => typeof profVerDocumentos === 'function'
            ? profVerDocumentos(id) : docAbrirJanela({ proformaId: id, titulo: `Documentos — Proforma ${p.codigo || ''}` }) },
        { acao: 'historico', icone: 'fa-clock-rotate-left', texto: 'Histórico', fn: () => abrirHistorico('proforma', id, p.codigo) },
        { acao: 'completo', icone: 'fa-up-right-from-square', texto: 'Formulário completo', fn: () => window.open(`formularios.html?tab=proposta&id=${encodeURIComponent(id)}&modo=visualizar`, '_blank') },
    ]);
}

async function _resProcesso(id) {
    const { data: pr, error } = await supabaseClient.from('processos').select('*').eq('id', id).single();
    if (error) throw error;
    const [profRes, irmaosRes, docsRes] = await Promise.all([
        pr.proforma_id ? supabaseClient.from('proformas').select('*').eq('id', pr.proforma_id).maybeSingle() : { data: null },
        pr.proforma_id ? supabaseClient.from('processos').select('id, numero_processo, status, modal, tipo, itens, documentos').eq('proforma_id', pr.proforma_id).neq('status', 'excluido') : { data: [pr] },
        pr.proforma_id ? window.supabaseAPI.buscarDocumentosProformas([pr.proforma_id]) : { data: [] },
    ]);
    const prof = profRes.data;
    const [parc, nomes] = await Promise.all([
        _resParceiros([pr.remetente_parceiro_id, pr.empresa_parceira_id, pr.trading_id, prof?.parceiro_id, prof?.destinatario_id, prof?.importador_final_id]),
        window.supabaseAPI.buscarNomesUsuarios([pr.criado_por]),
    ]);
    if (_resAtual?.id !== id) return;

    _resCabecalho(pr.numero_processo, RES_STATUS.processo[pr.status] || pr.status, pr.status, [
        RES_TIPO[pr.tipo] || pr.tipo,
        pr.data_abertura ? `Aberto em ${_resData(pr.data_abertura)}` : _resData(pr.criado_em),
        nomes[pr.criado_por] ? `por ${nomes[pr.criado_por]}` : '',
    ]);

    // Mesma regra do card: sem dado no Processo, vale a Proforma de origem
    let exportador;
    if (pr.emissor_tipo === 'terceiro' && pr.remetente_parceiro_id) exportador = _resDeParceiro(parc[pr.remetente_parceiro_id]);
    else if (pr.emissor_tipo === 'terceiro' || prof?.emissor_tipo === 'terceiro') exportador = _resDeParceiro(parc[prof?.parceiro_id], prof?.parceiro_razao_social, pr.documento, pr.documento_tipo);
    else exportador = _resPropria(pr.documento || prof?.documento, pr.documento_tipo || prof?.documento_tipo);
    // Exportação indireta: a trading exporta; o importador é o importador final da Proforma
    const indireta = pr.tipo === 'exportacao_indireta';
    const importador = indireta
        ? _resDeParceiro(parc[pr.empresa_parceira_id] || parc[prof?.importador_final_id])
        : _resDeParceiro(parc[pr.empresa_parceira_id] || parc[prof?.destinatario_id], prof?.destinatario_razao_social, prof?.destinatario_doc, prof?.destinatario_doc_tipo);
    const partesHtml = _resParte('Exportador', exportador)
        + (indireta ? _resParte('Trading (exportadora)', _resDeParceiro(parc[pr.trading_id] || parc[prof?.destinatario_id])) : '')
        + _resParte(indireta ? 'Importador final' : 'Importador', importador);
    const rota = _resRota(pr);
    const tr = pr.transporte || {};

    // Etapas: conclusão automática pelo que o sistema já sabe (etapas.js)
    const regsDoc = docsRes?.data || [];
    const unicoProc = (irmaosRes.data || []).length <= 1;
    const anexadoNoProc = tipo => regsDoc.some(r => r.tipo_documento === tipo && (r.arquivo_path || r.assinado)
        && (r.processo_id ? String(r.processo_id) === String(pr.id) : unicoProc));
    const ctxEtapas = typeof etapasContexto === 'function' ? etapasContexto({
        documentos: pr.documentos, data_embarque: pr.data_embarque, data_chegada: pr.data_chegada, nf_remessa_data: pr.nf_remessa_data,
        proformaAssinada: regsDoc.some(r => r.tipo_documento === 'proforma' && r.assinado),
        dueAnexada: anexadoNoProc('due'),
        memorandoAnexado: anexadoNoProc('memorando'),
    }) : null;
    _resEtapas = { processoId: id, ctx: ctxEtapas,
        lista: ctxEtapas
            ? etapasCalcularPrazos(etapasAplicarAutomaticas(pr.etapas, ctxEtapas).etapas, {
                previsao: pr.data_previsao || prof?.previsao_embarque, data_embarque: pr.data_embarque, data_chegada: pr.data_chegada,
                nf_remessa_data: pr.nf_remessa_data, modal: pr.modal })
            : (Array.isArray(pr.etapas) ? pr.etapas : []) };
    const etapasHtml = _resEtapas.lista.length ? `<div id="resumoEtapas">${_resEtapasHtml(_resEtapas.lista)}</div>` : '';

    const origemHtml = prof
        ? `<div class="resumo-links"><button type="button" class="resumo-link" data-proforma="${escHtml(prof.id)}">
               <i class="fa-solid fa-file-invoice-dollar"></i> Proforma ${escHtml(prof.codigo || '')}
               <em>${escHtml(RES_STATUS.proforma[prof.status] || prof.status || '')}</em></button></div>`
        : '<p class="resumo-nada">Processo sem Proforma de origem.</p>';

    document.getElementById('resumoCorpo').innerHTML = [
        _resSecao('Partes', 'fa-people-arrows', `<div class="resumo-partes">${partesHtml}</div>`),
        _resSecao('Embarque', RES_MODAL_ICONE[pr.modal] || 'fa-route', `<div class="resumo-grade">${[
            _resCampo('Modal', DOC_MODAL_LABEL[pr.modal] || pr.modal),
            _resCampo('Incoterm', pr.incoterm),
            _resCampo('Moeda', pr.moeda),
            _resCampo('Origem', rota.origem),
            _resCampo('Destino', rota.destino),
            _resCampo(pr.modal === 'aereo' ? 'Aeronave' : 'Navio', pr.modal === 'aereo' ? pr.aeronave : pr.modal === 'maritimo' ? pr.navio : ''),
            pr.modal === 'maritimo' ? _resCampo('Container', [pr.container_tipo, pr.container_numero].filter(Boolean).join(' — ')) : '',
            _resCampo('Transportadora', tr.nome || tr.razao),
            _resCampo('Previsão de embarque', _resData(pr.data_previsao || prof?.previsao_embarque)),
            _resCampo('Embarque', _resData(pr.data_embarque)),
            _resCampo('Chegada', _resData(pr.data_chegada)),
            indireta ? _resCampo('NF de remessa', [pr.documentos?.nfremessa, _resData(pr.nf_remessa_data)].filter(Boolean).join(' — ')) : '',
            indireta ? _resCampo('Memorando de Exportação', pr.documentos?.memorando) : '',
            _resCampo('Pagamento', [_resRotulo('forma_pagamento', prof?.forma_pagamento), _resRotulo('prazo_pagamento', prof?.prazo_pagamento)].filter(Boolean).join(' — ')),
        ].join('')}</div>`),
        _resSecao('Itens', 'fa-boxes-stacked', _resItens(pr.itens)),
        _resSecao('Etapas', 'fa-list-check', etapasHtml),
        _resSecao('Proforma de origem', 'fa-link', origemHtml),
        pr.proforma_id ? _resSecao('Documentos', 'fa-folder-open', _resDocumentos(irmaosRes.data || [pr], docsRes?.data, pr.id)) : '',
        _resSecao('Observações', 'fa-note-sticky', [pr.observacoes, pr.obs_prazos].filter(v => !_resVazio(v)).map(v => `<p class="resumo-obs">${escHtml(v)}</p>`).join('')),
    ].join('');
    document.querySelectorAll('#resumoCorpo [data-proforma]').forEach(b => b.addEventListener('click', () => abrirResumo('proforma', b.dataset.proforma)));
    document.getElementById('resumoEtapas')?.addEventListener('click', ev => {
        const b = ev.target.closest('[data-etapa]');
        if (b) _resMarcarEtapa(b.dataset.etapa);
    });

    _resRodape([
        { acao: 'editar', icone: 'fa-pen', texto: 'Editar', principal: true, fn: () => window.open(`formularios.html?tab=processo&id=${encodeURIComponent(id)}`, '_blank') },
        ...(pr.proforma_id ? [{ acao: 'documentos', icone: 'fa-folder-open', texto: 'Documentos',
            fn: () => docAbrirJanela({ proformaId: pr.proforma_id, processoId: id, titulo: `Documentos — Processo ${pr.numero_processo || ''}` }) }] : []),
        { acao: 'historico', icone: 'fa-clock-rotate-left', texto: 'Histórico', fn: () => abrirHistorico('processo', id, pr.numero_processo) },
        { acao: 'completo', icone: 'fa-up-right-from-square', texto: 'Formulário completo', fn: () => window.open(`formularios.html?tab=processo&id=${encodeURIComponent(id)}&modo=visualizar`, '_blank') },
    ]);
}
