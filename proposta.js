// ========================================
// PROPOSTA — tela de gestão (criar/editar/avançar/excluir)
// ========================================
// Modelada em cima de pedidos.js (Kanban+Lista, filtros, Excluídos com
// restauração em 7 dias) + a lógica de oportunidades que já existia em
// pipeline.js (que agora só visualiza, sem nenhuma ação de escrita —
// ver pipeline.js). Diferente de Pedido: sem itens de linha (valor é um
// campo único) e sem geração de PDF.

let _propTodas    = [];
let _propFiltradas = [];
let _propExcluirId = null;
let _propPedidosMap = {};
let _propViewMode  = 'kanban';
let _propExcluidosAberto = false;

const PROP_ETAPAS = ['proposta', 'negociacao', 'fechado', 'perdido'];

const PROP_ETAPA_LABEL = {
    proposta:    'Proposta',
    negociacao:  'Negociação',
    fechado:     'Fechado',
    perdido:     'Perdido',
};

const PROP_ETAPA_BADGE_CLASS = {
    proposta:    'prop-badge-proposta',
    negociacao:  'prop-badge-negociacao',
    fechado:     'prop-badge-fechado',
    perdido:     'prop-badge-perdido',
};

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _propCarregarUsuario();
    await _propCarregarMoedas();
    await propCarregar();
    await _propTratarParametrosUrl();
});

function _propCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Moedas (tabela apoio_moedas) ─────────────────────────────────────────────

async function _propCarregarMoedas() {
    const sel = document.getElementById('propMoeda');
    if (!sel) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('descricao', { ascending: true });
        if (data?.length) {
            sel.innerHTML = data.map(m => `<option value="${m.sigla || m.codigo}">${_propEscapar(m.descricao || '')}</option>`).join('');
        }
    } catch (e) {
        console.warn('[Proposta] Falha ao carregar moedas:', e);
    }
}

// ── URL: ?editar=<id> / ?visualizar=<id> (vindo do Pipeline, só leitura) ────

async function _propTratarParametrosUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('editar') || params.get('visualizar');
    if (!id) return;

    await propAbrirModal(id);
    if (params.get('visualizar')) propAplicarModoVisualizacao();
}

// Desabilita todo o formulário do modal e some com o rodapé de ações — usado
// quando a Proposta é aberta só pra consulta (link "ver detalhes" do
// Pipeline), mesmo padrão de modo visualização já usado em Pedidos.
function propAplicarModoVisualizacao() {
    const body = document.getElementById('prop-form-body');
    if (!body) return;

    body.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });

    const footer = document.getElementById('prop-form-footer');
    if (footer) footer.style.display = 'none';

    const banner = document.createElement('div');
    banner.style.cssText = 'position:sticky;top:0;z-index:100;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.3px;border-radius:8px;margin-bottom:12px;';
    banner.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Modo Visualização — somente leitura';
    body.insertBefore(banner, body.firstChild);
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function propCarregar() {
    const res = await buscarOportunidades();
    if (!res.sucesso) return;
    _propTodas = res.data || [];
    _propFiltradas = [..._propTodas];

    // Link reverso: quais propostas já geraram um Pedido
    _propPedidosMap = {};
    const oportunidadeIds = _propTodas.map(o => o.id).filter(Boolean);
    if (oportunidadeIds.length > 0) {
        try {
            const { data: pedidosLinkados } = await supabaseClient
                .from('pedidos')
                .select('id, numero, oportunidade_id')
                .in('oportunidade_id', oportunidadeIds);
            (pedidosLinkados || []).forEach(p => { _propPedidosMap[p.oportunidade_id] = p; });
        } catch (e) {}
    }

    propRenderizar();
}

// ── Filtro ─────────────────────────────────────────────────────────────────

// Debounce (revisão de performance) — ver mesmo comentário em contas-receber.js
let _propFiltrarTimer = null;
function propFiltrar() {
    clearTimeout(_propFiltrarTimer);
    _propFiltrarTimer = setTimeout(() => {
        const termo = document.getElementById('filtroProposta')?.value.toLowerCase().trim() || '';
        const etapaFiltro = document.getElementById('filtroEtapaProposta')?.value || '';
        _propFiltradas = _propTodas.filter(o => {
            const txt = [o.titulo, o.responsavel, o.parceiros?.razao_social, o.parceiros?.nome_fantasia]
                .filter(Boolean).join(' ').toLowerCase();
            if (!txt.includes(termo)) return false;
            if (etapaFiltro && o.etapa !== etapaFiltro) return false;
            return true;
        });
        propRenderizar();
    }, 200);
}

// ── Dispatcher Kanban/Lista ──────────────────────────────────────────────────

function propRenderizar() {
    _propAtualizarContadores();
    if (_propViewMode === 'kanban') _propRenderizarKanban();
    else _propRenderizarTabela();
}

function _propAtualizarContadores() {
    PROP_ETAPAS.forEach(etapa => {
        const count    = _propFiltradas.filter(o => o.etapa === etapa).length;
        const colCount = document.getElementById(`prop-count-${etapa}`);
        const tabCount = document.getElementById(`prop-tabcount-${etapa}`);
        if (colCount) colCount.textContent = count;
        if (tabCount) tabCount.textContent = count;
    });
}

function propSwitchView(mode) {
    _propViewMode = mode;
    document.getElementById('propBtnViewKanban').classList.toggle('active', mode === 'kanban');
    document.getElementById('propBtnViewLista').classList.toggle('active',  mode === 'lista');
    document.getElementById('propKanban').style.display      = mode === 'kanban' ? '' : 'none';
    document.getElementById('propKanbanTabs').style.display  = mode === 'kanban' ? '' : 'none';
    document.querySelector('.prop-table-wrap').style.display = mode === 'lista' ? '' : 'none';
    propRenderizar();
}

function propKanbanSwitchTab(btn) {
    document.querySelectorAll('#propKanbanTabs .kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const etapa = btn.getAttribute('data-col');
    document.querySelectorAll('#propKanban .pl-col').forEach(c => {
        c.style.display = c.dataset.etapa === etapa ? '' : 'none';
    });
}

// ── Renderizar kanban ──────────────────────────────────────────────────────

function _propRenderizarKanban() {
    PROP_ETAPAS.forEach(etapa => {
        const col = document.getElementById(`prop-col-${etapa}`);
        if (!col) return;

        const cards = _propFiltradas.filter(o => o.etapa === etapa);
        if (!cards.length) {
            col.innerHTML = '<div class="pl-col-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhuma proposta</p></div>';
            return;
        }
        col.innerHTML = cards.map(o => _propRenderCard(o)).join('');
    });
}

function _propRenderCard(o) {
    const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
    const valor   = o.valor
        ? `${o.moeda || 'USD'} ${Number(o.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    const dataFmt = o.data_prevista
        ? new Date(o.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    const podeAvancar = o.etapa !== 'fechado' && o.etapa !== 'perdido';
    const proxEtapa   = { proposta: 'negociacao', negociacao: 'fechado' };

    let botaoPedido = '';
    if (o.etapa === 'fechado') {
        const pedidoLinkado = _propPedidosMap[o.id];
        if (pedidoLinkado) {
            botaoPedido = `<button class="btn-ver-processo" onclick="propVerPedido('${pedidoLinkado.id}')"><i class="fa-solid fa-bag-shopping"></i> Ver Pedido ${_propEscapar(pedidoLinkado.numero || '')}</button>`;
        } else {
            botaoPedido = `<button class="btn-seguir-processo" onclick="propGerarPedido('${o.id}')"><i class="fa-solid fa-bag-shopping"></i> Gerar Pedido</button>`;
        }
    }

    return `
        <div class="pl-card" data-etapa="${o.etapa}" data-id="${o.id}">
            <div class="pl-card-header">
                <span class="pl-card-titulo">${_propEscapar(o.titulo)}</span>
            </div>

            <div class="pl-card-cliente">
                <i class="fa-solid fa-building"></i> ${_propEscapar(cliente)}
            </div>

            ${valor ? `<div class="pl-card-valor"><i class="fa-solid fa-coins"></i> ${valor}</div>` : ''}

            <div class="pl-card-footer">
                <div class="pl-card-meta">
                    ${o.responsavel ? `<span class="pl-card-resp"><i class="fa-solid fa-user-tie"></i> ${_propEscapar(o.responsavel)}</span>` : '<span></span>'}
                    ${dataFmt ? `<span class="pl-card-data"><i class="fa-regular fa-calendar"></i> ${dataFmt}</span>` : '<span></span>'}
                </div>
                ${botaoPedido}
                <div class="pl-card-btns">
                    <button class="pl-btn-acao pl-btn-editar" onclick="propAbrirModal('${o.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${podeAvancar ? `
                    <button class="pl-btn-acao pl-btn-avancar" onclick="propAvancarEtapa('${o.id}')" title="Avançar para ${PROP_ETAPA_LABEL[proxEtapa[o.etapa]]}">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>` : ''}
                    <button class="pl-btn-acao pl-btn-excluir" onclick="propAbrirModalExcluir('${o.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
}

// ── Renderizar tabela ──────────────────────────────────────────────────────

function _propRenderizarTabela() {
    const tbody = document.getElementById('propTbody');
    if (!_propFiltradas.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="prop-vazio"><i class="fa-regular fa-folder-open"></i> Nenhuma proposta encontrada.</td></tr>';
        return;
    }

    tbody.innerHTML = _propFiltradas.map(o => {
        const cliente   = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
        const remetente = o.remetente?.nome_fantasia || o.remetente?.razao_social || '';
        const valor     = o.valor
            ? `${o.moeda || 'USD'} ${Number(o.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '—';
        const previsao  = o.data_prevista
            ? new Date(o.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';
        const etapa      = o.etapa || 'proposta';
        const badgeClass = PROP_ETAPA_BADGE_CLASS[etapa] || '';
        const badgeLabel = PROP_ETAPA_LABEL[etapa] || etapa;
        const podeAvancar = etapa !== 'fechado' && etapa !== 'perdido';
        const proxEtapa   = { proposta: 'negociacao', negociacao: 'fechado' };

        let botaoPedido = '';
        if (etapa === 'fechado') {
            const pedidoLinkado = _propPedidosMap[o.id];
            botaoPedido = pedidoLinkado
                ? `<button class="pl-btn-acao pl-btn-editar" onclick="propVerPedido('${pedidoLinkado.id}')" title="Ver Pedido ${_propEscapar(pedidoLinkado.numero || '')}"><i class="fa-solid fa-bag-shopping"></i></button>`
                : `<button class="pl-btn-acao pl-btn-editar" onclick="propGerarPedido('${o.id}')" title="Gerar Pedido"><i class="fa-solid fa-bag-shopping"></i></button>`;
        }

        return `<tr class="prop-row prop-row-${etapa}">
            <td class="prop-num">${_propEscapar(o.titulo)}</td>
            <td>${remetente
                ? `<span class="ped-remetente-tag"><i class="fa-solid fa-building"></i> ${_propEscapar(remetente)}</span>`
                : `<span class="ped-remetente-tag ped-remetente-propria"><i class="fa-solid fa-house-flag"></i> Própria empresa</span>`}</td>
            <td>${_propEscapar(cliente)}</td>
            <td class="prop-valor">${valor}</td>
            <td><span class="prop-badge ${badgeClass}">${badgeLabel}</span></td>
            <td>${_propEscapar(o.responsavel || '—')}</td>
            <td>${previsao}</td>
            <td>
                <div class="ped-acoes">
                    ${botaoPedido}
                    ${podeAvancar ? `<button class="pl-btn-acao pl-btn-avancar" onclick="propAvancarEtapa('${o.id}')" title="Avançar para ${PROP_ETAPA_LABEL[proxEtapa[etapa]]}"><i class="fa-solid fa-arrow-right"></i></button>` : ''}
                    <button class="pl-btn-acao pl-btn-editar" onclick="propAbrirModal('${o.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="pl-btn-acao pl-btn-excluir" onclick="propAbrirModalExcluir('${o.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Gerar/ver Pedido a partir da proposta ──────────────────────────────────

function propGerarPedido(id) {
    const o = _propTodas.find(x => x.id === id);
    if (!o) return;
    const cliente   = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '';
    const remetente = o.remetente?.nome_fantasia || o.remetente?.razao_social || '';
    const params = new URLSearchParams({
        oportunidade_id:        id,
        cliente_id:             o.cliente_id || '',
        cliente_nome:           cliente,
        remetente_parceiro_id:  o.remetente_parceiro_id || '',
        remetente_nome:         remetente,
        valor:                  o.valor || '',
        moeda:                  o.moeda || 'USD',
    });
    window.open(`pedidos.html?${params.toString()}`, '_blank');
}

function propVerPedido(pedidoId) {
    window.open(`pedidos.html?editar=${pedidoId}`, '_blank');
}

// ── Avançar etapa ──────────────────────────────────────────────────────────

async function propAvancarEtapa(id) {
    const op = _propTodas.find(o => o.id === id);
    if (!op) return;
    const prox = { proposta: 'negociacao', negociacao: 'fechado' };
    const nova = prox[op.etapa];
    if (!nova) return;

    op.etapa = nova;
    propRenderizar();

    const res = await atualizarEtapaOportunidade(id, nova);
    if (!res.sucesso) {
        op.etapa = Object.keys(prox).find(k => prox[k] === nova) || op.etapa;
        propRenderizar();
        mostrarNotificacao('Erro ao atualizar etapa.', 'error');
    }
}

// ── Máscara monetária (Valor) ───────────────────────────────────────────────

function propMascaraMonetaria(el) {
    const cursor = el.selectionStart;
    const oldLen = el.value.length;
    let raw = el.value.replace(/[^\d,]/g, '');
    const partes = raw.split(',');
    if (partes.length > 2) raw = partes[0] + ',' + partes.slice(1).join('');
    const p = raw.split(',');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = p.join(',');
    const diff = el.value.length - oldLen;
    el.setSelectionRange(cursor + diff, cursor + diff);
}

function _propValorMonetario(el) {
    if (!el) return 0;
    return parseFloat((el.value || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function _propFormatarMonetario(num) {
    return Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Prazo hábil → calcula a Previsão de Fechamento ──────────────────────────

function propAtualizarPrazo() {
    const val = document.getElementById('propPrazoDias').value;
    const customGroup = document.getElementById('propPrazoCustomGroup');
    const customInput = document.getElementById('propPrazoCustom');

    if (val === 'outro') {
        customGroup.style.display = '';
        customInput.value = '';
        customInput.focus();
        document.getElementById('propDataPrevista').value = '';
        return;
    }

    customGroup.style.display = 'none';
    customInput.value = '';
    const dias = parseInt(val);
    if (!dias) { document.getElementById('propDataPrevista').value = ''; return; }
    _propCalcularPrevisao(dias);
}

function propAtualizarPrazoCustom() {
    const dias = parseInt(document.getElementById('propPrazoCustom').value);
    if (!dias) { document.getElementById('propDataPrevista').value = ''; return; }
    _propCalcularPrevisao(dias);
}

function _propCalcularPrevisao(dias) {
    const dataCriacao = document.getElementById('propDataCriacao').value;
    const base = dataCriacao ? new Date(dataCriacao + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + dias);
    document.getElementById('propDataPrevista').value = base.toISOString().slice(0, 10);
}

// ── Observações retrátil ─────────────────────────────────────────────────────

function propToggleObs(toggle) {
    const content = toggle.nextElementSibling;
    const aberto  = toggle.classList.contains('aberto');
    toggle.classList.toggle('aberto', !aberto);
    content.style.display = aberto ? 'none' : 'block';
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

async function propAbrirModal(id = null) {
    const op = id ? _propTodas.find(o => o.id === id) : null;
    document.getElementById('propEditId').value        = op?.id || '';
    document.getElementById('propModalTitulo').innerHTML = op
        ? '<i class="fa-solid fa-pen"></i> Editar Proposta'
        : '<i class="fa-solid fa-filter"></i> Nova Proposta';

    // "Número da Proposta" (campo propTitulo, readonly) é gerado pelo
    // sistema — sequencial por empresa, nunca repete mesmo se a
    // proposta for excluída depois (ver gerarNumeroSequencial() em
    // supabase-api.js). Editando uma já existente, só mostra o número
    // que ela já tem.
    const tituloEl = document.getElementById('propTitulo');
    const btnSalvar = document.getElementById('propBtnSalvar');
    tituloEl.value = op?.titulo || '';
    if (!op) {
        tituloEl.value = 'Gerando...';
        if (btnSalvar) btnSalvar.disabled = true;
        const res = await gerarNumeroSequencial('proposta', 'PROP');
        tituloEl.value = res.sucesso ? res.numero : '';
        if (btnSalvar) btnSalvar.disabled = false;
        if (!res.sucesso) mostrarNotificacao('Erro ao gerar o número da proposta: ' + (res.mensagem || 'tente novamente.'), 'error');
    }

    document.getElementById('propRemetenteNome').value      = op?.remetente?.nome_fantasia || op?.remetente?.razao_social || '';
    document.getElementById('propRemetenteId').value        = op?.remetente_parceiro_id || '';
    document.getElementById('propRemetenteDocumento').value = op?.remetente?.documento ? _propMascaraDocBR(op.remetente.documento) : '';

    document.getElementById('propDestinatarioNome').value      = op?.parceiros?.nome_fantasia || op?.parceiros?.razao_social || '';
    document.getElementById('propDestinatarioId').value        = op?.cliente_id || '';
    document.getElementById('propDestinatarioDocumento').value = op?.parceiros?.documento ? _propMascaraDocBR(op.parceiros.documento) : '';

    document.getElementById('propValor').value = op?.valor ? _propFormatarMonetario(op.valor) : '';
    document.getElementById('propMoeda').value = op?.moeda || 'USD';

    // Etapa só é editável numa proposta já existente — todo cadastro
    // novo nasce automaticamente como "proposta" (não é escolha do usuário).
    document.getElementById('propEtapa').value              = op?.etapa || 'proposta';
    document.getElementById('propEtapaGroup').style.display = op ? '' : 'none';

    document.getElementById('propResponsavel').value = op?.responsavel || '';

    document.getElementById('propDataCriacao').value = op?.created_at ? op.created_at.slice(0, 10) : _propHojeISO();
    document.getElementById('propPrazoDias').value    = '';
    document.getElementById('propPrazoCustom').value  = '';
    document.getElementById('propPrazoCustomGroup').style.display = 'none';
    document.getElementById('propDataPrevista').value = op?.data_prevista || '';

    document.getElementById('propObservacoes').value = op?.observacoes || '';
    document.querySelectorAll('#propModalOverlay .pl-obs-toggle').forEach(toggle => {
        toggle.classList.remove('aberto');
        toggle.nextElementSibling.style.display = 'none';
    });

    // Histórico só existe (e só faz sentido mostrar) numa proposta já
    // salva — uma nova ainda não teve nenhum evento registrado.
    document.getElementById('propHistoricoWrapper').style.display = op ? '' : 'none';
    if (op) _propCarregarHistorico(op.id);

    document.getElementById('propModalOverlay').classList.add('ativo');
}

// ── Histórico — linha do tempo da proposta ──────────────────────────────────

const PROP_HIST_EVENTO_LABEL = {
    criada:                  'Proposta criada',
    etapa_alterada:          'Etapa alterada',
    pedido_gerado:           'Pedido gerado',
    pedido_status_alterado:  'Status do Pedido alterado',
    pedido_excluido:         'Pedido excluído',
    excluida:                'Proposta excluída',
    restaurada:              'Proposta restaurada',
};

const PROP_HIST_EVENTO_ICONE = {
    criada:                 'fa-solid fa-plus',
    etapa_alterada:         'fa-solid fa-arrow-right',
    pedido_gerado:          'fa-solid fa-bag-shopping',
    pedido_status_alterado: 'fa-solid fa-truck-fast',
    pedido_excluido:        'fa-solid fa-trash',
    excluida:               'fa-solid fa-trash',
    restaurada:             'fa-solid fa-rotate-left',
};

// Mesmo rótulo usado no resto da tela pra etapa e status do Pedido, senão
// o histórico mostraria os valores crus salvos no banco (ex: "em_producao").
const PED_STATUS_LABEL_HIST = {
    aguardando: 'Aguardando', confirmado: 'Confirmado', em_producao: 'Em produção',
    embarcado: 'Embarcado', entregue: 'Entregue', cancelado: 'Cancelado', excluido: 'Excluído',
};

function _propHistLabelValor(evento, valor) {
    if (!valor) return null;
    if (evento === 'etapa_alterada') return PROP_ETAPA_LABEL[valor] || valor;
    if (evento === 'pedido_status_alterado') return PED_STATUS_LABEL_HIST[valor] || valor;
    return valor;
}

async function _propCarregarHistorico(oportunidadeId) {
    const container = document.getElementById('propHistoricoLista');
    container.innerHTML = '<div class="prop-historico-vazio"><i class="fa-solid fa-spinner fa-spin"></i></div>';

    const res = await window.supabaseAPI.buscarHistoricoOportunidade(oportunidadeId);
    if (!res.sucesso || !res.data?.length) {
        container.innerHTML = '<div class="prop-historico-vazio">Nenhum evento registrado ainda.</div>';
        return;
    }

    container.innerHTML = `<div class="prop-historico-timeline">
        ${res.data.map(ev => {
            const de  = _propHistLabelValor(ev.evento, ev.de_valor);
            const para = _propHistLabelValor(ev.evento, ev.para_valor);
            let detalhe = '';
            if (ev.evento === 'etapa_alterada' || ev.evento === 'pedido_status_alterado') {
                detalhe = de ? `${_propEscapar(de)} → ${_propEscapar(para)}` : _propEscapar(para);
            } else if (ev.evento === 'pedido_gerado') {
                detalhe = `Pedido ${_propEscapar(ev.pedidos?.numero || para || '')}`;
            } else if (ev.evento === 'criada') {
                detalhe = `Etapa inicial: ${_propEscapar(para)}`;
            }
            const dataFmt = new Date(ev.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            return `
                <div class="prop-historico-item">
                    <div class="prop-historico-icone"><i class="${PROP_HIST_EVENTO_ICONE[ev.evento] || 'fa-solid fa-circle'}"></i></div>
                    <div class="prop-historico-corpo">
                        <div class="prop-historico-titulo">${PROP_HIST_EVENTO_LABEL[ev.evento] || ev.evento}</div>
                        ${detalhe ? `<div class="prop-historico-detalhe">${detalhe}</div>` : ''}
                        <div class="prop-historico-meta">${dataFmt}${ev.usuario_nome ? ` · ${_propEscapar(ev.usuario_nome)}` : ''}</div>
                    </div>
                </div>`;
        }).join('')}
    </div>`;
}

function _propHojeISO() {
    return new Date().toISOString().slice(0, 10);
}

function propFecharModal() {
    document.getElementById('propModalOverlay').classList.remove('ativo');
    document.getElementById('propAutoRemetente').innerHTML = '';
    document.getElementById('propAutoDestinatario').innerHTML = '';
}

async function propSalvar() {
    if (!exigirEmpresaVinculada()) return;
    const titulo = document.getElementById('propTitulo').value.trim();
    if (!titulo || titulo === 'Gerando...') {
        mostrarNotificacao('Aguarde o número da proposta ser gerado.', 'warning');
        return;
    }

    const btn = document.getElementById('propBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const id = document.getElementById('propEditId').value || null;

    const dados = {
        titulo,
        cliente_id:            document.getElementById('propDestinatarioId').value || null,
        remetente_parceiro_id: document.getElementById('propRemetenteId').value || null,
        valor:         _propValorMonetario(document.getElementById('propValor')) || null,
        moeda:         document.getElementById('propMoeda').value,
        // Sem id (cadastro novo) = sempre "proposta", independente do select
        // (que fica escondido nesse caso).
        etapa:         id ? document.getElementById('propEtapa').value : 'proposta',
        responsavel:   document.getElementById('propResponsavel').value.trim() || null,
        data_prevista: document.getElementById('propDataPrevista').value || null,
        observacoes:   document.getElementById('propObservacoes').value.trim() || null,
    };

    const res = await salvarOportunidade(dados, id);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) { mostrarNotificacao('Erro ao salvar: ' + res.mensagem, 'error'); return; }

    mostrarNotificacao(id ? 'Proposta atualizada!' : 'Proposta criada!', 'success');
    propFecharModal();
    await propCarregar();
}

// ── Autocomplete de empresas (cadastradas em Parceiros) — Remetente/Destinatário ──

let _propBuscaTimer = null;

const PROP_EMPRESA_CAMPOS = {
    remetente:    { nome: 'propRemetenteNome',    id: 'propRemetenteId',    doc: 'propRemetenteDocumento',    box: 'propAutoRemetente' },
    destinatario: { nome: 'propDestinatarioNome', id: 'propDestinatarioId', doc: 'propDestinatarioDocumento', box: 'propAutoDestinatario' },
};

async function _propListarEmpresas(termo, box, tipo) {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('parceiros')
            .select('id, razao_social, nome_fantasia, documento')
            .limit(termo ? 8 : 15);
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        if (termo) query = query.or(`razao_social.ilike."%${_propEscaparFiltro(termo)}%",nome_fantasia.ilike."%${_propEscaparFiltro(termo)}%"`);
        else query = query.order('razao_social', { ascending: true });

        const { data } = await query;

        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhuma empresa encontrada — cadastre em Empresas primeiro</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="propSelecionarEmpresa('${tipo}', '${p.id}', '${_propEscaparAtributo(p.nome_fantasia || p.razao_social)}', '${_propEscaparAtributo(p.documento || '')}')">
                <span class="pl-auto-nome">${_propEscapar(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_propEscapar(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

async function propBuscarEmpresa(tipo, termo) {
    const campos = PROP_EMPRESA_CAMPOS[tipo];
    const box = document.getElementById(campos.box);
    document.getElementById(campos.id).value = '';
    document.getElementById(campos.doc).value = '';
    clearTimeout(_propBuscaTimer);
    _propBuscaTimer = setTimeout(() => _propListarEmpresas(termo?.length >= 2 ? termo : '', box, tipo), 300);
}

// Foco no campo: mostra a lista sem apagar a empresa já selecionada (editar proposta)
function propMostrarEmpresas(tipo, termo) {
    const campos = PROP_EMPRESA_CAMPOS[tipo];
    _propListarEmpresas(termo?.length >= 2 ? termo : '', document.getElementById(campos.box), tipo);
}

function propSelecionarEmpresa(tipo, id, nome, documento) {
    const campos = PROP_EMPRESA_CAMPOS[tipo];
    document.getElementById(campos.id).value    = id;
    document.getElementById(campos.nome).value  = nome;
    document.getElementById(campos.doc).value   = documento ? _propMascaraDocBR(documento) : '';
    document.getElementById(campos.box).innerHTML = '';
}

// CPF (11 dígitos): 000.000.000-00 — CNPJ (14 dígitos): 00.000.000/0000-00
function _propMascaraDocBR(valor) {
    const d = String(valor || '').replace(/\D/g, '').slice(0, 14);
    if (d.length <= 11) {
        if (d.length > 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
        if (d.length > 6) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
        if (d.length > 3) return d.slice(0,3) + '.' + d.slice(3);
        return d;
    }
    if (d.length > 12) return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8,12) + '-' + d.slice(12);
    if (d.length > 8)  return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8);
    if (d.length > 5)  return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5);
    if (d.length > 2)  return d.slice(0,2) + '.' + d.slice(2);
    return d;
}

// Escapa valores usados dentro de filtros PostgREST (.or()) — evita que
// vírgulas/parênteses no termo digitado alterem a estrutura do filtro.
function _propEscaparFiltro(termo) {
    return String(termo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Para uso como argumento de string dentro de onclick="fn('...')" — além do
// escape de HTML acima, escapa barra invertida e aspas simples para não
// quebrar o literal JS de aspas simples embutido no atributo.
function _propEscaparAtributo(str) {
    return _propEscapar(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

document.addEventListener('click', e => {
    Object.values(PROP_EMPRESA_CAMPOS).forEach(campos => {
        if (!e.target.closest(`#${campos.box}`) && !e.target.closest(`#${campos.nome}`)) {
            const box = document.getElementById(campos.box);
            if (box) box.innerHTML = '';
        }
    });
});

// ── Modal excluir ──────────────────────────────────────────────────────────

function propAbrirModalExcluir(id) {
    _propExcluirId = id;
    const op = _propTodas.find(o => o.id === id);
    document.getElementById('propExcluirNome').textContent = op?.titulo || '';
    document.getElementById('propModalExcluirOverlay').classList.add('ativo');
}

function propFecharModalExcluir() {
    _propExcluirId = null;
    document.getElementById('propModalExcluirOverlay').classList.remove('ativo');
}

async function propConfirmarExcluir() {
    if (!_propExcluirId) return;
    const btn = document.getElementById('propBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await excluirOportunidade(_propExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    if (!res.sucesso) { mostrarNotificacao('Erro ao excluir: ' + res.mensagem, 'error'); return; }
    mostrarNotificacao('Proposta excluída — disponível em "Excluídos" por 7 dias.', 'success');
    propFecharModalExcluir();
    await propCarregar();
}

// ── Painel Excluídos (restaurável em 7 dias) ────────────────────────────────

async function propToggleExcluidos() {
    const panel = document.getElementById('propExcluidosPanel');
    if (!panel) return;

    _propExcluidosAberto = !_propExcluidosAberto;
    panel.classList.toggle('aberto', _propExcluidosAberto);

    if (_propExcluidosAberto) await propCarregarExcluidos();
}

async function propCarregarExcluidos() {
    const container = document.getElementById('propExcluidosContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('oportunidades')
            .select('id, titulo, parceiros!oportunidades_cliente_id_fkey(razao_social, nome_fantasia), excluido_em, excluido_por')
            .not('excluido_em', 'is', null)
            .order('excluido_em', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhuma proposta excluída.</div>';
            return;
        }

        const agora = Date.now();
        container.innerHTML = data.map(o => {
            const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
            let metaHtml = '';
            if (o.excluido_em) {
                const exclMs        = new Date(o.excluido_em).getTime();
                const diasPassados  = Math.floor((agora - exclMs) / 86400000);
                const diasRestantes = 7 - diasPassados;
                const dataFmt       = new Date(o.excluido_em).toLocaleDateString('pt-BR');
                const corDias       = diasRestantes <= 2 ? '#dc2626' : '#94a3b8';
                metaHtml = `
                    <span class="prof-excluido-rota">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:10px;"></i> ${dataFmt}
                        ${o.excluido_por ? `· ${_propEscapar(o.excluido_por)}` : ''}
                    </span>
                    <span class="prof-excluido-rota" style="color:${corDias};">
                        <i class="fa-solid fa-clock" style="font-size:10px;"></i>
                        ${diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}` : 'Expira hoje'}
                    </span>`;
            }
            return `
            <div class="prof-excluido-item">
                <div class="prof-excluido-info">
                    <span class="prof-excluido-codigo">${_propEscapar(o.titulo || '—')}</span>
                    <span class="prof-excluido-rota">${_propEscapar(cliente)}</span>
                    ${metaHtml}
                </div>
                <button class="prof-excluido-restaurar" onclick="propRestaurar('${o.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Erro: ${err.message}</div>`;
    }
}

async function propRestaurar(id) {
    try {
        const res = await restaurarOportunidade(id);
        if (!res.sucesso) throw new Error(res.mensagem);
        await propCarregarExcluidos();
        await propCarregar();
        mostrarNotificacao('Proposta restaurada.', 'success');
    } catch (err) {
        mostrarNotificacao('Erro ao restaurar: ' + err.message, 'error');
    }
}

document.addEventListener('click', e => {
    if (_propExcluidosAberto && !e.target.closest('#propExcluidosWrapper')) {
        _propExcluidosAberto = false;
        document.getElementById('propExcluidosPanel')?.classList.remove('aberto');
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function _propEscapar(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sair sempre encerra a sessão de vez, mesmo com "Lembrar-me" ativo (login
// automático não deve sobreviver a um logout explícito). cpfSalvo é mantido
// de propósito, só pra não precisar redigitar o CPF na próxima vez.
function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('usuarioSalvo');
    localStorage.removeItem('lastLogin');
    window.location.href = 'login.html';
}
