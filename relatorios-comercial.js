// ========================================
// RELATÓRIOS COMERCIAIS
// ========================================

let _rcOportunidades = [];
let _rcDias          = 30;

// ── Inicialização ──────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
    _rcCarregarUsuario();
    _rcIniciarDatas();
    await rcCarregar();
});

function _rcCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

function _rcIniciarDatas() {
    const hoje  = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - _rcDias);

    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('rcDataFim').value    = fmt(hoje);
    document.getElementById('rcDataInicio').value = fmt(inicio);
}

// ── Período ────────────────────────────────────────────────────────────────

function rcSetPeriodo(btn, dias) {
    document.querySelectorAll('.rc-period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _rcDias = dias;

    const hoje  = new Date();
    const inicio = new Date();
    inicio.setDate(hoje.getDate() - dias);
    const fmt = d => d.toISOString().split('T')[0];
    document.getElementById('rcDataFim').value    = fmt(hoje);
    document.getElementById('rcDataInicio').value = fmt(inicio);

    rcCarregar();
}

function rcAplicarPeriodo() {
    document.querySelectorAll('.rc-period-btn').forEach(b => b.classList.remove('active'));
    rcCarregar();
}

function _rcGetFiltro() {
    return {
        inicio: document.getElementById('rcDataInicio').value,
        fim:    document.getElementById('rcDataFim').value,
    };
}

// ── Carregar dados ─────────────────────────────────────────────────────────

async function rcCarregar() {
    const resOp = await buscarOportunidades();
    _rcOportunidades = resOp.data || [];
    rcRenderizar();
}

// ── Renderizar ─────────────────────────────────────────────────────────────

function rcRenderizar() {
    const { inicio, fim } = _rcGetFiltro();
    const dtInicio = new Date(inicio + 'T00:00:00');
    const dtFim    = new Date(fim    + 'T23:59:59');

    const ops = _rcOportunidades.filter(o => {
        const dt = new Date(o.created_at);
        return dt >= dtInicio && dt <= dtFim;
    });

    _rcRenderCards(ops);
    _rcRenderPipelineEtapas(ops);
    _rcRenderTopClientes(ops);
    _rcRenderConversao(ops);
}

// ── Cards de resumo ────────────────────────────────────────────────────────

function _rcRenderCards(ops) {
    const valorTotal = ops.reduce((s, o) => s + (Number(o.valor) || 0), 0);
    const fechadas   = ops.filter(o => o.etapa === 'fechado').length;

    document.getElementById('rcTotalOportunidades').textContent = ops.length;
    document.getElementById('rcValorPipeline').textContent =
        'USD ' + valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById('rcOportunidadesFechadas').textContent = fechadas;
}

// ── Pipeline por etapa ─────────────────────────────────────────────────────

function _rcRenderPipelineEtapas(ops) {
    const el = document.getElementById('rcPipelineEtapas');

    const etapas = [
        { key: 'proposta',    label: 'Proposta',    cor: '#f97316' },
        { key: 'negociacao',  label: 'Negociação',  cor: '#8b5cf6' },
        { key: 'fechado',     label: 'Fechado',     cor: '#22c55e' },
        { key: 'perdido',     label: 'Perdido',     cor: '#ef4444' },
    ];

    const total = ops.length || 1;

    if (!ops.length) {
        el.innerHTML = '<p class="rc-vazio">Nenhuma oportunidade no período.</p>';
        return;
    }

    el.innerHTML = etapas.map(e => {
        const cnt   = ops.filter(o => o.etapa === e.key).length;
        const pct   = Math.round((cnt / total) * 100);
        const valor = ops.filter(o => o.etapa === e.key).reduce((s, o) => s + (Number(o.valor) || 0), 0);
        return `<div class="rc-etapa-row">
            <div class="rc-etapa-label">
                <span style="color:${e.cor};font-weight:700">${e.label}</span>
                <span class="rc-etapa-count">${cnt}</span>
            </div>
            <div class="rc-bar-wrap">
                <div class="rc-bar" style="width:${pct}%;background:${e.cor}"></div>
            </div>
            <div class="rc-etapa-valor">${valor > 0 ? 'USD ' + valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 }) : '—'}</div>
        </div>`;
    }).join('');
}

// ── Top clientes ───────────────────────────────────────────────────────────

function _rcRenderTopClientes(ops) {
    const el = document.getElementById('rcTopClientes');

    const mapa = {};
    ops.forEach(item => {
        const nome = item.parceiros?.nome_fantasia || item.parceiros?.razao_social;
        if (!nome) return;
        mapa[nome] = (mapa[nome] || 0) + 1;
    });

    const lista = Object.entries(mapa)
        .map(([nome, oportunidades]) => ({ nome, oportunidades }))
        .sort((a, b) => b.oportunidades - a.oportunidades)
        .slice(0, 8);

    if (!lista.length) {
        el.innerHTML = '<p class="rc-vazio">Nenhum cliente no período.</p>';
        return;
    }

    el.innerHTML = lista.map((c, i) => `
        <div class="rc-cliente-row">
            <span class="rc-cliente-pos">${i + 1}º</span>
            <span class="rc-cliente-nome">${_rcEscapar(c.nome)}</span>
            <div class="rc-cliente-badges">
                <span class="rc-badge rc-badge-op">${c.oportunidades} op.</span>
            </div>
        </div>`).join('');
}

// ── Taxa de conversão ──────────────────────────────────────────────────────

function _rcRenderConversao(ops) {
    const el = document.getElementById('rcConversao');

    const total    = ops.filter(o => o.etapa !== 'perdido').length || 1;
    const fechadas = ops.filter(o => o.etapa === 'fechado').length;
    const perdidas = ops.filter(o => o.etapa === 'perdido').length;
    const taxa     = Math.round((fechadas / total) * 100);

    el.innerHTML = `
        <div class="rc-gauge-wrap">
            <svg viewBox="0 0 120 70" class="rc-gauge-svg">
                <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#e2e8f0" stroke-width="12" stroke-linecap="round"/>
                <path d="M10,60 A50,50 0 0,1 110,60" fill="none" stroke="#22c55e" stroke-width="12"
                    stroke-linecap="round"
                    stroke-dasharray="${taxa * 1.57} 157"
                    style="transition:stroke-dasharray 0.8s ease"/>
            </svg>
            <div class="rc-gauge-pct">${taxa}%</div>
            <div class="rc-gauge-label">Taxa de Conversão</div>
        </div>
        <div class="rc-conversao-stats">
            <div class="rc-conv-stat">
                <span class="rc-conv-num" style="color:#22c55e">${fechadas}</span>
                <span class="rc-conv-label">Fechadas</span>
            </div>
            <div class="rc-conv-stat">
                <span class="rc-conv-num" style="color:#ef4444">${perdidas}</span>
                <span class="rc-conv-label">Perdidas</span>
            </div>
            <div class="rc-conv-stat">
                <span class="rc-conv-num" style="color:#3b82f6">${ops.filter(o => !['fechado','perdido'].includes(o.etapa)).length}</span>
                <span class="rc-conv-label">Em aberto</span>
            </div>
        </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function _rcEscapar(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
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
