// ========================================
// PROFORMA — JAVASCRIPT
// ========================================

let _profTodos      = [];
let _profExcluirId  = null;
let _profListaAtual = [];
let _viewMode        = 'kanban';

const KANBAN_COLS = ['pendente', 'enviado', 'aprovado', 'encerrado'];

// ── Nova Proforma agora nasce de um Pedido ──
function profIrParaPedidos() {
    mostrarNotificacao('Toda proforma nasce de um pedido. Crie ou escolha um pedido e use "Gerar Proforma".', 'info');
    window.location.href = 'pedidos.html';
}

// ── Helpers ──────────────────────────────
function _profEscapar(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function _profStatusLabel(status) {
    const map = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado', recusado: 'Encerrado' };
    return map[status] || 'Ativo';
}

// Mapeia status (incl. legado "recusado"/"finalizado") pra coluna do kanban
function _profGetColuna(status) {
    const map = { enviado: 'enviado', aprovado: 'aprovado', pendente: 'pendente', encerrado: 'encerrado', recusado: 'encerrado', finalizado: 'encerrado' };
    return map[status] || 'enviado';
}

function _profTipoLabel(tipo) {
    const map = { exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' };
    return map[tipo] || tipo || '';
}

function _profModalIcon(modal) {
    return { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' }[modal] || 'fa-route';
}

// Botão de ação pra gerar/ver o processo vinculado à proforma — 1:1, uma
// proforma gera no máximo 1 processo.
function _profBotaoProcesso(p, status) {
    const processos = p._processos || [];

    if (processos.length > 0) {
        return `<button class="btn-ver-processo" onclick="profVerProcesso('${processos[0].id}')"><i class="fa-solid fa-eye"></i> Ver Processo</button>`;
    }

    if (status === 'aprovado') {
        return `<button class="btn-seguir-processo" onclick="profSeguirProcesso('${p.id}')">Gerar Processo</button>`;
    }

    return '';
}

// Botão "Ver Pedido de origem" — link reverso de pedidos.proforma_id
function _profBotaoPedido(p) {
    if (!p._pedidoOrigemId) return '';
    return `<button class="btn-ver-processo" onclick="profVerPedido('${p._pedidoOrigemId}')"><i class="fa-solid fa-bag-shopping"></i> Ver Pedido de origem</button>`;
}

// Identificação do pedido de origem — sempre mostra uma linha, mesmo que por
// algum motivo não exista (não deveria acontecer, toda proforma nasce de um pedido).
function _profIdentPedido(p) {
    if (!p._pedidoOrigemId) return 'Sem Pedido';
    return `Pedido: ${p._pedidoNumero || '—'}`;
}

function _profEmissorNome(p) {
    if (p.emissor_tipo === 'terceiro') {
        // parceiro_id só resolve quando aponta pra um registro real de
        // "empresas" — quando a proforma nasce de um Pedido, o remetente vem
        // de "parceiros" (tabela/ID diferentes), então cai no snapshot em texto.
        return p.parceiro?.nome_fantasia || p.parceiro?.razao_social || p.parceiro_razao_social || '—';
    }
    return '(Própria empresa)';
}

function _profDestinatarioNome(p) {
    if (p.destinatario_emp?.razao_social) {
        return p.destinatario_emp.nome_fantasia || p.destinatario_emp.razao_social;
    }
    return p.destinatario_razao_social || '—';
}

function profAtualizarContadores(lista) {
    const counts = { enviado: 0, aprovado: 0, pendente: 0, encerrado: 0 };
    lista.forEach(p => { counts[_profGetColuna(p.status || 'enviado')]++; });

    KANBAN_COLS.forEach(s => {
        const key   = s.charAt(0).toUpperCase() + s.slice(1);
        const badge = document.getElementById('count' + key);
        const num   = document.getElementById('count' + key + 'Num');
        if (badge) badge.style.display = counts[s] > 0 ? '' : 'none';
        if (num)   num.textContent = counts[s];

        const colCount = document.getElementById(`count-${s}`);
        const tabCount = document.getElementById(`tab-count-${s}`);
        if (colCount) colCount.textContent = counts[s];
        if (tabCount) tabCount.textContent = counts[s];
    });
}

// ── Lista ─────────────────────────────────
async function profCarregarLista() {
    const container = document.getElementById('listaContainer');
    if (!container) return;
    container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('*')
            .neq('status', 'excluido')
            .order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        const proformas = data || [];

        const ids = [...new Set([
            ...proformas.map(p => p.parceiro_id).filter(Boolean),
            ...proformas.map(p => p.destinatario_id).filter(Boolean),
        ])];

        let empresaMap = {};
        if (ids.length > 0) {
            const { data: emps } = await supabaseClient
                .from('empresas')
                .select('id, razao_social, nome_fantasia')
                .in('id', ids);
            (emps || []).forEach(e => { empresaMap[e.id] = e; });
        }

        // Processo gerado a partir de cada proforma (1:1) — mesmo padrão de lookup
        // em lote já usado em processos.js pra resolver a proforma de cada processo.
        const proformaIds = proformas.map(p => p.id);
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

        // Número do pedido de origem — pra mostrar na identificação do card.
        const pedidoIds = [...new Set(proformas.map(p => p.pedido_id).filter(Boolean))];
        let pedidoNumeroMap = {};
        if (pedidoIds.length > 0) {
            const { data: peds } = await supabaseClient
                .from('pedidos')
                .select('id, numero')
                .in('id', pedidoIds);
            (peds || []).forEach(pd => { pedidoNumeroMap[pd.id] = pd.numero; });
        }

        _profTodos = proformas.map(p => ({
            ...p,
            parceiro:         empresaMap[p.parceiro_id]      || null,
            destinatario_emp: empresaMap[p.destinatario_id]  || null,
            _processos:       processosMap[p.id] || [],
            _pedidoOrigemId:  p.pedido_id || null,
            _pedidoNumero:    p.pedido_id ? (pedidoNumeroMap[p.pedido_id] || '') : '',
        }));

        profFiltrar();
    } catch (err) {
        container.innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar: ${err.message}</div>`;
    }
}

// ── Despacha para a view ativa (kanban ou lista) ──
function profRenderConteudo(lista) {
    _profListaAtual = lista;
    profAtualizarContadores(lista);
    const countEl = document.getElementById('listaCount');
    if (countEl) countEl.textContent = `${lista.length} ${lista.length === 1 ? 'proforma' : 'proformas'}`;

    if (_viewMode === 'kanban') profRenderKanban(lista);
    else profRenderizarLista(lista);
}

function profRenderKanban(lista) {
    const grupos = Object.fromEntries(KANBAN_COLS.map(c => [c, []]));
    lista.forEach(p => grupos[_profGetColuna(p.status || 'enviado')].push(p));

    KANBAN_COLS.forEach(g => {
        const body = document.getElementById(`cards-${g}`);
        if (!body) return;
        body.innerHTML = grupos[g].length === 0
            ? `<div class="kanban-vazio"><i class="fa-solid fa-inbox"></i><span>Nenhuma proforma</span></div>`
            : grupos[g].map(_profRenderCard).join('');
    });
}

// Cards do kanban começam recolhidos (mesmo padrão de Pedidos) — o Set guarda
// quais proformas o usuário já expandiu, sobrevive a re-renders do board inteiro.
let _profCardsExpandidos = new Set();

function profToggleCard(id) {
    if (_profCardsExpandidos.has(id)) _profCardsExpandidos.delete(id);
    else _profCardsExpandidos.add(id);
    profRenderConteudo(_profListaAtual);
}

function _profRenderCard(p) {
    const status      = _profGetColuna(p.status || 'enviado');
    const tipoLabel    = _profTipoLabel(p.tipo);
    const modalIco     = _profModalIcon(p.modal);
    const modalLabel   = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;
    const dataEmis     = p.data_emissao ? new Date(p.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
    const emissor      = _profEmissorNome(p);
    const destinatario = _profDestinatarioNome(p);
    const valorTexto   = p.valor_total
        ? `${p.moeda_principal || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : '—';
    const expandido = _profCardsExpandidos.has(p.id);

    const optStatus = KANBAN_COLS.map(s =>
        `<option value="${s}" ${status === s ? 'selected' : ''}>${_profStatusLabel(s)}</option>`
    ).join('');

    return `
    <div class="prof-card ${expandido ? 'prof-card-expandido' : ''}" id="prof-kcard-${p.id}" data-status="${status}">
        <div class="prof-card-top">
            <span class="prof-card-codigo">${_profEscapar(p.codigo) || '—'}</span>
            <button class="prof-card-toggle" onclick="profToggleCard('${p.id}')" title="${expandido ? 'Recolher' : 'Expandir'}">
                <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
            </button>
        </div>
        <div class="prof-card-ident">
            <i class="fa-solid fa-bag-shopping"></i>
            <span>${_profEscapar(_profIdentPedido(p))}</span>
            ${p._pedidoOrigemId ? `<button class="prof-card-ident-seta" onclick="profVerPedido('${p._pedidoOrigemId}')" title="Ver Pedido de origem"><i class="fa-solid fa-arrow-up-right-from-square"></i></button>` : ''}
        </div>
        ${tipoLabel ? `
        <div class="prof-card-modal">
            <span class="prof-card-tipo">${_profEscapar(tipoLabel)}</span>
        </div>` : ''}
        ${(modalLabel || p.incoterm) ? `
        <div class="prof-card-modal">
            ${modalLabel ? `<span class="tag-badge"><i class="fa-solid ${modalIco}"></i> ${_profEscapar(modalLabel)}</span>` : ''}
            ${p.incoterm ? `<span class="tag-badge">${_profEscapar(p.incoterm)}</span>` : ''}
        </div>` : ''}
        <div class="prof-card-empresa-linha">
            <span class="prof-card-label">Remetente:</span>
            <span class="prof-card-empresa-valor">${_profEscapar(emissor)}</span>
        </div>
        <div class="prof-card-empresa-linha">
            <span class="prof-card-label">Destinatário:</span>
            <span class="prof-card-empresa-valor">${_profEscapar(destinatario)}</span>
        </div>
        ${expandido ? `
        <div class="prof-card-valor"><i class="fa-solid fa-sack-dollar"></i><span>${_profEscapar(valorTexto)}</span></div>
        <div class="prof-card-datas">
            <span class="prof-card-label">Criação:</span> <span>${dataEmis}</span>
        </div>
        <div class="prof-card-footer">
            <select class="prof-status-select prof-status-${status}" onchange="profAlterarStatus('${p.id}', this)">
                ${optStatus}
            </select>
            ${_profBotaoProcesso(p, status)}
            <div class="prof-card-btns">
                <button class="btn-acao btn-ver"     onclick="profVisualizar('${p.id}')" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-acao btn-pdf"     onclick="profGerarPDF('${p.id}')" title="Gerar PDF"><i class="fa-solid fa-file-pdf"></i></button>
                <button class="btn-acao btn-editar"  onclick="profEditar('${p.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-acao btn-excluir" onclick="profAbrirModalExcluir('${p.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>` : ''}
    </div>`;
}

function switchView(mode) {
    _viewMode = mode;
    document.getElementById('btnViewKanban').classList.toggle('active', mode === 'kanban');
    document.getElementById('btnViewLista').classList.toggle('active',  mode === 'lista');
    document.getElementById('kanbanBoard').style.display    = mode === 'kanban' ? '' : 'none';
    document.getElementById('kanbanTabs').style.display     = mode === 'kanban' ? '' : 'none';
    document.getElementById('proformasLista').style.display = mode === 'lista'  ? '' : 'none';
    profRenderConteudo(_profListaAtual);
}

function kanbanSwitchTab(btn) {
    document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const col = btn.getAttribute('data-col');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('kanban-col-active'));
    document.getElementById(`col-${col}`)?.classList.add('kanban-col-active');
}

function profRenderizarLista(lista) {
    const container = document.getElementById('listaContainer');
    if (!container) return;

    if (!lista.length) {
        container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-file-circle-xmark"></i> Nenhuma proforma encontrada.</div>';
        return;
    }

    const rows = lista.map(p => {
        const dataEmis   = p.data_emissao  ? new Date(p.data_emissao  + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const dataVal    = p.data_validade ? new Date(p.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const modalIco   = _profModalIcon(p.modal);
        const modalLabel = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;
        const status     = _profGetColuna(p.status || 'enviado');

        const optStatus = KANBAN_COLS.map(s =>
            `<option value="${s}" ${status === s ? 'selected' : ''}>${_profStatusLabel(s)}</option>`
        ).join('');

        return `
        <tr id="prof-card-${p.id}">
            <td class="prof-col-codigo">
                <span class="prof-card-num">${p.codigo || '—'}</span>
                ${p.tipo ? `<br><span class="prof-tipo-sub">${_profTipoLabel(p.tipo)}</span>` : ''}
            </td>
            <td class="prof-col-rota">
                <span title="${p.origem_pais || ''}">${p.origem_pais || '—'}</span>
                <i class="fa-solid fa-arrow-right prof-rota-arrow"></i>
                <span title="${p.destino_pais || ''}">${p.destino_pais || '—'}</span>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;gap:3px;">
                    ${modalLabel ? `<span class="tag-badge" style="width:fit-content;"><i class="fa-solid ${modalIco}"></i> ${modalLabel}</span>` : '<span class="cell-vazio">—</span>'}
                    ${p.incoterm ? `<span class="tag-badge" style="width:fit-content;">${p.incoterm}</span>` : ''}
                </div>
            </td>
            <td class="cell-nowrap">
                <div style="font-size:12px;color:#374151;">${dataEmis}</div>
                <div style="font-size:11px;color:#94a3b8;">Val: ${dataVal}</div>
            </td>
            <td class="col-acoes">
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn-acao btn-ver" onclick="profVisualizar('${p.id}')" title="Visualizar">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-acao btn-pdf" onclick="profGerarPDF('${p.id}')" title="Gerar PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                    <button class="btn-acao btn-editar" onclick="profEditar('${p.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-acao btn-excluir" onclick="profAbrirModalExcluir('${p.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
            <td>
                <select class="prof-status-select prof-status-${status}"
                        onchange="profAlterarStatus('${p.id}', this)">
                    ${optStatus}
                </select>
            </td>
            <td class="col-gerar-processo">
                ${_profBotaoPedido(p)}
                ${_profBotaoProcesso(p, status)}
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <table class="empresa-tabela">
        <thead>
            <tr>
                <th>Código</th>
                <th>Rota</th>
                <th>Modal / Incoterm</th>
                <th>Data</th>
                <th class="col-acoes">Ações</th>
                <th>Status</th>
                <th class="col-gerar-processo"></th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// ── Alterar status rápido ─────────────────
async function profAlterarStatus(id, selectEl) {
    const novoStatus  = selectEl.value;
    const statusAntes = _profTodos.find(x => x.id === id)?.status || 'enviado';

    selectEl.className = `prof-status-select prof-status-${novoStatus}`;
    selectEl.disabled  = true;

    try {
        const agora = new Date().toISOString();
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: novoStatus, status_atualizado_em: agora })
            .eq('id', id);
        if (error) throw error;

        const p = _profTodos.find(x => x.id === id);
        if (p) { p.status = novoStatus; p.status_atualizado_em = agora; }
        profRenderConteudo(_profListaAtual);
    } catch (err) {
        alert('Erro ao atualizar status: ' + err.message);
        selectEl.value     = statusAntes;
        selectEl.className = `prof-status-select prof-status-${statusAntes}`;
    } finally {
        selectEl.disabled = false;
    }
}

// ── Filtro ────────────────────────────────
// Debounce (revisão de performance) — ver mesmo comentário em contas-receber.js
let _profFiltrarTimer = null;
function profFiltrar() {
    clearTimeout(_profFiltrarTimer);
    _profFiltrarTimer = setTimeout(() => {
        const q = (document.getElementById('filtroProformas')?.value.trim().toLowerCase()) || '';
        const s = document.getElementById('filtroStatus')?.value || '';

        let lista = _profTodos;
        // Vindo de "Ver Proformas (N)" no Pedido — mostra só as proformas daquele pedido
        const pedidoIdParam = new URLSearchParams(window.location.search).get('pedido_id');
        if (pedidoIdParam) lista = lista.filter(p => p.pedido_id === pedidoIdParam);
        if (s) lista = lista.filter(p => _profGetColuna(p.status || 'enviado') === s);
        if (q) lista = lista.filter(p =>
            (p.codigo        || '').toLowerCase().includes(q) ||
            (p.origem_pais   || '').toLowerCase().includes(q) ||
            (p.destino_pais  || '').toLowerCase().includes(q) ||
            (p.tipo          || '').toLowerCase().includes(q) ||
            (p.incoterm      || '').toLowerCase().includes(q) ||
            (_profEmissorNome(p)    ).toLowerCase().includes(q) ||
            (_profDestinatarioNome(p)).toLowerCase().includes(q)
        );

        profRenderConteudo(lista);

        // Sincroniza a aba mobile (Kanban) com o status escolhido no filtro —
        // sem isso, a coluna visível podia ficar "presa" numa aba diferente da
        // que o usuário acabou de filtrar, dando a impressão de que o filtro
        // não fez nada.
        if (s) {
            const tab = document.querySelector(`.kanban-tab[data-col="${s}"]`);
            if (tab) kanbanSwitchTab(tab);
        }
    }, 200);
}

// ── Editar ────────────────────────────────
function profEditar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}`, '_blank');
}

function profVisualizar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}&modo=visualizar`, '_blank');
}

async function profGerarPDF(id) {
    const btn = event?.currentTarget;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const res = await window.supabaseAPI.buscarProforma(id);
        if (!res.sucesso || !res.data) { mostrarNotificacao('Proforma não encontrada.', 'erro'); return; }
        await gerarPDFProformaDados(res.data);
    } catch (e) {
        mostrarNotificacao('Erro ao gerar PDF.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF'; }
    }
}

// ── Seguir com Processo ───────────────────
function profSeguirProcesso(id) {
    window.open(`formularios.html?tab=processo&proforma_id=${id}`, '_blank');
}

function profVerProcesso(processoId) {
    window.open(`formularios.html?tab=processo&id=${processoId}&modo=visualizar`, '_blank');
}

function profVerPedido(pedidoId) {
    window.open(`pedidos.html?editar=${pedidoId}&modo=visualizar`, '_blank');
}

// ── Excluir (soft delete) ─────────────────
function profAbrirModalExcluir(id) {
    _profExcluirId = id;
    const p    = _profTodos.find(x => x.id === id);
    const info = document.getElementById('excluirProformaInfo');
    if (info && p) {
        info.innerHTML = `
            <strong>${p.codigo || '—'}</strong><br>
            <span style="font-size:13px;color:#6b7280;">
                ${_profEmissorNome(p)} → ${_profDestinatarioNome(p)}
            </span>`;
    }
    document.getElementById('modalExcluirProforma').style.display = 'flex';
}

function profFecharModalExcluir() {
    document.getElementById('modalExcluirProforma').style.display = 'none';
    _profExcluirId = null;
}

async function profConfirmarExcluir() {
    if (!_profExcluirId) return;
    const btn = document.getElementById('btnConfirmarExcluirProforma');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...'; }
    try {
        const usuario = obterUsuarioLogado();
        const { error } = await supabaseClient
            .from('proformas')
            .update({
                status:      'excluido',
                excluido_em: new Date().toISOString(),
                excluido_por: usuario?.nome || usuario?.email || 'Desconhecido',
            })
            .eq('id', _profExcluirId);
        if (error) throw error;
        profFecharModalExcluir();
        await profCarregarLista();
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir'; }
    }
}

// ── Painel Excluídos ──────────────────────
let _profExcluidosAberto = false;

async function profToggleExcluidos() {
    const panel = document.getElementById('profExcluidosPanel');
    if (!panel) return;

    _profExcluidosAberto = !_profExcluidosAberto;
    panel.classList.toggle('aberto', _profExcluidosAberto);

    if (_profExcluidosAberto) await profCarregarExcluidos();
}

async function profCarregarExcluidos() {
    const container = document.getElementById('profExcluidosContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('id, codigo, origem_pais, destino_pais, excluido_em, excluido_por')
            .eq('status', 'excluido')
            .order('excluido_em', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhuma proforma excluída.</div>';
            return;
        }

        const agora = Date.now();
        container.innerHTML = data.map(p => {
            let metaHtml = '';
            if (p.excluido_em) {
                const exclMs   = new Date(p.excluido_em).getTime();
                const diasPassados = Math.floor((agora - exclMs) / 86400000);
                const diasRestantes = 7 - diasPassados;
                const dataFmt  = new Date(p.excluido_em).toLocaleDateString('pt-BR');
                const corDias  = diasRestantes <= 2 ? '#dc2626' : '#94a3b8';
                metaHtml = `
                    <span class="prof-excluido-rota">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:10px;"></i> ${dataFmt}
                        ${p.excluido_por ? `· ${p.excluido_por}` : ''}
                    </span>
                    <span class="prof-excluido-rota" style="color:${corDias};">
                        <i class="fa-solid fa-clock" style="font-size:10px;"></i>
                        ${diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}` : 'Expira hoje'}
                    </span>`;
            }
            return `
            <div class="prof-excluido-item">
                <div class="prof-excluido-info">
                    <span class="prof-excluido-codigo">${p.codigo || '—'}</span>
                    <span class="prof-excluido-rota">${p.origem_pais || '—'} → ${p.destino_pais || '—'}</span>
                    ${metaHtml}
                </div>
                <button class="prof-excluido-restaurar" onclick="profRestaurar('${p.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Erro: ${err.message}</div>`;
    }
}

async function profRestaurar(id) {
    try {
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: 'enviado' })
            .eq('id', id);
        if (error) throw error;
        await profCarregarExcluidos();
        await profCarregarLista();
    } catch (err) {
        alert('Erro ao restaurar: ' + err.message);
    }
}

// Fechar painel ao clicar fora
document.addEventListener('click', function(e) {
    if (_profExcluidosAberto && !e.target.closest('#profExcluidosWrapper')) {
        _profExcluidosAberto = false;
        document.getElementById('profExcluidosPanel')?.classList.remove('aberto');
    }
});

// ── Init ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = obterUsuarioLogado();
    if (!usuario) { window.location.href = 'login.html'; return; }

    const nameEl  = document.getElementById('displayUsername');
    const emailEl = document.getElementById('userEmail');
    const iconEl  = document.getElementById('topbarAvatarIcon');
    const imgEl   = document.getElementById('topbarAvatarImg');
    if (nameEl)  nameEl.textContent  = usuario.nome  || usuario.email || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';
    if (usuario.avatar_url && imgEl && iconEl) {
        imgEl.src            = usuario.avatar_url;
        imgEl.style.display  = 'block';
        iconEl.style.display = 'none';
    }

    document.getElementById('btnConfirmarExcluirProforma')?.addEventListener('click', profConfirmarExcluir);

    await profCarregarLista();
});
