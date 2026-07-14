// ========================================
// PROCESSOS — LISTA + MODAL DE CADASTRO
// ========================================

let _processosTodos = [];
let _viewMode       = 'kanban';

const KANBAN_COLS = ['aberto','em_andamento','aguardando_documentos','concluido','cancelado'];

const STATUS_OPTS = [
    { v: 'aberto',                label: 'Aberto' },
    { v: 'em_andamento',          label: 'Em Andamento' },
    { v: 'aguardando_documentos', label: 'Aguard. Documentos' },
    { v: 'concluido',             label: 'Concluído' },
    { v: 'cancelado',             label: 'Cancelado' },
];

// --------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function uid() {
    return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function notify(msg, type) {
    if (typeof mostrarNotificacao === 'function') {
        mostrarNotificacao(msg, type || 'info');
    }
}

function readProcessos() {
    return _processosTodos;
}

function writeProcessos(list) {
    _processosTodos = list || [];
}

function _kanbanSetLoading() {
    KANBAN_COLS.forEach(g => {
        const body = document.getElementById(`cards-${g}`);
        if (body) body.innerHTML = '<div class="kanban-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    });
}

function _kanbanSetErro(msg) {
    KANBAN_COLS.forEach(g => {
        const body = document.getElementById(`cards-${g}`);
        if (body) body.innerHTML = `<div class="kanban-vazio" style="color:#ef4444;"><i class="fa-solid fa-circle-exclamation"></i><span>${msg}</span></div>`;
    });
}

async function carregarProcessos() {
    _kanbanSetLoading();

    try {
        const u   = (() => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}'); } catch { return {}; } })();
        const res = await window.supabaseAPI.buscarProcessos();
        if (!res.sucesso) throw new Error(res.mensagem || 'Erro ao buscar processos');

        const processos = res.data || [];

        // Busca nomes das empresas parceiras
        const parceiraIds = [...new Set(processos.map(p => p.empresa_parceira_id).filter(Boolean))];
        let empresaMap = {};
        if (parceiraIds.length > 0) {
            const { data: emps } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social')
                .in('id', parceiraIds);
            if (emps) emps.forEach(e => { empresaMap[e.id] = e.razao_social || ''; });
        }

        // Busca código das proformas de origem (link reverso Processo -> Proforma)
        const proformaIds = [...new Set(processos.map(p => p.proforma_id).filter(Boolean))];
        let proformaMap = {};
        if (proformaIds.length > 0) {
            const { data: profs } = await supabaseClient
                .from('proformas')
                .select('id, codigo')
                .in('id', proformaIds);
            if (profs) profs.forEach(pr => { proformaMap[pr.id] = pr.codigo || ''; });
        }

        _processosTodos = processos.map(p => ({
            id:                p.id,
            codigo:            p.numero_processo || p.id?.slice(0,8).toUpperCase(),
            tipo:              p.tipo || '',
            status:            p.status || 'aberta',
            empresaExportador: u.empresa || '',
            empresaImportador: empresaMap[p.empresa_parceira_id] || '',
            pais_origem:       p.pais_origem || '',
            pais_destino:      p.pais_destino || '',
            etapas:            p.etapas || [],
            modal:             p.modal || '',
            incoterm:          p.incoterm || '',
            moeda:             p.moeda || 'USD',
            valor_total:       p.valor_total || null,
            proforma_id:       p.proforma_id || null,
            proforma_codigo:   proformaMap[p.proforma_id] || '',
            criado_em:         p.criado_em,
            atualizado_em:     p.atualizado_em || p.updated_at || null,
        }));
    } catch (err) {
        _kanbanSetErro(err.message);
        return;
    }
    renderKanban(document.getElementById('filtroProcessos')?.value || '');
}

// --------------------------------------------------
// MODAL DE EXCLUSÃO
// --------------------------------------------------
let _idParaExcluir = '';

function abrirModalExcluir(id) {
    const proc = readProcessos().find(p => p.id === id);
    if (!proc) return;
    _idParaExcluir = id;

    document.getElementById('excluirProcessoInfo').innerHTML = `
        <div style="font-weight:700; color:#991b1b; font-size:15px; margin-bottom:6px;">
            <i class="fa-solid fa-diagram-project"></i> ${escapeHtml(proc.codigo)}
        </div>
        <div style="font-size:13px; color:#6b7280;">${escapeHtml(proc.empresaImportador || proc.empresaExportador || '—')} &mdash; ${escapeHtml(proc.tipo)}</div>
    `;

    document.getElementById('modalExcluir').classList.add('active');
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    _idParaExcluir = '';
}

// --------------------------------------------------
// TABELA DE PROCESSOS
// --------------------------------------------------
function _getColuna(status) {
    const map = {
        aberto:                'aberto',
        aberta:                'aberto',
        em_andamento:          'em_andamento',
        pendente:              'em_andamento',
        aguardando_documentos: 'aguardando_documentos',
        concluido:             'concluido',
        encerrada:             'concluido',
        cancelado:             'cancelado',
    };
    return map[status] || 'aberto';
}

function switchView(mode) {
    _viewMode = mode;
    document.getElementById('btnViewKanban').classList.toggle('active', mode === 'kanban');
    document.getElementById('btnViewLista').classList.toggle('active',  mode === 'lista');
    document.getElementById('kanbanBoard').style.display    = mode === 'kanban' ? '' : 'none';
    document.getElementById('kanbanTabs').style.display     = mode === 'kanban' ? '' : 'none';
    document.getElementById('listaContainer').style.display = mode === 'lista'  ? '' : 'none';
    renderTabela(document.getElementById('filtroProcessos')?.value || '');
}

async function procAlterarStatus(id, selectEl) {
    const novoStatus  = selectEl.value;
    const statusAntes = _processosTodos.find(x => x.id === id)?.status || 'aberto';
    selectEl.className = `proc-status-select proc-status-${novoStatus}`;
    selectEl.disabled  = true;
    try {
        const res = await window.supabaseAPI.atualizarProcesso(id, { status: novoStatus });
        if (!res.sucesso) throw new Error(res.mensagem);
        const p = _processosTodos.find(x => x.id === id);
        if (p) { p.status = novoStatus; p.atualizado_em = new Date().toISOString(); }
        renderTabela(document.getElementById('filtroProcessos')?.value || '');
    } catch (err) {
        mostrarNotificacao('Erro ao atualizar status: ' + err.message, 'erro');
        selectEl.value     = statusAntes;
        selectEl.className = `proc-status-select proc-status-${statusAntes}`;
        selectEl.disabled  = false;
    }
}

function _primeiroNome(razaoSocial) {
    return (razaoSocial || '').trim().split(/\s+/)[0] || '—';
}

function _tempoRelativo(isoStr) {
    if (!isoStr) return null;
    const diff = Date.now() - new Date(isoStr).getTime();
    const min  = Math.floor(diff / 60000);
    const h    = Math.floor(diff / 3600000);
    const d    = Math.floor(diff / 86400000);
    if (min < 1)  return 'agora mesmo';
    if (min < 60) return `há ${min}min`;
    if (h   < 24) return `há ${h}h`;
    if (d   < 30) return `há ${d} dia${d > 1 ? 's' : ''}`;
    return new Date(isoStr).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function _renderCard(p) {
    const coluna     = _getColuna(p.status || 'aberto');
    const tipoLabel  = { importacao: 'Importação', exportacao: 'Exportação', exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' }[p.tipo] || null;
    const tipoClasse = { importacao: 'tipo-importacao', exportacao: 'tipo-exportacao', exportacao_direta: 'tipo-exportacao', exportacao_indireta: 'tipo-exp-indireta' }[p.tipo] || '';
    const imp        = p.empresaImportador && p.empresaImportador !== '—' ? p.empresaImportador : null;
    const exp        = _primeiroNome(p.empresaExportador);
    const status     = _getColuna(p.status || 'aberto');
    const modalIco   = { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' }[p.modal] || 'fa-route';
    const modalLabel = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;

    const etapaTexto = (() => {
        if (!p.etapas || p.etapas.length === 0) return null;
        const pend = p.etapas.find(e => !e.concluida);
        return pend ? pend.nome : p.etapas[p.etapas.length - 1].nome;
    })();

    const valorTexto = p.valor_total
        ? `${p.moeda || 'USD'} ${Number(p.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : null;

    const dataCriacao   = p.criado_em    ? new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;
    const dataAtualizado = _tempoRelativo(p.atualizado_em);

    const optStatus = STATUS_OPTS
        .map(o => `<option value="${o.v}" ${status === o.v ? 'selected' : ''}>${o.label}</option>`)
        .join('');

    return `
    <div class="proc-card" id="proc-card-${escapeHtml(p.id)}" data-grupo="${coluna}">
        <div class="proc-card-top">
            <span class="proc-card-codigo"><i class="fa-solid fa-hashtag proc-card-hash"></i>${escapeHtml(p.codigo.replace(/^PROC/,''))}</span>
            ${tipoLabel ? `<span class="proc-card-tipo ${tipoClasse}">${escapeHtml(tipoLabel)}</span>` : ''}
        </div>
        ${(p.pais_origem || p.pais_destino) ? `
        <div class="proc-card-rota">
            <i class="fa-solid fa-earth-americas"></i>
            <span class="proc-card-pais">${escapeHtml(p.pais_origem || '—')}</span>
            <i class="fa-solid fa-arrow-right proc-card-arrow"></i>
            <span class="proc-card-pais">${escapeHtml(p.pais_destino || '—')}</span>
        </div>` : ''}
        ${(modalLabel || p.incoterm) ? `
        <div class="proc-card-modal">
            ${modalLabel ? `<span class="tag-badge"><i class="fa-solid ${modalIco}"></i> ${modalLabel}</span>` : ''}
            ${p.incoterm ? `<span class="tag-badge">${escapeHtml(p.incoterm)}</span>` : ''}
        </div>` : ''}
        ${imp ? `
        <div class="proc-card-empresa">
            <i class="fa-solid fa-handshake"></i>
            <span class="proc-card-pais">${escapeHtml(exp)}</span>
            <i class="fa-solid fa-arrow-right proc-card-arrow"></i>
            <span class="proc-card-pais">${escapeHtml(_primeiroNome(imp))}</span>
        </div>` : ''}
        ${etapaTexto ? `
        <div class="proc-card-etapa"><i class="fa-solid fa-circle-dot"></i> ${escapeHtml(etapaTexto)}</div>` : ''}
        ${valorTexto ? `
        <div class="proc-card-valor"><i class="fa-solid fa-sack-dollar"></i> ${escapeHtml(valorTexto)}</div>` : ''}
        <div class="proc-card-footer">
            <div class="proc-card-meta">
                ${dataCriacao ? `<span class="proc-card-data"><i class="fa-regular fa-calendar"></i> Criado em ${dataCriacao}</span>` : '<span></span>'}
                <select class="proc-status-select proc-status-${escapeHtml(status)}"
                        onchange="procAlterarStatus('${escapeHtml(p.id)}', this)">
                    ${optStatus}
                </select>
            </div>
            ${dataAtualizado ? `<div class="proc-card-atualizado"><i class="fa-solid fa-rotate-right"></i> ${dataAtualizado}</div>` : ''}
            ${p.proforma_id ? `<button class="btn-ver-processo" data-action="ver-proforma" data-id="${escapeHtml(p.proforma_id)}"><i class="fa-solid fa-file-invoice-dollar"></i> Ver Proforma ${escapeHtml(p.proforma_codigo || '')}</button>` : ''}
            <div class="proc-card-btns">
                <button class="btn-acao btn-ver"     data-action="visualizar" data-id="${escapeHtml(p.id)}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-acao btn-pdf"     data-action="pdf"        data-id="${escapeHtml(p.id)}" title="Gerar PDF"><i class="fa-solid fa-file-pdf"></i></button>
                <button class="btn-acao btn-editar"  data-action="editar"     data-id="${escapeHtml(p.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-acao btn-excluir" data-action="excluir"    data-id="${escapeHtml(p.id)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    </div>`;
}

function _filtrarProcessos(filtro) {
    const q      = (filtro || '').trim().toLowerCase();
    const status = document.getElementById('filtroStatusProcesso')?.value || '';
    let list = readProcessos();
    if (status) list = list.filter(p => _getColuna(p.status || 'aberto') === status);
    if (q) list = list.filter(p => `${p.codigo} ${p.tipo} ${p.empresaExportador} ${p.empresaImportador} ${p.pais_origem} ${p.pais_destino} ${p.status}`.toLowerCase().includes(q));
    return list;
}

function renderKanban(filtro) {
    const q    = (filtro || '').trim().toLowerCase();
    const list = _filtrarProcessos(filtro);

    const grupos = Object.fromEntries(KANBAN_COLS.map(c => [c, []]));
    list.forEach(p => grupos[_getColuna(p.status || 'aberto')].push(p));

    KANBAN_COLS.forEach(g => {
        const body     = document.getElementById(`cards-${g}`);
        const count    = document.getElementById(`count-${g}`);
        const tabCount = document.getElementById(`tab-count-${g}`);
        if (count)    count.textContent    = grupos[g].length;
        if (tabCount) tabCount.textContent = grupos[g].length;
        if (!body) return;
        body.innerHTML = grupos[g].length === 0
            ? `<div class="kanban-vazio"><i class="fa-solid fa-inbox"></i><span>${q ? 'Sem resultados' : 'Nenhum processo'}</span></div>`
            : grupos[g].map(_renderCard).join('');
    });
}

function renderLista(filtro) {
    const tbody = document.getElementById('procTbody');
    if (!tbody) return;

    const q    = (filtro || '').trim().toLowerCase();
    const list = _filtrarProcessos(filtro);

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:#94a3b8;"><i class="fa-regular fa-folder-open"></i> Nenhum processo encontrado.</td></tr>`;
        return;
    }

    const tipoMap  = { importacao: 'Importação', exportacao: 'Exportação', exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' };
    const modalMap = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };

    tbody.innerHTML = list.map(p => {
        const status = _getColuna(p.status || 'aberto');
        const opts   = STATUS_OPTS.map(o => `<option value="${o.v}" ${status === o.v ? 'selected' : ''}>${o.label}</option>`).join('');
        const cliente = escapeHtml(p.empresaImportador || p.empresaExportador || '—');
        const rota    = (p.pais_origem || p.pais_destino)
            ? `<div class="proc-rota"><span>${escapeHtml(p.pais_origem||'—')}</span><i class="fa-solid fa-arrow-right proc-rota-arrow"></i><span>${escapeHtml(p.pais_destino||'—')}</span></div>`
            : '—';
        return `<tr>
            <td><span class="proc-codigo">${escapeHtml(p.codigo)}</span></td>
            <td class="proc-cliente-nome">${cliente}</td>
            <td>${escapeHtml(tipoMap[p.tipo] || p.tipo || '—')}</td>
            <td>${rota}</td>
            <td>${escapeHtml(modalMap[p.modal] || p.modal || '—')}</td>
            <td>${escapeHtml(p.incoterm || '—')}</td>
            <td><select class="proc-status-select proc-status-${status}" onchange="procAlterarStatus('${escapeHtml(p.id)}', this)">${opts}</select></td>
            <td><div class="proc-acoes">
                ${p.proforma_id ? `<button class="btn-acao btn-ver" data-action="ver-proforma" data-id="${escapeHtml(p.proforma_id)}" title="Ver Proforma de origem"><i class="fa-solid fa-file-invoice-dollar"></i></button>` : ''}
                <button class="btn-acao btn-ver"     data-action="visualizar" data-id="${escapeHtml(p.id)}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                <button class="btn-acao btn-pdf"     data-action="pdf"        data-id="${escapeHtml(p.id)}" title="Gerar PDF"><i class="fa-solid fa-file-pdf"></i></button>
                <button class="btn-acao btn-editar"  data-action="editar"     data-id="${escapeHtml(p.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-acao btn-excluir" data-action="excluir"    data-id="${escapeHtml(p.id)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
            </div></td>
        </tr>`;
    }).join('');
}

function kanbanSwitchTab(btn) {
    document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const col = btn.getAttribute('data-col');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('kanban-col-active'));
    document.getElementById(`col-${col}`)?.classList.add('kanban-col-active');
}

function renderTabela(filtro) {
    if (_viewMode === 'lista') renderLista(filtro);
    else renderKanban(filtro);
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    carregarProcessos();

    // Filtro
    document.getElementById('filtroProcessos')?.addEventListener('input', e => renderTabela(e.target.value));

    // Cliques nos cards/linhas (editar / excluir / visualizar)
    function _handleAcao(e) {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-id');
        if (action === 'editar')       window.open(`formularios.html?tab=processo&id=${id}`, '_blank');
        if (action === 'visualizar')   window.open(`formularios.html?tab=processo&id=${id}&modo=visualizar`, '_blank');
        if (action === 'pdf')          window.open(`formularios.html?tab=processo&id=${id}&modo=pdf`, '_blank');
        if (action === 'ver-proforma') window.open(`formularios.html?tab=proposta&id=${id}&modo=visualizar`, '_blank');
        if (action === 'excluir')      abrirModalExcluir(id);
    }
    document.getElementById('kanbanBoard')?.addEventListener('click', _handleAcao);
    document.getElementById('listaContainer')?.addEventListener('click', _handleAcao);

    // Confirmar exclusão (soft-delete)
    document.getElementById('btnConfirmarExcluir')?.addEventListener('click', async () => {
        if (!_idParaExcluir) return;
        const btn = document.getElementById('btnConfirmarExcluir');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...'; }
        try {
            const u = (() => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}'); } catch { return {}; } })();
            const res = await window.supabaseAPI.atualizarProcesso(_idParaExcluir, {
                status:       'excluido',
                excluido_em:  new Date().toISOString(),
                excluido_por: u?.nome || u?.email || 'Desconhecido'
            });
            if (!res.sucesso) throw new Error(res.mensagem);
            writeProcessos(readProcessos().filter(p => p.id !== _idParaExcluir));
            renderTabela(document.getElementById('filtroProcessos')?.value || '');
            notify('Processo movido para excluídos.', 'success');
            fecharModalExcluir();
        } catch (err) {
            notify('Erro ao excluir: ' + err.message, 'erro');
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir'; }
        }
    });

    // Atualiza tabela quando outra aba salva um processo
    window.addEventListener('storage', e => {
        if (e.key === 'processos_updated') carregarProcessos();
    });
});

// --------------------------------------------------
// EXCLUÍDOS
// --------------------------------------------------
let _procExcluidosAberto = false;

async function procToggleExcluidos() {
    const panel = document.getElementById('procExcluidosPanel');
    if (!panel) return;
    _procExcluidosAberto = !_procExcluidosAberto;
    panel.classList.toggle('aberto', _procExcluidosAberto);
    if (_procExcluidosAberto) await procCarregarExcluidos();
}

async function procCarregarExcluidos() {
    const container = document.getElementById('procExcluidosContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const u = (() => { try { return JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}'); } catch { return {}; } })();
        let query = supabaseClient
            .from('processos')
            .select('id, numero_processo, pais_origem, pais_destino, excluido_em, excluido_por')
            .eq('status', 'excluido')
            .order('excluido_em', { ascending: false });
        if (u?.empresa_id) query = query.eq('empresa_proprietaria_id', u.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhum processo excluído.</div>';
            return;
        }

        const agora = Date.now();
        container.innerHTML = data.map(p => {
            let metaHtml = '';
            if (p.excluido_em) {
                const exclMs = new Date(p.excluido_em).getTime();
                const diasPassados = Math.floor((agora - exclMs) / 86400000);
                const diasRestantes = 7 - diasPassados;
                const dataFmt = new Date(p.excluido_em).toLocaleDateString('pt-BR');
                const corDias = diasRestantes <= 2 ? '#dc2626' : '#94a3b8';
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
                    <span class="prof-excluido-codigo">${p.numero_processo || '—'}</span>
                    <span class="prof-excluido-rota">${p.pais_origem || '—'} → ${p.pais_destino || '—'}</span>
                    ${metaHtml}
                </div>
                <button class="prof-excluido-restaurar" onclick="procRestaurar('${p.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Erro: ${err.message}</div>`;
    }
}

async function procRestaurar(id) {
    try {
        const res = await window.supabaseAPI.atualizarProcesso(id, { status: 'aberto' });
        if (!res.sucesso) throw new Error(res.mensagem);
        await procCarregarExcluidos();
        await carregarProcessos();
    } catch (err) {
        alert('Erro ao restaurar: ' + err.message);
    }
}

document.addEventListener('click', function(e) {
    if (_procExcluidosAberto && !e.target.closest('#procExcluidosWrapper')) {
        _procExcluidosAberto = false;
        document.getElementById('procExcluidosPanel')?.classList.remove('aberto');
    }
});
