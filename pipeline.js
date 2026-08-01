// ========================================
// PIPELINE COMERCIAL
// ========================================

let _plTodas    = [];
let _plFiltradas = [];
let _plExcluirId = null;
let _plTabAtiva  = 'lead';
let _plPedidosMap = {};

const PL_ETAPAS = ['lead', 'proposta', 'negociacao', 'fechado'];

const PL_ETAPA_LABEL = {
    lead:        'Lead',
    proposta:    'Proposta',
    negociacao:  'Negociação',
    fechado:     'Fechado',
    perdido:     'Perdido',
};

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _plCarregarUsuario();
    await _plCarregarMoedas();
    await plCarregar();
});

// ── Moedas (tabela apoio_moedas) ─────────────────────────────────────────────

async function _plCarregarMoedas() {
    const sel = document.getElementById('plMoeda');
    if (!sel) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('descricao', { ascending: true });
        if (data?.length) {
            sel.innerHTML = data.map(m => `<option value="${m.sigla || m.codigo}">${_plEscapar(m.descricao || '')}</option>`).join('');
        }
    } catch (e) {
        console.warn('[Pipeline] Falha ao carregar moedas:', e);
    }
}

function _plCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function plCarregar() {
    _plSetLoading(true);
    const res = await buscarOportunidades();
    if (!res.sucesso) {
        _plSetLoading(false);
        return;
    }
    _plTodas = res.data || [];
    _plFiltradas = [..._plTodas];

    // Link reverso: quais oportunidades já geraram um Pedido
    _plPedidosMap = {};
    const oportunidadeIds = _plTodas.map(o => o.id).filter(Boolean);
    if (oportunidadeIds.length > 0) {
        try {
            const { data: pedidosLinkados } = await supabaseClient
                .from('pedidos')
                .select('id, numero, oportunidade_id')
                .in('oportunidade_id', oportunidadeIds);
            (pedidosLinkados || []).forEach(p => { _plPedidosMap[p.oportunidade_id] = p; });
        } catch (e) {}
    }

    plRenderizar();
}

function _plSetLoading(sim) {
    PL_ETAPAS.forEach(e => {
        const col = document.getElementById(`col-${e}`);
        if (col) col.innerHTML = sim
            ? '<div class="pl-loading"><i class="fa-solid fa-spinner fa-spin"></i></div>'
            : '';
    });
}

// ── Renderizar kanban ──────────────────────────────────────────────────────

function plRenderizar() {
    PL_ETAPAS.forEach(etapa => {
        const col   = document.getElementById(`col-${etapa}`);
        const count = document.getElementById(`count-${etapa}`);
        const tabCount = document.getElementById(`tab-count-${etapa}`);
        if (!col) return;

        const cards = _plFiltradas.filter(o => o.etapa === etapa);
        if (count)    count.textContent    = cards.length;
        if (tabCount) tabCount.textContent = cards.length;

        if (!cards.length) {
            col.innerHTML = '<div class="pl-col-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhuma oportunidade</p></div>';
            return;
        }

        col.innerHTML = cards.map(o => _plRenderCard(o)).join('');

        // Eventos dos botões
        col.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                const action = btn.dataset.action;
                const id     = btn.dataset.id;
                if (action === 'editar')  plAbrirModal(id);
                if (action === 'excluir') plAbrirModalExcluir(id);
                if (action === 'avancar') plAvancarEtapa(id);
            });
        });
    });

    // Atualiza visibilidade no mobile
    plAtualizarMobileTab();
    _plRenderPerdidos();
}

function _plRenderCard(o) {
    const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
    const valor   = o.valor
        ? `${o.moeda || 'USD'} ${Number(o.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    const dataFmt = o.data_prevista
        ? new Date(o.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    const podeAvancar = o.etapa !== 'fechado' && o.etapa !== 'perdido';
    const proxEtapa   = { lead: 'proposta', proposta: 'negociacao', negociacao: 'fechado' };

    let botaoPedido = '';
    if (o.etapa === 'fechado') {
        const pedidoLinkado = _plPedidosMap[o.id];
        if (pedidoLinkado) {
            botaoPedido = `<button class="btn-ver-processo" onclick="plVerPedido('${pedidoLinkado.id}')"><i class="fa-solid fa-bag-shopping"></i> Ver Pedido ${_plEscapar(pedidoLinkado.numero || '')}</button>`;
        } else {
            botaoPedido = `<button class="btn-seguir-processo" onclick="plGerarPedido('${o.id}')"><i class="fa-solid fa-bag-shopping"></i> Gerar Pedido</button>`;
        }
    }

    return `
        <div class="pl-card" data-etapa="${o.etapa}" data-id="${o.id}">
            <div class="pl-card-header">
                <span class="pl-card-titulo">${_plEscapar(o.titulo)}</span>
                <span class="pl-prob-badge">${o.probabilidade ?? 50}%</span>
            </div>

            <div class="pl-card-cliente">
                <i class="fa-solid fa-building"></i> ${_plEscapar(cliente)}
            </div>

            ${valor ? `<div class="pl-card-valor"><i class="fa-solid fa-coins"></i> ${valor}</div>` : ''}

            <div class="pl-card-footer">
                <div class="pl-card-meta">
                    ${o.responsavel ? `<span class="pl-card-resp"><i class="fa-solid fa-user-tie"></i> ${_plEscapar(o.responsavel)}</span>` : '<span></span>'}
                    ${dataFmt ? `<span class="pl-card-data"><i class="fa-regular fa-calendar"></i> ${dataFmt}</span>` : '<span></span>'}
                </div>
                ${botaoPedido}
                <div class="pl-card-btns">
                    <button class="pl-btn-acao pl-btn-editar" data-action="editar" data-id="${o.id}" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    ${podeAvancar ? `
                    <button class="pl-btn-acao pl-btn-avancar" data-action="avancar" data-id="${o.id}" title="Avançar para ${PL_ETAPA_LABEL[proxEtapa[o.etapa]]}">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>` : ''}
                    <button class="pl-btn-acao pl-btn-excluir" data-action="excluir" data-id="${o.id}" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>`;
}

function _plRenderPerdidos() {
    const lista = document.getElementById('plPerdidosLista');
    if (!lista) return;
    const perdidas = _plTodas.filter(o => o.etapa === 'perdido');
    if (!perdidas.length) {
        lista.innerHTML = '<div class="pl-perdidos-vazio"><i class="fa-regular fa-folder-open"></i><p>Nenhuma oportunidade perdida</p></div>';
        return;
    }
    lista.innerHTML = perdidas.map(o => {
        const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
        return `<div class="pl-perdido-item">
            <div class="pl-perdido-info">
                <span class="pl-perdido-titulo">${_plEscapar(o.titulo)}</span>
                <span class="pl-perdido-cliente">${_plEscapar(cliente)}</span>
            </div>
            <div class="pl-perdido-acoes">
                <button class="pl-btn-acao pl-btn-editar" onclick="plAbrirModal('${o.id}')" title="Editar / Reabrir">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="pl-btn-acao pl-btn-excluir" onclick="plAbrirModalExcluir('${o.id}')" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ── Filtro ─────────────────────────────────────────────────────────────────

function plFiltrar() {
    const termo = document.getElementById('filtroPipeline')?.value.toLowerCase().trim() || '';
    _plFiltradas = _plTodas.filter(o => {
        const txt = [o.titulo, o.responsavel, o.parceiros?.razao_social, o.parceiros?.nome_fantasia]
            .filter(Boolean).join(' ').toLowerCase();
        return txt.includes(termo);
    }).filter(o => o.etapa !== 'perdido');
    plRenderizar();
}

// ── Mobile tabs ────────────────────────────────────────────────────────────

function plSwitchTab(btn) {
    document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    _plTabAtiva = btn.dataset.col;
    plAtualizarMobileTab();
}

function plAtualizarMobileTab() {
    if (window.innerWidth > 768) return;
    document.querySelectorAll('.pl-col').forEach(col => {
        col.style.display = col.dataset.etapa === _plTabAtiva ? '' : 'none';
    });
}

// ── Gerar/ver Pedido a partir da oportunidade ──────────────────────────────

function plGerarPedido(id) {
    const o = _plTodas.find(x => x.id === id);
    if (!o) return;
    const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '';
    const params = new URLSearchParams({
        oportunidade_id: id,
        cliente_id:      o.cliente_id || '',
        cliente_nome:    cliente,
        valor:           o.valor || '',
        moeda:           o.moeda || 'USD',
    });
    window.open(`pedidos.html?${params.toString()}`, '_blank');
}

function plVerPedido(pedidoId) {
    window.open(`pedidos.html?editar=${pedidoId}`, '_blank');
}

// ── Avançar etapa ──────────────────────────────────────────────────────────

async function plAvancarEtapa(id) {
    const op  = _plTodas.find(o => o.id === id);
    if (!op) return;
    const prox = { lead: 'proposta', proposta: 'negociacao', negociacao: 'fechado' };
    const nova  = prox[op.etapa];
    if (!nova) return;

    op.etapa = nova;
    plRenderizar();

    const res = await atualizarEtapaOportunidade(id, nova);
    if (!res.sucesso) {
        op.etapa = Object.keys(prox).find(k => prox[k] === nova) || op.etapa;
        plRenderizar();
        alert('Erro ao atualizar etapa.');
    }
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

function plAbrirModal(id = null) {
    const op = id ? _plTodas.find(o => o.id === id) : null;
    document.getElementById('plEditId').value        = op?.id || '';
    document.getElementById('plModalTitulo').innerHTML = op
        ? '<i class="fa-solid fa-pen"></i> Editar Oportunidade'
        : '<i class="fa-solid fa-filter"></i> Nova Oportunidade';

    document.getElementById('plTitulo').value        = op?.titulo || '';
    document.getElementById('plClienteNome').value   = op?.parceiros?.nome_fantasia || op?.parceiros?.razao_social || '';
    document.getElementById('plClienteId').value     = op?.cliente_id || '';
    document.getElementById('plValor').value         = op?.valor || '';
    document.getElementById('plMoeda').value         = op?.moeda || 'USD';
    document.getElementById('plEtapa').value         = op?.etapa || 'lead';
    document.getElementById('plProbabilidade').value = op?.probabilidade ?? 50;
    document.getElementById('plResponsavel').value   = op?.responsavel || '';
    document.getElementById('plDataPrevista').value  = op?.data_prevista || '';
    document.getElementById('plObservacoes').value   = op?.observacoes || '';

    document.getElementById('plModalOverlay').classList.add('ativo');
}

function plFecharModal() {
    document.getElementById('plModalOverlay').classList.remove('ativo');
    document.getElementById('plAutoCliente').innerHTML = '';
}

async function plSalvar() {
    const titulo = document.getElementById('plTitulo').value.trim();
    if (!titulo) {
        document.getElementById('plTitulo').focus();
        return;
    }

    const btn = document.getElementById('plBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        titulo,
        cliente_id:    document.getElementById('plClienteId').value || null,
        valor:         document.getElementById('plValor').value || null,
        moeda:         document.getElementById('plMoeda').value,
        etapa:         document.getElementById('plEtapa').value,
        probabilidade: parseInt(document.getElementById('plProbabilidade').value) || 50,
        responsavel:   document.getElementById('plResponsavel').value.trim() || null,
        data_prevista: document.getElementById('plDataPrevista').value || null,
        observacoes:   document.getElementById('plObservacoes').value.trim() || null,
    };

    const id  = document.getElementById('plEditId').value || null;
    const res = await salvarOportunidade(dados, id);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }

    plFecharModal();
    await plCarregar();
}

// ── Autocomplete de clientes (empresas cadastradas em Parceiros) ───────────

let _plBuscaTimer = null;

async function _plListarClientes(termo, box) {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('parceiros')
            .select('id, razao_social, nome_fantasia')
            .limit(termo ? 8 : 15);
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        if (termo) query = query.or(`razao_social.ilike."%${_plEscaparFiltro(termo)}%",nome_fantasia.ilike."%${_plEscaparFiltro(termo)}%"`);
        else query = query.order('razao_social', { ascending: true });

        const { data } = await query;

        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhuma empresa encontrada — cadastre em Empresas primeiro</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="plSelecionarCliente('${p.id}', '${_plEscaparAtributo(p.nome_fantasia || p.razao_social)}')">
                <span class="pl-auto-nome">${_plEscapar(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_plEscapar(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

async function plBuscarCliente(termo) {
    const box = document.getElementById('plAutoCliente');
    document.getElementById('plClienteId').value = '';
    clearTimeout(_plBuscaTimer);
    _plBuscaTimer = setTimeout(() => _plListarClientes(termo?.length >= 2 ? termo : '', box), 300);
}

// Foco no campo: mostra a lista sem apagar o cliente já selecionado (editar oportunidade)
function plMostrarClientes(termo) {
    _plListarClientes(termo?.length >= 2 ? termo : '', document.getElementById('plAutoCliente'));
}

function plSelecionarCliente(id, nome) {
    document.getElementById('plClienteId').value   = id;
    document.getElementById('plClienteNome').value = nome;
    document.getElementById('plAutoCliente').innerHTML = '';
}

// Escapa valores usados dentro de filtros PostgREST (.or()) — evita que
// vírgulas/parênteses no termo digitado alterem a estrutura do filtro.
function _plEscaparFiltro(termo) {
    return String(termo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Para uso como argumento de string dentro de onclick="fn('...')" — além do
// escape de HTML acima, escapa barra invertida e aspas simples para não
// quebrar o literal JS de aspas simples embutido no atributo.
function _plEscaparAtributo(str) {
    return _plEscapar(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

document.addEventListener('click', e => {
    if (!e.target.closest('#plAutoCliente') && !e.target.closest('#plClienteNome')) {
        const box = document.getElementById('plAutoCliente');
        if (box) box.innerHTML = '';
    }
});

// ── Modal excluir ──────────────────────────────────────────────────────────

function plAbrirModalExcluir(id) {
    _plExcluirId = id;
    const op = _plTodas.find(o => o.id === id);
    document.getElementById('plExcluirNome').textContent = op?.titulo || '';
    document.getElementById('plModalExcluirOverlay').classList.add('ativo');
}

function plFecharModalExcluir() {
    _plExcluirId = null;
    document.getElementById('plModalExcluirOverlay').classList.remove('ativo');
}

async function plConfirmarExcluir() {
    if (!_plExcluirId) return;
    const btn = document.getElementById('plBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await excluirOportunidade(_plExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    plFecharModalExcluir();
    await plCarregar();
}

// ── Painel perdidos ────────────────────────────────────────────────────────

function plTogglePerdidos() {
    document.getElementById('plPerdidosPanel').classList.toggle('ativo');
    document.getElementById('plPerdidosOverlay').classList.toggle('ativo');
}

function plFecharPerdidos() {
    document.getElementById('plPerdidosPanel').classList.remove('ativo');
    document.getElementById('plPerdidosOverlay').classList.remove('ativo');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _plEscapar(str) {
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
