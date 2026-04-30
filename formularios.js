// ========================================
//  FORMULÁRIOS — JS
// ========================================

// Trocar aba
function mudarTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="' + tabId + '"]').classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
}

// Toggle seção colapsável
function toggleSection(titleEl) {
    const section = titleEl.closest('.form-section');
    const content = section.querySelector('.section-content');
    const isActive = section.classList.contains('active');
    section.classList.toggle('active');
    content.style.display = isActive ? 'none' : 'block';
}

// Limpar formulário
function limparForm(formId) {
    if (confirm('Deseja limpar todos os campos?')) {
        document.getElementById(formId).reset();
    }
}

function salvarEmpresa(e)  { e.preventDefault(); alert('Empresa salva com sucesso! (integração pendente)'); }

// ========================================
// TAGS — EMPRESA
// ========================================

let _empTagsArray = [];

function empIniciarTags() {
    const input = document.getElementById('emp-tags-input');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); empAdicionarTag(); }
    });
}

function empAdicionarTag() {
    const input = document.getElementById('emp-tags-input');
    const texto = input.value.trim().toLowerCase();
    if (!texto) return;
    if (_empTagsArray.length >= 4) { mostrarNotificacao('Limite de 4 tags atingido.', 'warning'); input.value = ''; return; }
    if (_empTagsArray.includes(texto)) { input.value = ''; return; }
    _empTagsArray.push(texto);
    empRenderizarTags();
    input.value = '';
    input.focus();
}

function empRemoverTag(i) {
    _empTagsArray.splice(i, 1);
    empRenderizarTags();
}

function empRenderizarTags() {
    const container = document.getElementById('emp-tags-container');
    const hidden    = document.getElementById('emp-tags');
    if (!container) return;

    if (_empTagsArray.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
    } else {
        container.style.display = 'flex';
        container.innerHTML = _empTagsArray.map((tag, i) => `
            <div class="tag-item">
                <i class="fa-solid fa-tag"></i>
                <span>${tag}</span>
                <i class="fa-solid fa-xmark tag-remove" onclick="empRemoverTag(${i})"></i>
            </div>`).join('');
    }

    if (hidden) hidden.value = JSON.stringify(_empTagsArray);
}

function toggleTelWhats(num, ativo) {
    const telInput   = document.getElementById(`emp-contato${num}-tel`);
    const whatsGroup = document.getElementById(`emp-contato${num}-whats-group`);
    const whatsInput = document.getElementById(`emp-contato${num}-whats`);
    if (ativo) {
        whatsGroup.style.display = 'none';
        if (whatsInput) whatsInput.value = telInput?.value || '';
    } else {
        whatsGroup.style.display = 'block';
        if (whatsInput) whatsInput.value = '';
    }
}

function toggleTransportadoraVinculada(ativo) {
    document.getElementById('emp-transportadora-campos').style.display = ativo ? 'block' : 'none';
}

function adicionarContato2() {
    document.getElementById('emp-contato2-bloco').style.display = 'block';
    document.getElementById('btn-add-contato').style.display    = 'none';
}

function removerContato2() {
    document.getElementById('emp-contato2-bloco').style.display = 'none';
    document.getElementById('btn-add-contato').style.display    = 'flex';
    ['emp-contato2-nome','emp-contato2-cargo','emp-contato2-tel','emp-contato2-whats']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}
function salvarProduto(e)  { e.preventDefault(); alert('Produto salvo com sucesso! (integração pendente)'); }

// ========================================
// SALVAR — PROCESSO
// ========================================

function salvarProcesso(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-confirmar-salvar');
    modal.dataset.origem = 'processo';
    modal.style.display = 'flex';
}

function fecharConfirmSalvar() {
    document.getElementById('modal-confirmar-salvar').style.display = 'none';
}

function confirmarSalvar() {
    const origem = document.getElementById('modal-confirmar-salvar').dataset.origem || 'processo';
    fecharConfirmSalvar();
    // TODO: integrar com Supabase
    const posModal = document.getElementById('modal-pos-salvo');
    posModal.dataset.origem = origem;
    posModal.style.display = 'flex';
}

// Alias mantido para compatibilidade com HTML existente
function confirmarSalvarProcesso() { confirmarSalvar(); }

function criarNovo() {
    const origem = document.getElementById('modal-pos-salvo').dataset.origem || 'processo';
    document.getElementById('modal-pos-salvo').style.display = 'none';
    if (origem === 'proposta') {
        document.getElementById('form-proposta')?.reset();
    } else {
        document.getElementById('form-processo')?.reset();
    }
}

function fecharGuia() {
    document.getElementById('modal-pos-salvo').style.display = 'none';
    window.close();
    if (!window.closed) window.history.back();
}

// Aliases para compatibilidade com HTML existente
function criarNovoProcesso() { criarNovo(); }
function fecharGuiaProcesso() { fecharGuia(); }

// ========================================
// SALVAR — PROPOSTA
// ========================================

function salvarProposta(e) {
    e.preventDefault();
    const modal = document.getElementById('modal-confirmar-salvar');
    modal.dataset.origem = 'proposta';
    modal.style.display = 'flex';
}

// ========================================
// PDF — PROPOSTA (stub)
// ========================================

function gerarPDFProposta() {
    alert('Geração de PDF para proposta em breve. (integração pendente)');
}

// ========================================
// SUFRAMA — TOGGLE
// ========================================

function toggleSuframa() {
    const input = document.getElementById('emp-suframa');
    const btn   = document.getElementById('btn-suframa');
    const icon  = document.getElementById('suframa-btn-icon');
    if (!input) return;
    const aberto = input.style.display !== 'none';
    input.style.display = aberto ? 'none' : 'block';
    icon.className = aberto ? 'fa-solid fa-plus' : 'fa-solid fa-xmark';
    btn.classList.toggle('ativo', !aberto);
    if (aberto) input.value = '';
}

// CONTATOS — ADICIONAR / REMOVER
// ========================================

let _empContatoCount = 0;
const EMP_CONTATO_MAX = 3;

function empContatoIniciar() {
    empContatoAdicionar();
}

function empContatoAdicionar() {
    if (_empContatoCount >= EMP_CONTATO_MAX) return;
    _empContatoCount++;
    const id = Date.now();

    const container = document.getElementById('emp-contato-rows');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'contato-lista-row';
    row.id = `contato-row-${id}`;
    row.innerHTML = `
        <input type="text"  class="contato-tipo-input" name="contato_${id}_tipo"  placeholder="Ex: Financeiro">
        <input type="text"  name="contato_${id}_nome"  placeholder="Nome completo">
        <input type="email" name="contato_${id}_email" placeholder="email@empresa.com">
        <input type="text"  name="contato_${id}_tel"   placeholder="00000000000" inputmode="numeric" oninput="this.value=this.value.replace(/\D/g,'')">
        <button type="button" class="btn-remover-contato" onclick="empContatoRemover('${id}')" title="Remover">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    container.appendChild(row);

    _empContatoAtualizarUI();
}

function empContatoRemover(id) {
    const row = document.getElementById(`contato-row-${id}`);
    if (row) { row.remove(); _empContatoCount--; }
    _empContatoAtualizarUI();
}

function _empContatoAtualizarUI() {
    const btn  = document.getElementById('btn-add-contato');
    const rows = document.querySelectorAll('#emp-contato-rows .contato-lista-row');
    if (btn) btn.style.display = _empContatoCount >= EMP_CONTATO_MAX ? 'none' : '';
    rows.forEach(r => {
        const b = r.querySelector('.btn-remover-contato');
        if (b) b.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
}

// AUTOCOMPLETE — DADOS
// ========================================

let _acEmpresas    = [];
let _acPaises      = [];
let _acContainers  = [];
let _acAeroportos  = [];
let _acPortos      = [];
let _acMoedas      = [];
let _acUnidades    = [];

const MODAL_INFO = {
    aereo:     'Transporte por via aérea. Mais rápido e seguro, indicado para cargas urgentes, de alto valor ou perecíveis. Custo mais elevado. Utiliza aeroportos como ponto de embarque e desembarque.',
    maritimo:  'Transporte por via marítima. Ideal para grandes volumes e cargas pesadas. Geralmente mais lento, porém com menor custo por tonelada. Utiliza navios e portos.',
    terrestre: 'Transporte por estradas em caminhões ou carretas. Flexível e com ampla cobertura territorial. Muito utilizado em operações domésticas e no Mercosul.',
};

const INCOTERMS_INFO = {
    EXW: 'O vendedor disponibiliza a mercadoria em seu estabelecimento. Toda a responsabilidade de transporte e custos é do comprador.',
    FCA: 'O vendedor entrega a mercadoria ao transportador indicado pelo comprador no local acordado. O risco passa ao comprador na entrega.',
    CPT: 'O vendedor paga o frete até o destino, mas o risco passa ao comprador quando entregue ao primeiro transportador.',
    CIP: 'Igual ao CPT, porém o vendedor também contrata seguro mínimo até o destino.',
    DAP: 'O vendedor entrega no local de destino acordado, pronto para descarga. O desembaraço na importação é responsabilidade do comprador.',
    DPU: 'O vendedor entrega e descarrega a mercadoria no local de destino. O desembaraço na importação é do comprador.',
    DDP: 'O vendedor assume todos os custos e riscos, incluindo impostos e desembaraço aduaneiro no país de destino.',
    FAS: 'O vendedor entrega a mercadoria ao lado do navio no porto de embarque. A partir daí, os custos e riscos são do comprador.',
    FOB: 'O vendedor entrega a mercadoria a bordo do navio no porto de embarque. A partir daí, riscos e custos são do comprador.',
    CFR: 'O vendedor paga o frete até o porto de destino, mas o risco passa ao comprador assim que a mercadoria é embarcada.',
    CIF: 'Igual ao CFR, porém o vendedor também contrata seguro mínimo até o porto de destino.',
};

async function _acCarregarEmpresas() {
    if (_acEmpresas.length > 0) return;
    try {
        const res = await window.supabaseAPI.buscarEmpresas();
        if (res.sucesso) _acEmpresas = res.data || [];
    } catch { _acEmpresas = []; }
}

async function _acCarregarContainers() {
    if (_acContainers.length > 0) return;
    try {
        const { data, error } = await supabaseClient
            .from('acondicionamento')
            .select('id, tipo, identificacao, descricao')
            .order('numero', { ascending: true });
        if (!error) _acContainers = data || [];
    } catch { _acContainers = []; }
}

async function _acCarregarAeroportos() {
    if (_acAeroportos.length > 0) return;
    try {
        const lote = 1000;
        let de = 0;
        let todos = [];
        while (true) {
            const { data, error } = await supabaseClient
                .from('apoio_aeroportos')
                .select('nome, codigo, pais')
                .order('nome', { ascending: true })
                .range(de, de + lote - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            todos = todos.concat(data);
            if (data.length < lote) break;
            de += lote;
        }
        _acAeroportos = todos;
    } catch { _acAeroportos = []; }
}

async function _acCarregarPortos() {
    if (_acPortos.length > 0) return;
    try {
        const lote = 1000;
        let de = 0;
        let todos = [];
        while (true) {
            const { data, error } = await supabaseClient
                .from('apoio_portos')
                .select('nome, sigla, cidade, pais')
                .order('nome', { ascending: true })
                .range(de, de + lote - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            todos = todos.concat(data);
            if (data.length < lote) break;
            de += lote;
        }
        _acPortos = todos;
    } catch { _acPortos = []; }
}

async function _acCarregarPaises() {
    if (_acPaises.length > 0) return;
    try {
        const { data, error } = await supabaseClient
            .from('paises')
            .select('descricao, codigo')
            .order('descricao', { ascending: true });
        if (!error) _acPaises = data || [];
    } catch { _acPaises = []; }
}

function _acMostrar(inputEl, listaEl, termo) {
    const q = (termo || '').trim().toLowerCase();
    const filtradas = q
        ? _acEmpresas.filter(e =>
            (e.nome_empresa || '').toLowerCase().includes(q) ||
            (e.nome_fantasia || '').toLowerCase().includes(q))
        : _acEmpresas;

    if (filtradas.length === 0) {
        listaEl.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
    } else {
        listaEl.innerHTML = filtradas.slice(0, 30).map(e => `
            <div class="autocomplete-item"
                 data-id="${e.id}"
                 data-nome="${(e.nome_empresa || '').replace(/"/g, '&quot;')}"
                 data-doc="${(e.documento || '').replace(/"/g, '&quot;')}"
                 data-pais="${(e.pais || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${e.nome_empresa || ''}</span>
                ${e.nome_fantasia ? `<span class="ac-fantasia">${e.nome_fantasia}</span>` : ''}
            </div>`).join('');
    }
    _acPosicionar(inputEl, listaEl);
    listaEl.classList.add('aberta');
}

function _acFechar(listaEl) {
    listaEl.classList.remove('aberta');
}

function _acPosicionar(inputEl, listaEl) {
    const rect = inputEl.getBoundingClientRect();
    listaEl.style.top   = (rect.bottom + 4) + 'px';
    listaEl.style.left  = rect.left + 'px';
    listaEl.style.width = rect.width + 'px';
}

// ========================================
// AUTOCOMPLETE — PAÍS DE ORIGEM (PROCESSO)
// ========================================

function iniciarAutocompletePaisOrigem() {
    const input   = document.getElementById('proc-origem-pais');
    const lista   = document.getElementById('proc-origem-pais-lista');
    const codigo  = document.getElementById('proc-origem-pais-codigo');
    const chkPais = document.getElementById('proc-origem-pais-editar');
    if (!input || !lista || !codigo) return;

    async function mostrarPaises() {
        if (!chkPais?.checked) return;
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${p.codigo}" data-nome="${(p.descricao || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.descricao}</span>
                <span class="ac-fantasia">${p.codigo}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    chkPais?.addEventListener('change', () => {
        input.readOnly = !chkPais.checked;
        if (!chkPais.checked) _acFechar(lista);
        else input.focus();
    });

    input.addEventListener('focus', mostrarPaises);
    input.addEventListener('input', () => { codigo.value = ''; mostrarPaises(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — PAÍS DE DESTINO (PROCESSO)
// ========================================

function iniciarAutocompletePaisDestino() {
    const input  = document.getElementById('proc-destino-pais');
    const lista  = document.getElementById('proc-destino-pais-lista');
    const codigo = document.getElementById('proc-destino-pais-codigo');
    if (!input || !lista || !codigo) return;

    async function mostrar() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${p.codigo}" data-nome="${(p.descricao || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.descricao}</span>
                <span class="ac-fantasia">${p.codigo}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { codigo.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — AEROPORTOS
// ========================================

function _iniciarAcAeroporto(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
    if (!input || !lista) return;

    async function mostrar() {
        await _acCarregarAeroportos();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acAeroportos.filter(a =>
                (a.nome   || '').toLowerCase().includes(q) ||
                (a.codigo || '').toLowerCase().includes(q) ||
                (a.pais   || '').toLowerCase().includes(q))
            : _acAeroportos;

        lista.innerHTML = filtrados.slice(0, 50).map(a => `
            <div class="autocomplete-item"
                 data-nome="${(a.nome || '').replace(/"/g, '&quot;')}"
                 data-codigo="${(a.codigo || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${a.nome}</span>
                <span class="ac-fantasia">${a.codigo}${a.pais ? ' · ' + a.pais : ''}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', mostrar);

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = `${item.getAttribute('data-nome')} (${item.getAttribute('data-codigo')})`;
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

function iniciarAutocompleteAeroportos() {
    _iniciarAcAeroporto('proc-aeroporto-origem',  'proc-aeroporto-origem-lista');
    _iniciarAcAeroporto('proc-aeroporto-destino', 'proc-aeroporto-destino-lista');
    _iniciarAcAeroporto('prop-aeroporto-origem',  'prop-aeroporto-origem-lista');
    _iniciarAcAeroporto('prop-aeroporto-destino', 'prop-aeroporto-destino-lista');
}

// ========================================
// AUTOCOMPLETE — PORTOS
// ========================================

function _iniciarAcPorto(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
    if (!input || !lista) return;

    async function mostrar() {
        await _acCarregarPortos();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPortos.filter(p =>
                (p.nome   || '').toLowerCase().includes(q) ||
                (p.sigla  || '').toLowerCase().includes(q) ||
                (p.cidade || '').toLowerCase().includes(q) ||
                (p.pais   || '').toLowerCase().includes(q))
            : _acPortos;

        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item"
                 data-nome="${(p.nome  || '').replace(/"/g, '&quot;')}"
                 data-sigla="${(p.sigla || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.nome}</span>
                <span class="ac-fantasia">${p.sigla ? p.sigla + ' · ' : ''}${p.cidade ? p.cidade + ' · ' : ''}${p.pais || ''}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', mostrar);

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        const sigla = item.getAttribute('data-sigla');
        input.value = sigla
            ? `${item.getAttribute('data-nome')} (${sigla})`
            : item.getAttribute('data-nome');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

function iniciarAutocompletePortos() {
    _iniciarAcPorto('proc-porto-origem',  'proc-porto-origem-lista');
    _iniciarAcPorto('proc-porto-destino', 'proc-porto-destino-lista');
    _iniciarAcPorto('prop-porto-origem',  'prop-porto-origem-lista');
    _iniciarAcPorto('prop-porto-destino', 'prop-porto-destino-lista');
}

// ========================================
// AUTOCOMPLETE — PAÍS DA EMPRESA
// ========================================

function iniciarAutocompletePaisEmpresa() {
    const input  = document.getElementById('emp-pais');
    const lista  = document.getElementById('emp-pais-lista');
    const codigo = document.getElementById('emp-pais-codigo');
    if (!input || !lista || !codigo) return;

    async function mostrar() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${p.codigo}" data-nome="${(p.descricao || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.descricao}</span>
                <span class="ac-fantasia">${p.codigo}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { codigo.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
        input.dispatchEvent(new Event('input'));
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// PAÍS EMPRESA — CEP / ESTADO CONDICIONAL
// ========================================

function iniciarPaisEmpresa() {
    const paisInput   = document.getElementById('emp-pais');
    const cepGroup    = document.getElementById('emp-cep')?.closest('.form-group');
    const estadoSel   = document.getElementById('emp-estado');
    const estadoTexto = document.getElementById('emp-estado-texto');
    if (!paisInput) return;

    const BRASIL = ['brasil', 'brazil', 'br'];

    function isBrasil() {
        return BRASIL.includes(paisInput.value.trim().toLowerCase());
    }

    function atualizar() {
        const br = isBrasil();

        if (cepGroup) cepGroup.style.display = br ? '' : 'none';

        if (estadoSel && estadoTexto) {
            estadoSel.style.display   = br ? '' : 'none';
            estadoTexto.style.display = br ? 'none' : '';
            estadoSel.required        = br;
            estadoTexto.required      = !br;
        }

        if (!br) {
            const cepEl = document.getElementById('emp-cep');
            if (cepEl) { cepEl.value = ''; cepEl.style.borderColor = ''; }
            _empCepMsg('');
            if (estadoSel) estadoSel.value = '';
        }
    }

    paisInput.addEventListener('input', atualizar);
    atualizar();
}

// ========================================
// CEP — MÁSCARA + BUSCA AUTOMÁTICA
// ========================================

function iniciarMascaraCEP() {
    const cepInput = document.getElementById('emp-cep');
    if (!cepInput) return;

    cepInput.maxLength   = 9;
    cepInput.placeholder = '00000-000';

    cepInput.addEventListener('input', () => {
        let v = cepInput.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
        cepInput.value = v;
        _empCepMsg('');
        cepInput.style.borderColor = '';
    });

    cepInput.addEventListener('blur', buscarCEPEmpresa);
}

function _empCepMsg(msg, cor) {
    let small = document.getElementById('emp-cep-msg');
    if (!small) {
        small = document.createElement('small');
        small.id = 'emp-cep-msg';
        small.style.cssText = 'display:block; margin-top:4px; font-size:12px;';
        document.getElementById('emp-cep')?.parentElement?.appendChild(small);
    }
    small.innerHTML   = msg;
    small.style.color = cor || '#64748b';
}

async function buscarCEPEmpresa() {
    const cepInput = document.getElementById('emp-cep');
    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        if (cep.length > 0) _empCepMsg('<i class="fa-solid fa-triangle-exclamation"></i> CEP deve conter 8 dígitos.', '#f59e0b');
        return;
    }

    _empCepMsg('<i class="fa-solid fa-spinner fa-spin"></i> Buscando endereço...', '#4776ec');
    cepInput.style.borderColor = '#4776ec';
    cepInput.disabled = true;

    try {
        const res   = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await res.json();

        if (dados.erro) {
            _empCepMsg('<i class="fa-solid fa-circle-xmark"></i> CEP não encontrado.', '#dc2626');
            cepInput.style.borderColor = '#dc2626';
        } else {
            const map = {
                'emp-estado':      dados.uf          || '',
                'emp-cidade':      dados.localidade  || '',
                'emp-bairro':      dados.bairro      || '',
                'emp-endereco':    dados.logradouro  || '',
                'emp-complemento': dados.complemento || '',
            };
            Object.entries(map).forEach(([id, val]) => {
                const el = document.getElementById(id);
                if (el && !el.value) el.value = val;
            });
            cepInput.style.borderColor = '#22C55E';
            _empCepMsg('<i class="fa-solid fa-circle-check"></i> Endereço preenchido automaticamente.', '#16a34a');
            setTimeout(() => document.getElementById('emp-numero')?.focus(), 300);
        }
    } catch {
        _empCepMsg('<i class="fa-solid fa-circle-xmark"></i> Erro ao buscar CEP. Verifique sua conexão.', '#dc2626');
        cepInput.style.borderColor = '#dc2626';
    } finally {
        cepInput.disabled = false;
    }
}

// ========================================
// MÁSCARA CPF / CNPJ — FORMULÁRIO EMPRESA
// ========================================

function aplicarMascaraDocumento() {
    const tipoSelect = document.getElementById('emp-tipo-cadastro');
    const docInput   = document.getElementById('emp-documento');
    if (!tipoSelect || !docInput) return;

    function mascarar(valor, tipo) {
        valor = valor.replace(/\D/g, '');
        if (tipo === 'cpf') {
            valor = valor.slice(0, 11);
            valor = valor.replace(/^(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1-$2');
        } else {
            valor = valor.slice(0, 14);
            valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        }
        return valor;
    }

    function atualizar() {
        const tipo = tipoSelect.value;
        if (tipo === 'cpf') {
            docInput.placeholder = '000.000.000-00';
            docInput.maxLength   = 14;
        } else {
            docInput.placeholder = '00.000.000/0001-00';
            docInput.maxLength   = 18;
        }
        docInput.value = mascarar(docInput.value, tipo);
    }

    tipoSelect.addEventListener('change', () => {
        docInput.value = '';
        atualizar();
        docInput.focus();
    });

    docInput.addEventListener('input', () => {
        docInput.value = mascarar(docInput.value, tipoSelect.value || 'cnpj');
    });

    atualizar();
}

// ========================================
// MÁSCARA CPF / CNPJ — FORMULÁRIO PROCESSO
// ========================================

function aplicarMascaraDocumentoProcesso() {
    const tipoSelect = document.getElementById('proc-documento-tipo');
    const docInput   = document.getElementById('proc-documento');
    if (!tipoSelect || !docInput) return;

    function mascarar(valor, tipo) {
        valor = valor.replace(/\D/g, '');
        if (tipo === 'cpf') {
            valor = valor.slice(0, 11);
            valor = valor.replace(/^(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1-$2');
        } else {
            valor = valor.slice(0, 14);
            valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        }
        return valor;
    }

    function atualizarPlaceholder() {
        const tipo = tipoSelect.value;
        docInput.placeholder = tipo === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00';
        docInput.maxLength   = tipo === 'cpf' ? 14 : 18;
        docInput.value       = '';
    }

    tipoSelect.addEventListener('change', atualizarPlaceholder);

    docInput.addEventListener('input', () => {
        if (docInput.readOnly) return;
        docInput.value = mascarar(docInput.value, tipoSelect.value);
    });

    atualizarPlaceholder();
}

// ========================================
// AUTOCOMPLETE — CONTAINER
// ========================================

function iniciarAutocompleteContainer() {
    const input  = document.getElementById('proc-container-tipo');
    const lista  = document.getElementById('proc-container-tipo-lista');
    const idOcul = document.getElementById('proc-container-tipo-id');
    if (!input || !lista || !idOcul) return;

    async function mostrar() {
        await _acCarregarContainers();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acContainers.filter(c =>
                (c.identificacao || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q) ||
                (c.descricao || '').toLowerCase().includes(q))
            : _acContainers;

        lista.innerHTML = filtrados.length
            ? filtrados.slice(0, 40).map(c => `
                <div class="autocomplete-item" data-id="${c.id}" data-nome="${(c.identificacao || '').replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${c.identificacao || ''}</span>
                    <span class="ac-fantasia">${c.tipo || ''} ${c.descricao ? '— ' + c.descricao : ''}</span>
                </div>`).join('')
            : '<div class="autocomplete-vazio">Nenhum resultado encontrado</div>';
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { idOcul.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        idOcul.value = item.getAttribute('data-id');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — ACONDICIONAMENTO
// ========================================

function iniciarAutocompleteAcondicionamento() {
    const input  = document.getElementById('proc-acondicionamento');
    const lista  = document.getElementById('proc-acondicionamento-lista');
    const idOcul = document.getElementById('proc-acondicionamento-id');
    if (!input || !lista || !idOcul) return;

    async function mostrar() {
        await _acCarregarContainers();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acContainers.filter(c =>
                (c.identificacao || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q) ||
                (c.descricao || '').toLowerCase().includes(q))
            : _acContainers;

        lista.innerHTML = filtrados.length
            ? filtrados.slice(0, 40).map(c => `
                <div class="autocomplete-item" data-id="${c.id}" data-nome="${(c.identificacao || '').replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${c.identificacao || ''}</span>
                    <span class="ac-fantasia">${c.tipo || ''} ${c.descricao ? '— ' + c.descricao : ''}</span>
                </div>`).join('')
            : '<div class="autocomplete-vazio">Nenhum resultado encontrado</div>';
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { idOcul.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        idOcul.value = item.getAttribute('data-id');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// ETAPAS DO PROCESSO
// ========================================

const ETAPAS_PADRAO = {
    exportacao_direta: [
        'Pedido Confirmado',
        'Licença de Exportação (LE)',
        'Registro da DUE',
        'Booking / Reserva',
        'Embarque Confirmado',
        'BL / AWB / CTR Emitido',
        'Chegada no Destino',
        'Desembaraço no Destino',
        'Entrega ao Importador',
    ],
    exportacao_indireta: [
        'Pedido Confirmado',
        'Nota Fiscal de Exportação Emitida',
        'Entrega à Trading / Comercial Exportadora',
        'Licença de Exportação (LE)',
        'Registro da DUE',
        'Booking / Reserva',
        'Embarque Confirmado',
        'BL / AWB / CTR Emitido',
        'Chegada no Destino',
        'Desembaraço no Destino',
    ],
};

let _etapas = [];

function _etapaId() {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function renderEtapas() {
    const lista = document.getElementById('etapas-lista');
    const info  = document.getElementById('etapas-info');
    if (!lista) return;

    if (info) info.textContent = `${_etapas.length} etapa${_etapas.length !== 1 ? 's' : ''}`;

    lista.innerHTML = _etapas.map(e => `
        <div class="etapa-row ${e.concluida ? 'concluida' : ''}" data-id="${e.id}">
            <div class="etapa-col-check">
                <input type="checkbox" class="etapa-check" ${e.concluida ? 'checked' : ''}>
            </div>
            <input type="text" class="etapa-nome" value="${(e.nome || '').replace(/"/g, '&quot;')}" placeholder="Nome da etapa">
            <input type="date" class="etapa-data" value="${e.data || ''}">
            <input type="text" class="etapa-resp" value="${(e.responsavel || '').replace(/"/g, '&quot;')}" placeholder="Responsável">
            <button type="button" class="btn-remover-etapa" title="Remover">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`).join('');

    lista.querySelectorAll('.etapa-check').forEach(chk => {
        chk.addEventListener('change', () => {
            const row = chk.closest('.etapa-row');
            const id  = row.getAttribute('data-id');
            const et  = _etapas.find(e => e.id === id);
            if (et) { et.concluida = chk.checked; row.classList.toggle('concluida', chk.checked); }
        });
    });
    lista.querySelectorAll('.etapa-nome').forEach(inp => {
        inp.addEventListener('input', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.nome = inp.value;
        });
    });
    lista.querySelectorAll('.etapa-data').forEach(inp => {
        inp.addEventListener('change', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.data = inp.value;
        });
    });
    lista.querySelectorAll('.etapa-resp').forEach(inp => {
        inp.addEventListener('input', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.responsavel = inp.value;
        });
    });
    lista.querySelectorAll('.btn-remover-etapa').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.etapa-row').getAttribute('data-id');
            _etapas = _etapas.filter(e => e.id !== id);
            renderEtapas();
        });
    });
}

function carregarEtapasPadrao(tipo) {
    const padrao = ETAPAS_PADRAO[tipo];
    if (!padrao) return;
    const substituiu = _etapas.length > 0;
    _etapas = padrao.map(nome => ({ id: _etapaId(), nome, data: '', responsavel: '', concluida: false }));
    renderEtapas();
    const tipoEl = document.getElementById('proc-tipo');
    const tipoNome = tipoEl?.options[tipoEl.selectedIndex]?.text || tipo;
    if (substituiu) {
        mostrarNotificacao(`Etapas atualizadas para o tipo "${tipoNome}".`, 'info');
    }
}

function atualizarResumoEtapas() {
    const empresa   = document.getElementById('proc-cliente')?.value.trim()         || '—';
    const tipoEl    = document.getElementById('proc-tipo');
    const tipo      = tipoEl?.options[tipoEl.selectedIndex]?.text                   || '—';
    const origem    = document.getElementById('proc-origem-pais')?.value.trim()     || '—';
    const destino   = document.getElementById('proc-destino-pais')?.value.trim()    || '—';
    const statusEl  = document.getElementById('proc-status');
    const status    = statusEl?.options[statusEl.selectedIndex]?.text               || '—';
    const abertura  = document.getElementById('proc-data-abertura')?.value          || '';
    const container = document.getElementById('proc-container-tipo')?.value.trim()  || '—';
    const numCont   = document.getElementById('proc-container-num')?.value.trim()   || '';

    const aberturaFmt  = abertura ? new Date(abertura + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const containerFmt = container !== '—' ? container + (numCont ? ` Nº ${numCont}` : '') : '—';

    document.getElementById('resumo-et-empresa')?.   setAttribute('data-txt', empresa);
    document.getElementById('resumo-et-tipo')?.      setAttribute('data-txt', tipo === 'Selecione...' ? '—' : tipo);
    document.getElementById('resumo-et-origem')?.    setAttribute('data-txt', origem);
    document.getElementById('resumo-et-destino')?.   setAttribute('data-txt', destino);
    document.getElementById('resumo-et-status')?.    setAttribute('data-txt', status === 'Selecione...' ? '—' : status);
    document.getElementById('resumo-et-abertura')?.  setAttribute('data-txt', aberturaFmt);
    document.getElementById('resumo-et-container')?.setAttribute('data-txt', containerFmt);

    ['resumo-et-empresa','resumo-et-tipo','resumo-et-origem','resumo-et-destino',
     'resumo-et-status','resumo-et-abertura','resumo-et-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = el.getAttribute('data-txt') || '—';
    });
}

function iniciarEtapas() {
    ['proc-cliente','proc-origem-pais','proc-destino-pais','proc-container-tipo','proc-container-num'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', atualizarResumoEtapas);
    });
    ['proc-tipo','proc-status','proc-data-abertura'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', atualizarResumoEtapas);
    });
    document.getElementById('proc-cliente-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    document.getElementById('proc-origem-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    document.getElementById('proc-destino-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    atualizarResumoEtapas();

    document.getElementById('btn-add-etapa')?.addEventListener('click', () => {
        _etapas.push({ id: _etapaId(), nome: '', data: '', responsavel: '', concluida: false });
        renderEtapas();
        const rows = document.querySelectorAll('.etapa-row');
        rows[rows.length - 1]?.querySelector('.etapa-nome')?.focus();
    });

    document.getElementById('proc-tipo')?.addEventListener('change', function () {
        if (this.value) carregarEtapasPadrao(this.value);
    });

    renderEtapas();
}

// ========================================
// CAMPOS DE STATUS
// ========================================

function iniciarCamposStatus() {
    const select = document.getElementById('proc-status');
    if (!select) return;

    function atualizar() {
        const status = select.value;
        document.querySelectorAll('#tab-processo [data-show-for]').forEach(el => {
            const permitidos = el.getAttribute('data-show-for').split(',');
            el.style.display = (status && permitidos.includes(status)) ? '' : 'none';
        });
    }

    select.addEventListener('change', atualizar);
    atualizar();
}

// ========================================
// EMISSOR
// ========================================

function iniciarEmissor() {
    const radios      = document.querySelectorAll('input[name="proc-emissor-tipo"]');
    const grupoEmp    = document.getElementById('proc-emissor-empresa-group');
    const docInput    = document.getElementById('proc-documento');
    const origemPais  = document.getElementById('proc-origem-pais');

    function atualizar() {
        const val = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;

        document.querySelectorAll('.emissor-opcao').forEach(l => l.classList.remove('ativo'));
        document.querySelector('input[name="proc-emissor-tipo"]:checked')
            ?.closest('.emissor-opcao')?.classList.add('ativo');

        const tipoDocSelect = document.getElementById('proc-documento-tipo');

        if (val === 'usuario') {
            if (grupoEmp) grupoEmp.style.display = 'none';
            if (tipoDocSelect) tipoDocSelect.style.display = '';
            if (docInput) {
                docInput.readOnly    = false;
                docInput.placeholder = 'Informe o CNPJ / CPF';
                const userDoc = window._usuarioLogado?.documento || '';
                if (!docInput.value) docInput.value = userDoc;
            }
            if (origemPais) {
                origemPais.readOnly    = false;
                origemPais.placeholder = 'Selecione o país de origem';
            }
        } else {
            if (grupoEmp) grupoEmp.style.display = '';
            if (tipoDocSelect) tipoDocSelect.style.display = 'none';
            if (docInput) {
                docInput.readOnly    = true;
                docInput.placeholder = 'Preenchido automaticamente';
                docInput.value       = '';
            }
            if (origemPais) {
                origemPais.readOnly    = true;
                origemPais.placeholder = 'Preenchido automaticamente';
            }
        }

        atualizarResumoProcesso();
    }

    radios.forEach(r => r.addEventListener('change', atualizar));
    atualizar();
}

// ========================================
// CAMPOS EXTRAS POR MODAL
// ========================================

function iniciarCamposModal() {
    const select = document.getElementById('proc-modal');
    if (!select) return;

    const grupos = {
        maritimo:  ['proc-navio-group', 'proc-porto-origem-group', 'proc-porto-destino-group'],
        aereo:     ['proc-aeronave-group', 'proc-aeroporto-origem-group', 'proc-aeroporto-destino-group'],
        terrestre: ['proc-fronteira-saida-group', 'proc-fronteira-entrada-group'],
    };

    const todosGrupos = [
        'proc-navio-group', 'proc-porto-origem-group', 'proc-porto-destino-group',
        'proc-aeronave-group', 'proc-aeroporto-origem-group', 'proc-aeroporto-destino-group',
        'proc-fronteira-saida-group', 'proc-fronteira-entrada-group',
    ];

    function atualizar() {
        todosGrupos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const ids = grupos[select.value] || [];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });

        // Campos de documentos por modal
        document.querySelectorAll('.doc-modal-field').forEach(el => {
            el.style.display = el.dataset.docModal === select.value ? '' : 'none';
        });

        // Limpa intermediários ao trocar modal
        limparIntermediarios();
    }

    select.addEventListener('change', atualizar);
    atualizar();
}

// ========================================
// ROTA INTERMEDIÁRIA
// ========================================

let _intermediarios = [];

const _INTERMEDIARIO_CONFIG = {
    porto:      { label: 'Porto Intermediário',              placeholder: 'Ex: Algeciras, Singapura...' },
    aeroporto:  { label: 'Aeroporto Intermediário',          placeholder: 'Ex: LIS, DXB...' },
    fronteira:  { label: 'Aduana / Fronteira Intermediária', placeholder: 'Ex: Encarnación...' },
};

function adicionarIntermediario(tipo) {
    const cfg     = _INTERMEDIARIO_CONFIG[tipo];
    if (!cfg) return;
    const id      = 'inter-' + tipo + '-' + Date.now();
    _intermediarios.push({ id, tipo });
    _renderIntermediarios();
}

function _renderIntermediarios() {
    const wrapper = document.getElementById('rota-intermediarios');
    const lista   = document.getElementById('rota-intermediarios-lista');
    if (!wrapper || !lista) return;

    if (_intermediarios.length === 0) {
        wrapper.style.display = 'none';
        lista.innerHTML = '';
        return;
    }

    wrapper.style.display = '';
    lista.innerHTML = _intermediarios.map((item, idx) => {
        const cfg = _INTERMEDIARIO_CONFIG[item.tipo];
        return `
        <div class="rota-intermediario-item" data-id="${item.id}">
            <div class="rota-intermediario-header">
                <span class="rota-inter-label"><i class="fa-solid fa-arrow-right-arrow-left"></i> ${cfg.label} ${_intermediarios.filter(i => i.tipo === item.tipo).indexOf(item) + 1}</span>
                <button type="button" class="rota-inter-remove" onclick="removerIntermediario('${item.id}')" title="Remover">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <input type="text" name="${item.tipo}_intermediario_${idx}" placeholder="${cfg.placeholder}" class="rota-inter-input">
        </div>`;
    }).join('');
}

function removerIntermediario(id) {
    _intermediarios = _intermediarios.filter(i => i.id !== id);
    _renderIntermediarios();
}

function limparIntermediarios() {
    _intermediarios = [];
    _renderIntermediarios();
}

function atualizarResumoProcesso() {
    const fn = window._atualizarResumoProcessoFn;
    if (fn) fn();
}

// ========================================
// RESUMO DO PROCESSO (linha superior)
// ========================================

function iniciarResumoProcesso() {
    function atualizar() {
        const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;
        let empresa;
        if (emissorTipo === 'usuario') {
            empresa = window._usuarioLogado?.nome || 'Usuário';
        } else {
            empresa = document.getElementById('proc-cliente')?.value.trim() || '—';
        }

        const tipoEl      = document.getElementById('proc-tipo');
        const tipo        = tipoEl?.options[tipoEl.selectedIndex]?.text                || '—';
        const origem      = document.getElementById('proc-origem-pais')?.value.trim()  || '—';
        const destino     = document.getElementById('proc-destino-pais')?.value.trim() || '—';
        const incoterm    = document.getElementById('proc-incoterm')?.value            || '—';
        const modalEl     = document.getElementById('proc-modal');
        const modal       = modalEl?.options[modalEl.selectedIndex]?.text              || '—';
        const statusEl    = document.getElementById('proc-status');
        const status      = statusEl?.options[statusEl.selectedIndex]?.text            || '—';
        const empDestBusca= document.getElementById('proc-emp-dest-busca')?.value.trim();
        const empDestRazao= document.getElementById('proc-emp-dest-razao')?.value.trim();
        const empDestino  = empDestBusca || empDestRazao || '—';

        document.getElementById('resumo-empresa')     && (document.getElementById('resumo-empresa').textContent     = empresa);
        document.getElementById('resumo-tipo')        && (document.getElementById('resumo-tipo').textContent        = tipo === 'Selecione...' ? '—' : tipo);
        document.getElementById('resumo-emp-destino') && (document.getElementById('resumo-emp-destino').textContent = empDestino);
        document.getElementById('resumo-origem')      && (document.getElementById('resumo-origem').textContent      = origem);
        document.getElementById('resumo-destino')     && (document.getElementById('resumo-destino').textContent     = destino);
        document.getElementById('resumo-incoterm')    && (document.getElementById('resumo-incoterm').textContent    = incoterm === '' ? '—' : incoterm);
        document.getElementById('resumo-modal')       && (document.getElementById('resumo-modal').textContent       = modal === 'Selecione...' ? '—' : modal);
        document.getElementById('resumo-status')      && (document.getElementById('resumo-status').textContent      = status === 'Selecione...' ? '—' : status);
    }

    window._atualizarResumoProcessoFn = atualizar;

    document.querySelectorAll('input[name="proc-emissor-tipo"]').forEach(r => r.addEventListener('change', atualizar));
    document.getElementById('proc-cliente')?.addEventListener('input', atualizar);
    document.getElementById('proc-tipo')?.addEventListener('change', atualizar);
    document.getElementById('proc-origem-pais')?.addEventListener('input', atualizar);
    document.getElementById('proc-destino-pais')?.addEventListener('input', atualizar);
    document.getElementById('proc-incoterm')?.addEventListener('change', atualizar);
    document.getElementById('proc-modal')?.addEventListener('change', atualizar);
    document.getElementById('proc-status')?.addEventListener('change', atualizar);
    document.getElementById('proc-emp-dest-busca')?.addEventListener('input', atualizar);
    document.getElementById('proc-emp-dest-razao')?.addEventListener('input', atualizar);
    document.getElementById('proc-emp-dest-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-cliente-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-origem-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-destino-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
}

// ========================================
// AUTOCOMPLETE — CLIENTE/EMPRESA (PROCESSO)
// ========================================

function iniciarAutocompleteProcCliente() {
    const input    = document.getElementById('proc-cliente');
    const lista    = document.getElementById('proc-cliente-lista');
    const idOculto = document.getElementById('proc-cliente-id');
    if (!input || !lista || !idOculto) return;

    input.addEventListener('focus', async () => {
        await _acCarregarEmpresas();
        _acMostrar(input, lista, input.value);
    });

    input.addEventListener('input', () => {
        idOculto.value = '';
        _acMostrar(input, lista, input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        const empresa = _acEmpresas.find(x => x.id === item.getAttribute('data-id'));
        input.value    = item.getAttribute('data-nome');
        idOculto.value = item.getAttribute('data-id');

        if (empresa) {
            const origemPais = document.getElementById('proc-origem-pais');
            const documento  = document.getElementById('proc-documento');
            const chkPais    = document.getElementById('proc-origem-pais-editar');

            if (origemPais) { origemPais.value = empresa.pais || ''; origemPais.readOnly = true; }
            if (documento)    documento.value   = empresa.documento || '';
            if (chkPais)      chkPais.checked   = false;
        }

        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// DOCUMENTOS DO PROCESSO
// ========================================

const DOCS_POR_MODAL = {
    maritimo: [
        'BL (Bill of Lading)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'Certificado Fitossanitário',
        'Apólice de Seguro',
    ],
    aereo: [
        'AWB (Air Waybill)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'Certificado Fitossanitário',
        'Apólice de Seguro',
    ],
    terrestre: [
        'CTR (Conhecimento de Transporte Rodoviário)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'CIOT',
    ],
};

let _docs = [];

function iniciarDocs() {
    // Atualiza resumo incoterm|modal na seção de documentos
    function atualizarResumo() {
        const incoterm = document.getElementById('proc-incoterm')?.value || '—';
        const modalEl  = document.getElementById('proc-modal');
        const modal    = modalEl?.options[modalEl.selectedIndex]?.text || '—';
        const el = document.getElementById('resumo-docs');
        if (el) el.textContent = `${incoterm === '' ? '—' : incoterm}  |  ${modal === 'Selecione...' ? '—' : modal}`;
    }

    document.getElementById('proc-incoterm')?.addEventListener('change', atualizarResumo);
    document.getElementById('proc-modal')?.addEventListener('change', atualizarResumo);
    atualizarResumo();
}

// ========================================
// EMPRESA DE DESTINO
// ========================================

function toggleEmpresaDestino(modo) {
    const buscaGroup   = document.getElementById('emp-dest-busca-group');
    const razaoGroup   = document.getElementById('emp-dest-razao-group');
    const fantasiaGroup= document.getElementById('emp-dest-fantasia-group');
    const docGroup     = document.getElementById('emp-dest-doc-group');
    const btnCad       = document.getElementById('btn-emp-dest-cadastrada');
    const btnMan       = document.getElementById('btn-emp-dest-manual');

    const manual = modo === 'manual';
    buscaGroup.style.display    = manual ? 'none' : '';
    razaoGroup.style.display    = manual ? '' : 'none';
    fantasiaGroup.style.display = manual ? '' : 'none';
    docGroup.style.display      = manual ? '' : 'none';
    btnCad.classList.toggle('ativo', !manual);
    btnMan.classList.toggle('ativo',  manual);

    if (!manual) {
        document.getElementById('proc-emp-dest-razao').value    = '';
        document.getElementById('proc-emp-dest-fantasia').value = '';
        document.getElementById('proc-emp-dest-doc').value      = '';
    } else {
        document.getElementById('proc-emp-dest-busca').value = '';
        document.getElementById('proc-emp-dest-id').value    = '';
        // limpa campos automáticos ao trocar para manual
        ['proc-emp-dest-auto-doc','proc-emp-dest-auto-id'].forEach(id => {
            const el = document.getElementById(id); if (el) el.value = '';
        });
        ['emp-dest-auto-doc-group','emp-dest-auto-id-group'].forEach(id => {
            const el = document.getElementById(id); if (el) el.style.display = 'none';
        });
    }
}

function iniciarAutocompleteEmpresaDestino() {
    const input  = document.getElementById('proc-emp-dest-busca');
    const lista  = document.getElementById('proc-emp-dest-lista');
    const idInput= document.getElementById('proc-emp-dest-id');
    if (!input || !lista) return;

    async function renderLista(termo) {
        await _acCarregarEmpresas();
        const q = (termo || '').trim().toLowerCase();
        const filtradas = q
            ? _acEmpresas.filter(e =>
                (e.nome_empresa  || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento     || '').includes(q))
            : _acEmpresas;

        if (filtradas.length === 0) {
            lista.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        } else {
            lista.innerHTML = filtradas.slice(0, 30).map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-razao="${(e.nome_empresa  || '').replace(/"/g,'&quot;')}"
                     data-fantasia="${(e.nome_fantasia || '').replace(/"/g,'&quot;')}"
                     data-doc="${e.documento || ''}"
                     data-idint="${(e.identificacao_empresa || '').replace(/"/g,'&quot;')}">
                    <span class="ac-nome">${e.nome_empresa || ''}</span>
                    ${e.nome_fantasia ? `<span class="ac-fantasia">${e.nome_fantasia}</span>` : ''}
                </div>`).join('');
        }
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    function validarDocDestino(docDestino) {
        const docOrigem = (document.getElementById('proc-documento')?.value || '').replace(/\D/g, '');
        const docDest   = (docDestino || '').replace(/\D/g, '');
        const avisoEl   = document.getElementById('emp-dest-aviso-mesmo-cnpj');
        if (!avisoEl) return false;
        const igual = docDest && docOrigem && docDest === docOrigem;
        avisoEl.style.display = igual ? '' : 'none';
        return igual;
    }

    function preencherCamposAuto(item) {
        const doc   = item.dataset.doc   || '';
        const idInt = item.dataset.idint || '';

        const docEl   = document.getElementById('proc-emp-dest-auto-doc');
        const idEl    = document.getElementById('proc-emp-dest-auto-id');
        const docGrp  = document.getElementById('emp-dest-auto-doc-group');
        const idGrp   = document.getElementById('emp-dest-auto-id-group');

        if (docEl && docGrp) {
            docEl.value = doc;
            docGrp.style.display = doc ? '' : 'none';
        }
        if (idEl && idGrp) {
            idEl.value = idInt;
            idGrp.style.display = idInt ? '' : 'none';
        }

        if (validarDocDestino(doc)) {
            input.value = '';
            if (idInput) idInput.value = '';
            if (docEl) docEl.value = '';
            if (docGrp) docGrp.style.display = 'none';
            if (idEl) idEl.value = '';
            if (idGrp) idGrp.style.display = 'none';
        }
    }

    function limparCamposAuto() {
        ['proc-emp-dest-auto-doc', 'proc-emp-dest-auto-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        ['emp-dest-auto-doc-group', 'emp-dest-auto-id-group'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    input.addEventListener('input', () => { renderLista(input.value); limparCamposAuto(); });
    input.addEventListener('focus', () => renderLista(input.value));

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.razao;
        if (idInput) idInput.value = item.dataset.id || '';
        lista.classList.remove('aberta');
        preencherCamposAuto(item);
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });

    input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('aberta'), 150));

    // Máscara no campo manual
    const docInput  = document.getElementById('proc-emp-dest-doc');
    const docTipo   = document.getElementById('proc-emp-dest-doc-tipo');
    if (docInput && docTipo) {
        function mascararEmpDest(valor, tipo) {
            valor = valor.replace(/\D/g, '');
            if (tipo === 'cpf') {
                valor = valor.slice(0,11);
                valor = valor.replace(/^(\d{3})(\d)/,'$1.$2');
                valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3');
                valor = valor.replace(/\.(\d{3})(\d)/,'.$1-$2');
            } else {
                valor = valor.slice(0,14);
                valor = valor.replace(/^(\d{2})(\d)/,'$1.$2');
                valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
                valor = valor.replace(/\.(\d{3})(\d)/,'.$1/$2');
                valor = valor.replace(/(\d{4})(\d)/,'$1-$2');
            }
            return valor;
        }
        docTipo.addEventListener('change', () => {
            docInput.value = '';
            docInput.placeholder = docTipo.value === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00';
            docInput.maxLength   = docTipo.value === 'cpf' ? 14 : 18;
        });
        docInput.addEventListener('input', () => {
            docInput.value = mascararEmpDest(docInput.value, docTipo.value);
            validarDocDestino(docInput.value);
        });
    }
}

// ========================================
// DESTINO — PAÍS + CEP AUTOMÁTICO
// ========================================

function iniciarAutocompleteDestinoPais() {
    const input  = document.getElementById('proc-destino-pais');
    const lista  = document.getElementById('proc-destino-pais-lista');
    const codigo = document.getElementById('proc-destino-pais-codigo');
    if (!input || !lista) return;

    const BRASIL_VALS = ['brasil', 'brazil', 'br'];

    function isBrasil() {
        return BRASIL_VALS.includes(input.value.trim().toLowerCase());
    }

    function atualizarCEP() {
        const cepGroup = document.getElementById('destino-cep-group');
        if (!cepGroup) return;
        const br = isBrasil();
        cepGroup.style.display = br ? '' : 'none';
        if (!br) {
            const cepEl = document.getElementById('proc-destino-cep');
            if (cepEl) { cepEl.value = ''; cepEl.style.borderColor = ''; }
            _destinoCepMsg('');
        }
    }

    async function renderLista(termo) {
        await _acCarregarPaises();
        const q = (termo || '').trim().toLowerCase();
        const filtradas = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q))
            : _acPaises;
        if (filtradas.length === 0) {
            lista.innerHTML = '<div class="autocomplete-vazio">Nenhum país encontrado</div>';
        } else {
            lista.innerHTML = filtradas.slice(0, 30).map(p => `
                <div class="autocomplete-item" data-nome="${p.descricao}" data-codigo="${p.codigo || ''}">
                    <span class="ac-nome">${p.descricao}</span>
                </div>`).join('');
        }
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('input', () => renderLista(input.value));
    input.addEventListener('focus', () => { if (input.value.length >= 0) renderLista(input.value); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.nome;
        if (codigo) codigo.value = item.dataset.codigo || '';
        lista.classList.remove('aberta');
        atualizarCEP();
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });

    input.addEventListener('change', atualizarCEP);
    input.addEventListener('blur', () => {
        setTimeout(() => lista.classList.remove('aberta'), 150);
        atualizarCEP();
    });
}

function _destinoCepMsg(msg, cor) {
    let small = document.getElementById('destino-cep-msg');
    if (!small) {
        small = document.createElement('small');
        small.id = 'destino-cep-msg';
        small.style.cssText = 'display:block; margin-top:4px; font-size:12px;';
        document.getElementById('proc-destino-cep')?.parentElement?.appendChild(small);
    }
    small.innerHTML   = msg;
    small.style.color = cor || '#64748b';
}

function iniciarCEPDestino() {
    const cepInput = document.getElementById('proc-destino-cep');
    if (!cepInput) return;

    cepInput.maxLength   = 9;
    cepInput.placeholder = '00000-000';

    cepInput.addEventListener('input', () => {
        let v = cepInput.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
        cepInput.value = v;
        _destinoCepMsg('');
        cepInput.style.borderColor = '';
    });

    cepInput.addEventListener('blur', async () => {
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            if (cep.length > 0) _destinoCepMsg('<i class="fa-solid fa-triangle-exclamation"></i> CEP deve conter 8 dígitos.', '#f59e0b');
            return;
        }

        _destinoCepMsg('<i class="fa-solid fa-spinner fa-spin"></i> Buscando endereço...', '#4776ec');
        cepInput.style.borderColor = '#4776ec';
        cepInput.disabled = true;

        try {
            const res   = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();

            if (dados.erro) {
                _destinoCepMsg('<i class="fa-solid fa-circle-xmark"></i> CEP não encontrado.', '#dc2626');
                cepInput.style.borderColor = '#dc2626';
            } else {
                const map = {
                    'proc-destino-estado':      dados.uf          || '',
                    'proc-destino-cidade':      dados.localidade  || '',
                    'proc-destino-bairro':      dados.bairro      || '',
                    'proc-destino-endereco':    dados.logradouro  || '',
                    'proc-destino-complemento': dados.complemento || '',
                };
                Object.entries(map).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el && !el.value) el.value = val;
                });
                cepInput.style.borderColor = '#22C55E';
                _destinoCepMsg('<i class="fa-solid fa-circle-check"></i> Endereço preenchido automaticamente.', '#16a34a');
            }
        } catch {
            _destinoCepMsg('<i class="fa-solid fa-circle-xmark"></i> Erro ao buscar CEP. Verifique sua conexão.', '#dc2626');
            cepInput.style.borderColor = '#dc2626';
        } finally {
            cepInput.disabled = false;
        }
    });
}

// ========================================
// DOCUMENTOS — UPLOAD / VER / EXCLUIR
// ========================================

function docUpload(id) {
    const fileInput = document.getElementById('doc-file-' + id);
    if (!fileInput) return;
    fileInput.click();
    fileInput.onchange = () => {
        const file = fileInput.files[0];
        if (!file) return;
        const span = document.getElementById('doc-filename-' + id);
        if (span) {
            span.innerHTML = `<i class="fa-solid fa-paperclip"></i> ${file.name}`;
            span.classList.add('doc-filename-ativo');
        }
        const btnVer = fileInput.closest('.doc-campo')?.querySelector('.doc-btn-ver');
        const btnDel = fileInput.closest('.doc-campo')?.querySelector('.doc-btn-del');
        if (btnVer) btnVer.classList.add('ativo');
        if (btnDel) btnDel.classList.add('ativo');
    };
}

function docVer(id) {
    const fileInput = document.getElementById('doc-file-' + id);
    if (!fileInput || !fileInput.files[0]) return;
    const url = URL.createObjectURL(fileInput.files[0]);
    window.open(url, '_blank');
}

function docExcluir(id) {
    const fileInput = document.getElementById('doc-file-' + id);
    if (fileInput) fileInput.value = '';
    const span = document.getElementById('doc-filename-' + id);
    if (span) { span.innerHTML = ''; span.classList.remove('doc-filename-ativo'); }
    const campo = fileInput?.closest('.doc-campo');
    campo?.querySelector('.doc-btn-ver')?.classList.remove('ativo');
    campo?.querySelector('.doc-btn-del')?.classList.remove('ativo');
}

// ========================================
// INCOTERM → MODAL AUTOMÁTICO
// ========================================

const INCOTERMS_MARITIMOS = ['FAS', 'FOB', 'CFR', 'CIF'];

function iniciarIncotermModal() {
    const incotermSelect  = document.getElementById('proc-incoterm');
    const modalSelect     = document.getElementById('proc-modal');
    if (!incotermSelect || !modalSelect) return;

    const infoEl      = document.getElementById('incoterm-info');
    const optMaritimo = modalSelect.querySelector('option[value="maritimo"]');
    let   _avisoMaritimoJaMostrado = false;

    // Modal bloqueado até o usuário escolher um incoterm
    modalSelect.disabled = true;
    modalSelect.title    = 'Selecione um Incoterm primeiro';

    incotermSelect.addEventListener('change', function () {
        // Sem incoterm → reseta tudo
        if (!this.value) {
            modalSelect.disabled           = true;
            modalSelect.value              = '';
            modalSelect.title              = 'Selecione um Incoterm primeiro';
            _avisoMaritimoJaMostrado       = false;
            if (optMaritimo) optMaritimo.disabled = false;
            modalSelect.dispatchEvent(new Event('change'));
            if (infoEl) { infoEl.classList.remove('visivel', 'incoterm-aviso-maritimo'); infoEl.innerHTML = ''; }
            return;
        }

        const descricao = INCOTERMS_INFO[this.value] || '';

        if (INCOTERMS_MARITIMOS.includes(this.value)) {
            // FAS / FOB / CFR / CIF → força Marítimo e bloqueia o select inteiro
            if (optMaritimo) optMaritimo.disabled = false;
            modalSelect.value    = 'maritimo';
            modalSelect.disabled = true;
            modalSelect.title    = 'Modal fixo em Marítimo para o Incoterm ' + this.value;
            modalSelect.dispatchEvent(new Event('change'));

            if (infoEl) {
                const aviso = !_avisoMaritimoJaMostrado
                    ? `<div class="aviso-maritimo-linha"><i class="fa-solid fa-triangle-exclamation"></i> Os Incoterms <strong>FAS, FOB, CFR e CIF</strong> são exclusivos para o modal <strong>Marítimo</strong>.</div>`
                    : '';
                infoEl.innerHTML = aviso + `<strong>${this.value}</strong> — ${descricao}`;
                infoEl.classList.add('visivel', 'incoterm-aviso-maritimo');
                _avisoMaritimoJaMostrado = true;
            }
        } else {
            // Qualquer outro incoterm → todos os modais disponíveis
            if (optMaritimo) optMaritimo.disabled = false;
            modalSelect.disabled = false;
            modalSelect.title    = '';

            if (infoEl) {
                infoEl.classList.remove('incoterm-aviso-maritimo');
                if (descricao) {
                    infoEl.innerHTML = `<strong>${this.value}</strong> — ${descricao}`;
                    infoEl.classList.add('visivel');
                } else {
                    infoEl.classList.remove('visivel');
                    infoEl.innerHTML = '';
                }
            }
        }
    });
}

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.form-section.active .section-content').forEach(c => {
        c.style.display = 'block';
    });

    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && document.getElementById('tab-' + tab)) {
        mudarTab(tab);
    }

    // Empresa
    aplicarMascaraDocumento();
    iniciarAutocompletePaisEmpresa();
    iniciarPaisEmpresa();
    iniciarMascaraCEP();
    empIniciarTags();
    empContatoIniciar();
    _carregarMoedas().then(moedas => {
        const sel = document.getElementById('fin-rec-moeda');
        if (!sel) return;
        moedas.forEach(m => {
            const o = document.createElement('option');
            o.value = m.codigo;
            o.textContent = m.descricao || m.codigo;
            sel.appendChild(o);
        });
    });

    // Processo
    aplicarMascaraDocumentoProcesso();
    iniciarEmissor();
    iniciarCamposModal();
    iniciarEtapas();
    iniciarCamposStatus();
    iniciarAutocompleteProcCliente();
    iniciarAutocompletePaisOrigem();
    iniciarAutocompletePaisDestino();
    iniciarAutocompleteContainer();
    iniciarAutocompleteAcondicionamento();
    iniciarResumoProcesso();
    iniciarDocs();
    iniciarIncotermModal();
    iniciarAutocompleteEmpresaDestino();
    iniciarAutocompleteAeroportos();
    iniciarAutocompletePortos();
    iniciarAutocompleteDestinoPais();
    iniciarCEPDestino();
    iniciarMascarasTransporte();
    _carregarMoedas();
    _carregarUnidades();
    carregarMoedasTransporte();
    iniciarTransportadoraPropria();

    // Proposta
    propGerarCodigo();
    const _propDataCriacao = document.getElementById('prop-data-emissao');
    if (_propDataCriacao) _propDataCriacao.value = new Date().toISOString().slice(0, 10);
    iniciarResumoProposta();
    iniciarEmissorProposta();
    iniciarModalIncotermProposta();
    iniciarMascaraDocumentoProposta();
    iniciarValidadeProposta();
    iniciarAutocompletePaisOrigemProposta();
    iniciarAutocompletePaisDestinoProposta();
    iniciarAutocompletePropCliente();
    iniciarAutocompleteEmpresaDestinoProposta();
    iniciarAutocompleteAeroportos();
    iniciarAutocompletePortos();
    propIniciarItens();

    // Modal info
    document.getElementById('proc-modal')?.addEventListener('change', function () {
        const info = document.getElementById('modal-info');
        if (!info) return;
        const val = this.value;
        if (val && MODAL_INFO[val]) {
            const label = this.options[this.selectedIndex].text;
            info.innerHTML = `<strong>${label}</strong> — ${MODAL_INFO[val]}`;
            info.classList.add('visivel');
        } else {
            info.classList.remove('visivel');
        }
    });
});

// ========================================
// TRANSPORTADORA PRÓPRIA DO CLIENTE
// ========================================

function iniciarTransportadoraPropria() {
    const tipoSelect  = document.getElementById('transp-tipo');
    const nomeInput   = document.getElementById('transp-nome');
    const cnpjInput   = document.getElementById('transp-cnpj');
    const aviso       = _criarAvisoTransp();
    if (!tipoSelect || !nomeInput) return;

    tipoSelect.addEventListener('change', async function () {
        if (this.value !== 'propria') { aviso.style.display = 'none'; return; }

        const usuario = obterUsuarioLogado();
        if (!usuario) return;

        try {
            const { data } = await supabaseClient
                .from('empresas_cadastradas')
                .select('id, nome_empresa, nome_fantasia, documento')
                .eq('empresa_proprietaria_id', usuario.empresa_id)
                .contains('tipos', ['transportadora']);

            if (!data?.length) {
                aviso.textContent = 'Nenhuma transportadora cadastrada encontrada.';
                aviso.style.display = 'block';
                return;
            }

            if (data.length === 1) {
                nomeInput.value = data[0].nome_empresa || data[0].nome_fantasia || '';
                if (cnpjInput) cnpjInput.value = data[0].documento || '';
                aviso.textContent = 'Transportadora preenchida automaticamente.';
                aviso.className = 'transp-aviso transp-aviso-ok';
                aviso.style.display = 'block';
                return;
            }

            // Mais de 1 → mostra dropdown de escolha
            aviso.style.display = 'none';
            _mostrarDropdownTransp(data, nomeInput, cnpjInput);
        } catch (_) {}
    });
}

function _criarAvisoTransp() {
    let el = document.getElementById('transp-aviso-propria');
    if (!el) {
        el = document.createElement('div');
        el.id        = 'transp-aviso-propria';
        el.className = 'transp-aviso';
        el.style.display = 'none';
        document.getElementById('transp-nome')?.closest('.form-grid')?.after(el);
    }
    return el;
}

function _mostrarDropdownTransp(lista, nomeInput, cnpjInput) {
    let dropdown = document.getElementById('transp-propria-dropdown');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id        = 'transp-propria-dropdown';
        dropdown.className = 'transp-propria-dropdown';
        nomeInput.closest('.form-grid')?.after(dropdown);
    }
    dropdown.innerHTML = '<p class="transp-dropdown-titulo">Selecione a transportadora:</p>';
    lista.forEach(t => {
        const item = document.createElement('div');
        item.className   = 'transp-dropdown-item';
        item.textContent = t.nome_empresa || t.nome_fantasia || '—';
        item.addEventListener('click', () => {
            nomeInput.value = t.nome_empresa || t.nome_fantasia || '';
            if (cnpjInput) cnpjInput.value = t.documento || '';
            dropdown.style.display = 'none';
        });
        dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
}

// ========================================
// MOEDAS — CACHE COMPARTILHADO
// ========================================

async function _carregarMoedas() {
    if (_acMoedas.length > 0) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao')
            .order('codigo', { ascending: true });
        _acMoedas = data || [];
    } catch { _acMoedas = []; }
}

// UNIDADES DE MEDIDA — CACHE COMPARTILHADO
// ========================================

async function _carregarUnidades() {
    if (_acUnidades.length > 0) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_unidades_medida')
            .select('unidade, descricao')
            .order('unidade', { ascending: true });
        _acUnidades = data || [];
    } catch { _acUnidades = []; }
}

// MOEDAS — TRANSPORTE
// ========================================

async function carregarMoedasTransporte() {
    const display  = document.getElementById('transp-frete-moeda-display');
    const hidden   = document.getElementById('transp-frete-moeda');
    const dropdown = document.getElementById('transp-frete-moeda-list');
    if (!display || !hidden || !dropdown) return;

    await _carregarMoedas();

    function mostrar(lista) {
        dropdown.innerHTML = '';
        if (!lista.length) { dropdown.style.display = 'none'; return; }
        lista.slice(0, 5).forEach(m => {
            const item = document.createElement('div');
            item.className   = 'autocomplete-item';
            item.textContent = m.descricao;
            item.addEventListener('mousedown', () => {
                display.value  = m.descricao;
                hidden.value   = m.descricao;
                dropdown.style.display = 'none';
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    }

    display.addEventListener('input', function () {
        hidden.value = '';
        const q = this.value.trim().toLowerCase();
        if (!q) { dropdown.style.display = 'none'; return; }
        mostrar(_acMoedas.filter(m =>
            m.descricao?.toLowerCase().includes(q) || m.codigo?.toLowerCase().includes(q)
        ));
    });

    display.addEventListener('blur', () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}

// ========================================
// PROPOSTA — RESUMO DA BARRA SUPERIOR
// ========================================

function iniciarResumoProposta() {
    function atualizar() {
        const emissorTipo = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value;
        let empresa;
        if (emissorTipo === 'usuario') {
            empresa = window._usuarioLogado?.nome || 'Usuário';
        } else {
            empresa = document.getElementById('prop-cliente')?.value.trim() || '—';
        }

        const tipoEl   = document.getElementById('prop-tipo');
        const tipo     = tipoEl?.options[tipoEl.selectedIndex]?.text                || '—';
        const origem   = document.getElementById('prop-origem-pais')?.value.trim()  || '—';
        const destino  = document.getElementById('prop-destino-pais')?.value.trim() || '—';
        const incoterm = document.getElementById('prop-incoterm')?.value            || '—';
        const modalEl  = document.getElementById('prop-modal');
        const modal    = modalEl?.options[modalEl.selectedIndex]?.text              || '—';
        const empDest  = document.getElementById('prop-emp-dest-busca')?.value.trim()
                      || document.getElementById('prop-emp-dest-razao')?.value.trim()
                      || '—';

        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('prop-resumo-tipo',        tipo === 'Selecione...' ? '—' : tipo);
        set('prop-resumo-empresa',     empresa);
        set('prop-resumo-emp-destino', empDest);
        set('prop-resumo-origem',      origem);
        set('prop-resumo-destino',     destino);
        set('prop-resumo-modal',       modal === 'Selecione...' ? '—' : modal);
        set('prop-resumo-incoterm',    incoterm === '' ? '—' : incoterm);
    }

    document.querySelectorAll('input[name="prop-emissor-tipo"]').forEach(r => r.addEventListener('change', atualizar));
    document.getElementById('prop-cliente')?.addEventListener('input', atualizar);
    document.getElementById('prop-tipo')?.addEventListener('change', atualizar);
    document.getElementById('prop-origem-pais')?.addEventListener('input', atualizar);
    document.getElementById('prop-destino-pais')?.addEventListener('input', atualizar);
    document.getElementById('prop-incoterm')?.addEventListener('change', atualizar);
    document.getElementById('prop-modal')?.addEventListener('change', atualizar);
    document.getElementById('prop-emp-dest-busca')?.addEventListener('input', atualizar);
    document.getElementById('prop-emp-dest-razao')?.addEventListener('input', atualizar);
    document.getElementById('prop-emp-dest-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('prop-cliente-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    atualizar();
}

// ========================================
// PROPOSTA — EMISSOR
// ========================================

function _mascaraDocBR(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 14);
    if (d.length <= 11) {
        if (d.length > 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
        if (d.length > 6) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
        if (d.length > 3) return d.slice(0,3) + '.' + d.slice(3);
        return d;
    } else {
        if (d.length > 12) return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8,12) + '-' + d.slice(12);
        if (d.length > 8)  return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5,8) + '/' + d.slice(8);
        if (d.length > 5)  return d.slice(0,2) + '.' + d.slice(2,5) + '.' + d.slice(5);
        if (d.length > 2)  return d.slice(0,2) + '.' + d.slice(2);
        return d;
    }
}

function _tipoDocBR(valor) {
    const d = valor.replace(/\D/g, '');
    return d.length <= 11 ? 'cpf' : 'cnpj';
}

function iniciarValidadeProposta() {
    const selectDias  = document.getElementById('prop-validade-dias');
    const inputData   = document.getElementById('prop-data-validade');
    if (!selectDias || !inputData) return;

    selectDias.addEventListener('change', function () {
        if (this.value === 'custom') {
            inputData.readOnly = false;
            inputData.value = '';
            inputData.focus();
            return;
        }
        inputData.readOnly = true;
        const dias = parseInt(this.value);
        if (!dias) { inputData.value = ''; return; }
        const data = new Date();
        data.setDate(data.getDate() + dias);
        inputData.value = data.toISOString().slice(0, 10);
    });
}

function iniciarMascaraDocumentoProposta() {
    const input      = document.getElementById('prop-documento');
    const tipoHidden = document.getElementById('prop-documento-tipo');
    if (!input) return;

    input.addEventListener('input', function () {
        if (this.readOnly) return;
        const masked = _mascaraDocBR(this.value);
        this.value = masked;
        if (tipoHidden) tipoHidden.value = _tipoDocBR(masked);
    });
}

// ========================================

function iniciarEmissorProposta() {
    const radios   = document.querySelectorAll('input[name="prop-emissor-tipo"]');
    const grupoEmp = document.getElementById('prop-emissor-empresa-group');
    const docInput = document.getElementById('prop-documento');

    function atualizar() {
        const val = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value;

        document.querySelectorAll('#tab-proposta .emissor-opcao').forEach(l => l.classList.remove('ativo'));
        document.querySelector('#tab-proposta input[name="prop-emissor-tipo"]:checked')
            ?.closest('.emissor-opcao')?.classList.add('ativo');

        const tipoHidden = document.getElementById('prop-documento-tipo');

        const usuarioEmpGrupo = document.getElementById('prop-usuario-empresa-group');
        const usuarioEmpInput = document.getElementById('prop-usuario-empresa');

        if (val === 'usuario') {
            if (usuarioEmpGrupo) usuarioEmpGrupo.style.display = '';
            if (usuarioEmpInput) usuarioEmpInput.value = window._usuarioLogado?.empresa || window._usuarioLogado?.nome_empresa || '';
            if (grupoEmp) grupoEmp.style.display = 'none';
            if (docInput) {
                docInput.readOnly = false;
                docInput.placeholder = 'Digite o número do documento';
                if (!docInput.value) {
                    const raw = window._usuarioLogado?.documento || '';
                    docInput.value = raw ? _mascaraDocBR(raw) : '';
                    if (tipoHidden && raw) tipoHidden.value = _tipoDocBR(raw);
                }
            }
            const rawPais = window._usuarioLogado?.pais || '';
            if (rawPais) _propPreencherPaisOrigem(rawPais);
        } else {
            if (usuarioEmpGrupo) usuarioEmpGrupo.style.display = 'none';
            if (grupoEmp) grupoEmp.style.display = '';
            if (docInput) {
                docInput.readOnly = true;
                docInput.placeholder = 'Preenchido automaticamente';
                docInput.value = '';
            }
            const paisInput = document.getElementById('prop-origem-pais');
            if (paisInput) paisInput.value = '';
        }

        iniciarResumoProposta && document.getElementById('prop-resumo-empresa') && (() => {
            const empresa = val === 'usuario'
                ? (window._usuarioLogado?.nome || 'Usuário')
                : (document.getElementById('prop-cliente')?.value.trim() || '—');
            document.getElementById('prop-resumo-empresa').textContent = empresa;
        })();
    }

    radios.forEach(r => r.addEventListener('change', atualizar));
    atualizar();
}

// ========================================
// PROPOSTA — MODAL → INCOTERM
// ========================================

function iniciarModalIncotermProposta() {
    const modalSelect    = document.getElementById('prop-modal');
    const incotermSelect = document.getElementById('prop-incoterm');
    if (!modalSelect || !incotermSelect) return;

    const infoEl = document.getElementById('prop-incoterm-info');

    const grupos = {
        maritimo:  ['prop-porto-origem-group',     'prop-porto-destino-group'],
        aereo:     ['prop-aeroporto-origem-group',  'prop-aeroporto-destino-group'],
        terrestre: ['prop-fronteira-saida-group',   'prop-fronteira-entrada-group'],
    };

    function ocultarGruposModal() {
        Object.values(grupos).flat().forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
    }

    function mostrarGruposModal(modal) {
        ocultarGruposModal();
        (grupos[modal] || []).forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });
    }

    function atualizarInfoIncoterm() {
        if (!infoEl) return;
        const val = incotermSelect.value;
        if (!val) {
            infoEl.style.display = 'none';
            infoEl.removeAttribute('data-tooltip');
            return;
        }
        const descricao = INCOTERMS_INFO[val] || '';
        const sufixo = INCOTERMS_MARITIMOS.includes(val) ? ' — Exclusivo Marítimo' : '';
        infoEl.setAttribute('data-tooltip', `${val}: ${descricao}${sufixo}`);
        infoEl.style.display = '';
    }

    modalSelect.addEventListener('change', function () {
        const modal = this.value;
        if (!modal) {
            incotermSelect.disabled = true;
            incotermSelect.value    = '';
            incotermSelect.title    = 'Selecione o modal primeiro';
            ocultarGruposModal();
            atualizarInfoIncoterm();
            return;
        }

        incotermSelect.disabled = false;
        incotermSelect.title    = '';

        const ehMaritimo = modal === 'maritimo';
        INCOTERMS_MARITIMOS.forEach(code => {
            const opt = incotermSelect.querySelector(`option[value="${code}"]`);
            if (opt) opt.disabled = !ehMaritimo;
        });

        if (!ehMaritimo && INCOTERMS_MARITIMOS.includes(incotermSelect.value)) {
            incotermSelect.value = '';
        }

        mostrarGruposModal(modal);
        atualizarInfoIncoterm();
    });

    incotermSelect.addEventListener('change', atualizarInfoIncoterm);
}

// ========================================
// PROPOSTA — EMPRESA DE DESTINO
// ========================================

function propToggleEmpresaDestino(modo) {
    const buscaGroup = document.getElementById('prop-emp-dest-busca-group');
    const msgEl      = document.getElementById('prop-emp-dest-redirect-msg');
    const btnCad     = document.getElementById('prop-btn-emp-dest-cadastrada');
    const btnMan     = document.getElementById('prop-btn-emp-dest-manual');

    if (buscaGroup) buscaGroup.style.display = '';
    if (msgEl)      msgEl.style.display      = 'none';
    if (btnCad)     btnCad.classList.add('ativo');
    if (btnMan)     btnMan.classList.remove('ativo');

    ['prop-emp-dest-busca', 'prop-emp-dest-id'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
    ['prop-emp-dest-auto-doc', 'prop-emp-dest-auto-id'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
    });
}

function propAbrirCadastroNovaEmpresa() {
    window.open('cadastros.html', '_blank');
    const buscaGroup = document.getElementById('prop-emp-dest-busca-group');
    const msgEl      = document.getElementById('prop-emp-dest-redirect-msg');
    const btnCad = document.getElementById('prop-btn-emp-dest-cadastrada');
    const btnMan = document.getElementById('prop-btn-emp-dest-manual');

    if (buscaGroup) buscaGroup.style.display = 'none';
    if (msgEl)      msgEl.style.display      = '';
    if (btnCad)     btnCad.classList.remove('ativo');
    if (btnMan)     btnMan.classList.add('ativo');
}

function iniciarAutocompleteEmpresaDestinoProposta() {
    const input  = document.getElementById('prop-emp-dest-busca');
    const lista  = document.getElementById('prop-emp-dest-lista');
    const idInput= document.getElementById('prop-emp-dest-id');
    if (!input || !lista) return;

    async function renderLista(termo) {
        await _acCarregarEmpresas();
        const q = (termo || '').trim().toLowerCase();
        const filtradas = q
            ? _acEmpresas.filter(e =>
                (e.nome_empresa  || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento     || '').includes(q))
            : _acEmpresas;

        lista.innerHTML = filtradas.length
            ? filtradas.slice(0, 30).map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-razao="${(e.nome_empresa  || '').replace(/"/g,'&quot;')}"
                     data-fantasia="${(e.nome_fantasia || '').replace(/"/g,'&quot;')}"
                     data-doc="${e.documento || ''}"
                     data-idint="${(e.identificacao_empresa || '').replace(/"/g,'&quot;')}">
                    <span class="ac-nome">${e.nome_empresa || ''}</span>
                    ${e.nome_fantasia ? `<span class="ac-fantasia">${e.nome_fantasia}</span>` : ''}
                </div>`).join('')
            : '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    function validarDocDestino(docDestino) {
        const docRemetente = (document.getElementById('prop-documento')?.value || '').replace(/\D/g, '');
        const docDest      = (docDestino || '').replace(/\D/g, '');
        const avisoEl      = document.getElementById('prop-emp-dest-aviso-mesmo-cnpj');
        if (!avisoEl) return false;
        const igual = docDest && docRemetente && docDest === docRemetente;
        avisoEl.style.display = igual ? '' : 'none';
        return igual;
    }

    function preencherCamposAuto(item) {
        const doc   = item.dataset.doc   || '';
        const idInt = item.dataset.idint || '';

        const docEl = document.getElementById('prop-emp-dest-auto-doc');
        const idEl  = document.getElementById('prop-emp-dest-auto-id');
        const idGrp = document.getElementById('prop-emp-dest-auto-id-group');

        if (validarDocDestino(doc)) {
            input.value = '';
            if (idInput) idInput.value = '';
            if (docEl)   docEl.value   = '';
            if (idEl)    idEl.value    = '';
            if (idGrp)   idGrp.style.display = 'none';
            return;
        }

        if (docEl) docEl.value = doc ? _mascaraDocBR(doc) : '';
        if (idEl && idGrp) { idEl.value = idInt; idGrp.style.display = idInt ? '' : 'none'; }
    }

    input.addEventListener('input', () => { validarDocDestino(''); renderLista(input.value); });
    input.addEventListener('focus', () => renderLista(input.value));

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.razao;
        if (idInput) idInput.value = item.dataset.id || '';
        lista.classList.remove('aberta');
        preencherCamposAuto(item);
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
    input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('aberta'), 150));
}

// ========================================
// PROPOSTA — CÓDIGO AUTO-GERADO
// ========================================

async function _propPreencherPaisOrigem(valorPais) {
    const paisInput = document.getElementById('prop-origem-pais');
    const paisCod   = document.getElementById('prop-origem-pais-codigo');
    if (!paisInput || !valorPais) return;

    await _acCarregarPaises();

    const isCodigo = valorPais.length <= 3;
    let pais = null;
    if (isCodigo) {
        pais = _acPaises.find(p => p.codigo.toUpperCase() === valorPais.toUpperCase());
    } else {
        pais = _acPaises.find(p => p.descricao.toLowerCase() === valorPais.toLowerCase())
            || _acPaises.find(p => p.descricao.toLowerCase().includes(valorPais.toLowerCase()));
    }

    paisInput.value = pais ? pais.descricao : valorPais;
    if (paisCod) paisCod.value = pais ? pais.codigo : valorPais;
}

async function propGerarCodigo() {
    const ano    = new Date().getFullYear();
    let   seq    = 1;
    try {
        const { count } = await supabaseClient
            .from('propostas')
            .select('*', { count: 'exact', head: true })
            .like('codigo', `PROPO${ano}%`);
        if (count != null) seq = count + 1;
    } catch { /* tabela ainda não existe — usa seq 1 */ }

    const codigo  = `PROPO${ano}${String(seq).padStart(4, '0')}`;
    const hidden  = document.getElementById('prop-codigo');
    const display = document.getElementById('prop-codigo-display');
    if (hidden)  hidden.value        = codigo;
    if (display) display.textContent = codigo;
}

// ========================================
// PROPOSTA — AUTOCOMPLETE PAÍSES
// ========================================

function iniciarAutocompletePaisOrigemProposta() {
    const input   = document.getElementById('prop-origem-pais');
    const lista   = document.getElementById('prop-origem-pais-lista');
    const codigo  = document.getElementById('prop-origem-pais-codigo');
    if (!input || !lista) return;

    async function mostrar() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${p.codigo}" data-nome="${(p.descricao || '').replace(/"/g,'&quot;')}">
                <span class="ac-nome">${p.descricao}</span>
                <span class="ac-fantasia">${p.codigo}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { if (codigo) codigo.value = ''; mostrar(); });
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.getAttribute('data-nome');
        if (codigo) codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
    });
    document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista); });
}

function iniciarAutocompletePaisDestinoProposta() {
    const input  = document.getElementById('prop-destino-pais');
    const lista  = document.getElementById('prop-destino-pais-lista');
    const codigo = document.getElementById('prop-destino-pais-codigo');
    if (!input || !lista) return;

    const BRASIL_VALS = ['brasil', 'brazil', 'br'];

    function atualizarCEP() {
        const cepGroup = document.getElementById('prop-destino-cep-group');
        if (!cepGroup) return;
        const br = BRASIL_VALS.includes(input.value.trim().toLowerCase());
        cepGroup.style.display = br ? '' : 'none';
        if (!br) {
            const cepEl = document.getElementById('prop-destino-cep');
            if (cepEl) { cepEl.value = ''; cepEl.style.borderColor = ''; }
        }
    }

    async function mostrar() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 30).map(p => `
            <div class="autocomplete-item" data-nome="${p.descricao}" data-codigo="${p.codigo || ''}">
                <span class="ac-nome">${p.descricao}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('input', () => mostrar());
    input.addEventListener('focus', () => mostrar());
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.nome;
        if (codigo) codigo.value = item.dataset.codigo || '';
        lista.classList.remove('aberta');
        atualizarCEP();
    });
    document.addEventListener('click', e => { if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta'); });
    input.addEventListener('blur', () => { setTimeout(() => lista.classList.remove('aberta'), 150); atualizarCEP(); });
    input.addEventListener('change', atualizarCEP);
}

function iniciarAutocompletePropCliente() {
    const input    = document.getElementById('prop-cliente');
    const lista    = document.getElementById('prop-cliente-lista');
    const idOculto = document.getElementById('prop-cliente-id');
    if (!input || !lista || !idOculto) return;

    input.addEventListener('focus', async () => {
        await _acCarregarEmpresas();
        _acMostrar(input, lista, input.value);
    });
    input.addEventListener('input', () => { idOculto.value = ''; _acMostrar(input, lista, input.value); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value    = item.getAttribute('data-nome');
        idOculto.value = item.getAttribute('data-id');

        const doc        = item.getAttribute('data-doc') || '';
        const docInput   = document.getElementById('prop-documento');
        const tipoHidden = document.getElementById('prop-documento-tipo');
        if (docInput) {
            docInput.value    = doc ? _mascaraDocBR(doc) : '';
            docInput.readOnly = true;
            if (tipoHidden && doc) tipoHidden.value = _tipoDocBR(doc);
        }

        const pais = item.getAttribute('data-pais') || '';
        if (pais) _propPreencherPaisOrigem(pais);


        _acFechar(lista);
    });
    document.addEventListener('click', e => { if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista); });
}

// ========================================
// PROPOSTA — ITENS
// ========================================

let _propItens = [];

async function propIniciarItens() {
    if (!document.getElementById('prop-itens-body')) return;
    await propAdicionarItem();
}

async function propAdicionarItem() {
    await Promise.all([_carregarMoedas(), _carregarUnidades()]);
    const _moedaDefault   = _acMoedas.length   > 0 ? _acMoedas[0].descricao   : '';
    const _unidadeDefault = _acUnidades.length  > 0 ? _acUnidades[0].unidade   : 'un';
    _propItens.push({ produto: '', qtd: 1, unidade: _unidadeDefault, preco: 0, moeda: _moedaDefault });
    propRenderizarItens();
}

function propRemoverItem(idx) {
    _propItens.splice(idx, 1);
    propRenderizarItens();
}

function propAtualizarItem(idx, campo, valor) {
    if (!_propItens[idx]) return;
    _propItens[idx][campo] = valor;
    propRecalcularTotais();
}

function propMascaraPreco(input, idx) {
    let raw = input.value.replace(/\D/g, '');
    if (!raw) { propAtualizarItem(idx, 'preco', 0); return; }
    const num = parseInt(raw, 10) / 100;
    input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    propAtualizarItem(idx, 'preco', num);
}

function propRenderizarItens() {
    const tbody = document.getElementById('prop-itens-body');
    if (!tbody) return;

    const unidades = _acUnidades.length > 0
        ? _acUnidades
        : [{unidade:'UN',descricao:'Unidade'},{unidade:'KG',descricao:'Quilograma'},{unidade:'CX',descricao:'Caixa'}];
    const moedas   = _acMoedas.length > 0
        ? _acMoedas
        : [{descricao:'Dólar Americano'},{descricao:'Euro'},{descricao:'Real Brasileiro'}];

    tbody.innerHTML = _propItens.map((item, i) => `
        <div class="prop-item-card">
            <div class="prop-item-top">
                <span class="prop-item-badge">${i + 1}</span>
                <input type="text" class="prop-item-input" value="${(item.produto || '').replace(/"/g,'&quot;')}"
                    oninput="propAtualizarItem(${i}, 'produto', this.value)"
                    placeholder="Produto ou descrição...">
                <button type="button" class="prop-item-del" onclick="propRemoverItem(${i})" title="Remover">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="prop-item-bottom">
                <div class="prop-item-field prop-item-field--qtd">
                    <label>Qtd</label>
                    <input type="number" class="prop-item-input prop-item-num" min="0" step="1" value="${item.qtd}"
                        oninput="propAtualizarItem(${i}, 'qtd', parseInt(this.value)||0)">
                </div>
                <div class="prop-item-field prop-item-field--un">
                    <label>Un.</label>
                    <select class="prop-item-select" onchange="propAtualizarItem(${i}, 'unidade', this.value)">
                        ${unidades.map(u => `<option value="${u.unidade}"${item.unidade===u.unidade?' selected':''}>${u.unidade}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-item-field prop-item-field--preco">
                    <label>Preço Unit.</label>
                    <input type="text" inputmode="decimal" class="prop-item-input prop-item-num"
                        value="${item.preco ? item.preco.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}"
                        placeholder="0,00"
                        oninput="propMascaraPreco(this, ${i})">
                </div>
                <div class="prop-item-field prop-item-field--moeda">
                    <label>Moeda</label>
                    <select class="prop-item-select" onchange="propAtualizarItem(${i}, 'moeda', this.value)">
                        ${moedas.map(m => `<option value="${m.descricao}"${item.moeda===m.descricao?' selected':''}>${m.descricao}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-item-field prop-item-field--total">
                    <label>Total</label>
                    <span class="prop-item-total-val" id="prop-item-total-${i}">${propFormatarValor(item.qtd * item.preco, item.moeda)}</span>
                </div>
            </div>
        </div>`).join('');

    propRecalcularTotais();
}

function propRecalcularTotais() {
    _propItens.forEach((item, i) => {
        const el = document.getElementById(`prop-item-total-${i}`);
        if (el) el.textContent = propFormatarValor(item.qtd * item.preco, item.moeda);
    });

    const totalEl = document.getElementById('prop-total-geral');
    if (!totalEl) return;

    const totais = {};
    _propItens.forEach(item => {
        const val = item.qtd * item.preco;
        if (val) totais[item.moeda] = (totais[item.moeda] || 0) + val;
    });

    const keys = Object.keys(totais);
    totalEl.textContent = keys.length
        ? keys.map(m => propFormatarValor(totais[m], m)).join(' + ')
        : '—';
}

function propFormatarValor(valor, moeda) {
    if (!valor) return '—';
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'USD', minimumFractionDigits: 2 }).format(valor);
    } catch (_) {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ' + (moeda || '');
    }
}

// ========================================
// MÁSCARAS — TRANSPORTE
// ========================================

function iniciarMascarasTransporte() {
    const cnpjInput = document.getElementById('transp-cnpj');
    if (cnpjInput) {
        cnpjInput.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 14);
            if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
            else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
            else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)/, '$1.$2');
            this.value = v;
        });
    }

    const placaInput = document.getElementById('transp-placa');
    if (placaInput) {
        placaInput.addEventListener('input', function () {
            let v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
            if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
            this.value = v;
        });
    }

    const freteInput = document.getElementById('transp-frete-valor');
    if (freteInput) {
        freteInput.addEventListener('blur', function () {
            const n = parseFloat(this.value.replace(',', '.'));
            if (!isNaN(n)) this.value = n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        });
    }

    // Espelha o incoterm selecionado no campo de frete
    const incotermSelect  = document.getElementById('proc-incoterm');
    const incotermTag     = document.getElementById('transp-frete-incoterm');
    if (incotermSelect && incotermTag) {
        const sync = () => { incotermTag.value = incotermSelect.value || ''; };
        incotermSelect.addEventListener('change', sync);
        sync();
    }
}
