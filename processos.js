// ========================================
// PROCESSOS — LISTA + MODAL DE CADASTRO
// ========================================

const PROCESSOS_KEY = 'processosCadastros';

let _empresasCache = [];
let _processosTodos = [];

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
    ['aberta','pendente','encerrada'].forEach(g => {
        const body = document.getElementById(`cards-${g}`);
        if (body) body.innerHTML = '<div class="kanban-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    });
}

function _kanbanSetErro(msg) {
    ['aberta','pendente','encerrada'].forEach(g => {
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
                .from('empresas_cadastradas')
                .select('id, razao_social')
                .in('id', parceiraIds);
            if (emps) emps.forEach(e => { empresaMap[e.id] = e.razao_social || ''; });
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
            criado_em:         p.criado_em,
        }));
    } catch (err) {
        _kanbanSetErro(err.message);
        return;
    }
    renderKanban(document.getElementById('filtroProcessos')?.value || '');
}

// --------------------------------------------------
// SEÇÕES COLAPSÁVEIS (igual cadastros.js)
// --------------------------------------------------
function toggleSection(titleEl) {
    const section = titleEl.closest('.form-section');
    const content = section.querySelector('.section-content');
    const arrow   = titleEl.querySelector('.section-arrow');
    const isActive = section.classList.contains('active');

    if (isActive) {
        section.classList.remove('active');
        content.style.display = 'none';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        section.classList.add('active');
        content.style.display = '';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

// --------------------------------------------------
// AUTOCOMPLETE DE EMPRESAS
// --------------------------------------------------
async function carregarEmpresas() {
    if (_empresasCache.length > 0) return;
    try {
        const res = await window.supabaseAPI.buscarEmpresas();
        if (res.sucesso) _empresasCache = res.data || [];
    } catch { _empresasCache = []; }
}

function mostrarSugestoes(termo) {
    const lista = document.getElementById('procClienteLista');
    if (!lista) return;

    const q = termo.trim().toLowerCase();
    const filtradas = q
        ? _empresasCache.filter(e =>
            (e.nome_empresa || '').toLowerCase().includes(q) ||
            (e.nome_fantasia || '').toLowerCase().includes(q)
          )
        : _empresasCache;

    if (filtradas.length === 0) {
        lista.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        lista.classList.add('aberta');
        return;
    }

    lista.innerHTML = filtradas.slice(0, 30).map(e => `
        <div class="autocomplete-item" data-id="${escapeHtml(e.id)}" data-nome="${escapeHtml(e.nome_empresa)}">
            <span class="ac-nome">${escapeHtml(e.nome_empresa)}</span>
            ${e.nome_fantasia ? `<span class="ac-fantasia">${escapeHtml(e.nome_fantasia)}</span>` : ''}
        </div>`).join('');
    lista.classList.add('aberta');
}

function fecharSugestoes() {
    const lista = document.getElementById('procClienteLista');
    if (lista) lista.classList.remove('aberta');
}

function iniciarAutocomplete() {
    const input = document.getElementById('procCliente');
    const lista = document.getElementById('procClienteLista');
    if (!input || !lista) return;

    input.addEventListener('input', () => {
        document.getElementById('procClienteId').value = '';
        mostrarSugestoes(input.value);
    });

    input.addEventListener('focus', () => {
        if (_empresasCache.length > 0) mostrarSugestoes(input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.getAttribute('data-nome');
        document.getElementById('procClienteId').value = item.getAttribute('data-id');
        fecharSugestoes();
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) fecharSugestoes();
    });
}

// --------------------------------------------------
// MODAL DE PROCESSO
// --------------------------------------------------
function abrirModalProcesso(id) {
    const overlay = document.getElementById('modalFormProcesso');
    const titulo  = document.getElementById('modalFormTitulo');

    carregarEmpresas();

    if (id) {
        const proc = readProcessos().find(p => p.id === id);
        if (!proc) return;
        titulo.textContent = `Editar Processo — ${proc.codigo}`;
        preencherForm(proc);
        document.getElementById('processoEditandoId').value = id;
    } else {
        titulo.textContent = 'Novo Processo';
        limparForm();
        document.getElementById('processoEditandoId').value = '';
    }

    overlay.classList.add('active');
}

function fecharModalProcesso() {
    document.getElementById('modalFormProcesso').classList.remove('active');
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
function statusLabel(s) {
    return {
        aberto:                'Aberto',
        em_andamento:          'Em Andamento',
        aguardando_documentos: 'Aguard. Documentos',
        concluido:             'Concluído',
        cancelado:             'Cancelado',
        aberta:                'Aberta',
        pendente:              'Pendente',
        encerrada:             'Encerrada',
    }[s] || 'Aberto';
}

async function procAlterarStatus(id, selectEl) {
    const novoStatus  = selectEl.value;
    const statusAntes = _processosTodos.find(x => x.id === id)?.status || 'aberta';
    selectEl.className = `proc-status-select proc-status-${novoStatus}`;
    selectEl.disabled  = true;
    try {
        const res = await window.supabaseAPI.atualizarProcesso(id, { status: novoStatus });
        if (!res.sucesso) throw new Error(res.mensagem);
        const p = _processosTodos.find(x => x.id === id);
        if (p) p.status = novoStatus;
        renderKanban(document.getElementById('filtroProcessos')?.value || '');
    } catch (err) {
        mostrarNotificacao('Erro ao atualizar status: ' + err.message, 'erro');
        selectEl.value     = statusAntes;
        selectEl.className = `proc-status-select proc-status-${statusAntes}`;
        selectEl.disabled  = false;
    }
}

function etapaAtual(etapas) {
    if (!etapas || etapas.length === 0) return null;
    const pendente = etapas.find(e => !e.done);
    return pendente ? pendente.text : etapas[etapas.length - 1].text;
}

function _primeiroNome(razaoSocial) {
    return (razaoSocial || '').trim().split(/\s+/)[0] || '—';
}

function _statusGrupo(status) {
    if (['aberto','aberta'].includes(status)) return 'aberta';
    if (['em_andamento','aguardando_documentos','pendente'].includes(status)) return 'pendente';
    return 'encerrada';
}

function _renderCard(p) {
    const grupo      = _statusGrupo(p.status || 'aberta');
    const tipoLabel  = { importacao: 'Importação', exportacao: 'Exportação', exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' }[p.tipo] || null;
    const tipoClasse = { importacao: 'tipo-importacao', exportacao: 'tipo-exportacao', exportacao_direta: 'tipo-exportacao', exportacao_indireta: 'tipo-exp-indireta' }[p.tipo] || '';
    const imp        = p.empresaImportador && p.empresaImportador !== '—' ? p.empresaImportador : null;
    const exp        = _primeiroNome(p.empresaExportador);
    const status     = p.status || 'aberta';
    const modalIco   = { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' }[p.modal] || 'fa-route';
    const modalLabel = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;

    const etapaTexto = (() => {
        if (!p.etapas || p.etapas.length === 0) return null;
        const pend = p.etapas.find(e => !e.done);
        return pend ? pend.text : p.etapas[p.etapas.length - 1].text;
    })();

    const dataCriacao = p.criado_em
        ? new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
        : null;

    const optStatus = ['aberto','em_andamento','aguardando_documentos','concluido','cancelado','aberta','pendente','encerrada']
        .map(s => `<option value="${s}" ${status === s ? 'selected' : ''}>${statusLabel(s)}</option>`)
        .join('');

    return `
    <div class="proc-card" id="proc-card-${escapeHtml(p.id)}" data-grupo="${grupo}">
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
        <div class="proc-card-footer">
            <div class="proc-card-actions">
                <div class="proc-card-btns">
                    <button class="btn-acao btn-ver"     data-action="visualizar" data-id="${escapeHtml(p.id)}" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                    <button class="btn-acao btn-pdf"     data-action="pdf"        data-id="${escapeHtml(p.id)}" title="PDF"><i class="fa-solid fa-file-pdf"></i></button>
                    <button class="btn-acao btn-editar"  data-action="editar"     data-id="${escapeHtml(p.id)}" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-acao btn-excluir" data-action="excluir"    data-id="${escapeHtml(p.id)}" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
                <select class="proc-status-select proc-status-${escapeHtml(status)}"
                        onchange="procAlterarStatus('${escapeHtml(p.id)}', this)">
                    ${optStatus}
                </select>
            </div>
            ${dataCriacao ? `<span class="proc-card-data"><i class="fa-regular fa-calendar"></i> ${dataCriacao}</span>` : ''}
        </div>
    </div>`;
}

function renderKanban(filtro) {
    const q   = (filtro || '').trim().toLowerCase();
    const all = readProcessos();
    const list = q
        ? all.filter(p => `${p.codigo} ${p.tipo} ${p.empresaExportador} ${p.empresaImportador} ${p.pais_origem} ${p.pais_destino} ${p.status}`.toLowerCase().includes(q))
        : all;

    const grupos = { aberta: [], pendente: [], encerrada: [] };
    list.forEach(p => grupos[_statusGrupo(p.status || 'aberta')].push(p));

    ['aberta','pendente','encerrada'].forEach(g => {
        const body     = document.getElementById(`cards-${g}`);
        const count    = document.getElementById(`count-${g}`);
        const tabCount = document.getElementById(`tab-count-${g}`);
        if (count)    count.textContent    = grupos[g].length;
        if (tabCount) tabCount.textContent = grupos[g].length;
        if (!body) return;
        if (grupos[g].length === 0) {
            body.innerHTML = `<div class="kanban-vazio"><i class="fa-solid fa-inbox"></i><span>${q ? 'Sem resultados' : 'Nenhum processo'}</span></div>`;
        } else {
            body.innerHTML = grupos[g].map(_renderCard).join('');
        }
    });
}

function kanbanSwitchTab(btn) {
    document.querySelectorAll('.kanban-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const col = btn.getAttribute('data-col');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('kanban-col-active'));
    document.getElementById(`col-${col}`)?.classList.add('kanban-col-active');
}

// Alias para compatibilidade com chamadas existentes
function renderTabela(filtro) { renderKanban(filtro); }

// --------------------------------------------------
// FORMULÁRIO — PREENCHER / LIMPAR
// --------------------------------------------------
function defaultEtapas() {
    return [
        { id: uid(), text: 'Abertura', done: false },
        { id: uid(), text: 'Booking/Coleta', done: false },
        { id: uid(), text: 'Documentação', done: false },
        { id: uid(), text: 'Embarque', done: false },
        { id: uid(), text: 'Chegada', done: false },
        { id: uid(), text: 'Desembaraço', done: false },
        { id: uid(), text: 'Entrega', done: false }
    ];
}

function defaultDocs() {
    return [
        { id: 'invoice',       label: 'Invoice',                checked: false },
        { id: 'packing',       label: 'Packing List',           checked: false },
        { id: 'bl',            label: 'BL/AWB',                 checked: false },
        { id: 'li',            label: 'Licenças (se aplica)',   checked: false },
        { id: 'cert',          label: 'Certificados (se aplica)', checked: false },
        { id: 'comprovantes',  label: 'Comprovantes',           checked: false }
    ];
}

function preencherForm(p) {
    document.getElementById('procCodigo').value        = p.codigo        || '';
    document.getElementById('procTipo').value          = p.tipo          || 'importacao';
    document.getElementById('procCliente').value       = p.cliente       || '';
    document.getElementById('procClienteId').value     = p.clienteId     || '';
    document.getElementById('procOrigem').value        = p.origem        || '';
    document.getElementById('procDestino').value       = p.destino       || '';
    document.getElementById('procIncoterm').value      = p.incoterm      || '';
    document.getElementById('procModal').value         = p.modal         || 'maritimo';
    document.getElementById('procObservacoes').value   = p.observacoes   || '';
    document.getElementById('procStatus').value        = p.status        || 'aberto';
    document.getElementById('procAbertura').value      = p.abertura      || '';
    document.getElementById('procEmbarque').value      = p.embarque      || '';
    document.getElementById('procChegada').value       = p.chegada       || '';
    document.getElementById('procContainerTipo').value = p.containerTipo || '';
    document.getElementById('procContainerNum').value  = p.containerNum  || '';
    renderEtapas(p.etapas || defaultEtapas());
    renderDocs(p.docs || defaultDocs());
}

function limparForm() {
    document.getElementById('processoForm').reset();
    preencherForm({ etapas: defaultEtapas(), docs: defaultDocs() });
}

// --------------------------------------------------
// ETAPAS
// --------------------------------------------------
function renderEtapas(etapas) {
    const root = document.getElementById('etapasList');
    if (!root) return;
    root.innerHTML = '';
    (etapas || []).forEach(e => {
        const row = document.createElement('div');
        row.className = 'etapa-item';
        row.innerHTML = `
            <div class="etapa-left">
                <input type="checkbox" data-id="${escapeHtml(e.id)}" ${e.done ? 'checked' : ''}>
                <div class="etapa-text">${escapeHtml(e.text)}</div>
            </div>
            <button type="button" class="btn-acao btn-excluir" data-action="remover-etapa" data-id="${escapeHtml(e.id)}">
                <i class="fa-solid fa-xmark"></i>
            </button>`;
        root.appendChild(row);
    });
}

function coletarEtapas() {
    const root = document.getElementById('etapasList');
    if (!root) return [];
    return Array.from(root.querySelectorAll('.etapa-item')).map(row => ({
        id:   row.querySelector('input[type="checkbox"]')?.getAttribute('data-id') || uid(),
        text: row.querySelector('.etapa-text')?.textContent || '',
        done: !!row.querySelector('input[type="checkbox"]')?.checked
    }));
}

// --------------------------------------------------
// DOCUMENTOS
// --------------------------------------------------
function renderDocs(docs) {
    const root = document.getElementById('docsChecklist');
    if (!root) return;
    root.innerHTML = '';
    (docs || []).forEach(d => {
        const item = document.createElement('div');
        item.className = 'check-item';
        item.innerHTML = `
            <input type="checkbox" id="doc_${escapeHtml(d.id)}" data-id="${escapeHtml(d.id)}" ${d.checked ? 'checked' : ''}>
            <label for="doc_${escapeHtml(d.id)}">${escapeHtml(d.label)}</label>`;
        root.appendChild(item);
    });
}

function coletarDocs() {
    const root = document.getElementById('docsChecklist');
    if (!root) return [];
    return Array.from(root.querySelectorAll('input[type="checkbox"][data-id]')).map(cb => ({
        id:      cb.getAttribute('data-id'),
        label:   document.querySelector(`label[for="doc_${CSS.escape(cb.getAttribute('data-id'))}"]`)?.textContent || cb.getAttribute('data-id'),
        checked: cb.checked
    }));
}

// --------------------------------------------------
// WHATSAPP
// --------------------------------------------------
function toggleWhatsappChat() {
    document.getElementById('whatsappChat')?.classList.toggle('active');
}

function enviarMensagem() {
    const input    = document.getElementById('chatInput');
    const chatBody = document.querySelector('.chat-body');
    if (!input || !chatBody) return;
    const msg = input.value.trim();
    if (!msg) return;

    const userMsg = document.createElement('div');
    userMsg.className = 'chat-message user';
    userMsg.innerHTML = `
        <div class="message-content">${escapeHtml(msg)}</div>
        <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>`;
    chatBody.appendChild(userMsg);
    input.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;

    setTimeout(() => {
        const botMsg = document.createElement('div');
        botMsg.className = 'chat-message bot';
        botMsg.innerHTML = `
            <div class="message-content">Obrigado! Nossa equipe responderá em breve.</div>
            <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>`;
        chatBody.appendChild(botMsg);
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 800);
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    carregarProcessos();
    iniciarAutocomplete();

    // Filtro
    document.getElementById('filtroProcessos')?.addEventListener('input', e => renderTabela(e.target.value));

    // Cliques nos cards (editar / excluir / visualizar / pdf)
    document.getElementById('kanbanBoard')?.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-id');
        if (action === 'editar')     window.open(`formularios.html?tab=processo&id=${id}`, '_blank');
        if (action === 'visualizar') window.open(`formularios.html?tab=processo&id=${id}&modo=visualizar`, '_blank');
        if (action === 'pdf')        window.open(`formularios.html?tab=processo&id=${id}&modo=pdf`, '_blank');
        if (action === 'excluir') abrirModalExcluir(id);
    });

    // Adicionar etapa
    document.getElementById('btnAddEtapa')?.addEventListener('click', () => {
        const text = prompt('Nome da etapa:');
        if (!text) return;
        const etapas = coletarEtapas();
        etapas.push({ id: uid(), text: String(text).trim(), done: false });
        renderEtapas(etapas);
    });

    // Remover etapa (delegado no form)
    document.getElementById('processoForm')?.addEventListener('click', e => {
        const btn = e.target.closest('[data-action="remover-etapa"]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        renderEtapas(coletarEtapas().filter(x => x.id !== id));
    });

    // Limpar dados
    document.getElementById('btnLimparProcesso')?.addEventListener('click', () => {
        if (confirm('Limpar todos os campos do processo?')) limparForm();
    });

    // Submissão do form
    document.getElementById('processoForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const codigo  = document.getElementById('procCodigo')?.value.trim();
        const cliente = document.getElementById('procCliente')?.value.trim();
        if (!codigo || !cliente) {
            notify('Preencha os campos obrigatórios (Código e Cliente/Empresa).', 'error');
            return;
        }

        const editandoId = document.getElementById('processoEditandoId').value;
        const payload = {
            id:            editandoId || uid(),
            codigo,
            tipo:          document.getElementById('procTipo')?.value          || 'importacao',
            cliente,
            clienteId:     document.getElementById('procClienteId')?.value     || '',
            origem:        document.getElementById('procOrigem')?.value         || '',
            destino:       document.getElementById('procDestino')?.value        || '',
            incoterm:      document.getElementById('procIncoterm')?.value       || '',
            modal:         document.getElementById('procModal')?.value          || 'maritimo',
            observacoes:   document.getElementById('procObservacoes')?.value    || '',
            status:        document.getElementById('procStatus')?.value         || 'aberto',
            abertura:      document.getElementById('procAbertura')?.value       || '',
            embarque:      document.getElementById('procEmbarque')?.value       || '',
            chegada:       document.getElementById('procChegada')?.value        || '',
            containerTipo: document.getElementById('procContainerTipo')?.value  || '',
            containerNum:  document.getElementById('procContainerNum')?.value   || '',
            etapas:        coletarEtapas(),
            docs:          coletarDocs()
        };

        const list = readProcessos();
        const idx  = list.findIndex(p => p.id === payload.id);
        if (idx >= 0) list[idx] = payload;
        else list.unshift(payload);
        writeProcessos(list);

        renderTabela(document.getElementById('filtroProcessos')?.value || '');
        notify('Processo salvo com sucesso.', 'success');
        fecharModalProcesso();
    });

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

    // Chat input Enter
    document.getElementById('chatInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') enviarMensagem();
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
