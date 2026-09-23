// ========================================
// PIPELINE FINANCEIRO — status da proforma em relação ao financeiro
// ========================================

let _pfProformas = [];
let _pfFiltrados = [];
let _pfContasPorProforma = {};
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

function _pfEmissorNome(p) {
    if (p.emissor_tipo === 'terceiro') {
        return p.parceiro?.nome_fantasia || p.parceiro?.razao_social || p.parceiro_razao_social || '';
    }
    return '';
}

function _pfDestinatarioNome(p) {
    if (p.destinatario_emp?.razao_social) {
        return p.destinatario_emp.nome_fantasia || p.destinatario_emp.razao_social;
    }
    return p.destinatario_razao_social || '—';
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function pfCarregar() {
    _pfSetLoading(true);

    const usuario = obterUsuarioLogado();
    let query = supabaseClient.from('proformas').select('*').neq('status', 'excluido');
    if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
    const { data, error } = await query;
    if (error) {
        _pfSetLoading(false);
        return;
    }
    _pfProformas = data || [];

    // parceiro_id/destinatario_id são BIGINT — referenciam "parceiros".
    const empresaIds = [...new Set([
        ..._pfProformas.map(p => p.parceiro_id).filter(Boolean),
        ..._pfProformas.map(p => p.destinatario_id).filter(Boolean),
    ])];
    let empresaMap = {};
    if (empresaIds.length > 0) {
        const { data: parc } = await supabaseClient
            .from('parceiros').select('id, razao_social, nome_fantasia').in('id', empresaIds);
        (parc || []).forEach(e => { empresaMap[e.id] = e; });
    }

    // Processos gerados a partir de cada proforma — Conta a Receber só pode
    // ser gerada depois que a proforma já tem 1+ processo (ver _pfPodeGerarConta)
    const proformaIds = _pfProformas.map(p => p.id);
    let processosMap = {};
    if (proformaIds.length > 0) {
        const { data: procs } = await supabaseClient
            .from('processos').select('id, proforma_id').in('proforma_id', proformaIds);
        (procs || []).forEach(pr => { (processosMap[pr.proforma_id] ||= []).push(pr); });
    }
    _pfProformas.forEach(p => {
        p.parceiro         = empresaMap[p.parceiro_id]     || null;
        p.destinatario_emp = empresaMap[p.destinatario_id] || null;
        p._processos       = processosMap[p.id] || [];
    });

    // Contas a receber vinculadas às proformas
    _pfContasPorProforma = {};
    try {
        let queryContas = supabaseClient
            .from('contas_receber')
            .select('id, proforma_id, status, valor, moeda, data_vencimento')
            .not('proforma_id', 'is', null);
        if (usuario?.empresa_id) queryContas = queryContas.eq('empresa_id', usuario.empresa_id);
        const { data: contas } = await queryContas;
        (contas || []).forEach(c => {
            (_pfContasPorProforma[c.proforma_id] ||= []).push(c);
        });
    } catch (e) {}

    _pfFiltrados = [..._pfProformas];
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

// ── Estágio financeiro da proforma ──────────────────────────────────────────

function _pfEstagio(proformaId) {
    const contas = (_pfContasPorProforma[proformaId] || []).filter(c => c.status !== 'cancelado');
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
            col.innerHTML = '<div class="pl-col-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhuma proforma</p></div>';
            return;
        }

        col.innerHTML = cards.map(p => _pfRenderCard(p, etapa)).join('');
    });

    pfAtualizarMobileTab();
}

// Cards do Kanban começam recolhidos — mesmo esquema de Proposta
// (_propCardsExpandidos/propToggleCard): recolhido só o essencial (código,
// valor, Remetente/Destino, Contas), expandir revela Data e as ações.
let _pfCardsExpandidos = new Set();

function pfToggleCard(id) {
    if (_pfCardsExpandidos.has(id)) _pfCardsExpandidos.delete(id);
    else _pfCardsExpandidos.add(id);
    pfRenderizar();
}

function _pfRenderCard(p, etapa) {
    const remetenteRazao = _pfEmissorNome(p);
    const destinoRazao   = _pfDestinatarioNome(p);
    const valor   = p.valor_total
        ? `${p.moeda_principal || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    const dataFmt = p.data_emissao
        ? new Date(p.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';

    const contas = (_pfContasPorProforma[p.id] || []).filter(c => c.status !== 'cancelado');
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
                <span class="pf-kcard-titulo"><i class="fa-solid fa-file-invoice-dollar"></i> Proforma ${_pfEscapar(p.codigo || '')}</span>
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
                <span class="pf-kcard-label">Data de Emissão:</span> <span>${dataFmt}</span>
            </div>
            <div class="pf-kcard-footer">
                <div class="pf-kcard-btns">
                    ${etapa === 'sem_cobranca'
                        ? (_pfPodeGerarConta(p)
                            ? `<button class="btn-seguir-processo" onclick="pfGerarContaReceber('${p.id}')"><i class="fa-solid fa-sack-dollar"></i> Gerar Conta a Receber</button>`
                            : `<span class="pf-aguardando-processo" title="Gere um Processo a partir desta Proforma antes de criar a Conta a Receber"><i class="fa-solid fa-hourglass-half"></i> Aguardando Processo</span>`)
                        : ''}
                    <button class="pl-btn-acao pl-btn-editar" onclick="pfVerProforma('${p.id}')" title="Ver Proforma">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            </div>` : ''}
        </div>`;
}

function _pfLabelStatus(status) {
    return { pendente: 'Pendente', vencido: 'Vencido', recebido: 'Recebido' }[status] || status;
}

// Só libera gerar Conta a Receber depois que a proforma já tem 1+ processo —
// gerá-la sozinha não basta.
function _pfPodeGerarConta(proforma) {
    return (proforma._processos || []).length > 0;
}

// ── Ações ──────────────────────────────────────────────────────────────────

function pfVerProforma(id) {
    window.open(`formularios.html?tab=proposta&id=${id}&modo=visualizar`, '_blank');
}

function pfGerarContaReceber(id) {
    window.open(`contas-receber.html?gerar_proforma_id=${id}`, '_blank');
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

        _pfFiltrados = _pfProformas.filter(p => {
            if (PF_ESTAGIOS_FILTRO.includes(campo) && _pfEstagio(p.id) !== campo) return false;
            if (!termo) return true;

            const destino = _pfDestinatarioNome(p);
            if (campo === 'numero')  return (p.codigo || '').toLowerCase().includes(termo);
            if (campo === 'cliente') return destino.toLowerCase().includes(termo);
            if (campo === 'cnpj' || campo === 'cpf') return (p.destinatario_doc || '').toLowerCase().includes(termo);

            // 'todos' e filtros de estágio: busca em todos os campos
            const txt = [p.codigo, destino, p.destinatario_doc].filter(Boolean).join(' ').toLowerCase();
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
