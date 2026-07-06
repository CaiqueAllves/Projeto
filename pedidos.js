// ========================================
// PEDIDOS
// ========================================

let _pedTodos    = [];
let _pedFiltrados = [];
let _pedExcluirId = null;

const PED_STATUS_LABEL = {
    aguardando:   'Aguardando',
    confirmado:   'Confirmado',
    em_producao:  'Em produção',
    embarcado:    'Embarcado',
    entregue:     'Entregue',
    cancelado:    'Cancelado',
};

const PED_STATUS_CLASS = {
    aguardando:   'ped-badge-aguardando',
    confirmado:   'ped-badge-confirmado',
    em_producao:  'ped-badge-em_producao',
    embarcado:    'ped-badge-embarcado',
    entregue:     'ped-badge-entregue',
    cancelado:    'ped-badge-cancelado',
};

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _pedCarregarUsuario();
    await pedCarregar();
});

function _pedCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function pedCarregar() {
    const tbody = document.getElementById('pedTbody');
    tbody.innerHTML = '<tr><td colspan="7" class="ped-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const res = await buscarPedidos();
    if (!res.sucesso) {
        tbody.innerHTML = '<tr><td colspan="7" class="ped-vazio">Erro ao carregar pedidos.</td></tr>';
        return;
    }

    _pedTodos    = res.data || [];
    _pedFiltrados = [..._pedTodos];
    pedRenderizar();
}

// ── Filtrar ────────────────────────────────────────────────────────────────

function pedFiltrar() {
    const termo  = document.getElementById('filtroPedidos')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('filtroStatusPedido')?.value || '';

    _pedFiltrados = _pedTodos.filter(p => {
        const txt = [p.numero, p.parceiros?.razao_social, p.parceiros?.nome_fantasia]
            .filter(Boolean).join(' ').toLowerCase();
        const okTermo  = !termo  || txt.includes(termo);
        const okStatus = !status || p.status === status;
        return okTermo && okStatus;
    });

    pedRenderizar();
}

// ── Renderizar tabela ──────────────────────────────────────────────────────

function pedRenderizar() {
    const tbody = document.getElementById('pedTbody');

    if (!_pedFiltrados.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="ped-vazio"><i class="fa-regular fa-folder-open"></i> Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = _pedFiltrados.map(p => {
        const cliente   = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
        const valor     = p.valor_total
            ? `${p.moeda || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '—';
        const dataPed   = p.data_pedido
            ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';
        const dataEntr  = p.data_entrega_prevista
            ? new Date(p.data_entrega_prevista + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';
        const status    = p.status || 'aguardando';
        const badgeClass = PED_STATUS_CLASS[status] || '';
        const badgeLabel = PED_STATUS_LABEL[status] || status;

        return `<tr>
            <td class="ped-num">${_pedEscapar(p.numero || '—')}</td>
            <td>${_pedEscapar(cliente)}</td>
            <td class="ped-valor">${valor}</td>
            <td>${dataPed}</td>
            <td>${dataEntr}</td>
            <td><span class="ped-badge ${badgeClass}">${badgeLabel}</span></td>
            <td>
                <div class="ped-acoes">
                    <select class="ped-status-select ped-status-${status}" onchange="pedAlterarStatus('${p.id}', this)" title="Alterar status">
                        ${Object.entries(PED_STATUS_LABEL).map(([v, l]) =>
                            `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`
                        ).join('')}
                    </select>
                    <button class="pl-btn-acao pl-btn-editar" onclick="pedAbrirModal('${p.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="pl-btn-acao pl-btn-excluir" onclick="pedAbrirModalExcluir('${p.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');
}

// ── Alterar status inline ──────────────────────────────────────────────────

async function pedAlterarStatus(id, selectEl) {
    const novoStatus = selectEl.value;
    const res = await atualizarStatusPedido(id, novoStatus);
    if (!res.sucesso) {
        alert('Erro ao atualizar status.');
        await pedCarregar();
        return;
    }
    const pedido = _pedTodos.find(p => p.id === id);
    if (pedido) pedido.status = novoStatus;

    // Atualiza a classe do select visualmente
    selectEl.className = `ped-status-select ped-status-${novoStatus}`;
    const badge = selectEl.closest('tr')?.querySelector('.ped-badge');
    if (badge) {
        badge.className = `ped-badge ${PED_STATUS_CLASS[novoStatus] || ''}`;
        badge.textContent = PED_STATUS_LABEL[novoStatus] || novoStatus;
    }
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

function pedAbrirModal(id = null) {
    const ped = id ? _pedTodos.find(p => p.id === id) : null;

    document.getElementById('pedEditId').value       = ped?.id || '';
    document.getElementById('pedModalTitulo').innerHTML = ped
        ? '<i class="fa-solid fa-pen"></i> Editar Pedido'
        : '<i class="fa-solid fa-bag-shopping"></i> Novo Pedido';

    document.getElementById('pedNumero').value       = ped?.numero || '';
    document.getElementById('pedStatus').value       = ped?.status || 'aguardando';
    document.getElementById('pedClienteNome').value  = ped?.parceiros?.nome_fantasia || ped?.parceiros?.razao_social || '';
    document.getElementById('pedClienteId').value    = ped?.cliente_id || '';
    document.getElementById('pedValor').value        = ped?.valor_total || '';
    document.getElementById('pedMoeda').value        = ped?.moeda || 'USD';
    document.getElementById('pedDataPedido').value   = ped?.data_pedido || '';
    document.getElementById('pedDataEntrega').value  = ped?.data_entrega_prevista || '';
    document.getElementById('pedObservacoes').value  = ped?.observacoes || '';

    document.getElementById('pedModalOverlay').classList.add('ativo');
}

function pedFecharModal() {
    document.getElementById('pedModalOverlay').classList.remove('ativo');
    document.getElementById('pedAutoCliente').innerHTML = '';
}

async function pedSalvar() {
    const btn = document.getElementById('pedBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        numero:               document.getElementById('pedNumero').value.trim() || null,
        status:               document.getElementById('pedStatus').value,
        cliente_id:           document.getElementById('pedClienteId').value || null,
        valor_total:          document.getElementById('pedValor').value || null,
        moeda:                document.getElementById('pedMoeda').value,
        data_pedido:          document.getElementById('pedDataPedido').value || null,
        data_entrega_prevista: document.getElementById('pedDataEntrega').value || null,
        observacoes:          document.getElementById('pedObservacoes').value.trim() || null,
    };

    const id  = document.getElementById('pedEditId').value || null;
    const res = await salvarPedido(dados, id);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    pedFecharModal();
    await pedCarregar();
}

// ── Autocomplete clientes ──────────────────────────────────────────────────

let _pedBuscaTimer = null;
async function pedBuscarCliente(termo) {
    const box = document.getElementById('pedAutoCliente');
    document.getElementById('pedClienteId').value = '';
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }

    clearTimeout(_pedBuscaTimer);
    _pedBuscaTimer = setTimeout(async () => {
        try {
            const { data } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social, nome_fantasia')
                .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
                .limit(8);

            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum cliente encontrado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="pedSelecionarCliente(${p.id}, '${_pedEscapar(p.nome_fantasia || p.razao_social)}')">
                    <span class="pl-auto-nome">${_pedEscapar(p.nome_fantasia || p.razao_social)}</span>
                    ${p.nome_fantasia ? `<span class="pl-auto-razao">${_pedEscapar(p.razao_social)}</span>` : ''}
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function pedSelecionarCliente(id, nome) {
    document.getElementById('pedClienteId').value   = id;
    document.getElementById('pedClienteNome').value = nome;
    document.getElementById('pedAutoCliente').innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#pedAutoCliente') && !e.target.closest('#pedClienteNome')) {
        const box = document.getElementById('pedAutoCliente');
        if (box) box.innerHTML = '';
    }
});

// ── Modal excluir ──────────────────────────────────────────────────────────

function pedAbrirModalExcluir(id) {
    _pedExcluirId = id;
    const ped = _pedTodos.find(p => p.id === id);
    document.getElementById('pedExcluirNum').textContent = ped?.numero || ped?.id?.substring(0, 8) || '';
    document.getElementById('pedModalExcluirOverlay').classList.add('ativo');
}

function pedFecharModalExcluir() {
    _pedExcluirId = null;
    document.getElementById('pedModalExcluirOverlay').classList.remove('ativo');
}

async function pedConfirmarExcluir() {
    if (!_pedExcluirId) return;
    const btn = document.getElementById('pedBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await excluirPedido(_pedExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    pedFecharModalExcluir();
    await pedCarregar();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _pedEscapar(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}
