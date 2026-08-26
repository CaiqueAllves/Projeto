// ========================================
// CONTAS A PAGAR
// ========================================

let _cpTodas    = [];
let _cpFiltradas = [];
let _cpExcluirId = null;

document.addEventListener('DOMContentLoaded', async () => {
    _cpCarregarUsuario();
    await cpCarregar();
    await _cpVerificarGeracaoViaUrl();
});

// ── Abertura pré-preenchida a partir de Processo (módulo Operacional) ──────

async function _cpVerificarGeracaoViaUrl() {
    const params     = new URLSearchParams(window.location.search);
    const processoId = params.get('gerar_processo_id');
    if (!processoId) return;

    const { data: processo } = await supabaseClient
        .from('processos')
        .select('id, numero_processo, valor_total, moeda')
        .eq('id', processoId).maybeSingle();
    if (processo) {
        // Parceiro não é pré-preenchido: processos usa empresas_cadastradas,
        // uma tabela diferente de parceiros (usada nas contas). O usuário
        // seleciona o fornecedor manualmente.
        cpAbrirModal(null, {
            descricao:    `Processo ${processo.numero_processo || ''}`.trim(),
            processoId:   processo.id,
            processoNome: processo.numero_processo || '',
            valor:        processo.valor_total || '',
            moeda:        processo.moeda || 'BRL',
        });
    }
}

function _cpCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Carregar ───────────────────────────────────────────────────────────────

async function cpCarregar() {
    document.getElementById('cpTbody').innerHTML =
        '<tr><td colspan="6" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    const res = await buscarContasPagar();
    if (!res.sucesso) {
        document.getElementById('cpTbody').innerHTML =
            '<tr><td colspan="6" class="fin-vazio"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar contas</p></td></tr>';
        return;
    }
    _cpTodas    = res.data || [];
    _cpFiltradas = [..._cpTodas];
    _cpAtualizarVencidos();
    cpRenderizar();
}

function _cpAtualizarVencidos() {
    const hoje = new Date().toISOString().split('T')[0];
    _cpTodas.forEach(c => {
        if (c.status === 'pendente' && c.data_vencimento < hoje) c.status = 'vencido';
    });
}

// ── Renderizar ─────────────────────────────────────────────────────────────

function cpRenderizar() {
    const tbody = document.getElementById('cpTbody');

    if (!_cpFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="fin-vazio">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <p>Nenhuma conta encontrada</p></div></td></tr>`;
        _cpAtualizarResumo();
        return;
    }

    tbody.innerHTML = _cpFiltradas.map(c => {
        const parceiro = c.parceiros?.nome_fantasia || c.parceiros?.razao_social || '—';
        const valor    = _cpFmtValor(c.valor, c.moeda);
        const venc     = c.data_vencimento
            ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';

        const badgeMap = {
            pendente:  '<span class="fin-badge pendente"><i class="fa-solid fa-clock"></i> Pendente</span>',
            vencido:   '<span class="fin-badge vencido"><i class="fa-solid fa-circle-exclamation"></i> Vencido</span>',
            pago:      '<span class="fin-badge pago"><i class="fa-solid fa-circle-check"></i> Pago</span>',
            cancelado: '<span class="fin-badge cancelado"><i class="fa-solid fa-ban"></i> Cancelado</span>',
        };

        const podePagar = c.status === 'pendente' || c.status === 'vencido';

        return `<tr>
            <td><strong>${_cpEsc(c.descricao)}</strong>${c.categoria ? `<br><span style="font-size:11px;color:#94a3b8">${_cpEsc(c.categoria)}</span>` : ''}${c.pedidos?.numero ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-bag-shopping"></i> Pedido ${_cpEsc(c.pedidos.numero)}</span>` : ''}${c.processos?.numero_processo ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-diagram-project"></i> Processo ${_cpEsc(c.processos.numero_processo)}</span>` : ''}</td>
            <td>${_cpEsc(parceiro)}</td>
            <td class="td-valor">${valor}</td>
            <td>${venc}</td>
            <td>${badgeMap[c.status] || c.status}</td>
            <td>
                <div class="fin-acoes">
                    <button class="fin-btn-acao fin-btn-editar" onclick="cpAbrirModal('${c.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${podePagar ? `<button class="fin-btn-acao fin-btn-pagar" onclick="cpMarcarPago('${c.id}')" title="Marcar como pago"><i class="fa-solid fa-circle-check"></i></button>` : ''}
                    <button class="fin-btn-acao fin-btn-excluir" onclick="cpAbrirModalExcluir('${c.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    _cpAtualizarResumo();
}

function _cpAtualizarResumo() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const pendente = _cpTodas
        .filter(c => c.status === 'pendente')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const vencido = _cpTodas
        .filter(c => c.status === 'vencido')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const pago = _cpTodas
        .filter(c => {
            if (c.status !== 'pago') return false;
            const d = c.data_pagamento ? new Date(c.data_pagamento) : null;
            return d && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        })
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    document.getElementById('totalPendente').textContent = _cpFmtValor(pendente, 'BRL');
    document.getElementById('totalVencido').textContent  = _cpFmtValor(vencido,  'BRL');
    document.getElementById('totalPago').textContent     = _cpFmtValor(pago,     'BRL');
}

// ── Filtro ─────────────────────────────────────────────────────────────────

function cpFiltrar() {
    const termo  = document.getElementById('filtroContas')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('filtroStatus')?.value || '';

    _cpFiltradas = _cpTodas.filter(c => {
        const txt = [c.descricao, c.parceiros?.razao_social, c.parceiros?.nome_fantasia]
            .filter(Boolean).join(' ').toLowerCase();
        const okTermo  = !termo  || txt.includes(termo);
        const okStatus = !status || c.status === status;
        return okTermo && okStatus;
    });
    cpRenderizar();
}

// ── Marcar como pago rapidamente ───────────────────────────────────────────

async function cpMarcarPago(id) {
    const c = _cpTodas.find(x => x.id === id);
    if (!c) return;
    const hoje = new Date().toISOString().split('T')[0];
    c.status = 'pago';
    c.data_pagamento = hoje;
    cpRenderizar();
    await atualizarContaPagar(id, { status: 'pago', data_pagamento: hoje });
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

function cpAbrirModal(id = null, prefill = null) {
    const c = id ? _cpTodas.find(x => x.id === id) : null;

    document.getElementById('cpEditId').value = c?.id || '';
    document.getElementById('cpModalTitulo').innerHTML = c
        ? '<i class="fa-solid fa-pen"></i> Editar Conta a Pagar'
        : '<i class="fa-solid fa-arrow-up"></i> Nova Conta a Pagar';

    document.getElementById('cpDescricao').value      = c?.descricao || prefill?.descricao || '';
    document.getElementById('cpFornecedorNome').value = c?.parceiros?.nome_fantasia || c?.parceiros?.razao_social || prefill?.fornecedorNome || '';
    document.getElementById('cpFornecedorId').value   = c?.parceiro_id || prefill?.fornecedorId || '';
    document.getElementById('cpPedidoNome').value     = c?.pedidos?.numero || prefill?.pedidoNome || '';
    document.getElementById('cpPedidoId').value        = c?.pedido_id || prefill?.pedidoId || '';
    document.getElementById('cpProcessoNome').value   = c?.processos?.numero_processo || prefill?.processoNome || '';
    document.getElementById('cpProcessoId').value     = c?.processo_id || prefill?.processoId || '';
    document.getElementById('cpValor').value          = c?.valor || prefill?.valor || '';
    document.getElementById('cpMoeda').value          = c?.moeda || prefill?.moeda || 'BRL';
    document.getElementById('cpVencimento').value     = c?.data_vencimento || '';
    document.getElementById('cpDataPagamento').value  = c?.data_pagamento  || '';
    document.getElementById('cpStatus').value         = c?.status || 'pendente';
    document.getElementById('cpCategoria').value      = c?.categoria || '';
    document.getElementById('cpObservacoes').value    = c?.observacoes || '';

    document.getElementById('cpModalOverlay').classList.add('ativo');
}

function cpFecharModal() {
    document.getElementById('cpModalOverlay').classList.remove('ativo');
    document.getElementById('cpAutoParceiro').innerHTML = '';
    document.getElementById('cpAutoPedido').innerHTML   = '';
    document.getElementById('cpAutoProcesso').innerHTML = '';
}

async function cpSalvar() {
    if (!exigirEmpresaVinculada()) return;
    const descricao = document.getElementById('cpDescricao').value.trim();
    const valor     = document.getElementById('cpValor').value;
    const venc      = document.getElementById('cpVencimento').value;

    if (!descricao || !valor || !venc) {
        alert('Preencha Descrição, Valor e Vencimento.');
        return;
    }

    const btn = document.getElementById('cpBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        descricao,
        parceiro_id:    document.getElementById('cpFornecedorId').value || null,
        pedido_id:      document.getElementById('cpPedidoId').value || null,
        processo_id:    document.getElementById('cpProcessoId').value || null,
        valor:          parseFloat(valor),
        moeda:          document.getElementById('cpMoeda').value,
        data_vencimento: venc,
        data_pagamento:  document.getElementById('cpDataPagamento').value || null,
        status:         document.getElementById('cpStatus').value,
        categoria:      document.getElementById('cpCategoria').value || null,
        observacoes:    document.getElementById('cpObservacoes').value.trim() || null,
    };

    const id  = document.getElementById('cpEditId').value || null;
    const res = await salvarContaPagar(dados, id);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    cpFecharModal();
    await cpCarregar();
}

// ── Autocomplete parceiro ──────────────────────────────────────────────────

let _cpBuscaTimer = null;
async function cpBuscarParceiro(termo) {
    const box = document.getElementById('cpAutoParceiro');
    document.getElementById('cpFornecedorId').value = '';
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }

    clearTimeout(_cpBuscaTimer);
    _cpBuscaTimer = setTimeout(async () => {
        try {
            const { data } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social, nome_fantasia')
                .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
                .limit(8);

            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum parceiro encontrado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="cpSelecionarParceiro(${p.id}, '${_cpEsc(p.nome_fantasia || p.razao_social)}')">
                    <span class="pl-auto-nome">${_cpEsc(p.nome_fantasia || p.razao_social)}</span>
                    ${p.nome_fantasia ? `<span class="pl-auto-razao">${_cpEsc(p.razao_social)}</span>` : ''}
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function cpSelecionarParceiro(id, nome) {
    document.getElementById('cpFornecedorId').value   = id;
    document.getElementById('cpFornecedorNome').value = nome;
    document.getElementById('cpAutoParceiro').innerHTML = '';
}

// ── Autocomplete vínculo — Pedido ────────────────────────────────────────────

let _cpBuscaPedidoTimer = null;
async function cpBuscarPedido(termo) {
    const box = document.getElementById('cpAutoPedido');
    document.getElementById('cpPedidoId').value = '';
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }
    clearTimeout(_cpBuscaPedidoTimer);
    _cpBuscaPedidoTimer = setTimeout(async () => {
        try {
            const { data } = await supabaseClient
                .from('pedidos')
                .select('id, numero')
                .ilike('numero', `%${termo}%`)
                .limit(8);
            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum pedido encontrado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="cpSelecionarPedido('${p.id}', '${_cpEsc(p.numero || '')}')">
                    <span class="pl-auto-nome">${_cpEsc(p.numero || '')}</span>
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function cpSelecionarPedido(id, numero) {
    document.getElementById('cpPedidoId').value   = id;
    document.getElementById('cpPedidoNome').value = numero;
    document.getElementById('cpAutoPedido').innerHTML = '';
}

// ── Autocomplete vínculo — Processo ─────────────────────────────────────────

let _cpBuscaProcessoTimer = null;
async function cpBuscarProcesso(termo) {
    const box = document.getElementById('cpAutoProcesso');
    document.getElementById('cpProcessoId').value = '';
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }
    clearTimeout(_cpBuscaProcessoTimer);
    _cpBuscaProcessoTimer = setTimeout(async () => {
        try {
            const { data } = await supabaseClient
                .from('processos')
                .select('id, numero_processo')
                .ilike('numero_processo', `%${termo}%`)
                .limit(8);
            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum processo encontrado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="cpSelecionarProcesso('${p.id}', '${_cpEsc(p.numero_processo || '')}')">
                    <span class="pl-auto-nome">${_cpEsc(p.numero_processo || '')}</span>
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function cpSelecionarProcesso(id, numero) {
    document.getElementById('cpProcessoId').value   = id;
    document.getElementById('cpProcessoNome').value = numero;
    document.getElementById('cpAutoProcesso').innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#cpAutoParceiro') && !e.target.closest('#cpFornecedorNome')) {
        const box = document.getElementById('cpAutoParceiro');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#cpAutoPedido') && !e.target.closest('#cpPedidoNome')) {
        const box = document.getElementById('cpAutoPedido');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#cpAutoProcesso') && !e.target.closest('#cpProcessoNome')) {
        const box = document.getElementById('cpAutoProcesso');
        if (box) box.innerHTML = '';
    }
});

// ── Modal excluir ──────────────────────────────────────────────────────────

function cpAbrirModalExcluir(id) {
    _cpExcluirId = id;
    const c = _cpTodas.find(x => x.id === id);
    document.getElementById('cpExcluirNome').textContent = c?.descricao || '';
    document.getElementById('cpModalExcluirOverlay').classList.add('ativo');
}

function cpFecharModalExcluir() {
    _cpExcluirId = null;
    document.getElementById('cpModalExcluirOverlay').classList.remove('ativo');
}

async function cpConfirmarExcluir() {
    if (!_cpExcluirId) return;
    const btn = document.getElementById('cpBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await excluirContaPagar(_cpExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    cpFecharModalExcluir();
    await cpCarregar();
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _cpFmtValor(v, moeda = 'BRL') {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency', currency: moeda, minimumFractionDigits: 2
    }).format(Number(v) || 0);
}

function _cpEsc(str) {
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
