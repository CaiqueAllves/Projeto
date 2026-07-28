// ========================================
// PEDIDOS
// ========================================

let _pedTodos    = [];
let _pedFiltrados = [];
let _pedExcluirId = null;
let _pedItensAtual = [];
const _pedItemBuscaTimers = {};

// Escapa valores usados dentro de filtros PostgREST (.or()) — evita que
// vírgulas/parênteses no termo digitado alterem a estrutura do filtro.
function _pedEscaparFiltro(termo) {
    return String(termo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

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
    await _pedCarregarMoedas();
    await pedCarregar();
    _pedTratarParametrosUrl();
});

// ── Moedas (tabela apoio_moedas) ─────────────────────────────────────────────

async function _pedCarregarMoedas() {
    const sel = document.getElementById('pedMoeda');
    if (!sel) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('descricao', { ascending: true });
        if (data?.length) {
            sel.innerHTML = data.map(m => `<option value="${m.sigla || m.codigo}">${_pedEscapar(m.descricao || '')}</option>`).join('');
        }
    } catch (e) {
        console.warn('[Pedidos] Falha ao carregar moedas:', e);
    }
}

// ── Integração com Pipeline (oportunidade -> pedido) ────────────────────────

function _pedTratarParametrosUrl() {
    const params = new URLSearchParams(window.location.search);

    const editarId = params.get('editar');
    if (editarId) {
        pedAbrirModal(editarId);
        return;
    }

    const oportunidadeId = params.get('oportunidade_id');
    if (oportunidadeId) {
        pedAbrirModal();
        document.getElementById('pedOportunidadeId').value = oportunidadeId;
        document.getElementById('pedClienteNome').value    = params.get('cliente_nome') || '';
        document.getElementById('pedClienteId').value      = params.get('cliente_id')   || '';
        document.getElementById('pedMoeda').value          = params.get('moeda')        || 'USD';

        const valorParam = parseFloat(params.get('valor'));
        if (valorParam > 0) {
            _pedItensAtual = [{ produto_id: null, produto_nome: 'Item do pedido', quantidade: 1, unidade_medida: 'UN', preco_unitario: valorParam }];
            pedRenderizarItens();
        }
    }
}

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
    tbody.innerHTML = '<tr><td colspan="8" class="ped-loading"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</td></tr>';

    const res = await buscarPedidos();
    if (!res.sucesso) {
        tbody.innerHTML = '<tr><td colspan="8" class="ped-vazio">Erro ao carregar pedidos.</td></tr>';
        return;
    }

    _pedTodos    = res.data || [];

    // Processos gerados a partir da proforma de cada pedido (pedido -> proforma -> processos)
    const proformaIds = [...new Set(_pedTodos.map(p => p.proforma_id).filter(Boolean))];
    let processosMap = {};
    if (proformaIds.length > 0) {
        const { data: procs } = await supabaseClient
            .from('processos')
            .select('id, proforma_id')
            .in('proforma_id', proformaIds);
        (procs || []).forEach(pr => {
            (processosMap[pr.proforma_id] ||= []).push(pr);
        });
    }
    _pedTodos.forEach(p => { p._processos = p.proforma_id ? (processosMap[p.proforma_id] || []) : []; });

    _pedFiltrados = [..._pedTodos];
    pedRenderizar();
}

// ── Filtrar ────────────────────────────────────────────────────────────────

function pedFiltrar() {
    const termo  = document.getElementById('filtroPedidos')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('filtroStatusPedido')?.value || '';

    _pedFiltrados = _pedTodos.filter(p => {
        const txt = [p.numero, p.parceiros?.razao_social, p.parceiros?.nome_fantasia, p.remetente?.razao_social, p.remetente?.nome_fantasia]
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
        tbody.innerHTML = '<tr><td colspan="8" class="ped-vazio"><i class="fa-regular fa-folder-open"></i> Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = _pedFiltrados.map(p => {
        const cliente   = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
        const remetente = p.remetente?.nome_fantasia || p.remetente?.razao_social || '';
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

        return `<tr class="ped-row ped-row-${status}">
            <td class="ped-num">${_pedEscapar(p.numero || '—')}</td>
            <td>${remetente
                ? `<span class="ped-remetente-tag"><i class="fa-solid fa-building"></i> ${_pedEscapar(remetente)}</span>`
                : `<span class="ped-remetente-tag ped-remetente-propria"><i class="fa-solid fa-house-flag"></i> Própria empresa</span>`}</td>
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
                    ${p.proforma_id
                        ? `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProforma('${p.proforma_id}')" title="Ver Proforma gerada"><i class="fa-solid fa-file-invoice-dollar"></i></button>`
                        : `<button class="pl-btn-acao pl-btn-editar" onclick="pedGerarProforma('${p.id}')" title="Gerar Proforma"><i class="fa-solid fa-file-circle-plus"></i></button>`}
                    ${_pedBotaoProcessos(p)}
                    ${(p._processos && p._processos.length > 0)
                        ? `<button class="pl-btn-acao pl-btn-editar" onclick="pedGerarContaReceber('${p.id}')" title="Gerar Conta a Receber"><i class="fa-solid fa-sack-dollar"></i></button>`
                        : `<button class="pl-btn-acao pl-btn-editar" disabled title="Gere um Processo antes de criar a Conta a Receber" style="opacity:.4;cursor:not-allowed;"><i class="fa-solid fa-sack-dollar"></i></button>`}
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

// ── Gerar/ver Proforma a partir do pedido ───────────────────────────────────

function pedGerarProforma(id) {
    window.open(`formularios.html?tab=proposta&pedido_id=${id}`, '_blank');
}

function pedVerProforma(proformaId) {
    window.open(`formularios.html?tab=proposta&id=${proformaId}&modo=visualizar`, '_blank');
}

// ── Ver Processo(s) gerados a partir da proforma do pedido ──────────────────

function _pedBotaoProcessos(p) {
    const processos = p._processos || [];
    if (!processos.length) return '';
    if (processos.length === 1) {
        return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProcessoUnico('${processos[0].id}')" title="Ver Processo"><i class="fa-solid fa-diagram-project"></i></button>`;
    }
    return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProcessos('${p.proforma_id}')" title="Ver Processos (${processos.length})"><i class="fa-solid fa-diagram-project"></i> ${processos.length}</button>`;
}

function pedVerProcessoUnico(processoId) {
    window.open(`formularios.html?tab=processo&id=${processoId}&modo=visualizar`, '_blank');
}

function pedVerProcessos(proformaId) {
    window.open(`processos.html?proforma_id=${proformaId}`, '_blank');
}

// ── Gerar Conta a Receber a partir do pedido ────────────────────────────────

function pedGerarContaReceber(id) {
    window.open(`contas-receber.html?gerar_pedido_id=${id}`, '_blank');
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

async function pedAbrirModal(id = null) {
    const ped = id ? _pedTodos.find(p => p.id === id) : null;

    document.getElementById('pedEditId').value         = ped?.id || '';
    document.getElementById('pedOportunidadeId').value = ped?.oportunidade_id || '';
    document.getElementById('pedModalTitulo').innerHTML = ped
        ? '<i class="fa-solid fa-pen"></i> Editar Pedido'
        : '<i class="fa-solid fa-bag-shopping"></i> Novo Pedido';

    document.getElementById('pedNumero').value       = ped?.numero || '';
    document.getElementById('pedStatus').value       = ped?.status || 'aguardando';
    document.getElementById('pedClienteNome').value       = ped?.parceiros?.nome_fantasia || ped?.parceiros?.razao_social || '';
    document.getElementById('pedClienteId').value          = ped?.cliente_id || '';
    document.getElementById('pedClienteDocumento').value    = ped?.parceiros?.documento || '';
    document.getElementById('pedMoeda').value        = ped?.moeda || 'USD';
    document.getElementById('pedDataPedido').value   = ped?.data_pedido || '';
    document.getElementById('pedDataEntrega').value  = ped?.data_entrega_prevista || '';
    document.getElementById('pedObservacoes').value  = ped?.observacoes || '';

    // Emissor: própria empresa (padrão) ou terceiro/intermediário
    document.getElementById('pedRemetenteNome').value       = ped?.remetente?.nome_fantasia || ped?.remetente?.razao_social || '';
    document.getElementById('pedRemetenteId').value          = ped?.remetente_parceiro_id || '';
    document.getElementById('pedRemetenteDocumento').value   = ped?.remetente?.documento || '';
    const emissorTipo = ped?.remetente_parceiro_id ? 'terceiro' : 'usuario';
    document.getElementById(`ped-emissor-${emissorTipo}`).checked = true;
    await pedAtualizarEmissorTipo();

    _pedItensAtual = (ped?.pedido_itens || []).map(it => ({
        produto_id:     it.produto_id || null,
        produto_nome:   it.produto_nome || it.produtos?.nome || '',
        quantidade:     Number(it.quantidade) || 1,
        unidade_medida: it.unidade_medida || 'UN',
        preco_unitario: Number(it.preco_unitario) || 0,
    }));
    if (!_pedItensAtual.length) {
        _pedItensAtual = [{ produto_id: null, produto_nome: '', quantidade: 1, unidade_medida: 'UN', preco_unitario: 0 }];
    }
    pedRenderizarItens();

    document.getElementById('pedModalOverlay').classList.add('ativo');
}

function pedFecharModal() {
    document.getElementById('pedModalOverlay').classList.remove('ativo');
    document.getElementById('pedAutoCliente').innerHTML = '';
    document.getElementById('pedAutoRemetente').innerHTML = '';
    document.getElementById('pedClienteDocumento').value = '';
    document.getElementById('pedRemetenteDocumento').value = '';
    _pedItensAtual = [];
}

// ── Emissor: própria empresa ou terceiro/intermediário ──────────────────────

let _pedEmpresaPropria = null;
async function _pedCarregarEmpresaPropria() {
    if (_pedEmpresaPropria) return _pedEmpresaPropria;
    try {
        const res = await window.supabaseAPI.buscarTenantEmpresa();
        if (res.sucesso) _pedEmpresaPropria = res.data;
    } catch (e) {}
    return _pedEmpresaPropria;
}

async function pedAtualizarEmissorTipo() {
    const tipo = document.querySelector('input[name="ped-emissor-tipo"]:checked')?.value || 'usuario';
    document.getElementById('ped-emissor-opcao-usuario').classList.toggle('ativo', tipo === 'usuario');
    document.getElementById('ped-emissor-opcao-terceiro').classList.toggle('ativo', tipo === 'terceiro');

    const nomeInput = document.getElementById('pedRemetenteNome');
    const docInput  = document.getElementById('pedRemetenteDocumento');

    if (tipo === 'usuario') {
        const emp = await _pedCarregarEmpresaPropria();
        document.getElementById('pedRemetenteId').value = '';
        nomeInput.value    = emp?.nome_fantasia || emp?.razao_social || '';
        nomeInput.readOnly = true;
        docInput.value     = emp?.cnpj || '';
    } else {
        nomeInput.readOnly = false;
        if (document.getElementById('pedRemetenteId').value === '') {
            nomeInput.value = '';
            docInput.value  = '';
        }
    }
}

let _pedBuscaRemetenteTimer = null;
async function _pedListarRemetentes(termo, box) {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('parceiros')
            .select('id, razao_social, nome_fantasia, documento')
            .limit(termo ? 8 : 15);
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        if (termo) query = query.or(`razao_social.ilike."%${_pedEscaparFiltro(termo)}%",nome_fantasia.ilike."%${_pedEscaparFiltro(termo)}%"`);
        else query = query.order('razao_social', { ascending: true });

        const { data } = await query;

        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhuma empresa encontrada</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="pedSelecionarRemetente('${p.id}', '${_pedEscaparAtributo(p.nome_fantasia || p.razao_social)}', '${_pedEscaparAtributo(p.documento || '')}')">
                <span class="pl-auto-nome">${_pedEscapar(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_pedEscapar(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

async function pedBuscarRemetente(termo) {
    const box = document.getElementById('pedAutoRemetente');
    document.getElementById('pedRemetenteId').value = '';
    document.getElementById('pedRemetenteDocumento').value = '';

    clearTimeout(_pedBuscaRemetenteTimer);
    _pedBuscaRemetenteTimer = setTimeout(() => _pedListarRemetentes(termo?.length >= 2 ? termo : '', box), 300);
}

// Foco no campo: mostra a lista sem apagar a empresa já selecionada (editar pedido)
function pedMostrarRemetentes(termo) {
    if (document.getElementById('pedRemetenteNome')?.readOnly) return;
    _pedListarRemetentes(termo?.length >= 2 ? termo : '', document.getElementById('pedAutoRemetente'));
}

function pedSelecionarRemetente(id, nome, documento) {
    document.getElementById('pedRemetenteId').value        = id;
    document.getElementById('pedRemetenteNome').value      = nome;
    document.getElementById('pedRemetenteDocumento').value = documento || '';
    document.getElementById('pedAutoRemetente').innerHTML  = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#pedAutoRemetente') && !e.target.closest('#pedRemetenteNome')) {
        const box = document.getElementById('pedAutoRemetente');
        if (box) box.innerHTML = '';
    }
});

// ── Itens do pedido ──────────────────────────────────────────────────────────

function pedAdicionarItem() {
    _pedItensAtual.push({ produto_id: null, produto_nome: '', quantidade: 1, unidade_medida: 'UN', preco_unitario: 0 });
    pedRenderizarItens();
}

function pedRemoverItem(idx) {
    _pedItensAtual.splice(idx, 1);
    pedRenderizarItens();
}

function pedAtualizarItem(idx, campo, valor) {
    if (!_pedItensAtual[idx]) return;
    _pedItensAtual[idx][campo] = valor;
    pedRecalcularTotais();
}

function pedRenderizarItens() {
    const body = document.getElementById('ped-itens-body');
    if (!body) return;

    body.innerHTML = _pedItensAtual.map((item, i) => `
        <div class="ped-item-card">
            <div class="ped-item-top">
                <span class="ped-item-badge">${i + 1}</span>
                <div class="ped-item-produto-wrap">
                    <input type="text" class="ped-item-input" id="ped-item-produto-${i}"
                        value="${_pedEscapar(item.produto_nome)}" autocomplete="off"
                        placeholder="Buscar produto ou digitar descrição..."
                        oninput="pedBuscarProduto(${i}, this.value)">
                    <input type="hidden" id="ped-item-produtoId-${i}" value="${item.produto_id || ''}">
                    <div class="pl-autocomplete" id="ped-item-auto-${i}"></div>
                </div>
                <button type="button" class="ped-item-del" onclick="pedRemoverItem(${i})" title="Remover">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="ped-item-bottom">
                <div class="ped-item-field ped-item-field--qtd">
                    <label>Qtd</label>
                    <input type="number" class="ped-item-input" min="0" step="0.01" value="${item.quantidade}"
                        oninput="pedAtualizarItem(${i}, 'quantidade', parseFloat(this.value)||0)">
                </div>
                <div class="ped-item-field ped-item-field--un">
                    <label>Un.</label>
                    <input type="text" class="ped-item-input" value="${_pedEscapar(item.unidade_medida)}"
                        oninput="pedAtualizarItem(${i}, 'unidade_medida', this.value)">
                </div>
                <div class="ped-item-field ped-item-field--preco">
                    <label>Preço Unit.</label>
                    <input type="number" class="ped-item-input" min="0" step="0.01" value="${item.preco_unitario}"
                        oninput="pedAtualizarItem(${i}, 'preco_unitario', parseFloat(this.value)||0)">
                </div>
                <div class="ped-item-field ped-item-field--total">
                    <label>Total</label>
                    <span class="ped-item-total-val" id="ped-item-total-${i}">${(item.quantidade * item.preco_unitario).toFixed(2)}</span>
                </div>
            </div>
        </div>`).join('');

    pedRecalcularTotais();
}

function pedRecalcularTotais() {
    _pedItensAtual.forEach((item, i) => {
        const el = document.getElementById(`ped-item-total-${i}`);
        if (el) el.textContent = (item.quantidade * item.preco_unitario).toFixed(2);
    });

    const total   = _pedItensAtual.reduce((s, it) => s + (it.quantidade * it.preco_unitario), 0);
    const moeda   = document.getElementById('pedMoeda')?.value || 'USD';
    const totalEl = document.getElementById('pedTotalGeral');
    if (totalEl) {
        totalEl.textContent = total
            ? `${moeda} ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '—';
    }
}

// ── Autocomplete produtos ────────────────────────────────────────────────────

async function pedBuscarProduto(idx, termo) {
    const box = document.getElementById(`ped-item-auto-${idx}`);
    document.getElementById(`ped-item-produtoId-${idx}`).value = '';
    pedAtualizarItem(idx, 'produto_id', null);
    pedAtualizarItem(idx, 'produto_nome', termo);
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }

    clearTimeout(_pedItemBuscaTimers[idx]);
    _pedItemBuscaTimers[idx] = setTimeout(async () => {
        try {
            const usuario = obterUsuarioLogado();
            const { data } = await supabaseClient
                .from('produtos')
                .select('id, nome, sku')
                .eq('empresa_id', usuario.empresa_id)
                .or(`nome.ilike."%${_pedEscaparFiltro(termo)}%",sku.ilike."%${_pedEscaparFiltro(termo)}%"`)
                .limit(8);

            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum produto encontrado — usando texto digitado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="pedSelecionarProduto(${idx}, '${p.id}', '${_pedEscaparAtributo(p.nome)}')">
                    <span class="pl-auto-nome">${_pedEscapar(p.nome)}</span>
                    ${p.sku ? `<span class="pl-auto-razao">${_pedEscapar(p.sku)}</span>` : ''}
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function pedSelecionarProduto(idx, produtoId, nome) {
    document.getElementById(`ped-item-produtoId-${idx}`).value = produtoId;
    document.getElementById(`ped-item-produto-${idx}`).value   = nome;
    document.getElementById(`ped-item-auto-${idx}`).innerHTML  = '';
    pedAtualizarItem(idx, 'produto_id', produtoId);
    pedAtualizarItem(idx, 'produto_nome', nome);
}

document.addEventListener('click', e => {
    if (e.target.closest('[id^="ped-item-auto-"]') || e.target.closest('[id^="ped-item-produto-"]')) return;
    document.querySelectorAll('[id^="ped-item-auto-"]').forEach(b => b.innerHTML = '');
});

async function pedSalvar() {
    const linhasValidas = _pedItensAtual.filter(it => it.produto_nome?.trim() && it.quantidade > 0);
    if (!linhasValidas.length) {
        alert('Adicione ao menos um item com produto, quantidade e preço.');
        return;
    }

    const emissorTipo = document.querySelector('input[name="ped-emissor-tipo"]:checked')?.value || 'usuario';
    if (emissorTipo === 'terceiro' && !document.getElementById('pedRemetenteId').value) {
        alert('Selecione a Empresa Remetente ou volte pra "Própria empresa".');
        return;
    }

    const btn = document.getElementById('pedBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const valorTotal = linhasValidas.reduce((s, it) => s + (it.quantidade * it.preco_unitario), 0);

    const dados = {
        numero:               document.getElementById('pedNumero').value.trim() || null,
        status:               document.getElementById('pedStatus').value,
        cliente_id:           document.getElementById('pedClienteId').value || null,
        remetente_parceiro_id: document.getElementById('pedRemetenteId').value || null,
        oportunidade_id:      document.getElementById('pedOportunidadeId').value || null,
        valor_total:          valorTotal || null,
        moeda:                document.getElementById('pedMoeda').value,
        data_pedido:          document.getElementById('pedDataPedido').value || null,
        data_entrega_prevista: document.getElementById('pedDataEntrega').value || null,
        observacoes:          document.getElementById('pedObservacoes').value.trim() || null,
    };

    const id  = document.getElementById('pedEditId').value || null;
    const res = await salvarPedido(dados, id, linhasValidas);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }

    _pedUltimoSalvo = {
        id:                  res.data?.id || id,
        numero:              dados.numero,
        status:              dados.status,
        clienteNome:         document.getElementById('pedClienteNome').value,
        clienteDocumento:    document.getElementById('pedClienteDocumento').value,
        remetenteNome:       document.getElementById('pedRemetenteNome').value,
        remetenteDocumento:  document.getElementById('pedRemetenteDocumento').value,
        valor_total:         dados.valor_total,
        moeda:               dados.moeda,
        data_pedido:         dados.data_pedido,
        data_entrega_prevista: dados.data_entrega_prevista,
        observacoes:         dados.observacoes,
        itens:               linhasValidas,
    };
    pedMostrarPosSalvo(_pedUltimoSalvo);
    await pedCarregar();
}

// ── Tela pós-salvo ───────────────────────────────────────────────────────────

let _pedUltimoSalvo = null;

function pedMostrarPosSalvo(pedido) {
    document.getElementById('ped-form-body').style.display   = 'none';
    document.getElementById('ped-form-footer').style.display = 'none';
    document.getElementById('ped-pos-salvo-numero').textContent = pedido.numero || pedido.id?.slice(0, 8).toUpperCase() || '—';
    document.getElementById('ped-pos-salvo').style.display = 'flex';
}

function pedFecharPosSalvo() {
    document.getElementById('ped-pos-salvo').style.display    = 'none';
    document.getElementById('ped-form-body').style.display    = '';
    document.getElementById('ped-form-footer').style.display  = '';
    pedFecharModal();
}

function pedAdicionarOutroPedido() {
    document.getElementById('ped-pos-salvo').style.display    = 'none';
    document.getElementById('ped-form-body').style.display    = '';
    document.getElementById('ped-form-footer').style.display  = '';
    pedAbrirModal();
}

function pedGerarPDF() {
    if (typeof gerarPDFPedido === 'function' && _pedUltimoSalvo) {
        gerarPDFPedido(_pedUltimoSalvo);
    }
}

// ── Autocomplete clientes ──────────────────────────────────────────────────

let _pedBuscaTimer = null;
async function _pedListarClientes(termo, box) {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('parceiros')
            .select('id, razao_social, nome_fantasia, documento')
            .limit(termo ? 8 : 15);
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        if (termo) query = query.or(`razao_social.ilike."%${_pedEscaparFiltro(termo)}%",nome_fantasia.ilike."%${_pedEscaparFiltro(termo)}%"`);
        else query = query.order('razao_social', { ascending: true });

        const { data } = await query;

        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum cliente encontrado — cadastre em Empresas primeiro</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="pedSelecionarCliente('${p.id}', '${_pedEscaparAtributo(p.nome_fantasia || p.razao_social)}', '${_pedEscaparAtributo(p.documento || '')}')">
                <span class="pl-auto-nome">${_pedEscapar(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_pedEscapar(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

async function pedBuscarCliente(termo) {
    const box = document.getElementById('pedAutoCliente');
    document.getElementById('pedClienteId').value = '';
    document.getElementById('pedClienteDocumento').value = '';

    clearTimeout(_pedBuscaTimer);
    _pedBuscaTimer = setTimeout(() => _pedListarClientes(termo?.length >= 2 ? termo : '', box), 300);
}

// Foco no campo: mostra a lista sem apagar o cliente já selecionado (editar pedido)
function pedMostrarClientes(termo) {
    _pedListarClientes(termo?.length >= 2 ? termo : '', document.getElementById('pedAutoCliente'));
}

function pedSelecionarCliente(id, nome, documento) {
    document.getElementById('pedClienteId').value         = id;
    document.getElementById('pedClienteNome').value       = nome;
    document.getElementById('pedClienteDocumento').value  = documento || '';
    document.getElementById('pedAutoCliente').innerHTML    = '';
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

// ── Painel Excluídos ─────────────────────────────────────────────────────────

let _pedExcluidosAberto = false;

async function pedToggleExcluidos() {
    const panel = document.getElementById('pedExcluidosPanel');
    if (!panel) return;

    _pedExcluidosAberto = !_pedExcluidosAberto;
    panel.classList.toggle('aberto', _pedExcluidosAberto);

    if (_pedExcluidosAberto) await pedCarregarExcluidos();
}

async function pedCarregarExcluidos() {
    const container = document.getElementById('pedExcluidosContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('pedidos')
            .select('id, numero, parceiros!pedidos_cliente_id_fkey(razao_social, nome_fantasia), excluido_em, excluido_por')
            .eq('status', 'excluido')
            .order('excluido_em', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhum pedido excluído.</div>';
            return;
        }

        const agora = Date.now();
        container.innerHTML = data.map(p => {
            const cliente = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
            let metaHtml = '';
            if (p.excluido_em) {
                const exclMs        = new Date(p.excluido_em).getTime();
                const diasPassados  = Math.floor((agora - exclMs) / 86400000);
                const diasRestantes = 7 - diasPassados;
                const dataFmt       = new Date(p.excluido_em).toLocaleDateString('pt-BR');
                const corDias       = diasRestantes <= 2 ? '#dc2626' : '#94a3b8';
                metaHtml = `
                    <span class="prof-excluido-rota">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:10px;"></i> ${dataFmt}
                        ${p.excluido_por ? `· ${_pedEscapar(p.excluido_por)}` : ''}
                    </span>
                    <span class="prof-excluido-rota" style="color:${corDias};">
                        <i class="fa-solid fa-clock" style="font-size:10px;"></i>
                        ${diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}` : 'Expira hoje'}
                    </span>`;
            }
            return `
            <div class="prof-excluido-item">
                <div class="prof-excluido-info">
                    <span class="prof-excluido-codigo">${_pedEscapar(p.numero || '—')}</span>
                    <span class="prof-excluido-rota">${_pedEscapar(cliente)}</span>
                    ${metaHtml}
                </div>
                <button class="prof-excluido-restaurar" onclick="pedRestaurar('${p.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Erro: ${err.message}</div>`;
    }
}

async function pedRestaurar(id) {
    try {
        const res = await atualizarStatusPedido(id, 'aguardando');
        if (!res.sucesso) throw new Error(res.mensagem);
        await pedCarregarExcluidos();
        await pedCarregar();
    } catch (err) {
        alert('Erro ao restaurar: ' + err.message);
    }
}

document.addEventListener('click', e => {
    if (_pedExcluidosAberto && !e.target.closest('#pedExcluidosWrapper')) {
        _pedExcluidosAberto = false;
        document.getElementById('pedExcluidosPanel')?.classList.remove('aberto');
    }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function _pedEscapar(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Para uso como argumento de string dentro de onclick="fn('...')" — além do
// escape de HTML acima, escapa barra invertida e aspas simples para não
// quebrar o literal JS de aspas simples embutido no atributo.
function _pedEscaparAtributo(str) {
    return _pedEscapar(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}
