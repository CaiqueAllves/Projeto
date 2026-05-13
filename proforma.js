// ========================================
// PROFORMA — JAVASCRIPT
// ========================================

let _profTodos      = [];
let _profExcluirId  = null;
let _profListaAtual = [];

// ── Helpers ──────────────────────────────
function _profFmt(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _profStatusLabel(status) {
    const map = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', recusado: 'Recusado' };
    return map[status] || 'Ativo';
}

function _profTipoLabel(tipo) {
    const map = { exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' };
    return map[tipo] || tipo || '';
}

function _profModalIcon(modal) {
    return { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' }[modal] || 'fa-route';
}

function _profEmissorNome(p) {
    if (p.emissor_tipo === 'terceiro') {
        return p.parceiro?.nome_fantasia || p.parceiro?.razao_social || '—';
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
    const counts = { enviado: 0, aprovado: 0, pendente: 0, recusado: 0 };
    lista.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
    ['enviado', 'aprovado', 'pendente', 'recusado'].forEach(s => {
        const key   = s.charAt(0).toUpperCase() + s.slice(1);
        const badge = document.getElementById('count' + key);
        const num   = document.getElementById('count' + key + 'Num');
        if (badge) badge.style.display = counts[s] > 0 ? '' : 'none';
        if (num)   num.textContent = counts[s];
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

        _profTodos = proformas.map(p => ({
            ...p,
            parceiro:         empresaMap[p.parceiro_id]      || null,
            destinatario_emp: empresaMap[p.destinatario_id]  || null,
        }));

        profRenderizarLista(_profTodos);
    } catch (err) {
        container.innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar: ${err.message}</div>`;
    }
}

function profRenderizarLista(lista) {
    const container = document.getElementById('listaContainer');
    const countEl   = document.getElementById('listaCount');
    if (!container) return;
    _profListaAtual = lista;
    if (countEl) countEl.textContent = `${lista.length} ${lista.length === 1 ? 'proforma' : 'proformas'}`;
    profAtualizarContadores(lista);

    if (!lista.length) {
        container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-file-circle-xmark"></i> Nenhuma proforma encontrada.</div>';
        return;
    }

    const rows = lista.map(p => {
        const dataEmis   = p.data_emissao  ? new Date(p.data_emissao  + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const dataVal    = p.data_validade ? new Date(p.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const modalIco   = _profModalIcon(p.modal);
        const modalLabel = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;
        const status     = p.status || 'enviado';

        const optStatus = ['enviado','aprovado','pendente','recusado'].map(s =>
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
            <td>
                <select class="prof-status-select prof-status-${status}"
                        onchange="profAlterarStatus('${p.id}', this)">
                    ${optStatus}
                </select>
            </td>
            <td class="col-acoes">
                <div style="display:flex;gap:6px;">
                    <button class="btn-acao btn-editar" onclick="profEditar('${p.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-acao btn-excluir" onclick="profAbrirModalExcluir('${p.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
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
                <th>Status</th>
                <th class="col-acoes"></th>
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
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: novoStatus })
            .eq('id', id);
        if (error) throw error;

        const p = _profTodos.find(x => x.id === id);
        if (p) p.status = novoStatus;
        profAtualizarContadores(_profListaAtual);
    } catch (err) {
        alert('Erro ao atualizar status: ' + err.message);
        selectEl.value     = statusAntes;
        selectEl.className = `prof-status-select prof-status-${statusAntes}`;
    } finally {
        selectEl.disabled = false;
    }
}

// ── Filtro ────────────────────────────────
function profFiltrar() {
    const q = (document.getElementById('filtroProformas')?.value.trim().toLowerCase()) || '';
    const s = document.getElementById('filtroStatus')?.value || '';

    let lista = _profTodos;
    if (s) lista = lista.filter(p => (p.status || 'enviado') === s);
    if (q) lista = lista.filter(p =>
        (p.codigo        || '').toLowerCase().includes(q) ||
        (p.origem_pais   || '').toLowerCase().includes(q) ||
        (p.destino_pais  || '').toLowerCase().includes(q) ||
        (p.tipo          || '').toLowerCase().includes(q) ||
        (p.incoterm      || '').toLowerCase().includes(q) ||
        (_profEmissorNome(p)    ).toLowerCase().includes(q) ||
        (_profDestinatarioNome(p)).toLowerCase().includes(q)
    );

    profRenderizarLista(lista);
}

// ── Editar ────────────────────────────────
function profEditar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}`, '_blank');
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
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: 'excluido' })
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
            .select('id, codigo, origem_pais, destino_pais, created_at')
            .eq('status', 'excluido')
            .order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhuma proforma excluída.</div>';
            return;
        }

        container.innerHTML = data.map(p => `
            <div class="prof-excluido-item">
                <div class="prof-excluido-info">
                    <span class="prof-excluido-codigo">${p.codigo || '—'}</span>
                    <span class="prof-excluido-rota">${p.origem_pais || '—'} → ${p.destino_pais || '—'}</span>
                </div>
                <button class="prof-excluido-restaurar" onclick="profRestaurar('${p.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>
        `).join('');
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
