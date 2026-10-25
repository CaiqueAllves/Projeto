// ========================================
// FORMULÁRIOS — Aba Empresa (cadastro de empresas/parceiros: tags, contatos, marcas, documentos, CEP, CNPJ)
// ========================================
// Parte do antigo formularios.js (dividido por aba em 2026-10). Tudo continua
// global: funções de uma aba podem chamar as das outras e as de formularios.js.

let _empEditandoId = null;

async function salvarEmpresa(e) {
    e.preventDefault();
    if (!exigirEmpresaVinculada()) return;

    // Modo tenant: salva direto na tabela empresas e volta para perfil
    if (window._tenantEmpresaId) {
        function val(id) { return (document.getElementById(id)?.value || '').trim(); }
        const dados = {
            razao_social:  val('emp-nome'),
            nome_fantasia: val('emp-fantasia'),
            ie:            val('emp-ie'),
            im:            val('emp-im'),
            suframa:       val('emp-suframa'),
            cep:           val('emp-cep').replace(/\D/g, '') || null,
            estado:        val('emp-estado'),
            cidade:        val('emp-cidade'),
            endereco:      val('emp-endereco'),
            numero:        val('emp-numero') || null,
            complemento:   val('emp-complemento') || null,
        };
        const res = await window.supabaseAPI.atualizarTenantEmpresa(dados);
        if (res.sucesso) {
            // logo e contas bancárias da própria empresa (contas com parceiro_id NULL)
            const avisos = [];
            const logo = await logoCampoResolver('emp', 'logo');
            if (logo.mudou && !(await window.supabaseAPI.atualizarTenantEmpresa({ logo_url: logo.url })).sucesso) avisos.push('logo');
            if (!(await window.supabaseAPI.salvarContasBancarias(null, _empColetarContas())).sucesso) avisos.push('contas bancárias');
            if (avisos.length) mostrarNotificacao(`Dados salvos, mas não foi possível gravar: ${avisos.join(', ')}. Rode database-logo-marcas-contas-bancarias.sql.`, 'aviso');
            mostrarNotificacao('Dados da empresa atualizados!', 'sucesso');
            setTimeout(() => window.location.href = 'perfil.html?empresa_atualizada=1', 1200);
        } else {
            mostrarNotificacao('Erro ao salvar: ' + res.mensagem, 'erro');
        }
        return;
    }

    const modelo = document.querySelector('[name="emp_modelo"]:checked')?.value || 'empresa';

    // ── Tipos ────────────────────────────────
    const tipos = [];
    if (modelo === 'transportadora') {
        tipos.push('transportadora');
    } else {
        ['fabricante','cliente','fornecedor','remetente','comprador','importador'].forEach(t => {
            if (document.querySelector(`[name="tipo_${t}"]`)?.checked) tipos.push(t);
        });
        if (tipos.length === 0) {
            mostrarNotificacao('Selecione uma opção em "Tipo" de empresa: Fabricante, Fornecedor, Comprador ou Importador.', 'warning');
            return;
        }
    }

    // ── Validação por campo ───────────────────
    function val(id) { return (document.getElementById(id)?.value || '').trim(); }
    function marcar(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.borderColor = '#dc2626';
        el.addEventListener('input',  () => { el.style.borderColor = ''; }, { once: true });
        el.addEventListener('change', () => { el.style.borderColor = ''; }, { once: true });
    }
    function checar(id, msg) {
        if (!val(id)) { marcar(id); mostrarNotificacao(msg, 'warning'); return false; }
        return true;
    }

    if (!checar('emp-tipo-cadastro', 'Selecione o tipo de identificação da empresa (CNPJ ou CPF).')) return;
    if (!checar('emp-documento',     'Informe o Número de Identificação da empresa.')) return;
    if (!checar('emp-nome',          'Informe a Razão Social da empresa.')) return;

    const isBrasil = modelo === 'empresa' || modelo === 'transportadora' || modelo === 'trading';
    if (!isBrasil && !checar('emp-pais', 'Informe o País da empresa.')) return;
    if (isBrasil  && !checar('emp-ie',   'Informe a Inscrição Estadual.')) return;

    if (!checar('emp-estado',   'Informe o Estado.')) return;
    if (!checar('emp-cidade',   'Informe a Cidade.')) return;
    if (!checar('emp-bairro',   'Informe o Bairro.')) return;
    if (!checar('emp-endereco', 'Informe o Endereço.')) return;

    const numEl = document.getElementById('emp-numero');
    if (!numEl?.disabled && !val('emp-numero')) {
        marcar('emp-numero');
        mostrarNotificacao('Informe o Número do endereço (ou marque S/N).', 'warning');
        return;
    }

    const dados = {
        tipos,
        modelo,
        tipo_cadastro:       document.getElementById('emp-tipo-cadastro')?.value   || '',
        documento:           document.getElementById('emp-documento')?.value        || '',
        razao_social:        document.getElementById('emp-nome')?.value             || '',
        nome_fantasia:       document.getElementById('emp-fantasia')?.value         || '',
        inscricao_estadual:  document.getElementById('emp-ie')?.value              || '',
        suframa:             document.getElementById('emp-suframa')?.value          || '',
        pais:                _normalizarPais(document.getElementById('emp-pais-codigo')?.value || document.getElementById('emp-pais')?.value || ''),
        cep:                 document.getElementById('emp-cep')?.value              || '',
        estado:              document.getElementById('emp-estado')?.value           || '',
        cidade:              document.getElementById('emp-cidade')?.value           || '',
        bairro:              document.getElementById('emp-bairro')?.value           || '',
        endereco:            document.getElementById('emp-endereco')?.value         || '',
        numero:              document.getElementById('emp-numero')?.value           || '',
        complemento:         document.getElementById('emp-complemento')?.value     || '',
        codigo:              document.getElementById('emp-codigo')?.value           || '',
        coleta: {
            mesmo_fiscal: !!document.getElementById('emp-coleta-mesmo')?.checked,
            cep:          document.getElementById('emp-coleta-cep')?.value          || '',
            estado:       document.getElementById('emp-coleta-estado')?.value       || '',
            cidade:       document.getElementById('emp-coleta-cidade')?.value       || '',
            bairro:       document.getElementById('emp-coleta-bairro')?.value       || '',
            endereco:     document.getElementById('emp-coleta-endereco')?.value     || '',
            numero:       document.getElementById('emp-coleta-numero')?.value       || '',
            complemento:  document.getElementById('emp-coleta-complemento')?.value  || '',
            horario:      document.getElementById('emp-coleta-horario')?.value      || '',
            intervalo:    document.getElementById('emp-coleta-intervalo')?.value    || '',
        },
        site:                document.getElementById('emp-site')?.value             || '',
        horario_atendimento: document.getElementById('emp-horario')?.value         || '',
        tags:                _empTagsArray,
        observacoes:         document.getElementById('emp-obs')?.value             || '',
        contatos: [],
        financeiro: {
            pag_forma:      document.getElementById('fin-pag-forma')?.value      || '',
            pag_condicao:   document.getElementById('fin-pag-condicao')?.value   || '',
            pag_banco:      document.getElementById('fin-pag-banco')?.value      || '',
            pag_tipo_conta: document.getElementById('fin-pag-tipo-conta')?.value || '',
            pag_agencia:    document.getElementById('fin-pag-agencia')?.value    || '',
            pag_conta:      document.getElementById('fin-pag-conta')?.value      || '',
            rec_forma:      document.getElementById('fin-rec-forma')?.value      || '',
            rec_moeda:      document.getElementById('fin-rec-moeda')?.value      || '',
            rec_banco:      document.getElementById('fin-rec-banco')?.value      || '',
            rec_tipo_conta: document.getElementById('fin-rec-tipo-conta')?.value || '',
            rec_agencia:    document.getElementById('fin-rec-agencia')?.value    || '',
            rec_conta:      document.getElementById('fin-rec-conta')?.value      || '',
        },
    };

    document.querySelectorAll('#emp-contato-rows .contato-lista-row').forEach(row => {
        const ins = row.querySelectorAll('input');
        if (ins.length >= 4) {
            const tipo = ins[0].value.trim(), nome = ins[1].value.trim(),
                  email = ins[2].value.trim(), tel = ins[3].value.trim();
            if (tipo || nome || email || tel)
                dados.contatos.push({ tipo, nome, email, telefone: tel });
        }
    });

    const btn = document.querySelector('#form-empresa .btn-save');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    const res = _empEditandoId
        ? await window.supabaseAPI.editarEmpresa(_empEditandoId, dados)
        : await window.supabaseAPI.salvarEmpresa(dados);

    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; }

    if (res.sucesso) {
        const parceiroId = _empEditandoId || res.data?.id;
        if (parceiroId) await _empSalvarLogoMarcasContas(parceiroId);
        mostrarNotificacao(_empEditandoId ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!', 'sucesso');
        if (!_empEditandoId) {
            logoCampoDefinir('emp', null);
            document.getElementById('emp-contas-extra').innerHTML = '';
            document.getElementById('emp-marcas-lista').innerHTML = '';
            document.getElementById('form-empresa').reset();
            _empTagsArray = [];
            empRenderizarTags();
            _empContatoCount = 0;
            document.getElementById('emp-contato-rows').innerHTML = '';
            empContatoIniciar();
        } else {
            // Edição sempre abre numa aba nova (via editarEmpresa() em
            // cadastros.js) — fecha sozinha depois de dar tempo do usuário
            // ler a confirmação, em vez de deixar a aba parada sem próxima ação.
            _agendarFechamentoAutomatico();
        }
    } else {
        mostrarNotificacao('Erro ao salvar: ' + (res.mensagem || 'Tente novamente.'), 'erro');
    }
}

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
        <input type="text"  name="contato_${id}_tel"   placeholder="Número de telefone" inputmode="numeric" oninput="this.value=this.value.replace(/\D/g,'')">
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
        const excluirBrasil = input.getAttribute('data-excluir-brasil') === '1';
        let base = excluirBrasil
            ? _acPaises.filter(p => !['BR', 'BRA'].includes(p.codigo.toUpperCase()) && p.descricao.toLowerCase() !== 'brasil')
            : _acPaises;
        const filtrados = q
            ? base.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : base;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${escHtml(p.codigo)}" data-nome="${escHtml(p.descricao || '')}">
                <span class="ac-nome">${escHtml(p.descricao)}</span>
                <span class="ac-fantasia">${escHtml(p.codigo)}</span>
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
    window._empPaisAtualizar = atualizar;
    atualizar();
}

// ========================================
// MODELO DE EMPRESA
// ========================================

function onModeloChange(modelo) {
    const paisGroup      = document.getElementById('emp-pais')?.closest('.form-group');
    const paisInput      = document.getElementById('emp-pais');
    const paisCodigo     = document.getElementById('emp-pais-codigo');
    const ieGroup        = document.getElementById('emp-ie')?.closest('.form-group');
    const sufrGroup      = document.getElementById('btn-suframa')?.closest('.form-group');
    const tipoGroup      = document.getElementById('emp-tipo-group');
    const coletaDivider  = document.getElementById('emp-coleta-divider-wrapper');
    const coletaGroup    = document.getElementById('emp-coleta-group');
    const coletaHorarios = document.getElementById('emp-coleta-horarios');
    const secaoMarca     = document.getElementById('emp-secao-marca');
    const secaoFrota     = document.getElementById('emp-secao-frota');
    const codigoGroup    = document.getElementById('emp-codigo-group');
    const rntrcGroup     = document.getElementById('emp-rntrc-group');
    const imGroup        = document.getElementById('emp-im-group');

    const isTransp = modelo === 'transportadora';
    const isCompany = modelo === 'company';
    const ieInput = document.getElementById('emp-ie');

    // Highlight active modelo card
    document.querySelectorAll('.modelo-card').forEach(card => {
        const radio = card.querySelector('input[type="radio"]');
        card.classList.toggle('modelo-card--ativo', radio && radio.value === modelo);
    });

    // Transportadora-specific visibility
    if (tipoGroup)      tipoGroup.style.display      = isTransp ? 'none' : '';
    if (coletaDivider)  coletaDivider.style.display  = isTransp ? 'none' : '';
    if (coletaGroup)    coletaGroup.style.display     = isTransp ? 'none' : '';
    if (coletaHorarios) coletaHorarios.style.display  = isTransp ? 'none' : '';
    if (secaoMarca)     secaoMarca.style.display      = isTransp ? 'none' : '';
    if (secaoFrota)     secaoFrota.style.display      = isTransp ? '' : 'none';
    if (codigoGroup)    codigoGroup.style.display     = isTransp ? 'none' : '';
    if (rntrcGroup)     rntrcGroup.style.display      = isTransp ? '' : 'none';
    if (imGroup)        imGroup.style.display         = (modelo === 'empresa' || modelo === 'trading') ? '' : 'none';

    // Trading (exportação indireta) compra da empresa: já marca "Comprador"
    if (modelo === 'trading') {
        const comprador = document.querySelector('[name="tipo_comprador"]');
        if (comprador && !comprador.checked) { comprador.checked = true; comprador.dispatchEvent(new Event('change', { bubbles: true })); }
    }

    if (modelo === 'empresa' || modelo === 'transportadora' || modelo === 'trading') {
        // BR only — auto-set Brasil, hide country picker
        if (paisInput)  { paisInput.value = 'Brasil'; }
        if (paisCodigo) paisCodigo.value = 'BR';
        if (paisGroup)  paisGroup.style.display = 'none';
        if (ieGroup)    ieGroup.style.display = '';
        if (sufrGroup)  sufrGroup.style.display = '';
        if (window._empPaisAtualizar) window._empPaisAtualizar();
    } else if (isCompany) {
        // Foreign only — clear country, show picker but exclude Brasil
        if (paisInput)  { paisInput.value = ''; paisInput.setAttribute('data-excluir-brasil', '1'); }
        if (paisCodigo) paisCodigo.value = '';
        if (paisGroup)  paisGroup.style.display = '';
        if (ieGroup)    ieGroup.style.display = 'none';
        if (ieInput)    ieInput.value = '';
        if (sufrGroup)  sufrGroup.style.display = 'none';
        if (window._empPaisAtualizar) window._empPaisAtualizar();
    } else {
        // Outros — BR + foreign, show everything
        if (paisInput)  { paisInput.removeAttribute('data-excluir-brasil'); }
        if (paisGroup)  paisGroup.style.display = '';
        if (ieGroup)    ieGroup.style.display = '';
        if (sufrGroup)  sufrGroup.style.display = '';
        if (window._empPaisAtualizar) window._empPaisAtualizar();
    }
}

// ========================================
// DADOS PARA COLETA
// ========================================

function toggleDadosColeta(checked) {
    const campos      = document.getElementById('emp-coleta-campos');
    const coletaInput = document.getElementById('emp-coleta');
    if (!campos) return;

    if (checked) {
        campos.style.display = 'none';
        if (coletaInput) {
            const endereco = document.getElementById('emp-endereco')?.value || '';
            const numero   = document.getElementById('emp-numero')?.value   || '';
            const cidade   = document.getElementById('emp-cidade')?.value   || '';
            coletaInput.value         = [endereco, numero, cidade].filter(Boolean).join(', ');
            coletaInput.style.display = '';
        }
    } else {
        campos.style.display = '';
        if (coletaInput) coletaInput.style.display = 'none';
    }
}

function iniciarMascaraCEPColeta() {
    const cepInput = document.getElementById('emp-coleta-cep');
    if (!cepInput) return;

    cepInput.addEventListener('input', () => {
        let v = cepInput.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
        cepInput.value = v;
    });

    cepInput.addEventListener('blur', async () => {
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) return;
        try {
            const res   = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();
            if (!dados.erro) {
                const map = {
                    'emp-coleta-estado':   dados.uf         || '',
                    'emp-coleta-cidade':   dados.localidade || '',
                    'emp-coleta-bairro':   dados.bairro     || '',
                    'emp-coleta-endereco': dados.logradouro || '',
                };
                Object.entries(map).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el && !el.value) el.value = val;
                });
                setTimeout(() => document.getElementById('emp-coleta-numero')?.focus(), 300);
            }
        } catch (_) {}
    });
}

// ========================================
// MARCA
// ========================================

let _empMarcaCount = 0;

function empAdicionarMarca() {
    const lista = document.getElementById('emp-marcas-lista');
    if (!lista) return;
    if (lista.querySelectorAll('.marca-item').length >= 5) return;

    _empMarcaCount++;
    const id = _empMarcaCount;

    const div = document.createElement('div');
    div.className = 'marca-item';
    div.id = `marca-item-${id}`;
    div.innerHTML = `
        <div class="marca-item-preview" id="marca-preview-${id}">
            <i class="fa-solid fa-image marca-placeholder-icon"></i>
        </div>
        <div class="marca-item-body">
            <div class="marca-item-row">
                <label class="marca-upload-btn" for="marca-file-${id}">
                    <i class="fa-solid fa-upload"></i> Carregar imagem
                    <input type="file" id="marca-file-${id}" accept="image/*" style="display:none"
                        onchange="empPreviewMarca(this, ${id})">
                </label>
            </div>
            <input type="text" class="marca-nome-input" name="marca_nome_${id}" placeholder="Nome da marca (opcional)">
        </div>
        <button type="button" class="btn-remover-marca" onclick="empRemoverMarca(${id})" title="Remover marca">
            <i class="fa-solid fa-trash"></i>
        </button>`;
    lista.appendChild(div);
}

function empRemoverMarca(id) {
    document.getElementById(`marca-item-${id}`)?.remove();
}

function toggleSemMarcaGlobal(checkbox) {
    const lista  = document.getElementById('emp-marcas-lista');
    const addBtn = document.getElementById('btn-add-marca');
    const badge  = document.getElementById('marca-sem-badge');
    if (checkbox.checked) {
        if (lista)   lista.style.display  = 'none';
        if (addBtn)  addBtn.disabled      = true;
        if (addBtn)  addBtn.style.opacity = '0.4';
        if (badge)   badge.style.display  = '';
    } else {
        if (lista)   lista.style.display  = '';
        if (addBtn)  addBtn.disabled      = false;
        if (addBtn)  addBtn.style.opacity = '';
        if (badge)   badge.style.display  = 'none';
    }
}

function empPreviewMarca(input, id) {
    if (!input.files || !input.files[0]) return;
    const preview = document.getElementById(`marca-preview-${id}`);
    if (!preview) return;
    const reader = new FileReader();
    reader.onload = e => {
        preview.innerHTML = `<img src="${escHtml(e.target.result)}" alt="Marca" class="marca-preview-img">`;
    };
    reader.readAsDataURL(input.files[0]);
}

// ========================================
// DOCUMENTOS (EMPRESA FORM)
// ========================================

let _empDocCount = 0;
const _EMP_DOC_TIPOS = [
    'Contrato Social',
    'Cartão CNPJ',
    'Cartão Inscrição Estadual',
    'Inscrição no MAPA',
    'Inscrição no ANVISA',
    'Certificado',
    'Catálogo',
    'Número CRLV',
    'Número RCTR-C',
    'Número RCF-DC',
    'Outros'
];

function _empDocUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        return u.nome || u.email || 'Usuário';
    } catch { return 'Usuário'; }
}

function _empDocFormatarData(d) {
    const dias   = ['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
    const meses  = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
    return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()} às ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function _empDocFormatarTamanho(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1048576)    return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
}

function empAdicionarDocumento() {
    const lista = document.getElementById('emp-docs-lista');
    if (!lista) return;

    _empDocCount++;
    const id = _empDocCount;

    const tiposOpts = _EMP_DOC_TIPOS.map(t => `<option value="${t}">${t}</option>`).join('');
    const usuario   = _empDocUsuario();
    const dataStr   = _empDocFormatarData(new Date());

    const div = document.createElement('div');
    div.className = 'emp-doc-item';
    div.id = `emp-doc-item-${id}`;
    div.innerHTML = `
        <div class="emp-doc-item-top">
            <div class="emp-doc-item-fields">
                <div class="form-group emp-doc-tipo-group">
                    <label for="emp-doc-tipo-${id}">Tipo de Documento</label>
                    <select id="emp-doc-tipo-${id}" name="doc_tipo_${id}" onchange="empTipoDocChange(this, ${id})">
                        <option value="">Selecione...</option>
                        ${tiposOpts}
                    </select>
                </div>
                <div class="form-group emp-doc-outros-group" id="emp-doc-outros-group-${id}" style="display:none;">
                    <label for="emp-doc-outros-${id}">Descrição do Documento</label>
                    <input type="text" id="emp-doc-outros-${id}" name="doc_outros_${id}" placeholder="Descreva o tipo de documento...">
                </div>
            </div>
            <button type="button" class="btn-remover-doc-emp" onclick="empRemoverDocumento(${id})" title="Remover documento">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>

        <div class="emp-doc-fonte-toggle">
            <button type="button" class="emp-doc-fonte-btn ativo" id="emp-doc-fonte-arquivo-${id}" onclick="empToggleFonteDoc(${id},'arquivo')">
                <i class="fa-solid fa-file-arrow-up"></i> Arquivo local
            </button>
            <button type="button" class="emp-doc-fonte-btn" id="emp-doc-fonte-link-${id}" onclick="empToggleFonteDoc(${id},'link')">
                <i class="fa-solid fa-link"></i> Link externo
            </button>
        </div>

        <div class="emp-doc-file-area" id="emp-doc-area-arquivo-${id}">
            <div class="emp-doc-upload-zone" id="emp-doc-upload-zone-${id}">
                <label class="emp-doc-upload-btn" for="emp-doc-file-${id}">
                    <i class="fa-solid fa-file-arrow-up"></i> Selecionar PDF
                    <input type="file" id="emp-doc-file-${id}" accept=".pdf,application/pdf" style="display:none"
                        onchange="empPreviewDocumento(this, ${id})">
                </label>
                <span class="emp-doc-upload-hint">Somente arquivos .PDF</span>
            </div>
            <div class="emp-doc-uploaded" id="emp-doc-uploaded-${id}" style="display:none;">
                <div class="emp-doc-uploaded-info">
                    <i class="fa-solid fa-circle-check emp-doc-ok-icon"></i>
                    <div class="emp-doc-uploaded-meta">
                        <span class="emp-doc-uploaded-name" id="emp-doc-uploaded-name-${id}"></span>
                        <span class="emp-doc-uploaded-size" id="emp-doc-uploaded-size-${id}"></span>
                    </div>
                </div>
                <div class="emp-doc-uploaded-actions">
                    <button type="button" class="emp-doc-action-btn emp-doc-btn-ver" onclick="empVisualizarDoc(${id})" title="Visualizar">
                        <i class="fa-solid fa-eye"></i> Visualizar
                    </button>
                    <label class="emp-doc-action-btn emp-doc-btn-editar" for="emp-doc-file-${id}" title="Substituir arquivo">
                        <i class="fa-solid fa-pen"></i> Editar
                    </label>
                    <button type="button" class="emp-doc-action-btn emp-doc-btn-excluir" onclick="empRemoverArquivoDoc(${id})" title="Remover arquivo">
                        <i class="fa-solid fa-xmark"></i> Remover
                    </button>
                </div>
            </div>
        </div>

        <div class="emp-doc-file-area" id="emp-doc-area-link-${id}" style="display:none;">
            <div class="emp-doc-link-wrapper">
                <i class="fa-solid fa-cloud emp-doc-link-icon"></i>
                <div class="emp-doc-link-fields">
                    <input type="url" id="emp-doc-url-${id}" name="doc_url_${id}"
                        placeholder="Cole aqui o link do Google Drive, Dropbox, OneDrive..."
                        data-no-caps oninput="empAtualizarPreviewLink(${id})">
                    <span class="emp-doc-link-hint">O link deve estar configurado como "qualquer pessoa com o link pode visualizar"</span>
                </div>
            </div>
            <div class="emp-doc-uploaded-actions" id="emp-doc-link-actions-${id}" style="display:none;">
                <button type="button" class="emp-doc-action-btn emp-doc-btn-ver" onclick="empAbrirLinkDoc(${id})">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir link
                </button>
                <button type="button" class="emp-doc-action-btn emp-doc-btn-excluir" onclick="empLimparLinkDoc(${id})">
                    <i class="fa-solid fa-xmark"></i> Remover
                </button>
            </div>
        </div>

        <div class="emp-doc-footer">
            <i class="fa-solid fa-user"></i>
            <span>${escHtml(usuario)}</span>
            <span class="emp-doc-footer-sep">•</span>
            <i class="fa-regular fa-calendar"></i>
            <span id="emp-doc-data-${id}">${dataStr}</span>
        </div>`;
    lista.appendChild(div);
}

function empToggleFonteDoc(id, fonte) {
    const areaArquivo = document.getElementById(`emp-doc-area-arquivo-${id}`);
    const areaLink    = document.getElementById(`emp-doc-area-link-${id}`);
    const btnArquivo  = document.getElementById(`emp-doc-fonte-arquivo-${id}`);
    const btnLink     = document.getElementById(`emp-doc-fonte-link-${id}`);
    if (!areaArquivo || !areaLink) return;

    const isLink = fonte === 'link';
    areaArquivo.style.display = isLink ? 'none' : '';
    areaLink.style.display    = isLink ? '' : 'none';
    btnArquivo.classList.toggle('ativo', !isLink);
    btnLink.classList.toggle('ativo', isLink);
}

function empAtualizarPreviewLink(id) {
    const input   = document.getElementById(`emp-doc-url-${id}`);
    const actions = document.getElementById(`emp-doc-link-actions-${id}`);
    if (!input || !actions) return;
    const val = input.value.trim();
    actions.style.display = val ? '' : 'none';
}

function empAbrirLinkDoc(id) {
    const url = document.getElementById(`emp-doc-url-${id}`)?.value.trim();
    if (url) window.open(url, '_blank', 'noopener');
}

function empLimparLinkDoc(id) {
    const input   = document.getElementById(`emp-doc-url-${id}`);
    const actions = document.getElementById(`emp-doc-link-actions-${id}`);
    if (input)   input.value = '';
    if (actions) actions.style.display = 'none';
}

function empTipoDocChange(sel, id) {
    const outrosGroup = document.getElementById(`emp-doc-outros-group-${id}`);
    if (!outrosGroup) return;
    outrosGroup.style.display = sel.value === 'Outros' ? '' : 'none';
    if (sel.value !== 'Outros') {
        const outrosInput = document.getElementById(`emp-doc-outros-${id}`);
        if (outrosInput) outrosInput.value = '';
    }
}

function empRemoverDocumento(id) {
    document.getElementById(`emp-doc-item-${id}`)?.remove();
}

function empPreviewDocumento(input, id) {
    const file = input.files[0];
    if (!file) return;

    const uploadZone  = document.getElementById(`emp-doc-upload-zone-${id}`);
    const uploadedBox = document.getElementById(`emp-doc-uploaded-${id}`);
    const nameEl      = document.getElementById(`emp-doc-uploaded-name-${id}`);
    const sizeEl      = document.getElementById(`emp-doc-uploaded-size-${id}`);
    const dataEl      = document.getElementById(`emp-doc-data-${id}`);

    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = _empDocFormatarTamanho(file.size);
    if (dataEl) dataEl.textContent = _empDocFormatarData(new Date());

    if (uploadZone)  uploadZone.style.display  = 'none';
    if (uploadedBox) uploadedBox.style.display  = '';

    // store object URL for preview
    input._objectUrl = URL.createObjectURL(file);
}

function empRemoverArquivoDoc(id) {
    const fileInput   = document.getElementById(`emp-doc-file-${id}`);
    const uploadZone  = document.getElementById(`emp-doc-upload-zone-${id}`);
    const uploadedBox = document.getElementById(`emp-doc-uploaded-${id}`);

    if (fileInput) {
        if (fileInput._objectUrl) { URL.revokeObjectURL(fileInput._objectUrl); fileInput._objectUrl = null; }
        fileInput.value = '';
    }
    if (uploadZone)  uploadZone.style.display  = '';
    if (uploadedBox) uploadedBox.style.display  = 'none';
}

function empVisualizarDoc(id) {
    const fileInput = document.getElementById(`emp-doc-file-${id}`);
    const url = fileInput?._objectUrl;
    if (url) window.open(url, '_blank');
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
        if (tipoSelect.value === 'cnpj') {
            const digits = docInput.value.replace(/\D/g, '');
            if (digits.length === 14) _empBuscarCNPJ(digits);
        }
    });

    atualizar();
}

async function _empBuscarCNPJ(cnpj) {
    const set = (id, val) => {
        if (!val) return;
        const el = document.getElementById(id);
        if (el && !el.readOnly) el.value = String(val).trim().toUpperCase();
    };

    const docInput = document.getElementById('emp-documento');
    if (docInput) { docInput.style.background = '#fffbeb'; docInput.title = 'Consultando CNPJ...'; }

    try {
        const res  = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
        if (!res.ok) throw new Error('CNPJ não encontrado');
        const d = await res.json();

        set('emp-nome',        d.razao_social);
        set('emp-fantasia',    d.nome_fantasia);
        set('emp-ie',          d.inscricao_estadual || d.inscricoes_estaduais?.[0]?.inscricao_estadual);
        set('emp-estado',      d.uf);
        set('emp-cidade',      d.municipio);
        set('emp-bairro',      d.bairro);
        set('emp-endereco',    d.logradouro);
        set('emp-complemento', d.complemento);

        // Número
        const numEl = document.getElementById('emp-numero');
        if (numEl && d.numero && !numEl.disabled) numEl.value = d.numero;

        // CEP — dispara o autocomplete de endereço já existente
        const cepEl = document.getElementById('emp-cep');
        if (cepEl && d.cep) {
            cepEl.value = d.cep.replace(/\D/g, '').replace(/(\d{5})(\d{3})/, '$1-$2');
        }

        // Contato (e-mail e telefone do 1º contato)
        const primeiroContato = document.querySelector('#emp-contato-rows .contato-lista-row');
        if (primeiroContato) {
            const ins = primeiroContato.querySelectorAll('input');
            if (ins[2] && d.email)    ins[2].value = d.email.toLowerCase();
            if (ins[3] && d.ddd_telefone_1) ins[3].value = (d.ddd_telefone_1 || '').replace(/\D/g, '');
        }

        mostrarNotificacao('Dados do CNPJ preenchidos automaticamente.', 'sucesso');
        if (docInput) { docInput.style.background = '#f0fdf4'; docInput.title = ''; }

    } catch (err) {
        mostrarNotificacao('CNPJ não encontrado na Receita Federal.', 'aviso');
        if (docInput) { docInput.style.background = ''; docInput.title = ''; }
    }
}

function _empPreencherEdicao(dados) {
    if (!dados) return;

    _empEditandoId = dados.id;

    const set = (id, val) => {
        if (!val && val !== 0) return;
        const el = document.getElementById(id);
        if (!el) return;
        const v = String(val).trim();
        el.value = el.type === 'text' && !el.readOnly && !el.dataset.noCaps ? v.toUpperCase() : v;
    };

    // Modelo — usa o valor salvo, se existir (registros antigos sem essa coluna
    // caem no heurístico por país/transportadora como antes)
    let modelo = dados.modelo || 'empresa';
    if (!dados.modelo) {
        if (dados.is_transportadora) modelo = 'transportadora';
        else if (dados.pais && !['BR','BRASIL'].includes((dados.pais || '').toUpperCase())) modelo = 'company';
    }
    const modeloRadio = document.querySelector(`[name="emp_modelo"][value="${modelo}"]`);
    if (modeloRadio) { modeloRadio.checked = true; onModeloChange(modelo); }

    // Tipos
    ['fabricante', 'fornecedor', 'comprador', 'importador'].forEach(t => {
        const cb = document.querySelector(`[name="tipo_${t}"]`);
        if (cb) cb.checked = !!dados[`is_${t}`];
    });

    // Tipo de identificação
    const tipoCadEl = document.getElementById('emp-tipo-cadastro');
    if (tipoCadEl && dados.tipo_cadastro) {
        tipoCadEl.value = dados.tipo_cadastro;
        tipoCadEl.dispatchEvent(new Event('change'));
    }

    // Documento formatado
    const digitos = String(dados.documento || '').replace(/\D/g, '');
    let docFmt = digitos;
    if (digitos.length === 14) docFmt = digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    else if (digitos.length === 11) docFmt = digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    set('emp-documento', docFmt);

    set('emp-nome',        dados.razao_social);
    set('emp-fantasia',    dados.nome_fantasia);
    set('emp-ie',          dados.inscricao_estadual);
    set('emp-suframa',     dados.suframa);
    set('emp-cep',         dados.cep);
    set('emp-estado',      dados.estado);
    set('emp-cidade',      dados.cidade);
    set('emp-bairro',      dados.bairro);
    set('emp-endereco',    dados.endereco);
    set('emp-complemento', dados.complemento);
    set('emp-codigo',      dados.codigo);

    // Endereço de coleta (colunas parceiros.coleta_*, separado do fiscal)
    set('emp-coleta-cep',         dados.coleta_cep);
    set('emp-coleta-estado',      dados.coleta_estado);
    set('emp-coleta-cidade',      dados.coleta_cidade);
    set('emp-coleta-bairro',      dados.coleta_bairro);
    set('emp-coleta-endereco',    dados.coleta_endereco);
    set('emp-coleta-numero',      dados.coleta_numero);
    set('emp-coleta-complemento', dados.coleta_complemento);
    set('emp-coleta-horario',     dados.coleta_horario);
    set('emp-coleta-intervalo',   dados.coleta_intervalo);
    if (String(dados.coleta_numero || '').toUpperCase() === 'S/N') {
        const snColeta = document.getElementById('emp-coleta-numero')?.parentElement?.querySelector('.sn-toggle-inner');
        if (snColeta && !snColeta.classList.contains('ativo')) snColeta.click();
    }
    const coletaMesmoEl = document.getElementById('emp-coleta-mesmo');
    if (coletaMesmoEl) {
        coletaMesmoEl.checked = !!dados.coleta_mesmo_fiscal;
        if (typeof toggleDadosColeta === 'function') toggleDadosColeta(coletaMesmoEl.checked);
    }

    // País estrangeiro
    if (dados.pais && !['BR','BRASIL'].includes((dados.pais || '').toUpperCase())) {
        set('emp-pais', dados.pais);
        const paisCodEl = document.getElementById('emp-pais-codigo');
        if (paisCodEl) paisCodEl.value = dados.pais;
    }

    // Número
    if (String(dados.numero || '').toUpperCase() === 'S/N') {
        const snToggle = document.querySelector('#form-empresa .sn-toggle-inner');
        if (snToggle && !snToggle.classList.contains('ativo')) snToggle.click();
    } else {
        set('emp-numero', dados.numero);
    }

    // Tags
    if (dados.tags && dados.tags.length > 0) {
        _empTagsArray = [...dados.tags];
        empRenderizarTags();
    }

    // Contatos
    if (dados.contatos && dados.contatos.length > 0) {
        _empContatoCount = 0;
        document.getElementById('emp-contato-rows').innerHTML = '';
        dados.contatos.forEach(c => {
            empContatoAdicionar();
            const rows = document.querySelectorAll('#emp-contato-rows .contato-lista-row');
            const row  = rows[rows.length - 1];
            if (row) {
                const ins = row.querySelectorAll('input');
                if (ins[0]) ins[0].value = (c.tipo     || '').toUpperCase();
                if (ins[1]) ins[1].value = (c.nome     || '').toUpperCase();
                if (ins[2]) ins[2].value =  c.email    || '';
                if (ins[3]) ins[3].value =  c.telefone || '';
            }
        });
    }

    if (dados.id) _empCarregarLogoMarcasContas(dados.id);
}

// Própria empresa (modo tenant, vindo do Perfil): logo em empresas.logo_url e
// contas bancárias sem parceiro. Marcas são do cadastro de parceiros.
async function _empCarregarTenantLogoContas(empresaId) {
    document.getElementById('emp-secao-marca')?.style.setProperty('display', 'none');
    _empIniciarLogo();
    const { data: emp } = await supabaseClient.from('empresas').select('logo_url').eq('id', empresaId).maybeSingle();
    logoCampoDefinir('emp', emp?.logo_url || null);
    const contas = (await window.supabaseAPI.buscarContasBancarias(null)).data || [];
    if (!contas.length) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
    const [c1, ...resto] = contas;
    set('fin-rec-conta-id', c1.id);
    set('fin-rec-banco', c1.banco); set('fin-rec-agencia', c1.agencia); set('fin-rec-conta', c1.conta);
    set('fin-rec-tipo-conta', c1.tipo_conta); set('fin-rec-moeda', c1.moeda);
    set('fin-rec-swift', c1.swift); set('fin-rec-iban', c1.iban); set('fin-rec-end-banco', c1.endereco_banco);
    contasBancariasRender('emp-contas-extra', resto);
}

// ── Logo, Marcas e Contas bancárias (database-logo-marcas-contas-bancarias.sql) ──
function _empIniciarLogo() {
    const slot = document.getElementById('emp-logo-slot');
    if (slot && !slot.innerHTML.trim()) { slot.innerHTML = logoCampoHtml('emp'); logoCampoDefinir('emp', null); }
}

// Conta de "Recebimento" (campos fixos do formulário) + as extras
function _empColetarContas() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    const principal = {
        id: v('fin-rec-conta-id') || null,
        banco: v('fin-rec-banco'), agencia: v('fin-rec-agencia'), conta: v('fin-rec-conta'),
        tipo_conta: v('fin-rec-tipo-conta'), moeda: v('fin-rec-moeda'),
        swift: v('fin-rec-swift').toUpperCase(), iban: v('fin-rec-iban'), endereco_banco: v('fin-rec-end-banco'),
    };
    return [principal, ...contasBancariasColetar('emp-contas-extra')];
}

async function _empSalvarLogoMarcasContas(parceiroId) {
    const avisos = [];
    const logo = await logoCampoResolver('emp', 'logo');
    if (logo.mudou) {
        const { error } = await supabaseClient.from('parceiros').update({ logo_url: logo.url }).eq('id', parceiroId);
        if (error) avisos.push('logo');
    }
    // Marcas: envia as imagens novas e grava a lista
    const marcas = [];
    for (const item of document.querySelectorAll('#emp-marcas-lista .marca-item')) {
        const arquivo = item.querySelector('input[type="file"]')?.files?.[0];
        let url = item.dataset.url || null;
        if (arquivo) {
            const r = await window.supabaseAPI.enviarImagemLogo(arquivo, 'marca');
            if (r.sucesso) { url = r.url; item.dataset.url = url; } else avisos.push('imagem de marca');
        }
        const nome = item.querySelector('.marca-nome-input')?.value.trim() || null;
        if (nome || url) marcas.push({ nome, imagem_url: url });
    }
    const rMarcas = await window.supabaseAPI.salvarMarcasParceiro(parceiroId, marcas);
    if (!rMarcas.sucesso && marcas.length) avisos.push('marcas');
    const rContas = await window.supabaseAPI.salvarContasBancarias(parceiroId, _empColetarContas());
    if (!rContas.sucesso) avisos.push('contas bancárias');
    if (avisos.length) mostrarNotificacao(`Empresa salva, mas não foi possível gravar: ${avisos.join(', ')}. Rode database-logo-marcas-contas-bancarias.sql.`, 'aviso');
}

// Edição: financeiro (antes não carregava — salvar apagava), logo, marcas e contas
async function _empCarregarLogoMarcasContas(parceiroId) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
    const { data: fin } = await supabaseClient.from('parceiro_financeiro').select('*').eq('parceiro_id', parceiroId).maybeSingle();
    if (fin) {
        ['pag_forma', 'pag_condicao', 'pag_banco', 'pag_tipo_conta', 'pag_agencia', 'pag_conta', 'rec_forma', 'rec_moeda', 'rec_banco', 'rec_tipo_conta', 'rec_agencia', 'rec_conta']
            .forEach(k => set('fin-' + k.replace(/_/g, '-'), fin[k]));
    }
    const { data: parc } = await supabaseClient.from('parceiros').select('logo_url').eq('id', parceiroId).maybeSingle();
    _empIniciarLogo();
    logoCampoDefinir('emp', parc?.logo_url || null);

    const contas = (await window.supabaseAPI.buscarContasBancarias(parceiroId)).data || [];
    if (contas.length) {
        const [c1, ...resto] = contas;
        set('fin-rec-conta-id', c1.id);
        set('fin-rec-banco', c1.banco); set('fin-rec-agencia', c1.agencia); set('fin-rec-conta', c1.conta);
        set('fin-rec-tipo-conta', c1.tipo_conta); set('fin-rec-moeda', c1.moeda);
        set('fin-rec-swift', c1.swift); set('fin-rec-iban', c1.iban); set('fin-rec-end-banco', c1.endereco_banco);
        contasBancariasRender('emp-contas-extra', resto);
    }

    const marcas = (await window.supabaseAPI.buscarMarcasParceiro(parceiroId)).data || [];
    marcas.forEach(m => {
        empAdicionarMarca();
        const itens = document.querySelectorAll('#emp-marcas-lista .marca-item');
        const item = itens[itens.length - 1];
        if (!item) return;
        if (m.imagem_url) {
            item.dataset.url = m.imagem_url;
            const prev = item.querySelector('.marca-item-preview');
            if (prev) prev.innerHTML = `<img src="${_clcEsc(m.imagem_url)}" alt="Marca" class="marca-preview-img">`;
        }
        const nome = item.querySelector('.marca-nome-input');
        if (nome && m.nome) nome.value = m.nome;
    });
    // carregou depois do modo visualização ter travado o formulário: trava o que entrou agora
    if (document.querySelector('#form-empresa .btn-save')?.style.display === 'none') {
        document.querySelectorAll('#emp-contas-extra input, #emp-contas-extra select, #emp-contas-extra button, #emp-logo-slot input, #emp-logo-slot button, #emp-marcas-lista input, #emp-marcas-lista button')
            .forEach(el => { el.disabled = true; });
        document.querySelectorAll('#emp-logo-slot .logo-campo-acoes, .conta-bancaria-add').forEach(el => { el.style.display = 'none'; });
    }
}

function _empAtivarModoVisualizar() {
    const form = document.getElementById('form-empresa');
    if (!form) return;

    // Desabilita todos os campos
    form.querySelectorAll('input, select, textarea, button[type="button"]').forEach(el => {
        el.disabled = true;
    });

    // Esconde o botão de salvar e botões de ação internos
    form.querySelector('.btn-save')?.closest('.form-actions')?.style && (form.querySelector('.btn-save').closest('.form-actions').style.display = 'none');
    form.querySelectorAll('.btn-save, #btn-add-contato, #btn-add-idioma, #btn-add-desc-idioma, .btn-remover-contato, .btn-tag-remover, .emp-doc-upload-btn').forEach(el => {
        el.style.display = 'none';
    });

    // Banner de aviso no topo do formulário
    const banner = document.createElement('div');
    banner.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:10px 16px;margin-bottom:16px;display:flex;align-items:center;gap:10px;font-size:13px;color:#1d4ed8;font-weight:600;';
    banner.innerHTML = '<i class="fa-solid fa-eye"></i> Modo visualização — os campos estão somente para leitura.';
    form.prepend(banner);
}

function _empPreencherDoUpload(dados) {
    if (!dados || !Object.keys(dados).length) return;

    const set = (id, val) => {
        if (!val && val !== 0) return;
        const el = document.getElementById(id);
        if (!el) return;
        const v = String(val).trim();
        el.value = el.type === 'text' && !el.readOnly && !el.dataset.noCaps ? v.toUpperCase() : v;
    };

    // Modelo: empresa nacional (padrão) ou company se país estrangeiro
    const modelo = dados.pais && !['BR','BRASIL'].includes((dados.pais || '').toUpperCase()) ? 'company' : 'empresa';
    const modeloRadio = document.querySelector(`[name="emp_modelo"][value="${modelo}"]`);
    if (modeloRadio) { modeloRadio.checked = true; onModeloChange(modelo); }

    // Tipo de identificação — disparar change para habilitar o campo documento
    const tipoCadEl = document.getElementById('emp-tipo-cadastro');
    if (tipoCadEl && dados.tipo_cadastro) {
        tipoCadEl.value = dados.tipo_cadastro;
        tipoCadEl.dispatchEvent(new Event('change'));
    }

    set('emp-documento',   dados.documento);
    set('emp-nome',        dados.razao_social);
    set('emp-fantasia',    dados.nome_fantasia);
    set('emp-ie',          dados.inscricao_estadual);
    set('emp-suframa',     dados.suframa);
    set('emp-cep',         dados.cep);
    set('emp-estado',      dados.estado);
    set('emp-cidade',      dados.cidade);
    set('emp-bairro',      dados.bairro);
    set('emp-endereco',    dados.endereco);
    set('emp-complemento', dados.complemento);

    // País (autocomplete — preencher o campo de texto)
    if (dados.pais && !['BR','BRASIL'].includes((dados.pais || '').toUpperCase())) {
        set('emp-pais', dados.pais);
    }

    // Número
    if (dados.numero) {
        if (String(dados.numero).toUpperCase() === 'S/N') {
            const snToggle = document.querySelector('#form-empresa .sn-toggle-inner');
            if (snToggle && !snToggle.classList.contains('ativo')) snToggle.click();
        } else {
            set('emp-numero', dados.numero);
        }
    }

    // Se tiver CEP mas não endereço, dispara busca automática
    const cepEl = document.getElementById('emp-cep');
    if (cepEl && cepEl.value.replace(/\D/g, '').length === 8 && !dados.endereco) {
        buscarCEPEmpresa();
    }

    // Contato (e-mail e telefone do 1º contato)
    const primeiroContato = document.querySelector('#emp-contato-rows .contato-lista-row');
    if (primeiroContato && (dados.email_contato || dados.telefone_contato)) {
        const ins = primeiroContato.querySelectorAll('input');
        if (ins[2] && dados.email_contato)    ins[2].value = dados.email_contato.toLowerCase();
        if (ins[3] && dados.telefone_contato) ins[3].value = String(dados.telefone_contato).replace(/\D/g, '');
    }
}
