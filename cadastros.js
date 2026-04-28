// ========================================
// CADASTRO DE EMPRESAS
// ========================================

let tagsArray = [];
let empresaExcluindoId = null;
let todasEmpresas = [];

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    aplicarMascarasCEP();
    aplicarMascarasTelefone();
    aplicarContadores();
    inicializarValidacao();
    aplicarMascaraTagsEnter();
    carregarEmpresas();

    // Filtro automático ao digitar
    document.getElementById('filterInput').addEventListener('input', function() {
        filtrarEmpresas(this.value);
    });

});

// ========================================
// MODAL DO FORMULÁRIO
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

function renderizarEmpresas(lista) {
    const container = document.getElementById('listaContainer');
    const count = document.getElementById('listaCount');

    count.textContent = `${lista.length} empresa(s)`;

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-building"></i>
                <p>Nenhuma empresa cadastrada ainda.</p>
                <p style="font-size:13px; color:#9ca3af;">Clique em <b>Cadastrar</b> para adicionar a primeira.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="empresa-tabela">
            <thead>
                <tr>
                    <th class="col-tipo"></th>
                    <th class="col-razao">Razão Social</th>
                    <th class="col-fantasia">Nome Fantasia</th>
                    <th class="col-doc">Documento</th>
                    <th class="col-loc">País / Estado</th>
                    <th class="col-tags">Tags</th>
                    <th class="col-id">ID Interno</th>
                    <th class="col-acoes" style="text-align:center;">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(e => `
                    <tr>
                        <td class="col-tipo">
                            <div class="tipo-badges">
                                ${(e.tipos || []).map(t => `<span class="tag-tipo tag-${t}" title="${t}">${t.charAt(0).toUpperCase()}</span>`).join('')}
                            </div>
                        </td>
                        <td class="col-razao">
                            <span class="empresa-nome">${e.nome_empresa || '—'}</span>
                        </td>
                        <td class="col-fantasia">
                            <span class="empresa-fantasia">${e.nome_fantasia || '<span class="cell-vazio">—</span>'}</span>
                        </td>
                        <td class="col-doc cell-nowrap">${e.documento || '—'}</td>
                        <td class="col-loc cell-nowrap">${[e.pais, e.estado].filter(Boolean).join(' / ') || '—'}</td>
                        <td class="col-tags">
                            ${(e.tags && e.tags.length) ? renderTagsMini(e.tags) : '<span class="cell-vazio">—</span>'}
                        </td>
                        <td class="col-id">
                            ${e.identificacao_empresa ? `<span class="id-interno">${e.identificacao_empresa}</span>` : ''}
                        </td>
                        <td class="col-acoes" style="text-align:center; white-space:nowrap;">
                            <button class="btn-acao btn-editar" onclick="editarEmpresa('${e.id}')" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-acao btn-excluir" onclick="excluirEmpresa('${e.id}')" title="Excluir">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

function renderTagsMini(tags) {
    return tags.slice(0, 2).map(t => `<span class="tag-item-mini">${t}</span>`).join('');
}

function filtrarEmpresas(valor) {
    const filtro = (valor !== undefined ? valor : document.getElementById('filterInput').value).toLowerCase().trim();

    if (!filtro) {
        renderizarEmpresas(todasEmpresas);
        return;
    }

    const lista = todasEmpresas.filter(e => {
        const tagMatch = e.tags && e.tags.some(t => t.toLowerCase().includes(filtro));
        return (e.nome_empresa && e.nome_empresa.toLowerCase().includes(filtro)) ||
               (e.nome_fantasia && e.nome_fantasia.toLowerCase().includes(filtro)) ||
               (e.documento && e.documento.includes(filtro)) ||
               (e.cidade && e.cidade.toLowerCase().includes(filtro)) ||
               (e.pais && e.pais.toLowerCase().includes(filtro)) ||
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

    // Preencher campos
    if (empresa.tipos) {
        document.getElementById('tipoCliente').checked = empresa.tipos.includes('cliente');
        document.getElementById('tipoFornecedor').checked = empresa.tipos.includes('fornecedor');
    }
    document.getElementById('tipoCadastro').value = empresa.tipo_documento || '';
    alterarTipoCadastro();
    document.getElementById('cadastro').value = empresa.documento || '';
    document.getElementById('nomeEmpresa').value = empresa.nome_empresa || '';
    document.getElementById('nomeFantasia').value = empresa.nome_fantasia || '';
    document.getElementById('pais').value = empresa.pais || 'BR';
    onPaisChange();
    document.getElementById('cep').value = empresa.cep || '';
    document.getElementById('estado').value = empresa.estado || '';
    document.getElementById('cidade').value = empresa.cidade || '';
    document.getElementById('bairro').value = empresa.bairro || '';
    document.getElementById('endereco').value = empresa.endereco || '';
    document.getElementById('numero').value = empresa.numero || '';
    document.getElementById('complemento').value = empresa.complemento || '';
    document.getElementById('contato1').value = empresa.contato_principal || '';
    document.getElementById('contato2').value = empresa.contato_secundario || '';
    document.getElementById('email').value = empresa.email || '';
    document.getElementById('identificacao').value = empresa.identificacao_empresa || '';

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
            <span>${empresa.nome_empresa || '—'}</span>
        </div>
        ${empresa.nome_fantasia ? `
        <div class="excluir-info-fantasia">
            <i class="fa-solid fa-tag"></i> ${empresa.nome_fantasia}
        </div>` : ''}
        <div class="excluir-info-grid">
            <div class="excluir-info-item">
                <span class="excluir-label">Documento</span>
                <span class="excluir-valor">${empresa.documento || '—'}</span>
            </div>
            <div class="excluir-info-item">
                <span class="excluir-label">País / Estado</span>
                <span class="excluir-valor">${localizacao}</span>
            </div>
            ${empresa.identificacao_empresa ? `
            <div class="excluir-info-item">
                <span class="excluir-label">ID Interno</span>
                <span class="excluir-valor"><span class="id-interno">${empresa.identificacao_empresa}</span></span>
            </div>` : ''}
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
// TOGGLE DE SEÇÕES COLAPSÁVEIS
// ========================================

function toggleSection(element) {
    const section = element.closest('.form-section');
    const content = section.querySelector('.section-content');

    section.classList.toggle('active');

    if (section.classList.contains('active')) {
        content.style.display = 'block';
        setTimeout(() => {
            content.style.maxHeight = content.scrollHeight + 'px';
            content.style.opacity = '1';
        }, 10);
    } else {
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        setTimeout(() => { content.style.display = 'none'; }, 300);
    }
}

// ========================================
// PAÍS — CEP SOMENTE PARA BRASIL
// ========================================

function onPaisChange() {
    const pais = document.getElementById('pais').value;
    const campoCep = document.getElementById('campoCep');
    const cepInput = document.getElementById('cep');

    if (pais === 'BR') {
        campoCep.style.display = '';
        cepInput.required = true;
        // Limpar campos de endereço ao trocar para BR
        ['estado','cidade','bairro','endereco'].forEach(id => {
            const el = document.getElementById(id);
            if (!el.value) el.placeholder = el.placeholder; // manter placeholder
        });
    } else {
        campoCep.style.display = 'none';
        cepInput.required = false;
        cepInput.value = '';
    }
}

// ========================================
// MÁSCARAS
// ========================================

function aplicarMascarasCEP() {
    const cepInput = document.getElementById('cep');
    if (cepInput) {
        cepInput.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '').slice(0, 8);
            e.target.value = v.replace(/^(\d{5})(\d)/, '$1-$2');
        });
    }
}

function aplicarMascarasTelefone() {
    [document.getElementById('contato1'), document.getElementById('contato2')].forEach(input => {
        if (!input) return;
        input.addEventListener('input', function(e) {
            let v = e.target.value.replace(/\D/g, '').slice(0, 11);
            if (v.length <= 10) v = v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
            else v = v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
            e.target.value = v;
        });
    });
}

function aplicarMascaraTagsEnter() {
    const tagsInput = document.getElementById('tagsInput');
    if (tagsInput) {
        tagsInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); adicionarTag(); }
        });
    }
}

// ========================================
// ALTERNAR TIPO DE CADASTRO (CNPJ/CPF)
// ========================================

function alterarTipoCadastro() {
    const tipo = document.getElementById('tipoCadastro').value;
    const input = document.getElementById('cadastro');
    const label = document.getElementById('labelCadastro');

    if (!tipo) {
        input.disabled = true;
        input.placeholder = 'Selecione o tipo de cadastro primeiro';
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
        aplicarMascaraCNPJ(input);
    } else {
        label.textContent = 'CPF';
        input.placeholder = '000.000.000-00';
        input.maxLength = 14;
        aplicarMascaraCPF(input);
    }
}

function aplicarMascaraCNPJ(input) {
    const handler = function(e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 14);
        v = v.replace(/^(\d{2})(\d)/, '$1.$2');
        v = v.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1/$2');
        v = v.replace(/(\d{4})(\d)/, '$1-$2');
        e.target.value = v;
    };
    input._cnpjHandler && input.removeEventListener('input', input._cnpjHandler);
    input._cnpjHandler = handler;
    input.addEventListener('input', handler);
}

function aplicarMascaraCPF(input) {
    const handler = function(e) {
        let v = e.target.value.replace(/\D/g, '').slice(0, 11);
        v = v.replace(/^(\d{3})(\d)/, '$1.$2');
        v = v.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
        v = v.replace(/\.(\d{3})(\d)/, '.$1-$2');
        e.target.value = v;
    };
    input._cpfHandler && input.removeEventListener('input', input._cpfHandler);
    input._cpfHandler = handler;
    input.addEventListener('input', handler);
}

// ========================================
// TOGGLE NÚMERO (S/N)
// ========================================

function toggleNumero() {
    const checkbox = document.getElementById('semNumero');
    const input = document.getElementById('numero');
    const req = document.getElementById('numeroRequired');

    if (checkbox.checked) {
        input.value = 'S/N';
        input.disabled = true;
        input.required = false;
        req.style.display = 'none';
    } else {
        input.value = '';
        input.disabled = false;
        input.required = true;
        req.style.display = 'inline';
        input.focus();
    }
}

// ========================================
// BUSCAR CEP (somente Brasil)
// ========================================

function _cepInfo(msg, cor) {
    const small = document.querySelector('#campoCep .info-text');
    if (!small) return;
    small.innerHTML = msg;
    small.style.color = cor || '';
}

async function buscarCEP() {
    const pais = document.getElementById('pais').value;
    if (pais !== 'BR') return;

    const cepInput = document.getElementById('cep');
    const cep = cepInput.value.replace(/\D/g, '');

    if (cep.length !== 8) {
        if (cep.length > 0) _cepInfo('<i class="fa-solid fa-triangle-exclamation"></i> CEP deve conter 8 dígitos.', '#f59e0b');
        return;
    }

    _cepInfo('<i class="fa-solid fa-spinner fa-spin"></i> Buscando endereço...', '#4776ec');
    cepInput.style.borderColor = '#4776ec';
    cepInput.disabled = true;

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await res.json();

        if (dados.erro) {
            _cepInfo('<i class="fa-solid fa-circle-xmark"></i> CEP não encontrado.', '#dc2626');
            cepInput.style.borderColor = '#dc2626';
            ['estado','cidade','bairro','endereco','complemento'].forEach(id => document.getElementById(id).value = '');
        } else {
            document.getElementById('estado').value = dados.uf || '';
            document.getElementById('cidade').value = dados.localidade || '';
            document.getElementById('bairro').value = dados.bairro || '';
            document.getElementById('endereco').value = dados.logradouro || '';
            document.getElementById('complemento').value = dados.complemento || '';
            cepInput.style.borderColor = '#22C55E';
            _cepInfo('<i class="fa-solid fa-circle-check"></i> Endereço preenchido automaticamente.', '#16a34a');
            setTimeout(() => document.getElementById('numero').focus(), 500);
        }
    } catch {
        _cepInfo('<i class="fa-solid fa-circle-xmark"></i> Erro ao buscar CEP. Verifique sua conexão.', '#dc2626');
        cepInput.style.borderColor = '#dc2626';
    } finally {
        cepInput.disabled = false;
    }
}

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

    // Atualiza o maxHeight da seção para acomodar o novo conteúdo
    const sectionContent = container.closest('.section-content');
    if (sectionContent && sectionContent.style.display !== 'none') {
        sectionContent.style.maxHeight = sectionContent.scrollHeight + 'px';
    }
}

function removerTag(index) {
    tagsArray.splice(index, 1);
    renderizarTags();
}

// ========================================
// APENAS NÚMEROS
// ========================================

function apenasNumeros(event) {
    return /[0-9]/.test(String.fromCharCode(event.which));
}

// ========================================
// CONTADORES DE CARACTERES
// ========================================

function aplicarContadores() {
    [{ id: 'nomeEmpresa', max: 100 }, { id: 'nomeFantasia', max: 50 }, { id: 'identificacao', max: 15 }]
        .forEach(({ id, max }) => {
            const input = document.getElementById(id);
            if (!input) return;
            const counter = input.nextElementSibling;
            input.addEventListener('input', function() {
                if (counter && counter.classList.contains('char-counter')) {
                    counter.textContent = `${this.value.length}/${max} caracteres`;
                    counter.style.color = this.value.length > max * 0.9 ? '#f59e0b' : '#94a3b8';
                }
            });
        });
}

// ========================================
// LIMPAR FORMULÁRIO
// ========================================

function confirmarLimparDados() {
    if (confirm('Tem certeza que deseja limpar todos os dados do formulário?')) {
        limparFormulario();
        mostrarNotificacao('Formulário limpo!', 'info');
    }
}

function limparFormulario() {
    const form = document.getElementById('empresaForm');
    form.reset();

    document.getElementById('tipoCliente').checked = false;
    document.getElementById('tipoFornecedor').checked = false;
    document.getElementById('cadastro').disabled = true;
    document.getElementById('cadastro').placeholder = 'Selecione o tipo de cadastro primeiro';
    document.getElementById('labelCadastro').textContent = 'CNPJ/CPF';
    document.getElementById('numero').disabled = false;
    document.getElementById('numero').required = true;
    document.getElementById('semNumero').checked = false;
    document.getElementById('numeroRequired').style.display = 'inline';
    document.getElementById('empresaEditandoId').value = '';

    tagsArray = [];
    renderizarTags();

    document.querySelectorAll('.char-counter').forEach(c => {
        const m = c.textContent.match(/\/(\d+)/);
        if (m) { c.textContent = `0/${m[1]} caracteres`; c.style.color = '#94a3b8'; }
    });
    document.querySelectorAll('input, select').forEach(el => {
        el.style.borderColor = '#E5E7EB';
        el.classList.remove('error', 'success');
    });

    // Só abre a primeira seção
    document.querySelectorAll('.form-section').forEach((s, i) => {
        if (i === 0) {
            s.classList.add('active');
            s.querySelector('.section-content').style.display = 'block';
        } else {
            s.classList.remove('active');
            s.querySelector('.section-content').style.display = 'none';
        }
    });

    // Reset país para Brasil
    document.getElementById('pais').value = 'BR';
    onPaisChange();
}

// ========================================
// VALIDAÇÃO E ENVIO
// ========================================

function inicializarValidacao() {
    document.getElementById('empresaForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (validarFormulario()) salvarCadastro();
    });
}

function validarFormulario() {
    let valido = true;
    const pais = document.getElementById('pais').value;

    if (!document.getElementById('tipoCliente').checked && !document.getElementById('tipoFornecedor').checked) {
        mostrarNotificacao('Selecione pelo menos um tipo (Cliente ou Fornecedor)!', 'error');
        valido = false;
    }

    const obrigatorios = ['tipoCadastro', 'nomeEmpresa', 'cadastro', 'pais', 'estado', 'cidade', 'bairro', 'endereco', 'contato1'];
    if (pais === 'BR') obrigatorios.push('cep');
    if (!document.getElementById('semNumero').checked) obrigatorios.push('numero');

    obrigatorios.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && !campo.value.trim()) {
            campo.style.borderColor = '#dc2626';
            campo.classList.add('error');
            valido = false;
            campo.addEventListener('input', function() {
                this.style.borderColor = '#E5E7EB';
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

async function salvarCadastro() {
    const btnSalvar = document.querySelector('.btn-save');
    btnSalvar.classList.add('loading');
    btnSalvar.disabled = true;

    const tipos = [];
    if (document.getElementById('tipoCliente').checked) tipos.push('cliente');
    if (document.getElementById('tipoFornecedor').checked) tipos.push('fornecedor');

    const dados = {
        tipos,
        cadastro: document.getElementById('tipoCadastro').value,
        documento: document.getElementById('cadastro').value,
        nomeEmpresa: document.getElementById('nomeEmpresa').value,
        nomeFantasia: document.getElementById('nomeFantasia').value,
        pais: document.getElementById('pais').value,
        cep: document.getElementById('cep').value,
        estado: document.getElementById('estado').value,
        cidade: document.getElementById('cidade').value,
        bairro: document.getElementById('bairro').value,
        endereco: document.getElementById('endereco').value,
        numero: document.getElementById('numero').value,
        semNumero: document.getElementById('semNumero').checked,
        complemento: document.getElementById('complemento').value,
        contatoPrincipal: document.getElementById('contato1').value,
        contatoSecundario: document.getElementById('contato2').value,
        email: document.getElementById('email').value,
        identificacao: document.getElementById('identificacao').value,
        tags: tagsArray
    };

    const editandoId = document.getElementById('empresaEditandoId').value;
    const resultado = editandoId
        ? await window.supabaseAPI.editarEmpresa(editandoId, dados)
        : await window.supabaseAPI.salvarEmpresa(dados);

    btnSalvar.classList.remove('loading');
    btnSalvar.disabled = false;

    if (resultado.sucesso) {
        mostrarNotificacao(editandoId ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!', 'success');
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
    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
        mostrarNotificacao('Apenas arquivos Excel (.xlsx, .xls) ou PDF (.pdf) são permitidos.', 'error');
        input.value = '';
        return;
    }

    if (arquivo.size > 10 * 1024 * 1024) {
        mostrarNotificacao('O arquivo deve ter no máximo 10MB.', 'error');
        input.value = '';
        return;
    }

    mostrarNotificacao(`Processando "${arquivo.name}"...`, 'info');
    input.value = '';
}

// ========================================
// NOTIFICAÇÕES
// ========================================

function mostrarNotificacao(mensagem, tipo = 'info') {
    const icones = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const cores = { success: '#22C55E', error: '#dc2626', warning: '#f59e0b', info: '#4776ec' };

    const n = document.createElement('div');
    n.className = `notificacao notificacao-${tipo}`;
    n.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;
    n.style.cssText = `position:fixed;top:100px;right:20px;background:white;color:${cores[tipo]};padding:16px 24px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:12px;font-weight:600;z-index:99999;animation:slideIn .3s ease;border-left:4px solid ${cores[tipo]};max-width:400px;`;

    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideOut .3s ease'; setTimeout(() => n.remove(), 300); }, 5000);
}

const style = document.createElement('style');
style.textContent = `
@keyframes slideIn { from { transform:translateX(400px); opacity:0; } to { transform:translateX(0); opacity:1; } }
@keyframes slideOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(400px); opacity:0; } }
`;
document.head.appendChild(style);
