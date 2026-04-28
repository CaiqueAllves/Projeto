// ========================================
// PRODUTOS — LISTA + MODAL DE CADASTRO
// ========================================

const PRODUTOS_KEY = 'produtosCadastros';

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
    if (typeof mostrarNotificacao === 'function') mostrarNotificacao(msg, type || 'info');
}

function readProdutos() {
    try {
        const raw = localStorage.getItem(PRODUTOS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function writeProdutos(list) {
    localStorage.setItem(PRODUTOS_KEY, JSON.stringify(list || []));
}

// --------------------------------------------------
// SEÇÕES COLAPSÁVEIS
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
// MODAL DE PRODUTO
// --------------------------------------------------
function abrirModalProduto(id) {
    const overlay = document.getElementById('modalFormProduto');
    const titulo  = document.getElementById('modalFormTitulo');

    if (id) {
        const prod = readProdutos().find(p => p.id === id);
        if (!prod) return;
        titulo.textContent = `Editar — ${prod.nome || prod.sku}`;
        preencherForm(prod);
        document.getElementById('produtoEditandoId').value = id;
    } else {
        titulo.textContent = 'Novo Produto';
        limparForm();
        document.getElementById('produtoEditandoId').value = '';
    }

    overlay.classList.add('active');
}

function fecharModalProduto() {
    document.getElementById('modalFormProduto').classList.remove('active');
}

// --------------------------------------------------
// MODAL DE EXCLUSÃO
// --------------------------------------------------
let _idParaExcluir = '';

function abrirModalExcluir(id) {
    const prod = readProdutos().find(p => p.id === id);
    if (!prod) return;
    _idParaExcluir = id;

    document.getElementById('excluirProdutoInfo').innerHTML = `
        <div style="font-weight:700; color:#991b1b; font-size:15px; margin-bottom:6px;">
            <i class="fa-solid fa-boxes-stacked"></i> ${escapeHtml(prod.nome || '—')}
        </div>
        <div style="font-size:13px; color:#6b7280;">SKU: ${escapeHtml(prod.sku || '—')} &mdash; ${escapeHtml(prod.categoria || 'Sem categoria')}</div>
    `;

    document.getElementById('modalExcluir').classList.add('active');
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    _idParaExcluir = '';
}

// --------------------------------------------------
// TABELA DE PRODUTOS
// --------------------------------------------------
function statusProdBadge(s) {
    return s === 'inativo'
        ? '<span class="prod-badge inativo">Inativo</span>'
        : '<span class="prod-badge ativo">Ativo</span>';
}

function renderTabela(filtro) {
    const container = document.getElementById('listaContainer');
    const count     = document.getElementById('listaCount');
    if (!container) return;

    const q    = (filtro || '').trim().toLowerCase();
    const all  = readProdutos();
    const list = q
        ? all.filter(p => `${p.sku} ${p.nome} ${p.categoria} ${p.ncm} ${p.marca}`.toLowerCase().includes(q))
        : all;

    count.textContent = `${list.length} produto${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-inbox"></i>
                ${q ? 'Nenhum produto encontrado para este filtro.' : 'Nenhum produto cadastrado ainda. Clique em "Novo Produto".'}
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="prod-tabela">
            <thead>
                <tr>
                    <th>SKU</th>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Marca</th>
                    <th>NCM</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(p => `
                <tr>
                    <td><span class="prod-sku">${escapeHtml(p.sku || '—')}</span></td>
                    <td>${escapeHtml(p.nome || '—')}</td>
                    <td>${escapeHtml(p.categoria || '—')}</td>
                    <td>${escapeHtml(p.marca || '—')}</td>
                    <td>${escapeHtml(p.ncm || '—')}</td>
                    <td>${statusProdBadge(p.statusAtivo)}</td>
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
function preencherForm(p) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
    const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

    set('sku', p.sku);
    set('statusAtivo', p.statusAtivo || 'ativo');
    set('nome', p.nome);
    set('descricao', p.descricao);
    set('categoria', p.categoria);
    set('marca', p.marca);
    set('ncm', p.ncm);
    set('unidadeMedida', p.unidadeMedida);

    set('moeda', p.moeda || 'BRL');
    set('custo', p.custo);
    set('margem', p.margem);
    set('precoVenda', p.precoVenda);
    set('descontoMax', p.descontoMax);
    set('leadTimeDias', p.leadTimeDias);
    set('observacoesPreco', p.observacoesPreco);

    chk('controlaEstoque', p.controlaEstoque !== false);
    chk('permiteVendaSemEstoque', p.permiteVendaSemEstoque);
    set('estoqueAtual', p.estoqueAtual);
    set('estoqueMinimo', p.estoqueMinimo);
    set('localizacao', p.localizacao);
    set('loteValidade', p.loteValidade || 'nao');

    set('pesoBrutoKg', p.pesoBrutoKg);
    set('pesoLiquidoKg', p.pesoLiquidoKg);
    set('comprimentoCm', p.comprimentoCm);
    set('larguraCm', p.larguraCm);
    set('alturaCm', p.alturaCm);
    chk('fragil', p.fragil);
    chk('empilhavel', p.empilhavel);
    chk('perigoso', p.perigoso);
    set('temperatura', p.temperatura || 'ambiente');
    set('embalagem', p.embalagem);
    set('tipoContainer', p.tipoContainer || '20');
    set('observacoesLogistica', p.observacoesLogistica);

    set('fichaTecnicaUrl', p.fichaTecnicaUrl);
    set('observacoesGerais', p.observacoesGerais);

    initCharCounters();
    initLogisticaCalcs();
}

function limparForm() {
    document.getElementById('produtoForm').reset();
    const preview = document.getElementById('imagensPreview');
    if (preview) preview.innerHTML = '';
    initCharCounters();
    initLogisticaCalcs();
}

function processarUploadProdutos(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    notify(`Arquivo "${file.name}" recebido. Integração de importação em desenvolvimento.`, 'info');
    input.value = '';
}

function coletarForm(editandoId) {
    const get = id => document.getElementById(id)?.value ?? '';
    const chk = id => !!document.getElementById(id)?.checked;

    return {
        id:                   editandoId || uid(),
        sku:                  get('sku').trim(),
        statusAtivo:          get('statusAtivo'),
        nome:                 get('nome').trim(),
        descricao:            get('descricao'),
        categoria:            get('categoria'),
        marca:                get('marca'),
        ncm:                  get('ncm'),
        unidadeMedida:        get('unidadeMedida'),
        moeda:                get('moeda'),
        custo:                get('custo'),
        margem:               get('margem'),
        precoVenda:           get('precoVenda'),
        descontoMax:          get('descontoMax'),
        leadTimeDias:         get('leadTimeDias'),
        observacoesPreco:     get('observacoesPreco'),
        controlaEstoque:      chk('controlaEstoque'),
        permiteVendaSemEstoque: chk('permiteVendaSemEstoque'),
        estoqueAtual:         get('estoqueAtual'),
        estoqueMinimo:        get('estoqueMinimo'),
        localizacao:          get('localizacao'),
        loteValidade:         get('loteValidade'),
        pesoBrutoKg:          get('pesoBrutoKg'),
        pesoLiquidoKg:        get('pesoLiquidoKg'),
        comprimentoCm:        get('comprimentoCm'),
        larguraCm:            get('larguraCm'),
        alturaCm:             get('alturaCm'),
        volumeM3:             get('volumeM3'),
        fragil:               chk('fragil'),
        empilhavel:           chk('empilhavel'),
        perigoso:             chk('perigoso'),
        temperatura:          get('temperatura'),
        embalagem:            get('embalagem'),
        tipoContainer:        get('tipoContainer'),
        unidadesPorContainer: get('unidadesPorContainer'),
        observacoesLogistica: get('observacoesLogistica'),
        fichaTecnicaUrl:      get('fichaTecnicaUrl'),
        observacoesGerais:    get('observacoesGerais'),
    };
}

// --------------------------------------------------
// CÁLCULOS DE LOGÍSTICA
// --------------------------------------------------
function containerVolumeM3(tipo) {
    if (tipo === '20') return 33.2;
    if (tipo === '40') return 67.7;
    if (tipo === '40hc') return 76.4;
    return 33.2;
}

function initLogisticaCalcs() {
    const comprimento = document.getElementById('comprimentoCm');
    const largura     = document.getElementById('larguraCm');
    const altura      = document.getElementById('alturaCm');
    const volumeM3    = document.getElementById('volumeM3');
    const tipoContainer = document.getElementById('tipoContainer');
    const unidades    = document.getElementById('unidadesPorContainer');
    if (!comprimento || !largura || !altura || !volumeM3 || !tipoContainer || !unidades) return;

    const recalc = () => {
        const c = Number(comprimento.value);
        const l = Number(largura.value);
        const a = Number(altura.value);
        if (!c || !l || !a) { volumeM3.value = ''; unidades.value = ''; return; }
        const vol = (c * l * a) / 1_000_000;
        volumeM3.value = vol.toLocaleString('pt-BR', { minimumFractionDigits: 6, maximumFractionDigits: 6 });
        const volCont = containerVolumeM3(tipoContainer.value);
        const qtd = vol > 0 ? Math.floor(volCont / vol) : 0;
        unidades.value = qtd > 0 ? qtd.toLocaleString('pt-BR') : '0';
    };

    [comprimento, largura, altura].forEach(el => el.addEventListener('input', recalc));
    tipoContainer.addEventListener('change', recalc);
    recalc();
}

// --------------------------------------------------
// CONTADORES DE CARACTERES
// --------------------------------------------------
function initCharCounters() {
    document.querySelectorAll('.char-counter[data-for]').forEach(counter => {
        const field = document.getElementById(counter.getAttribute('data-for'));
        if (!field) return;
        const max = Number(field.getAttribute('maxlength')) || 0;
        const update = () => {
            counter.textContent = max ? `${field.value.length}/${max}` : `${field.value.length}`;
        };
        field.removeEventListener('input', update);
        field.addEventListener('input', update);
        update();
    });
}

// --------------------------------------------------
// PREVIEW DE IMAGENS
// --------------------------------------------------
function initImagemPreview() {
    const input   = document.getElementById('imagens');
    const preview = document.getElementById('imagensPreview');
    if (!input || !preview) return;

    input.addEventListener('change', () => {
        preview.innerHTML = '';
        Array.from(input.files || []).forEach((file, idx) => {
            const url  = URL.createObjectURL(file);
            const card = document.createElement('div');
            card.className = 'img-card';
            card.innerHTML = `
                <img alt="Imagem ${idx + 1}" src="${url}">
                <div class="img-meta">
                    <span title="${escapeHtml(file.name)}">${escapeHtml(file.name.length > 18 ? file.name.slice(0, 17) + '…' : file.name)}</span>
                    <button class="img-remove" type="button">✕</button>
                </div>`;
            card.querySelector('.img-remove').addEventListener('click', () => {
                input.value = '';
                preview.innerHTML = '';
            });
            card.querySelector('img').addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
            preview.appendChild(card);
        });
    });
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
    initImagemPreview();

    // Filtro
    document.getElementById('filtroProdutos')?.addEventListener('input', e => renderTabela(e.target.value));

    // Cliques na tabela
    document.getElementById('listaContainer')?.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-id');
        if (action === 'editar')  abrirModalProduto(id);
        if (action === 'excluir') abrirModalExcluir(id);
    });

    // Limpar dados
    document.getElementById('btnLimparProduto')?.addEventListener('click', () => {
        if (confirm('Limpar todos os campos do produto?')) limparForm();
    });

    // Submissão do formulário
    document.getElementById('produtoForm')?.addEventListener('submit', e => {
        e.preventDefault();
        const sku  = document.getElementById('sku')?.value.trim();
        const nome = document.getElementById('nome')?.value.trim();
        if (!sku || !nome) {
            notify('Preencha os campos obrigatórios (SKU e Nome).', 'error');
            return;
        }

        // Auto-calcular preço de venda se vazio
        const custo  = Number(document.getElementById('custo')?.value);
        const margem = Number(document.getElementById('margem')?.value);
        const precoEl = document.getElementById('precoVenda');
        if (precoEl && !precoEl.value && custo >= 0 && margem >= 0) {
            precoEl.value = (custo * (1 + margem / 100)).toFixed(2);
        }

        const editandoId = document.getElementById('produtoEditandoId').value;
        const payload    = coletarForm(editandoId);

        const list = readProdutos();
        const idx  = list.findIndex(p => p.id === payload.id);
        if (idx >= 0) list[idx] = payload;
        else list.unshift(payload);
        writeProdutos(list);

        renderTabela(document.getElementById('filtroProdutos')?.value || '');
        notify('Produto salvo com sucesso.', 'success');
        fecharModalProduto();
    });

    // Confirmar exclusão
    document.getElementById('btnConfirmarExcluir')?.addEventListener('click', () => {
        if (!_idParaExcluir) return;
        writeProdutos(readProdutos().filter(p => p.id !== _idParaExcluir));
        renderTabela(document.getElementById('filtroProdutos')?.value || '');
        notify('Produto excluído.', 'success');
        fecharModalExcluir();
    });

    // Chat Enter
    document.getElementById('chatInput')?.addEventListener('keypress', e => {
        if (e.key === 'Enter') enviarMensagem();
    });
});
