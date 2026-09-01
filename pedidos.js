// ========================================
// PEDIDOS
// ========================================

let _pedTodos    = [];
let _pedFiltrados = [];
let _pedExcluirId = null;
let _pedItensAtual = [];
const _pedItemBuscaTimers = {};
let _pedUnidadesMedida = [];

// Escapa valores usados dentro de filtros PostgREST (.or()) — evita que
// vírgulas/parênteses no termo digitado alterem a estrutura do filtro.
function _pedEscaparFiltro(termo) {
    return String(termo).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

// Data de hoje no formato do <input type="date"> (YYYY-MM-DD), em horário
// local — evita o efeito de toISOString() jogar pro dia anterior perto da
// meia-noite em fusos atrás de UTC.
function _pedHojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Aviso centralizado na tela — substitui alert() (que mostra o domínio do
// Codespace na caixa nativa do navegador, confuso pro usuário final).
const PED_AVISO_TIPO = {
    erro: { icone: 'fa-circle-exclamation', cor: '#dc2626', titulo: 'Erro' },
    aviso: { icone: 'fa-triangle-exclamation', cor: '#f59e0b', titulo: 'Aviso' },
    info: { icone: 'fa-circle-info', cor: '#4776ec', titulo: 'Aviso' },
};

function pedAviso(mensagem, tipo = 'aviso') {
    const cfg = PED_AVISO_TIPO[tipo] || PED_AVISO_TIPO.aviso;
    const icone = document.getElementById('pedAvisoIcone');
    const titulo = document.getElementById('pedAvisoTitulo');
    if (icone) { icone.className = `fa-solid ${cfg.icone}`; icone.style.color = cfg.cor; }
    if (titulo) titulo.textContent = cfg.titulo;
    document.getElementById('pedAvisoMsg').textContent = mensagem;
    document.getElementById('pedAvisoOverlay')?.classList.add('ativo');
}

function pedFecharAviso() {
    document.getElementById('pedAvisoOverlay')?.classList.remove('ativo');
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

// Sequência normal do pedido — Cancelado é um estado à parte (só alcançável a
// partir de qualquer etapa ativa, nunca a partir de Entregue) e não entra nela.
const PED_STATUS_ORDEM = ['aguardando', 'confirmado', 'em_producao', 'embarcado', 'entregue'];
const PED_STATUS_CRITICOS = ['cancelado', 'entregue'];

// Só permite avançar/recuar um passo por vez (evita pular etapa ou "resetar"
// o pedido de volta pro início por engano), ou ir/voltar de Cancelado.
function _pedTransicaoValida(atual, novo) {
    if (novo === atual) return true;
    if (novo === 'cancelado') return atual !== 'entregue';
    if (atual === 'cancelado') return novo === 'aguardando';
    const iAtual = PED_STATUS_ORDEM.indexOf(atual);
    const iNovo  = PED_STATUS_ORDEM.indexOf(novo);
    if (iAtual === -1 || iNovo === -1) return false;
    return Math.abs(iNovo - iAtual) === 1;
}

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _pedCarregarUsuario();
    await _pedCarregarMoedas();
    await _pedCarregarUnidadesMedida();
    await pedCarregar();
    await _pedTratarParametrosUrl();
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

// ── Unidades de Medida (tabela apoio_unidades_medida — Apoio > Comercial) ────

async function _pedCarregarUnidadesMedida() {
    try {
        const { data } = await supabaseClient
            .from('apoio_unidades_medida')
            .select('unidade, descricao')
            .order('unidade', { ascending: true });
        _pedUnidadesMedida = data || [];
    } catch (e) {
        console.warn('[Pedidos] Falha ao carregar unidades de medida:', e);
        _pedUnidadesMedida = [];
    }
}

// ── Integração com Pipeline (oportunidade -> pedido) ────────────────────────

async function _pedTratarParametrosUrl() {
    const params = new URLSearchParams(window.location.search);

    const editarId = params.get('editar');
    if (editarId) {
        await pedAbrirModal(editarId);
        if (params.get('modo') === 'visualizar') pedAplicarModoVisualizacao();
        return;
    }

    const oportunidadeId = params.get('oportunidade_id');
    if (oportunidadeId) {
        await pedAbrirModal();
        document.getElementById('pedOportunidadeId').value = oportunidadeId;
        document.getElementById('pedClienteNome').value    = params.get('cliente_nome') || '';
        document.getElementById('pedClienteId').value      = params.get('cliente_id')   || '';
        document.getElementById('pedMoeda').value          = params.get('moeda')        || 'USD';

        // Remetente da Oportunidade — repassa pro Pedido novo, se houver.
        const remetenteId = params.get('remetente_parceiro_id');
        if (remetenteId) {
            document.getElementById('pedRemetenteId').value   = remetenteId;
            document.getElementById('pedRemetenteNome').value = params.get('remetente_nome') || '';
            document.getElementById('ped-emissor-terceiro').checked = true;
            await pedAtualizarEmissorTipo();
            try {
                const { data: remetente } = await supabaseClient
                    .from('parceiros').select('documento').eq('id', remetenteId).single();
                if (remetente?.documento) {
                    document.getElementById('pedRemetenteDocumento').value = _pedMascaraDocBR(remetente.documento);
                }
            } catch (e) {}
        }

        const valorParam = parseFloat(params.get('valor'));
        if (valorParam > 0) {
            _pedItensAtual = [{ produto_id: null, produto_nome: 'Item do pedido', quantidade: 1, unidade_medida: 'UN', preco_unitario: valorParam }];
            pedRenderizarItens();
        }
    }
}

// Desabilita todo o formulário do modal e some com o rodapé de ações — usado
// quando o pedido é aberto só pra consulta (ex: seta "Ver Pedido" na Proforma),
// mesmo padrão de modo visualização já usado em Processo/Empresa.
function pedAplicarModoVisualizacao() {
    const body = document.getElementById('ped-form-body');
    if (!body) return;

    body.querySelectorAll('input, select, textarea, button').forEach(el => { el.disabled = true; });

    const footer = document.getElementById('ped-form-footer');
    if (footer) footer.style.display = 'none';

    const banner = document.createElement('div');
    banner.style.cssText = 'position:sticky;top:0;z-index:100;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.3px;border-radius:8px;margin-bottom:12px;';
    banner.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Modo Visualização — somente leitura';
    body.insertBefore(banner, body.firstChild);
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

    // Filtro de período (revisão de performance) — só reduz o que vem do
    // banco pra pedidos já finalizados; em andamento sempre vem, não
    // importa a data (ver mesma lógica em buscarPedidos, supabase-api.js).
    const diasAtras = Number(document.getElementById('filtroPeriodoPedidos')?.value) || null;
    const res = await buscarPedidos({ diasAtras });
    if (!res.sucesso) {
        tbody.innerHTML = '<tr><td colspan="8" class="ped-vazio">Erro ao carregar pedidos.</td></tr>';
        return;
    }

    _pedTodos    = res.data || [];

    // Proformas geradas a partir de cada pedido (1 pedido -> N proformas) e os
    // processos gerados a partir delas (cada proforma gera no máximo 1 processo).
    const pedidoIds = _pedTodos.map(p => p.id).filter(Boolean);
    let proformasMap = {};
    let processosMap = {};
    if (pedidoIds.length > 0) {
        const { data: proformas } = await supabaseClient
            .from('proformas').select('id, codigo, status, pedido_id').in('pedido_id', pedidoIds);
        (proformas || []).forEach(pf => {
            (proformasMap[pf.pedido_id] ||= []).push(pf);
        });
        const proformaIds = (proformas || []).map(pf => pf.id);
        if (proformaIds.length > 0) {
            const { data: procs } = await supabaseClient
                .from('processos').select('id, numero_processo, proforma_id').in('proforma_id', proformaIds);
            (procs || []).forEach(pr => {
                (processosMap[pr.proforma_id] ||= []).push(pr);
            });
        }
    }
    _pedTodos.forEach(p => {
        p._proformas = proformasMap[p.id] || [];
        p._processos = p._proformas.flatMap(pf => processosMap[pf.id] || []);
    });

    _pedFiltrados = [..._pedTodos];
    pedRenderizar();
}

// ── Filtrar ────────────────────────────────────────────────────────────────

// Debounce (revisão de performance) — ver mesmo comentário em contas-receber.js
let _pedFiltrarTimer = null;
function pedFiltrar() {
    clearTimeout(_pedFiltrarTimer);
    _pedFiltrarTimer = setTimeout(() => {
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

        // Sincroniza a aba mobile (Kanban) com o status escolhido no filtro —
        // sem isso, a coluna visível podia ficar "presa" numa aba diferente da
        // que o usuário acabou de filtrar, dando a impressão de que o filtro
        // não fez nada.
        if (status) {
            const tab = document.querySelector(`#pedKanbanTabs .kanban-tab[data-col="${status}"]`);
            if (tab) pedKanbanSwitchTab(tab);
        }
    }, 200);
}

// ── Renderizar tabela ──────────────────────────────────────────────────────

const PED_KANBAN_COLS = ['aguardando', 'confirmado', 'em_producao', 'embarcado', 'entregue', 'cancelado'];
let _pedViewMode = 'kanban';

function pedRenderizar() {
    _pedAtualizarContadores(_pedFiltrados);
    if (_pedViewMode === 'kanban') _pedRenderizarKanban(_pedFiltrados);
    else _pedRenderizarTabela(_pedFiltrados);
}

function _pedAtualizarContadores(lista) {
    const counts = Object.fromEntries(PED_KANBAN_COLS.map(s => [s, 0]));
    lista.forEach(p => { counts[p.status || 'aguardando']++; });
    PED_KANBAN_COLS.forEach(s => {
        const colCount = document.getElementById(`ped-count-${s}`);
        const tabCount = document.getElementById(`ped-tab-count-${s}`);
        if (colCount) colCount.textContent = counts[s];
        if (tabCount) tabCount.textContent = counts[s];
    });
}

function pedSwitchView(mode) {
    _pedViewMode = mode;
    document.getElementById('pedBtnViewKanban').classList.toggle('active', mode === 'kanban');
    document.getElementById('pedBtnViewLista').classList.toggle('active',  mode === 'lista');
    document.getElementById('pedKanbanBoard').style.display = mode === 'kanban' ? '' : 'none';
    document.getElementById('pedKanbanTabs').style.display  = mode === 'kanban' ? '' : 'none';
    document.querySelector('.ped-table-wrap').style.display = mode === 'lista' ? '' : 'none';
    pedRenderizar();
}

function pedKanbanSwitchTab(btn) {
    document.querySelectorAll('#pedKanbanTabs .kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const col = btn.getAttribute('data-col');
    document.querySelectorAll('#pedKanbanBoard .kanban-col').forEach(c => c.classList.remove('kanban-col-active'));
    document.getElementById(`ped-col-${col}`)?.classList.add('kanban-col-active');
}

// ── Kanban ───────────────────────────────────────────────────────────────────

function _pedRenderizarKanban(lista) {
    const grupos = Object.fromEntries(PED_KANBAN_COLS.map(c => [c, []]));
    lista.forEach(p => grupos[p.status || 'aguardando'].push(p));

    PED_KANBAN_COLS.forEach(g => {
        const body = document.getElementById(`ped-cards-${g}`);
        if (!body) return;
        body.innerHTML = grupos[g].length === 0
            ? `<div class="kanban-vazio"><i class="fa-solid fa-inbox"></i><span>Nenhum pedido</span></div>`
            : grupos[g].map(_pedRenderCardKanban).join('');
    });
}

// Identificação da Proforma/Processo do pedido — sempre mostra uma linha,
// mesmo quando não existe ainda ("Sem Proforma"/"Sem Processo"), pra manter
// a altura do card previsível independente do estágio em que o pedido está.
function _pedIdentProforma(p) {
    const proformas = p._proformas || [];
    if (!proformas.length) return 'Sem Proforma';
    if (proformas.length === 1) return `Proforma: ${proformas[0].codigo || '—'}`;
    return `Proformas: ${proformas.length} geradas`;
}

function _pedIdentProcesso(p) {
    const processos = p._processos || [];
    if (!processos.length) return 'Sem Processo';
    if (processos.length === 1) return `Processo: ${processos[0].numero_processo || '—'}`;
    return `Processos: ${processos.length} gerados`;
}

// Cards do kanban começam recolhidos (só nº/Proforma/Processo) — o Set
// guarda quais pedidos o usuário já expandiu, pra sobreviver a re-renders
// completos do board (troca de status, etc. chamam pedRenderizar() inteiro).
let _pedCardsExpandidos = new Set();

function pedToggleCard(id) {
    if (_pedCardsExpandidos.has(id)) _pedCardsExpandidos.delete(id);
    else _pedCardsExpandidos.add(id);
    pedRenderizar();
}

function _pedRenderCardKanban(p) {
    const clienteRazao   = p.parceiros?.razao_social || p.parceiros?.nome_fantasia || '—';
    const remetenteRazao = p.remetente?.razao_social || p.remetente?.nome_fantasia || '';
    const valor     = p.valor_total
        ? `${p.moeda || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : '—';
    const dataCriacao = p.data_pedido
        ? new Date(p.data_pedido + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
    const dataEntr  = p.data_entrega_prevista
        ? new Date(p.data_entrega_prevista + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
        : '—';
    const status = p.status || 'aguardando';
    const temProcesso = p._processos && p._processos.length > 0;
    const expandido = _pedCardsExpandidos.has(p.id);

    return `
    <div class="ped-kcard ${expandido ? 'ped-kcard-expandido' : ''}" data-status="${status}">
        <div class="ped-kcard-top">
            <span class="ped-kcard-num"><i class="fa-solid fa-hashtag"></i> ${_pedEscapar(p.numero || '—')}</span>
            <button class="ped-kcard-toggle" onclick="pedToggleCard('${p.id}')" title="${expandido ? 'Recolher' : 'Expandir'}">
                <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
            </button>
        </div>
        <div class="ped-kcard-ident">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <span>${_pedEscapar(_pedIdentProforma(p))}</span>
        </div>
        <div class="ped-kcard-ident">
            <i class="fa-solid fa-diagram-project"></i>
            <span>${_pedEscapar(_pedIdentProcesso(p))}</span>
        </div>
        <div class="ped-kcard-empresa-linha">
            <span class="ped-kcard-label">Remetente:</span>
            <span class="ped-kcard-empresa-valor">${remetenteRazao ? _pedEscapar(remetenteRazao) : 'Própria empresa'}</span>
        </div>
        <div class="ped-kcard-empresa-linha">
            <span class="ped-kcard-label">Destino:</span>
            <span class="ped-kcard-empresa-valor">${_pedEscapar(clienteRazao)}</span>
        </div>
        ${expandido ? `
        <div class="ped-kcard-valor"><i class="fa-solid fa-sack-dollar"></i><span>${valor}</span></div>
        <div class="ped-kcard-datas">
            <span class="ped-kcard-label">Criação:</span> <span>${dataCriacao}</span>
        </div>
        <div class="ped-kcard-datas">
            <span class="ped-kcard-label">Entrega Prevista:</span> <span>${dataEntr}</span>
        </div>
        <div class="ped-kcard-footer">
            <select class="ped-status-select ped-status-${status}" onchange="pedAlterarStatus('${p.id}', this)">
                ${Object.entries(PED_STATUS_LABEL).map(([v, l]) =>
                    `<option value="${v}" ${v === status ? 'selected' : ''}>${l}</option>`
                ).join('')}
            </select>
            <div class="ped-kcard-btns">
                ${_pedBotaoProformas(p)}
                <button class="pl-btn-acao pl-btn-editar" onclick="pedGerarProforma('${p.id}')" title="Gerar Proforma"><i class="fa-solid fa-file-circle-plus"></i></button>
                ${_pedBotaoProcessos(p)}
                ${_pedBotaoGerarProcesso(p)}
                ${temProcesso
                    ? `<button class="pl-btn-acao pl-btn-editar" onclick="pedGerarContaReceber('${p.id}')" title="Gerar Conta a Receber"><i class="fa-solid fa-sack-dollar"></i></button>`
                    : `<button class="pl-btn-acao pl-btn-editar" disabled title="Gere um Processo antes de criar a Conta a Receber" style="opacity:.4;cursor:not-allowed;"><i class="fa-solid fa-sack-dollar"></i></button>`}
                <button class="pl-btn-acao pl-btn-editar" onclick="pedAbrirModal('${p.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="pl-btn-acao pl-btn-excluir" onclick="pedAbrirModalExcluir('${p.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>` : ''}
    </div>`;
}

// ── Lista (tabela) ────────────────────────────────────────────────────────────

function _pedRenderizarTabela(lista) {
    const tbody = document.getElementById('pedTbody');

    if (!lista.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="ped-vazio"><i class="fa-regular fa-folder-open"></i> Nenhum pedido encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = lista.map(p => {
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
            <td class="ped-num">${_pedEscapar(p.numero || '—')}${_pedEtapaBadge(p) ? `<br>${_pedEtapaBadge(p)}` : ''}</td>
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
                    ${_pedBotaoProformas(p)}
                    <button class="pl-btn-acao pl-btn-editar" onclick="pedGerarProforma('${p.id}')" title="Gerar Proforma"><i class="fa-solid fa-file-circle-plus"></i></button>
                    ${_pedBotaoProcessos(p)}
                    ${_pedBotaoGerarProcesso(p)}
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

async function pedVerProforma(proformaId) {
    const btn = event?.currentTarget;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const res = await window.supabaseAPI.buscarProforma(proformaId);
        if (!res.sucesso || !res.data) { pedAviso('Proforma não encontrada.', 'erro'); return; }
        await gerarPDFProformaDados(res.data);
    } catch (e) {
        pedAviso('Erro ao gerar PDF da proforma.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-invoice-dollar"></i>'; }
    }
}

function pedVerProformas(pedidoId) {
    window.open(`proforma.html?pedido_id=${pedidoId}`, '_blank');
}

function _pedBotaoProformas(p) {
    const proformas = p._proformas || [];
    if (!proformas.length) return '';
    if (proformas.length === 1) {
        return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProforma('${proformas[0].id}')" title="Ver Proforma gerada"><i class="fa-solid fa-file-invoice-dollar"></i></button>`;
    }
    return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProformas('${p.id}')" title="Ver Proformas (${proformas.length})"><i class="fa-solid fa-file-invoice-dollar"></i> ${proformas.length}</button>`;
}

// ── Ver Processo(s) gerados a partir das proformas do pedido ────────────────

// Mostra a etapa mais avançada que o pedido já alcançou na cadeia
// Pedido → Proforma(s) → Processo(s), pra não depender só do texto do botão.
function _pedEtapaBadge(p) {
    const processos = p._processos || [];
    const proformas = p._proformas || [];
    if (processos.length > 0) {
        return `<span class="ped-etapa-badge ped-etapa-processo"><i class="fa-solid fa-diagram-project"></i> Em Processo (${processos.length})</span>`;
    }
    if (proformas.length > 1) {
        return `<span class="ped-etapa-badge ped-etapa-proforma"><i class="fa-solid fa-file-invoice-dollar"></i> ${proformas.length} Proformas geradas</span>`;
    }
    if (proformas.length === 1) {
        const codigo = proformas[0].codigo ? ` ${proformas[0].codigo}` : ' gerada';
        return `<span class="ped-etapa-badge ped-etapa-proforma"><i class="fa-solid fa-file-invoice-dollar"></i> Proforma${_pedEscapar(codigo)}</span>`;
    }
    return '';
}

function _pedBotaoProcessos(p) {
    const processos = p._processos || [];
    if (!processos.length) return '';
    if (processos.length === 1) {
        return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProcessoUnico('${processos[0].id}')" title="Ver Processo"><i class="fa-solid fa-diagram-project"></i></button>`;
    }
    return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProcessos('${p.id}')" title="Ver Processos (${processos.length})"><i class="fa-solid fa-diagram-project"></i> ${processos.length}</button>`;
}

// Botão "Gerar Processo" — só habilitado quando já existe exatamente 1
// Proforma (o Processo nasce dela, não direto do Pedido) e ainda não há
// nenhum Processo gerado. Mesmo padrão visual do botão "Gerar Conta a
// Receber" (desabilitado com tooltip explicando o pré-requisito faltando).
function _pedBotaoGerarProcesso(p) {
    const proformas = p._proformas || [];
    const processos = p._processos || [];
    if (processos.length > 0) return '';
    if (proformas.length === 1) {
        return `<button class="pl-btn-acao pl-btn-editar" onclick="pedGerarProcesso('${proformas[0].id}')" title="Gerar Processo"><i class="fa-solid fa-diagram-project"></i></button>`;
    }
    if (proformas.length > 1) {
        return `<button class="pl-btn-acao pl-btn-editar" onclick="pedVerProformas('${p.id}')" title="Selecione uma Proforma pra gerar o Processo"><i class="fa-solid fa-diagram-project"></i></button>`;
    }
    return `<button class="pl-btn-acao pl-btn-editar" disabled title="Gere uma Proforma antes de criar o Processo" style="opacity:.4;cursor:not-allowed;"><i class="fa-solid fa-diagram-project"></i></button>`;
}

function pedVerProcessoUnico(processoId) {
    window.open(`formularios.html?tab=processo&id=${processoId}&modo=visualizar`, '_blank');
}

function pedVerProcessos(pedidoId) {
    window.open(`processos.html?pedido_id=${pedidoId}`, '_blank');
}

function pedGerarProcesso(proformaId) {
    window.open(`formularios.html?tab=processo&proforma_id=${proformaId}`, '_blank');
}

function pedGerarProcesso(proformaId) {
    window.open(`formularios.html?tab=processo&proforma_id=${proformaId}`, '_blank');
}

// ── Gerar Conta a Receber a partir do pedido ────────────────────────────────

function pedGerarContaReceber(id) {
    window.open(`contas-receber.html?gerar_pedido_id=${id}`, '_blank');
}

// ── Alterar status inline ──────────────────────────────────────────────────

let _pedStatusPendente = null; // { id, novoStatus, selectEl, statusAnterior }

async function pedAlterarStatus(id, selectEl) {
    const pedido = _pedTodos.find(p => p.id === id);
    const atual  = pedido?.status || 'aguardando';
    const novo   = selectEl.value;

    if (novo === atual) return;

    if (!_pedTransicaoValida(atual, novo)) {
        pedAviso(`Não é possível mudar de "${PED_STATUS_LABEL[atual]}" direto para "${PED_STATUS_LABEL[novo]}". Siga a sequência das etapas (ou cancele o pedido).`, 'aviso');
        selectEl.value = atual;
        return;
    }

    if (PED_STATUS_CRITICOS.includes(novo)) {
        _pedStatusPendente = { id, novoStatus: novo, selectEl, statusAnterior: atual };
        const msgEl = document.getElementById('pedStatusConfirmMsg');
        if (msgEl) {
            msgEl.textContent = novo === 'cancelado'
                ? `Tem certeza que deseja cancelar o pedido ${pedido?.numero || ''}?`
                : `Confirmar que o pedido ${pedido?.numero || ''} foi entregue?`;
        }
        const btn = document.getElementById('pedBtnConfirmarStatus');
        if (btn) {
            btn.className = novo === 'cancelado' ? 'pl-btn-excluir' : 'pl-btn-salvar';
            btn.innerHTML = novo === 'cancelado'
                ? '<i class="fa-solid fa-ban"></i> Cancelar Pedido'
                : '<i class="fa-solid fa-check"></i> Confirmar Entrega';
        }
        document.getElementById('pedModalConfirmStatusOverlay')?.classList.add('ativo');
        return;
    }

    await _pedAplicarStatus(id, novo);
}

function pedFecharModalConfirmStatus() {
    if (_pedStatusPendente) _pedStatusPendente.selectEl.value = _pedStatusPendente.statusAnterior;
    _pedStatusPendente = null;
    document.getElementById('pedModalConfirmStatusOverlay')?.classList.remove('ativo');
}

async function pedConfirmarMudancaStatus() {
    if (!_pedStatusPendente) return;
    const { id, novoStatus } = _pedStatusPendente;
    document.getElementById('pedModalConfirmStatusOverlay')?.classList.remove('ativo');
    _pedStatusPendente = null;
    await _pedAplicarStatus(id, novoStatus);
}

async function _pedAplicarStatus(id, novoStatus) {
    const res = await atualizarStatusPedido(id, novoStatus);
    if (!res.sucesso) {
        pedAviso('Erro ao atualizar status.', 'erro');
        await pedCarregar();
        return;
    }
    const pedido = _pedTodos.find(p => p.id === id);
    const statusAnterior = pedido?.status;
    if (pedido) pedido.status = novoStatus;

    // Reflete a mudança de volta na Oportunidade que originou o pedido (Pipeline
    // Comercial), se houver: cancelar o pedido desfaz o "Fechado" no funil (vira
    // Perdido); reabrir um pedido cancelado volta a marcar a negociação como Fechada.
    if (pedido?.oportunidade_id) {
        if (novoStatus === 'cancelado') {
            await window.supabaseAPI.atualizarEtapaOportunidade(pedido.oportunidade_id, 'perdido');
        } else if (statusAnterior === 'cancelado' && novoStatus === 'aguardando') {
            await window.supabaseAPI.atualizarEtapaOportunidade(pedido.oportunidade_id, 'fechado');
        }
    }

    // Re-render completo: no kanban isso move o card pra coluna nova, na
    // lista repinta a linha — um patch manual de DOM não dava conta das
    // duas visões (só funcionava pro <tr> da tabela antiga).
    pedRenderizar();
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

async function pedAbrirModal(id = null) {
    const ped = id ? _pedTodos.find(p => p.id === id) : null;

    document.getElementById('pedEditId').value         = ped?.id || '';
    document.getElementById('pedOportunidadeId').value = ped?.oportunidade_id || '';
    document.getElementById('pedModalTitulo').innerHTML = ped
        ? `<i class="fa-solid fa-pen"></i> Editar Pedido${ped.numero ? ` — ${_pedEscapar(ped.numero)}` : ''}`
        : '<i class="fa-solid fa-bag-shopping"></i> Novo Pedido';

    document.getElementById('pedNumero').value       = ped?.numero || '';
    document.getElementById('pedStatus').value       = ped?.status || 'aguardando';
    document.getElementById('pedClienteNome').value       = ped?.parceiros?.nome_fantasia || ped?.parceiros?.razao_social || '';
    document.getElementById('pedClienteId').value          = ped?.cliente_id || '';
    document.getElementById('pedClienteDocumento').value    = ped?.parceiros?.documento ? _pedMascaraDocBR(ped.parceiros.documento) : '';
    document.getElementById('pedMoeda').value        = ped?.moeda || 'USD';
    document.getElementById('pedDataPedido').value   = ped?.data_pedido || _pedHojeISO();
    document.getElementById('pedDataEntrega').value  = ped?.data_entrega_prevista || '';
    document.getElementById('pedObservacoes').value  = ped?.observacoes || '';

    // Emissor: própria empresa (padrão) ou terceiro/intermediário
    document.getElementById('pedRemetenteNome').value       = ped?.remetente?.nome_fantasia || ped?.remetente?.razao_social || '';
    document.getElementById('pedRemetenteId').value          = ped?.remetente_parceiro_id || '';
    document.getElementById('pedRemetenteDocumento').value   = ped?.remetente?.documento ? _pedMascaraDocBR(ped.remetente.documento) : '';
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
        else console.warn('[Pedidos] buscarTenantEmpresa() não retornou sucesso:', res);
    } catch (e) { console.error('[Pedidos] erro ao buscar dados da própria empresa:', e); }
    return _pedEmpresaPropria;
}

async function pedAtualizarEmissorTipo() {
    const tipo = document.querySelector('input[name="ped-emissor-tipo"]:checked')?.value || 'usuario';
    document.getElementById('ped-emissor-opcao-usuario').classList.toggle('ativo', tipo === 'usuario');
    document.getElementById('ped-emissor-opcao-terceiro').classList.toggle('ativo', tipo === 'terceiro');

    const nomeInput = document.getElementById('pedRemetenteNome');
    const docInput  = document.getElementById('pedRemetenteDocumento');

    if (tipo === 'usuario') {
        const emp     = await _pedCarregarEmpresaPropria();
        const usuario = obterUsuarioLogado();
        document.getElementById('pedRemetenteId').value = '';
        // Fallback pro nome da empresa já salvo na própria sessão de login
        // (usuario.empresa) — não depende de uma segunda consulta que pode
        // falhar (ex: RLS, timing) e deixar o campo vazio sem avisar nada.
        nomeInput.value    = emp?.nome_fantasia || emp?.razao_social || usuario?.empresa || '';
        nomeInput.readOnly = true;
        docInput.value     = emp?.cnpj ? _pedMascaraDocBR(emp.cnpj) : '';
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
    document.getElementById('pedRemetenteDocumento').value = documento ? _pedMascaraDocBR(documento) : '';
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

    const unidades = _pedUnidadesMedida.length > 0
        ? _pedUnidadesMedida
        : [{ unidade: 'UN', descricao: 'Unidade' }, { unidade: 'KG', descricao: 'Quilograma' }, { unidade: 'CX', descricao: 'Caixa' }];

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
                    <select class="ped-item-input" onchange="pedAtualizarItem(${i}, 'unidade_medida', this.value)">
                        ${unidades.map(u => `<option value="${u.unidade}"${item.unidade_medida === u.unidade ? ' selected' : ''}>${_pedEscapar(u.unidade)}</option>`).join('')}
                    </select>
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

// Endereço completo pro PDF do Pedido — o formulário só coleta nome/documento
// de Remetente/Destinatário, o endereço mora no cadastro (parceiros, ou na
// própria empresa quando o emissor é "usuário").
async function _pedBuscarEnderecoParceiro(id) {
    if (!id) return null;
    try {
        const { data } = await supabaseClient
            .from('parceiros')
            .select('endereco, numero, complemento, bairro, cidade, estado, cep, pais')
            .eq('id', id).maybeSingle();
        return data || null;
    } catch (e) { return null; }
}

async function _pedBuscarEnderecoEmpresaPropria() {
    try {
        const res = await window.supabaseAPI.buscarTenantEmpresa();
        if (!res.sucesso || !res.data) return null;
        const d = res.data;
        return { endereco: d.endereco, numero: d.numero, complemento: d.complemento, bairro: null, cidade: d.cidade, estado: d.estado, cep: d.cep, pais: 'Brasil' };
    } catch (e) { return null; }
}

async function pedSalvar() {
    if (!exigirEmpresaVinculada()) return;
    const linhasValidas = _pedItensAtual.filter(it => it.produto_nome?.trim() && it.quantidade > 0);
    if (!linhasValidas.length) {
        pedAviso('Adicione ao menos um item com produto, quantidade e preço.', 'aviso');
        return;
    }

    const emissorTipo = document.querySelector('input[name="ped-emissor-tipo"]:checked')?.value || 'usuario';
    if (emissorTipo === 'terceiro' && !document.getElementById('pedRemetenteId').value) {
        pedAviso('Selecione a Empresa Remetente ou volte pra "Própria empresa".', 'aviso');
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

    if (!res.sucesso) { pedAviso('Erro: ' + res.mensagem, 'erro'); return; }

    // Endereço completo de Remetente/Destinatário pro PDF — busca em paralelo,
    // sem travar a tela caso alguma das duas falhe.
    const [enderecoRemetente, enderecoCliente] = await Promise.all([
        emissorTipo === 'terceiro' ? _pedBuscarEnderecoParceiro(dados.remetente_parceiro_id) : _pedBuscarEnderecoEmpresaPropria(),
        _pedBuscarEnderecoParceiro(dados.cliente_id),
    ]);

    _pedUltimoSalvo = {
        id:                  res.data?.id || id,
        numero:              res.data?.numero || dados.numero,
        status:              dados.status,
        emissorTipo,
        clienteNome:         document.getElementById('pedClienteNome').value,
        clienteDocumento:    document.getElementById('pedClienteDocumento').value,
        clienteEndereco:     enderecoCliente,
        remetenteNome:       document.getElementById('pedRemetenteNome').value,
        remetenteDocumento:  document.getElementById('pedRemetenteDocumento').value,
        remetenteEndereco:   enderecoRemetente,
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
    document.getElementById('pedClienteDocumento').value  = documento ? _pedMascaraDocBR(documento) : '';
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

    if (!res.sucesso) { pedAviso('Erro: ' + res.mensagem, 'erro'); return; }
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
        pedAviso('Erro ao restaurar: ' + err.message, 'erro');
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

// CPF (11 dígitos): 000.000.000-00 — CNPJ (14 dígitos): 00.000.000/0000-00
function _pedMascaraDocBR(valor) {
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
