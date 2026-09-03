// ========================================
// PIPELINE FINANCEIRO — status do pedido em relação ao financeiro
// ========================================

let _pfPedidos = [];
let _pfFiltrados = [];
let _pfContasPorPedido = {};
let _pfProcessosPorProforma = {};
let _pfTabAtiva = 'sem_cobranca';

const PF_ETAPAS = ['sem_cobranca', 'aguardando', 'vencido', 'recebido'];

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _pfCarregarUsuario();
    await pfCarregar();
});

function _pfCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function pfCarregar() {
    _pfSetLoading(true);

    const res = await buscarPedidos();
    if (!res.sucesso) {
        _pfSetLoading(false);
        return;
    }
    _pfPedidos = (res.data || []).filter(p => p.status !== 'cancelado');

    // Processos gerados a partir da proforma de cada pedido — Conta a Receber só
    // pode ser gerada depois que o pedido virou processo (ver _pfPodeGerarConta)
    _pfProcessosPorProforma = {};
    const proformaIds = [...new Set(_pfPedidos.map(p => p.proforma_id).filter(Boolean))];
    if (proformaIds.length > 0) {
        const { data: procs } = await supabaseClient
            .from('processos')
            .select('id, proforma_id')
            .in('proforma_id', proformaIds);
        (procs || []).forEach(pr => {
            (_pfProcessosPorProforma[pr.proforma_id] ||= []).push(pr);
        });
    }

    // Contas a receber vinculadas aos pedidos
    _pfContasPorPedido = {};
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('contas_receber')
            .select('id, pedido_id, status, valor, moeda, data_vencimento')
            .not('pedido_id', 'is', null);
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data } = await query;
        (data || []).forEach(c => {
            if (!_pfContasPorPedido[c.pedido_id]) _pfContasPorPedido[c.pedido_id] = [];
            _pfContasPorPedido[c.pedido_id].push(c);
        });
    } catch (e) {}

    _pfFiltrados = [..._pfPedidos];
    pfRenderizar();
}

function _pfSetLoading(sim) {
    PF_ETAPAS.forEach(e => {
        const col = document.getElementById(`col-${e}`);
        if (col) col.innerHTML = sim
            ? '<div class="pl-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>'
            : '';
    });
}

// ── Estágio financeiro do pedido ────────────────────────────────────────────

function _pfEstagio(pedidoId) {
    const contas = (_pfContasPorPedido[pedidoId] || []).filter(c => c.status !== 'cancelado');
    if (!contas.length) return 'sem_cobranca';

    const hoje = new Date().toISOString().split('T')[0];
    const vencida = c => c.status === 'vencido' || (c.status === 'pendente' && c.data_vencimento && c.data_vencimento < hoje);

    if (contas.every(c => c.status === 'recebido')) return 'recebido';
    if (contas.some(vencida)) return 'vencido';
    return 'aguardando';
}

// ── Renderizar kanban ──────────────────────────────────────────────────────

function pfRenderizar() {
    PF_ETAPAS.forEach(etapa => {
        const col      = document.getElementById(`col-${etapa}`);
        const count    = document.getElementById(`count-${etapa}`);
        const tabCount = document.getElementById(`tab-count-${etapa}`);
        if (!col) return;

        const cards = _pfFiltrados.filter(p => _pfEstagio(p.id) === etapa);
        if (count)    count.textContent    = cards.length;
        if (tabCount) tabCount.textContent = cards.length;

        if (!cards.length) {
            col.innerHTML = '<div class="pl-col-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhum pedido</p></div>';
            return;
        }

        col.innerHTML = cards.map(p => _pfRenderCard(p, etapa)).join('');
    });

    pfAtualizarMobileTab();
}

// Cards do Kanban começam recolhidos — mesmo esquema de Pedidos/Proposta
// (_pedCardsExpandidos/pedToggleCard, _propCardsExpandidos/propToggleCard):
// recolhido só o essencial (nº, valor, Remetente/Destino, Contas), expandir
// revela Responsável/Data e as ações.
let _pfCardsExpandidos = new Set();

function pfToggleCard(id) {
    if (_pfCardsExpandidos.has(id)) _pfCardsExpandidos.delete(id);
    else _pfCardsExpandidos.add(id);
    pfRenderizar();
}

function _pfRenderCard(p, etapa) {
    const remetenteRazao = p.remetente?.nome_fantasia || p.remetente?.razao_social || '';
    const destinoRazao   = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
    const valor   = p.valor_total
        ? `${p.moeda || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    const dataFmt = p.data_pedido
        ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';

    const contas = (_pfContasPorPedido[p.id] || []).filter(c => c.status !== 'cancelado');
    const hoje   = new Date().toISOString().split('T')[0];
    const badgeMap = { pendente: 'pendente', vencido: 'vencido', recebido: 'recebido' };

    const contasHtml = contas.length
        ? `<div class="pf-card-contas">${contas.map(c => {
            const statusReal = (c.status === 'pendente' && c.data_vencimento && c.data_vencimento < hoje) ? 'vencido' : c.status;
            const venc = c.data_vencimento ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
            const val  = `${c.moeda || 'BRL'} ${Number(c.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
            return `<div class="pf-card-conta">
                <span class="fin-badge ${badgeMap[statusReal] || statusReal}">${_pfLabelStatus(statusReal)}</span>
                <span class="pf-card-conta-valor">${val}</span>
                <span class="pf-card-conta-venc"><i class="fa-regular fa-calendar"></i> ${venc}</span>
            </div>`;
        }).join('')}</div>`
        : '';

    const expandido = _pfCardsExpandidos.has(p.id);

    return `
        <div class="pf-kcard ${expandido ? 'pf-kcard-expandido' : ''}" data-etapa="${etapa}" data-id="${p.id}">
            <div class="pf-kcard-top">
                <span class="pf-kcard-titulo"><i class="fa-solid fa-bag-shopping"></i> Pedido ${_pfEscapar(p.numero || '')}</span>
                <button class="pf-kcard-toggle" onclick="pfToggleCard('${p.id}')" title="${expandido ? 'Recolher' : 'Expandir'}">
                    <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
                </button>
            </div>

            <div class="pf-kcard-empresa-linha">
                <span class="pf-kcard-label">Remetente:</span>
                <span class="pf-kcard-empresa-valor">${remetenteRazao ? _pfEscapar(remetenteRazao) : 'Própria empresa'}</span>
            </div>
            <div class="pf-kcard-empresa-linha">
                <span class="pf-kcard-label">Destino:</span>
                <span class="pf-kcard-empresa-valor">${_pfEscapar(destinoRazao)}</span>
            </div>

            ${valor ? `<div class="pf-kcard-valor"><i class="fa-solid fa-coins"></i> <span>${valor}</span></div>` : ''}

            ${contasHtml}

            ${expandido ? `
            <div class="pf-kcard-meta">
                <span class="pf-kcard-label">Responsável:</span> <span>${p.criado_por ? _pfEscapar(p.criado_por) : '—'}</span>
            </div>
            <div class="pf-kcard-meta">
                <span class="pf-kcard-label">Data do Pedido:</span> <span>${dataFmt}</span>
            </div>
            <div class="pf-kcard-footer">
                <div class="pf-kcard-btns">
                    ${etapa === 'sem_cobranca'
                        ? (_pfPodeGerarConta(p)
                            ? `<button class="btn-seguir-processo" onclick="pfGerarContaReceber('${p.id}')"><i class="fa-solid fa-sack-dollar"></i> Gerar Conta a Receber</button>`
                            : `<span class="pf-aguardando-processo" title="Gere um Processo a partir da Proforma deste pedido antes de criar a Conta a Receber"><i class="fa-solid fa-hourglass-half"></i> Aguardando Processo</span>`)
                        : ''}
                    <button class="pl-btn-acao pl-btn-editar" onclick="pfVerPedido('${p.id}')" title="Ver Pedido">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            </div>` : ''}
        </div>`;
}

function _pfLabelStatus(status) {
    return { pendente: 'Pendente', vencido: 'Vencido', recebido: 'Recebido' }[status] || status;
}

// Só libera gerar Conta a Receber depois que o pedido já virou 1+ processo
// (via a proforma gerada pelo pedido) — confirmar o pedido sozinho não basta.
function _pfPodeGerarConta(pedido) {
    return !!(pedido.proforma_id && (_pfProcessosPorProforma[pedido.proforma_id] || []).length > 0);
}

// ── Ações ──────────────────────────────────────────────────────────────────

function pfVerPedido(id) {
    window.open(`pedidos.html?editar=${id}`, '_blank');
}

function pfGerarContaReceber(id) {
    window.open(`contas-receber.html?gerar_pedido_id=${id}`, '_blank');
}

// ── Filtro ─────────────────────────────────────────────────────────────────

const PF_ESTAGIOS_FILTRO = ['sem_cobranca', 'aguardando', 'vencido', 'recebido'];

// Debounce (revisão de performance) — ver mesmo comentário em contas-receber.js
let _pfFiltrarTimer = null;
function pfFiltrar() {
    clearTimeout(_pfFiltrarTimer);
    _pfFiltrarTimer = setTimeout(() => {
        const termo = document.getElementById('filtroPipelineFinanceiro')?.value.toLowerCase().trim() || '';
        const campo = document.getElementById('filtroCampoPipelineFinanceiro')?.value || 'todos';

        _pfFiltrados = _pfPedidos.filter(p => {
            if (PF_ESTAGIOS_FILTRO.includes(campo) && _pfEstagio(p.id) !== campo) return false;
            if (!termo) return true;

            if (campo === 'numero')  return (p.numero || '').toLowerCase().includes(termo);
            if (campo === 'cliente') return (p.parceiros?.razao_social || '').toLowerCase().includes(termo);
            if (campo === 'cnpj' || campo === 'cpf') return (p.parceiros?.documento || '').toLowerCase().includes(termo);

            // 'todos' e filtros de estágio: busca em todos os campos
            const txt = [p.numero, p.parceiros?.razao_social, p.parceiros?.nome_fantasia, p.parceiros?.documento]
                .filter(Boolean).join(' ').toLowerCase();
            return txt.includes(termo);
        });
        pfRenderizar();
    }, 200);
}

// ── Mobile tabs ────────────────────────────────────────────────────────────

function pfSwitchTab(btn) {
    document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    _pfTabAtiva = btn.dataset.col;
    pfAtualizarMobileTab();
}

function pfAtualizarMobileTab() {
    if (window.innerWidth > 768) return;
    document.querySelectorAll('.pl-col').forEach(col => {
        col.style.display = col.dataset.etapa === _pfTabAtiva ? '' : 'none';
    });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _pfEscapar(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
