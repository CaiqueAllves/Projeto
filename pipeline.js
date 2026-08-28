// ========================================
// PIPELINE COMERCIAL — visualização (só leitura)
// ========================================
// Toda ação de escrita (criar/editar/avançar etapa/excluir) saiu daqui e
// foi pra tela "Proposta" (proposta.html/proposta.js) — ver plano em
// atomic-dancing-whisper.md. Este arquivo só carrega e mostra o Kanban
// por Etapa; cada card tem um único botão, que abre a Proposta em modo
// leitura (?visualizar=<id>).

let _plTodas     = [];
let _plFiltradas = [];
let _plTabAtiva  = 'proposta';
let _plPedidosMap = {};

const PL_ETAPAS = ['proposta', 'negociacao', 'fechado'];

const PL_ETAPA_LABEL = {
    proposta:    'Proposta',
    negociacao:  'Negociação',
    fechado:     'Fechado',
    perdido:     'Perdido',
};

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _plCarregarUsuario();
    await plCarregar();
});

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

    // Link reverso: quais propostas já geraram um Pedido (pro botão "Ver Pedido")
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

        col.innerHTML = cards.length
            ? cards.map(o => _plRenderCard(o)).join('')
            : '<div class="pl-col-vazia"><i class="fa-regular fa-folder-open"></i><p>Nenhuma oportunidade</p></div>';
    });

    plAtualizarMobileTab();
}

function _plRenderCard(o) {
    const cliente = o.parceiros?.nome_fantasia || o.parceiros?.razao_social || '—';
    const valor   = o.valor
        ? `${o.moeda || 'USD'} ${Number(o.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;
    const dataFmt = o.data_prevista
        ? new Date(o.data_prevista + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : null;

    // Único botão mutável que sobra aqui: "Ver Pedido" é navegação, não
    // escrita — abre pedidos.html, não altera nada em oportunidades.
    let botaoPedido = '';
    if (o.etapa === 'fechado') {
        const pedidoLinkado = _plPedidosMap[o.id];
        if (pedidoLinkado) {
            botaoPedido = `<button class="btn-ver-processo" onclick="plVerPedido('${pedidoLinkado.id}')"><i class="fa-solid fa-bag-shopping"></i> Ver Pedido ${_plEscapar(pedidoLinkado.numero || '')}</button>`;
        }
    }

    return `
        <div class="pl-card" data-etapa="${o.etapa}" data-id="${o.id}" onclick="plVerDetalhes('${o.id}')">
            <div class="pl-card-header">
                <span class="pl-card-titulo">${_plEscapar(o.titulo)}</span>
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
                ${botaoPedido ? `<span onclick="event.stopPropagation()">${botaoPedido}</span>` : ''}
                <div class="pl-card-btns">
                    <button class="pl-btn-acao pl-btn-editar" onclick="event.stopPropagation(); plVerDetalhes('${o.id}')" title="Ver detalhes">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                </div>
            </div>
        </div>`;
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

// ── Navegação (só leitura) ───────────────────────────────────────────────

function plVerDetalhes(id) {
    window.location.href = `proposta.html?visualizar=${id}`;
}

function plVerPedido(pedidoId) {
    window.open(`pedidos.html?editar=${pedidoId}`, '_blank');
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
