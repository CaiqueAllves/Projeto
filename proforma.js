// ========================================
// PROFORMA — JAVASCRIPT
// ========================================

let _profTodos     = [];
let _profExcluirId = null;

// ── Helpers ──────────────────────────────
function _profFmt(n) {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _profTotalProforma(p) {
    const subtotal = (p.itens || []).reduce((s, it) => s + (it.quantidade || 0) * (it.preco_unit || 0), 0);
    return subtotal + (p.frete || 0) + (p.seguro || 0) + (p.outras_despesas || 0);
}

// ── Lista ─────────────────────────────────
async function profCarregarLista() {
    const container = document.getElementById('listaContainer');
    if (!container) return;
    container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient.from('proformas').select('*').order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;
        _profTodos = data || [];
        profRenderizarLista(_profTodos);
    } catch (err) {
        container.innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar: ${err.message}</div>`;
    }
}

function profRenderizarLista(lista) {
    const container = document.getElementById('listaContainer');
    const countEl   = document.getElementById('listaCount');
    if (!container) return;
    if (countEl) countEl.textContent = `${lista.length} ${lista.length === 1 ? 'proforma' : 'proformas'}`;

    if (!lista.length) {
        container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-file-circle-xmark"></i> Nenhuma proforma cadastrada.</div>';
        return;
    }

    container.innerHTML = lista.map(p => {
        const total    = _profTotalProforma(p);
        const totalStr = total > 0 ? `${p.moeda || ''} ${_profFmt(total)}` : '—';
        const dataEmis = p.data_emissao  ? new Date(p.data_emissao  + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const dataVal  = p.data_validade ? new Date(p.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const nItens   = (p.itens || []).length;

        return `
        <div class="empresa-card" id="prof-card-${p.id}">
            <div class="empresa-info">
                <div class="empresa-nome">
                    <span class="prof-card-num">${p.numero || '—'}</span>
                    ${p.referencia ? `<span class="prof-card-ref">${p.referencia}</span>` : ''}
                </div>
                <div class="empresa-detalhes">
                    <span><i class="fa-solid fa-arrow-up-from-bracket"></i> ${p.exp_empresa || '—'}</span>
                    <span class="resumo-sep">›</span>
                    <span><i class="fa-solid fa-arrow-down-to-bracket"></i> ${p.imp_empresa || '—'}</span>
                </div>
                <div class="empresa-tags" style="margin-top:6px; gap:6px;">
                    <span class="tag-badge"><i class="fa-regular fa-calendar"></i> Emissão: ${dataEmis}</span>
                    <span class="tag-badge"><i class="fa-regular fa-clock"></i> Validade: ${dataVal}</span>
                    ${p.modal    ? `<span class="tag-badge"><i class="fa-solid fa-ship"></i> ${p.modal}</span>` : ''}
                    ${p.incoterm ? `<span class="tag-badge">${p.incoterm}</span>` : ''}
                    <span class="tag-badge"><i class="fa-solid fa-list"></i> ${nItens} ${nItens === 1 ? 'item' : 'itens'}</span>
                    <span class="tag-badge prof-badge-total"><i class="fa-solid fa-coins"></i> ${totalStr}</span>
                </div>
            </div>
            <div class="empresa-acoes">
                <button class="btn-acao btn-editar" onclick="profEditar('${p.id}')" title="Editar">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn-acao btn-excluir" onclick="profAbrirModalExcluir('${p.id}')" title="Excluir">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

// ── Filtro ────────────────────────────────
function profFiltrar() {
    const q = document.getElementById('filtroProformas')?.value.trim().toLowerCase() || '';
    if (!q) { profRenderizarLista(_profTodos); return; }
    profRenderizarLista(_profTodos.filter(p =>
        (p.numero      || '').toLowerCase().includes(q) ||
        (p.exp_empresa || '').toLowerCase().includes(q) ||
        (p.imp_empresa || '').toLowerCase().includes(q) ||
        (p.referencia  || '').toLowerCase().includes(q) ||
        (p.moeda       || '').toLowerCase().includes(q)
    ));
}

// ── Editar ────────────────────────────────
function profEditar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}`, '_blank');
}

// ── Excluir ───────────────────────────────
function profAbrirModalExcluir(id) {
    _profExcluirId = id;
    const p    = _profTodos.find(x => x.id === id);
    const info = document.getElementById('excluirProformaInfo');
    if (info && p) {
        info.innerHTML = `
            <strong>${p.numero || '—'}</strong><br>
            <span style="font-size:13px;color:#6b7280;">
                ${p.exp_empresa || '—'} → ${p.imp_empresa || '—'}
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
        const { error } = await supabaseClient.from('proformas').delete().eq('id', _profExcluirId);
        if (error) throw error;
        profFecharModalExcluir();
        await profCarregarLista();
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir'; }
    }
}

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
        imgEl.src = usuario.avatar_url;
        imgEl.style.display  = 'block';
        iconEl.style.display = 'none';
    }

    document.getElementById('btnConfirmarExcluirProforma')?.addEventListener('click', profConfirmarExcluir);

    await profCarregarLista();
});
