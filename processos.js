// ========================================
// PROCESSOS — LISTA + MODAL DE CADASTRO
// ========================================

const PROCESSOS_KEY = 'processosCadastros';

let _empresasCache = [];

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
    try {
        const raw = localStorage.getItem(PROCESSOS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function writeProcessos(list) {
    localStorage.setItem(PROCESSOS_KEY, JSON.stringify(list || []));
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
        <div style="font-size:13px; color:#6b7280;">${escapeHtml(proc.cliente)} &mdash; ${escapeHtml(proc.tipo)}</div>
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
    return { aberto: 'Aberto', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' }[s] || 'Aberto';
}

function etapaAtual(etapas) {
    if (!etapas || etapas.length === 0) return null;
    const pendente = etapas.find(e => !e.done);
    return pendente ? pendente.text : etapas[etapas.length - 1].text;
}

function renderTabela(filtro) {
    const container = document.getElementById('listaContainer');
    const count     = document.getElementById('listaCount');
    if (!container) return;

    const q    = (filtro || '').trim().toLowerCase();
    const all  = readProcessos();
    const list = q
        ? all.filter(p => `${p.codigo} ${p.tipo} ${p.cliente} ${p.origem} ${p.destino} ${p.status}`.toLowerCase().includes(q))
        : all;

    count.textContent = `${list.length} processo${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-inbox"></i>
                ${q ? 'Nenhum processo encontrado para este filtro.' : 'Nenhum processo cadastrado ainda. Clique em "Novo Processo".'}
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="proc-tabela">
            <thead>
                <tr>
                    <th>Código</th>
                    <th>Tipo</th>
                    <th>Cliente/Empresa</th>
                    <th>Origem</th>
                    <th>Destino</th>
                    <th>Etapa Atual</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(p => `
                <tr>
                    <td><span class="proc-codigo">${escapeHtml(p.codigo)}</span></td>
                    <td>${escapeHtml(p.tipo || '')}</td>
                    <td>${escapeHtml(p.cliente || '')}</td>
                    <td>${escapeHtml(p.origem || '—')}</td>
                    <td>${escapeHtml(p.destino || '—')}</td>
                    <td>${etapaAtual(p.etapas) ? `<span class="etapa-badge">${escapeHtml(etapaAtual(p.etapas))}</span>` : '<span style="color:#d1d5db">—</span>'}</td>
                    <td><span class="badge" data-status="${escapeHtml(p.status || 'aberto')}">${escapeHtml(statusLabel(p.status))}</span></td>
                    <td>
                        <button class="btn-acao btn-editar" data-action="editar" data-id="${escapeHtml(p.id)}" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-acao btn-excluir" data-action="excluir" data-id="${escapeHtml(p.id)}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

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
    renderTabela('');
    iniciarAutocomplete();

    // Filtro
    document.getElementById('filtroProcessos')?.addEventListener('input', e => renderTabela(e.target.value));

    // Cliques na tabela (editar / excluir)
    document.getElementById('listaContainer')?.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-id');
        if (action === 'editar')  abrirModalProcesso(id);
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

    // Confirmar exclusão
    document.getElementById('btnConfirmarExcluir')?.addEventListener('click', () => {
        if (!_idParaExcluir) return;
        writeProcessos(readProcessos().filter(p => p.id !== _idParaExcluir));
        renderTabela(document.getElementById('filtroProcessos')?.value || '');
        notify('Processo excluído.', 'success');
        fecharModalExcluir();
    });

    // Chat input Enter
    document.getElementById('chatInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') enviarMensagem();
    });
});
