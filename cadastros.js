// ========================================
// CADASTRO DE EMPRESAS
// ========================================

let tagsArray = [];
let empresaExcluindoId = null;
let todasEmpresas = [];

let _cadContatoCount = 0;
const CAD_CONTATO_MAX = 3;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    aplicarMascaraCEP();
    cadContatoIniciar();
    carregarMoedasModal();
    carregarEmpresas();

    document.getElementById('filterInput').addEventListener('input', function() {
        filtrarEmpresas(this.value);
    });

    document.getElementById('tagsInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); }
    });

    document.getElementById('empresaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (validarFormulario()) salvarCadastro();
    });
});

// ========================================
// MOEDAS — carregar no select do modal
// ========================================

async function carregarMoedasModal() {
    const sel = document.getElementById('cad-rec-moeda');
    if (!sel) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao')
            .order('codigo', { ascending: true });
        (data || []).forEach(m => {
            const o = document.createElement('option');
            o.value = m.codigo;
            o.textContent = m.descricao || m.codigo;
            sel.appendChild(o);
        });
    } catch { /* silencia erro de rede */ }
}

// ========================================
// CONTATOS DINÂMICOS
// ========================================

function cadContatoIniciar() {
    _cadContatoCount = 0;
    document.getElementById('cad-contato-rows').innerHTML = '';
    cadContatoAdicionar();
}

function cadContatoAdicionar() {
    if (_cadContatoCount >= CAD_CONTATO_MAX) return;
    _cadContatoCount++;
    const id = Date.now();
    const container = document.getElementById('cad-contato-rows');
    const row = document.createElement('div');
    row.className = 'cad-contato-row';
    row.id = `cad-row-${id}`;
    row.innerHTML = `
        <input type="text"  class="cad-contato-tipo" name="cad_${id}_tipo"  placeholder="Ex: Financeiro">
        <input type="text"  name="cad_${id}_nome"  placeholder="Nome">
        <input type="email" name="cad_${id}_email" placeholder="email@empresa.com">
        <input type="text"  name="cad_${id}_tel"   placeholder="00000000000" inputmode="numeric" oninput="this.value=this.value.replace(/\\D/g,'')">
        <button type="button" class="cad-btn-remover" onclick="cadContatoRemover('${id}')" title="Remover">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    container.appendChild(row);
    _cadContatoAtualizarUI();
}

function cadContatoRemover(id) {
    const row = document.getElementById(`cad-row-${id}`);
    if (row) { row.remove(); _cadContatoCount--; }
    _cadContatoAtualizarUI();
}

function _cadContatoAtualizarUI() {
    const btn  = document.getElementById('btn-cad-add-contato');
    const rows = document.querySelectorAll('#cad-contato-rows .cad-contato-row');
    if (btn) btn.style.display = _cadContatoCount >= CAD_CONTATO_MAX ? 'none' : '';
    rows.forEach(r => {
        const b = r.querySelector('.cad-btn-remover');
        if (b) b.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
}

function _coletarContatos() {
    const rows = document.querySelectorAll('#cad-contato-rows .cad-contato-row');
    const contatos = [];
    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');
        const tipo  = inputs[0].value.trim();
        const nome  = inputs[1].value.trim();
        const email = inputs[2].value.trim();
        const tel   = inputs[3].value.trim();
        if (tipo || nome || email || tel) {
            contatos.push({ tipo: tipo || 'Geral', nome, email, telefone: tel });
        }
    });
    return contatos;
}

function _preencherContatos(contatos) {
    document.getElementById('cad-contato-rows').innerHTML = '';
    _cadContatoCount = 0;
    if (!contatos || contatos.length === 0) {
        cadContatoAdicionar();
        return;
    }
    contatos.forEach(c => {
        cadContatoAdicionar();
        const rows = document.querySelectorAll('#cad-contato-rows .cad-contato-row');
        const row  = rows[rows.length - 1];
        const inputs = row.querySelectorAll('input');
        inputs[0].value = c.tipo     || '';
        inputs[1].value = c.nome     || '';
        inputs[2].value = c.email    || '';
        inputs[3].value = c.telefone || '';
    });
}

// ========================================
// MODAL
// ========================================

function abrirModalCadastro() {
    document.getElementById('modalFormTitulo').textContent = 'Cadastrar Empresa';
    document.getElementById('empresaEditandoId').value = '';
    limparFormulario();
    document.getElementById('modalFormCadastro').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharModalCadastro() {
    document.getElementById('modalFormCadastro').classList.remove('active');
    document.body.style.overflow = '';
}

// ========================================
// LISTA DE EMPRESAS
// ========================================

async function carregarEmpresas() {
    const resultado = await window.supabaseAPI.buscarEmpresas();

    if (!resultado.sucesso) {
        document.getElementById('listaContainer').innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar empresas.
            </div>`;
        return;
    }

    todasEmpresas = resultado.data || [];
    renderizarEmpresas(todasEmpresas);
}

function _tiposDeEmpresa(e) {
    const mapa = [
        { key: 'is_fabricante',    label: 'Fabricante',    css: 'fabricante' },
        { key: 'is_cliente',       label: 'Cliente',       css: 'cliente' },
        { key: 'is_fornecedor',    label: 'Fornecedor',    css: 'fornecedor' },
        { key: 'is_transportadora',label: 'Transportadora',css: 'transportadora' },
        { key: 'is_remetente',     label: 'Remetente',     css: 'remetente' },
    ];
    return mapa.filter(m => e[m.key]);
}

function _avatarCor(nome) {
    const cores = ['#4776ec','#f7931e','#16a34a','#7c3aed','#0891b2','#d97706','#dc2626'];
    let h = 0;
    for (const c of (nome || '?')) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
    return cores[Math.abs(h) % cores.length];
}

function renderizarEmpresas(lista) {
    const container = document.getElementById('listaContainer');
    const count     = document.getElementById('listaCount');

    count.textContent = `${lista.length} empresa(s)`;

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-building"></i>
                <p>Nenhuma empresa cadastrada ainda.</p>
                <p style="font-size:13px;color:#9ca3af;">Clique em <b>Cadastrar</b> para adicionar a primeira.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="empresa-tabela">
            <thead>
                <tr>
                    <th class="col-empresa">Empresa</th>
                    <th class="col-tipo">Tipo</th>
                    <th class="col-doc">Documento</th>
                    <th class="col-loc">Localização</th>
                    <th class="col-tags">Tags</th>
                    <th class="col-acoes">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(e => {
                    const tipos  = _tiposDeEmpresa(e);
                    const cor    = _avatarCor(e.razao_social);
                    const letra  = (e.razao_social || '?').charAt(0).toUpperCase();
                    const loc    = [e.cidade, e.estado, e.pais].filter(Boolean).join(', ') || '—';
                    return `
                    <tr onclick="editarEmpresa('${e.id}')" class="empresa-row">
                        <td class="col-empresa">
                            <div class="empresa-cell">
                                <div class="empresa-avatar" style="background:${cor}">${letra}</div>
                                <div class="empresa-info">
                                    <span class="empresa-nome">${e.razao_social || '—'}</span>
                                    ${e.nome_fantasia ? `<span class="empresa-fantasia">${e.nome_fantasia}</span>` : ''}
                                </div>
                            </div>
                        </td>
                        <td class="col-tipo">
                            <div class="tipo-badges">
                                ${tipos.map(t => `<span class="tag-tipo tag-${t.css}" title="${t.label}">${t.label.charAt(0)}</span>`).join('') || '<span class="cell-vazio">—</span>'}
                            </div>
                        </td>
                        <td class="col-doc">
                            ${e.documento ? `<code class="doc-code">${e.documento}</code>` : '<span class="cell-vazio">—</span>'}
                        </td>
                        <td class="col-loc">${loc}</td>
                        <td class="col-tags">${(e.tags && e.tags.length) ? renderTagsMini(e.tags) : '<span class="cell-vazio">—</span>'}</td>
                        <td class="col-acoes" onclick="event.stopPropagation()">
                            <div class="acoes-grupo">
                                <button class="btn-acao btn-editar" onclick="editarEmpresa('${e.id}')" title="Editar">
                                    <i class="fa-solid fa-pen"></i>
                                </button>
                                <button class="btn-acao btn-excluir" onclick="excluirEmpresa('${e.id}')" title="Excluir">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>`;
}

function renderTagsMini(tags) {
    const visiveis = tags.slice(0, 2).map(t => `<span class="tag-item-mini">${t}</span>`).join('');
    const extra = tags.length > 2 ? `<span class="tag-item-mini tag-extra">+${tags.length - 2}</span>` : '';
    return visiveis + extra;
}

function filtrarEmpresas(valor) {
    const filtro = (valor !== undefined ? valor : document.getElementById('filterInput').value).toLowerCase().trim();

    if (!filtro) { renderizarEmpresas(todasEmpresas); return; }

    const lista = todasEmpresas.filter(e => {
        const tagMatch = e.tags && e.tags.some(t => t.toLowerCase().includes(filtro));
        return (e.razao_social  && e.razao_social.toLowerCase().includes(filtro)) ||
               (e.nome_fantasia && e.nome_fantasia.toLowerCase().includes(filtro)) ||
               (e.documento     && e.documento.includes(filtro)) ||
               (e.cidade        && e.cidade.toLowerCase().includes(filtro)) ||
               (e.pais          && e.pais.toLowerCase().includes(filtro)) ||
               tagMatch;
    });

    renderizarEmpresas(lista);
}

// ========================================
// EDITAR EMPRESA
// ========================================

async function editarEmpresa(id) {
    const resultado = await window.supabaseAPI.buscarEmpresas();
    if (!resultado.sucesso) return;

    const empresa = resultado.data.find(e => e.id === id);
    if (!empresa) return;

    limparFormulario();
    document.getElementById('empresaEditandoId').value = id;
    document.getElementById('modalFormTitulo').textContent = 'Editar Empresa';

    // Tipos
    document.getElementById('tipoFabricante').checked    = empresa.is_fabricante     || false;
    document.getElementById('tipoCliente').checked       = empresa.is_cliente        || false;
    document.getElementById('tipoFornecedor').checked    = empresa.is_fornecedor     || false;
    document.getElementById('tipoTransportadora').checked= empresa.is_transportadora || false;
    document.getElementById('tipoRemetente').checked     = empresa.is_remetente      || false;
    _atualizarTipoCards();

    // Identificação
    document.getElementById('tipoCadastro').value = empresa.tipo_cadastro || '';
    alterarTipoCadastro();
    document.getElementById('documento').value = empresa.documento || '';

    // Dados principais
    document.getElementById('nomeEmpresa').value      = empresa.razao_social        || '';
    document.getElementById('nomeFantasia').value     = empresa.nome_fantasia        || '';
    document.getElementById('inscricaoEstadual').value= empresa.inscricao_estadual   || '';
    document.getElementById('suframa').value          = empresa.suframa              || '';

    // Endereço
    document.getElementById('pais').value       = empresa.pais       || 'BR';
    onPaisChange();
    document.getElementById('cep').value        = empresa.cep        || '';
    document.getElementById('estado').value     = empresa.estado     || '';
    document.getElementById('cidade').value     = empresa.cidade     || '';
    document.getElementById('bairro').value     = empresa.bairro     || '';
    document.getElementById('endereco').value   = empresa.endereco   || '';
    document.getElementById('complemento').value= empresa.complemento|| '';

    if (empresa.numero === 'S/N') {
        document.getElementById('semNumero').checked = true;
        toggleNumero();
    } else {
        document.getElementById('numero').value = empresa.numero || '';
    }

    // Contatos (vêm da view como JSON array)
    _preencherContatos(empresa.contatos || []);

    // Financeiro
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    set('cad-pag-forma',      empresa.pag_forma);
    set('cad-pag-condicao',   empresa.pag_condicao);
    set('cad-pag-banco',      empresa.pag_banco);
    set('cad-pag-tipo-conta', empresa.pag_tipo_conta);
    set('cad-pag-agencia',    empresa.pag_agencia);
    set('cad-pag-conta',      empresa.pag_conta);
    set('cad-rec-forma',      empresa.rec_forma);
    set('cad-rec-moeda',      empresa.rec_moeda);
    set('cad-rec-banco',      empresa.rec_banco);
    set('cad-rec-tipo-conta', empresa.rec_tipo_conta);
    set('cad-rec-agencia',    empresa.rec_agencia);
    set('cad-rec-conta',      empresa.rec_conta);

    // Extras
    set('cadSite',    empresa.site);
    set('cadHorario', empresa.horario_atendimento);

    if (empresa.tags && empresa.tags.length > 0) {
        tagsArray = [...empresa.tags];
        renderizarTags();
    }

    document.getElementById('modalFormCadastro').classList.add('active');
    document.body.style.overflow = 'hidden';
}

// ========================================
// EXCLUIR EMPRESA
// ========================================

function excluirEmpresa(id) {
    const empresa = todasEmpresas.find(e => e.id === id);
    if (!empresa) return;

    empresaExcluindoId = id;
    const localizacao = [empresa.pais, empresa.estado].filter(Boolean).join(' / ') || '—';

    document.getElementById('excluirEmpresaInfo').innerHTML = `
        <div class="excluir-info-row excluir-razao">
            <i class="fa-solid fa-building"></i>
            <span>${empresa.razao_social || '—'}</span>
        </div>
        ${empresa.nome_fantasia ? `<div class="excluir-info-fantasia"><i class="fa-solid fa-tag"></i> ${empresa.nome_fantasia}</div>` : ''}
        <div class="excluir-info-grid">
            <div class="excluir-info-item">
                <span class="excluir-label">Documento</span>
                <span class="excluir-valor">${empresa.documento || '—'}</span>
            </div>
            <div class="excluir-info-item">
                <span class="excluir-label">País / Estado</span>
                <span class="excluir-valor">${localizacao}</span>
            </div>
        </div>`;

    document.getElementById('btnConfirmarExcluir').onclick = confirmarExclusao;
    document.getElementById('modalExcluir').classList.add('active');
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    empresaExcluindoId = null;
}

async function confirmarExclusao() {
    if (!empresaExcluindoId) return;

    const btn = document.getElementById('btnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Excluindo...';

    const resultado = await window.supabaseAPI.excluirEmpresa(empresaExcluindoId);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    fecharModalExcluir();

    if (resultado.sucesso) {
        mostrarNotificacao('Empresa excluída com sucesso!', 'success');
        carregarEmpresas();
    } else {
        mostrarNotificacao(resultado.mensagem, 'error');
    }
}

// ========================================
// TOGGLE DE SEÇÕES
// ========================================

function toggleSection(element) {
    const section = element.closest('.form-section');
    const content = section.querySelector('.section-content');

    section.classList.toggle('active');

    if (section.classList.contains('active')) {
        content.style.display = 'block';
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.opacity   = '1';
        }, 10);
    } else {
        content.style.maxHeight = '0';
        content.style.opacity   = '0';
        setTimeout(() => { content.style.display = 'none'; }, 300);
    }
}

// ========================================
// PAÍS — CEP SOMENTE PARA BRASIL
// ========================================

function onPaisChange() {
    const pais     = document.getElementById('pais').value;
    const campoCep = document.getElementById('campoCep');
    const cepInput = document.getElementById('cep');

    if (pais === 'BR') {
        campoCep.style.display = '';
        cepInput.required = true;
    } else {
        campoCep.style.display = 'none';
        cepInput.required = false;
        cepInput.value = '';
    }
}

// ========================================
// MÁSCARA CEP
// ========================================

function aplicarMascaraCEP() {
    const cepInput = document.getElementById('cep');
    if (!cepInput) return;
    cepInput.addEventListener('input', function(e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 8);
        e.target.value = v.replace(/^(\d{5})(\d)/, '$1-$2');
    });
}

// ========================================
// TIPO DE CADASTRO (CNPJ/CPF)
// ========================================

function alterarTipoCadastro() {
    const tipo  = document.getElementById('tipoCadastro').value;
    const input = document.getElementById('documento');
    const label = document.getElementById('labelDocumento');

    if (!tipo) {
        input.disabled = true;
        input.placeholder = 'Selecione o tipo primeiro';
        input.value = '';
        label.textContent = 'CNPJ/CPF';
        return;
    }

    input.disabled = false;
    input.value = '';
    input.focus();

    if (tipo === 'cnpj') {
        label.textContent = 'CNPJ';
        input.placeholder = '00.000.000/0000-00';
        input.maxLength = 18;
        _aplicarMascaraCNPJ(input);
    } else {
        label.textContent = 'CPF';
        input.placeholder = '000.000.000-00';
        input.maxLength = 14;
        _aplicarMascaraCPF(input);
    }
}

function _aplicarMascaraCNPJ(input) {
    const h = e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        e.target.value = v;
    };
    input._cnpjH && input.removeEventListener('input', input._cnpjH);
    input._cpfH  && input.removeEventListener('input', input._cpfH);
    input._cnpjH = h;
    input.addEventListener('input', h);
}

function _aplicarMascaraCPF(input) {
    const h = e => {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/^(\d{3})(\d)/, '$1.$2');
        v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
        e.target.value = v;
    };
    input._cpfH  && input.removeEventListener('input', input._cpfH);
    input._cnpjH && input.removeEventListener('input', input._cnpjH);
    input._cpfH = h;
    input.addEventListener('input', h);
}

// ========================================
// TOGGLE NÚMERO (S/N)
// ========================================

function toggleNumero() {
    const cb  = document.getElementById('semNumero');
    const inp = document.getElementById('numero');
    const req = document.getElementById('numeroRequired');

    if (cb.checked) {
        inp.value    = 'S/N';
        inp.disabled = true;
        inp.required = false;
        req.style.display = 'none';
    } else {
        inp.value    = '';
        inp.disabled = false;
        inp.required = true;
        req.style.display = 'inline';
        inp.focus();
    }
}

// ========================================
// BUSCAR CEP
// ========================================

function _cepInfo(msg, cor) {
    const el = document.getElementById('cepInfo');
    if (el) { el.innerHTML = msg; el.style.color = cor || ''; }
}

async function buscarCEP() {
    if (document.getElementById('pais').value !== 'BR') return;

    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        if (cep.length > 0) _cepInfo('<i class="fa-solid fa-triangle-exclamation"></i> CEP deve conter 8 dígitos.', '#f59e0b');
        return;
    }

    _cepInfo('<i class="fa-solid fa-spinner fa-spin"></i> Buscando...', '#4776ec');
    cepInput.disabled = true;

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await res.json();

        if (dados.erro) {
            _cepInfo('<i class="fa-solid fa-circle-xmark"></i> CEP não encontrado.', '#dc2626');
        } else {
            document.getElementById('estado').value   = dados.uf         || '';
            document.getElementById('cidade').value   = dados.localidade || '';
            document.getElementById('bairro').value   = dados.bairro     || '';
            document.getElementById('endereco').value = dados.logradouro || '';
            document.getElementById('complemento').value = dados.complemento || '';
            cepInput.style.borderColor = '#22C55E';
            _cepInfo('<i class="fa-solid fa-circle-check"></i> Endereço preenchido.', '#16a34a');
            setTimeout(() => document.getElementById('numero').focus(), 500);
        }
    } catch {
        _cepInfo('<i class="fa-solid fa-circle-xmark"></i> Erro ao buscar CEP.', '#dc2626');
    } finally {
        cepInput.disabled = false;
    }
}

// ========================================
// TIPO-CARDS — atualizar visual
// ========================================

function _atualizarTipoCards() {
    ['tipoFabricante','tipoCliente','tipoFornecedor','tipoTransportadora','tipoRemetente'].forEach(id => {
        const cb = document.getElementById(id);
        if (!cb) return;
        cb.closest('.cad-tipo-card').classList.toggle('selected', cb.checked);
    });
}

// Delega o toggle visual ao clicar em qualquer tipo-card
document.addEventListener('change', function(e) {
    if (e.target && e.target.closest('.cad-tipo-card')) _atualizarTipoCards();
});

// ========================================
// SISTEMA DE TAGS
// ========================================

function adicionarTag() {
    const input = document.getElementById('tagsInput');
    const texto = input.value.trim().toLowerCase();
    if (!texto) { mostrarNotificacao('Digite uma tag primeiro!', 'warning'); return; }
    if (tagsArray.includes(texto)) { mostrarNotificacao('Tag já adicionada!', 'warning'); input.value = ''; return; }
    tagsArray.push(texto);
    renderizarTags();
    input.value = '';
    input.focus();
}

function renderizarTags() {
    const container = document.getElementById('tagsContainer');
    if (!container) return;
    if (tagsArray.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
    } else {
        container.style.display = 'flex';
        container.innerHTML = tagsArray.map((tag, i) => `
            <div class="tag-item">
                <i class="fa-solid fa-tag"></i>
                <span>${tag}</span>
                <i class="fa-solid fa-xmark tag-remove" onclick="removerTag(${i})"></i>
            </div>`).join('');
    }
}

function removerTag(index) {
    tagsArray.splice(index, 1);
    renderizarTags();
}

// ========================================
// LIMPAR FORMULÁRIO
// ========================================

function confirmarLimparDados() {
    if (confirm('Limpar todos os dados do formulário?')) {
        limparFormulario();
        mostrarNotificacao('Formulário limpo!', 'info');
    }
}

function limparFormulario() {
    document.getElementById('empresaForm').reset();

    // Tipos
    ['tipoFabricante','tipoCliente','tipoFornecedor','tipoTransportadora','tipoRemetente']
        .forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
    _atualizarTipoCards();

    // Identificação
    document.getElementById('documento').disabled    = true;
    document.getElementById('documento').placeholder = 'Selecione o tipo primeiro';
    document.getElementById('labelDocumento').textContent = 'CNPJ/CPF';

    // Número
    document.getElementById('numero').disabled = false;
    document.getElementById('numero').required = true;
    document.getElementById('semNumero').checked = false;
    document.getElementById('numeroRequired').style.display = 'inline';

    // Tags
    tagsArray = [];
    renderizarTags();

    // Contatos
    cadContatoIniciar();

    // Financeiro
    ['cad-pag-forma','cad-pag-condicao','cad-pag-banco','cad-pag-tipo-conta','cad-pag-agencia','cad-pag-conta',
     'cad-rec-forma','cad-rec-moeda','cad-rec-banco','cad-rec-tipo-conta','cad-rec-agencia','cad-rec-conta']
        .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    // Extras
    ['cadSite','cadHorario'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    // País / CEP
    document.getElementById('pais').value = 'BR';
    onPaisChange();

    // Campos de erro
    document.querySelectorAll('#empresaForm input, #empresaForm select').forEach(el => {
        el.style.borderColor = '';
        el.classList.remove('error', 'success');
    });

    // Seções — abre apenas a primeira
    document.querySelectorAll('#empresaForm .form-section').forEach((s, i) => {
        const content = s.querySelector('.section-content');
        if (i === 0) {
            s.classList.add('active');
            content.style.display  = 'block';
            content.style.maxHeight = '';
            content.style.opacity  = '1';
        } else {
            s.classList.remove('active');
            content.style.display  = 'none';
            content.style.maxHeight = '0';
            content.style.opacity  = '0';
        }
    });
}

// ========================================
// VALIDAÇÃO
// ========================================

function validarFormulario() {
    let valido = true;

    // Pelo menos 1 tipo
    const algumTipo = ['tipoFabricante','tipoCliente','tipoFornecedor','tipoTransportadora','tipoRemetente']
        .some(id => document.getElementById(id).checked);
    if (!algumTipo) {
        mostrarNotificacao('Selecione pelo menos um tipo de empresa!', 'error');
        valido = false;
    }

    const pais = document.getElementById('pais').value;
    const obrigatorios = ['tipoCadastro','documento','nomeEmpresa','pais','estado','cidade','bairro','endereco'];
    if (pais === 'BR') obrigatorios.push('cep');
    if (!document.getElementById('semNumero').checked) obrigatorios.push('numero');

    obrigatorios.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && !campo.value.trim()) {
            campo.style.borderColor = '#dc2626';
            campo.classList.add('error');
            valido = false;
            campo.addEventListener('input', function() {
                this.style.borderColor = '';
                this.classList.remove('error');
            }, { once: true });
        }
    });

    if (!valido) {
        mostrarNotificacao('Preencha todos os campos obrigatórios!', 'error');
        const primeiro = document.querySelector('#empresaForm .error');
        if (primeiro) primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    return valido;
}

// ========================================
// SALVAR CADASTRO
// ========================================

async function salvarCadastro() {
    const btnSalvar = document.querySelector('.btn-save');
    btnSalvar.classList.add('loading');
    btnSalvar.disabled = true;

    const tipos = ['fabricante','cliente','fornecedor','transportadora','remetente']
        .filter(t => document.getElementById(`tipo${t.charAt(0).toUpperCase() + t.slice(1)}`).checked);

    const get = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };

    const dados = {
        tipos,
        tipo_cadastro:        get('tipoCadastro'),
        documento:            get('documento'),
        razao_social:         get('nomeEmpresa'),
        nome_fantasia:        get('nomeFantasia'),
        inscricao_estadual:   get('inscricaoEstadual'),
        suframa:              get('suframa'),
        pais:                 get('pais'),
        cep:                  get('cep'),
        estado:               get('estado'),
        cidade:               get('cidade'),
        bairro:               get('bairro'),
        endereco:             get('endereco'),
        numero:               get('numero'),
        complemento:          get('complemento'),
        site:                 get('cadSite'),
        horario_atendimento:  get('cadHorario'),
        tags:                 tagsArray,
        contatos:             _coletarContatos(),
        financeiro: {
            pag_forma:      get('cad-pag-forma'),
            pag_condicao:   get('cad-pag-condicao'),
            pag_banco:      get('cad-pag-banco'),
            pag_tipo_conta: get('cad-pag-tipo-conta'),
            pag_agencia:    get('cad-pag-agencia'),
            pag_conta:      get('cad-pag-conta'),
            rec_forma:      get('cad-rec-forma'),
            rec_moeda:      get('cad-rec-moeda'),
            rec_banco:      get('cad-rec-banco'),
            rec_tipo_conta: get('cad-rec-tipo-conta'),
            rec_agencia:    get('cad-rec-agencia'),
            rec_conta:      get('cad-rec-conta'),
        }
    };

    const editandoId = get('empresaEditandoId');
    const resultado  = editandoId
        ? await window.supabaseAPI.editarEmpresa(editandoId, dados)
        : await window.supabaseAPI.salvarEmpresa(dados);

    btnSalvar.classList.remove('loading');
    btnSalvar.disabled = false;

    if (resultado.sucesso) {
        mostrarNotificacao(editandoId ? 'Empresa atualizada!' : 'Empresa cadastrada!', 'success');
        fecharModalCadastro();
        carregarEmpresas();
    } else {
        mostrarNotificacao(resultado.mensagem, 'error');
    }
}

// ========================================
// UPLOAD DE ARQUIVO
// ========================================

function processarUpload(input) {
    const arquivo = input.files[0];
    if (!arquivo) return;
    const ext = arquivo.name.split('.').pop().toLowerCase();
    if (!['xlsx','xls','pdf'].includes(ext)) {
        mostrarNotificacao('Apenas Excel ou PDF são permitidos.', 'error');
        input.value = ''; return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
        mostrarNotificacao('O arquivo deve ter no máximo 10MB.', 'error');
        input.value = ''; return;
    }
    mostrarNotificacao(`Processando "${arquivo.name}"...`, 'info');
    input.value = '';
}

// ========================================
// NOTIFICAÇÕES
// ========================================

function mostrarNotificacao(mensagem, tipo = 'info') {
    const icones = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const cores  = { success: '#22C55E', error: '#dc2626', warning: '#f59e0b', info: '#4776ec' };

    const n = document.createElement('div');
    n.className = `notificacao notificacao-${tipo}`;
    n.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;
    n.style.cssText = `position:fixed;top:100px;right:20px;background:white;color:${cores[tipo]};padding:16px 24px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:12px;font-weight:600;z-index:99999;animation:slideIn .3s ease;border-left:4px solid ${cores[tipo]};max-width:400px;`;

    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideOut .3s ease'; setTimeout(() => n.remove(), 300); }, 5000);
}

const _notifStyle = document.createElement('style');
_notifStyle.textContent = `
@keyframes slideIn  { from { transform:translateX(400px); opacity:0; } to { transform:translateX(0); opacity:1; } }
@keyframes slideOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(400px); opacity:0; } }
`;
document.head.appendChild(_notifStyle);
