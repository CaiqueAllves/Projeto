// ========================================
//  FORMULÁRIOS — JS
// ========================================

// Normaliza país para código interno — Brasil sempre como 'BRASIL'
function _normalizarPais(valor) {
    if (!valor) return '';
    const v = valor.trim().toUpperCase();
    if (['BR', 'BRA', 'BRASIL', 'BRAZIL'].includes(v)) return 'BRASIL';
    return valor.trim();
}

// Trocar aba
function mudarTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="' + tabId + '"]').classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
    const url = new URL(window.location);
    url.searchParams.set('tab', tabId);
    window.history.replaceState({}, '', url);
    if (typeof destacarMenuAtivo === 'function') destacarMenuAtivo();
}

// Toggle seção colapsável
function toggleSection(titleEl) {
    const section = titleEl.closest('.form-section');
    const content = section.querySelector('.section-content');
    const isActive = section.classList.contains('active');
    section.classList.toggle('active');
    content.style.display = isActive ? 'none' : 'block';
}

function toggleLogSub(headerEl) {
    const section = headerEl.closest('.log-sub-section');
    const body = section.querySelector('.log-sub-body');
    const isActive = section.classList.contains('active');
    section.classList.toggle('active');
    body.style.display = isActive ? 'none' : 'block';
}

// Limpar formulário
function limparForm(formId) {
    if (confirm('Deseja limpar todos os campos?')) {
        document.getElementById(formId).reset();
    }
}

let _empEditandoId = null;

async function salvarEmpresa(e) {
    e.preventDefault();

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
        ['fabricante','cliente','fornecedor','remetente'].forEach(t => {
            if (document.querySelector(`[name="tipo_${t}"]`)?.checked) tipos.push(t);
        });
        if (tipos.length === 0) {
            mostrarNotificacao('Selecione pelo menos um Tipo de empresa.', 'warning');
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

    if (!checar('emp-tipo-cadastro', 'Selecione o tipo de identificação da empresa (CNPJ, CPF ou Outros).')) return;
    if (!checar('emp-documento',     'Informe o Número de Identificação da empresa.')) return;
    if (!checar('emp-nome',          'Informe a Razão Social da empresa.')) return;

    const isBrasil = modelo === 'empresa' || modelo === 'transportadora';
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
        mostrarNotificacao(_empEditandoId ? 'Empresa atualizada com sucesso!' : 'Empresa cadastrada com sucesso!', 'sucesso');
        if (!_empEditandoId) {
            document.getElementById('form-empresa').reset();
            _empTagsArray = [];
            empRenderizarTags();
            _empContatoCount = 0;
            document.getElementById('emp-contato-rows').innerHTML = '';
            empContatoIniciar();
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
let _prodEditandoId = null;

// Recalcula margem/lucro líquido a partir dos valores brutos — os campos
// prod-margem/prod-lucro-liquido só guardam texto formatado ("12,34%",
// "R$ 123,45") pra exibição, não dá pra salvar isso direto como número.
function _prodCalcularMargemLucroBrutos() {
    const preco = _prodValorMonetario(document.getElementById('prod-preco-venda'));
    const custo = _prodValorMonetario(document.getElementById('prod-preco-custo'));
    const fixos = _prodValorMonetario(document.getElementById('prod-custos-fixos'));
    const taxas = _prodValorMonetario(document.getElementById('prod-imposto'));
    const lucro = preco - (custo + fixos + taxas);
    return {
        margem:        preco > 0 ? Number(((lucro / preco) * 100).toFixed(4)) : null,
        lucro_liquido: preco > 0 ? Number(lucro.toFixed(4)) : null,
    };
}

// Idiomas do nome/descrição — linha base (prod-nome-idioma) + até 3 linhas
// extras (prodAdicionarIdiomaExtra). Guardado como array pra poder ser
// selecionado depois na hora de gerar documentação de proposta/processo.
function _prodColetarIdiomas() {
    const idiomas = [];

    const idiomaBase = document.getElementById('prod-nome-idioma')?.value || 'pt';
    idiomas.push({
        idioma:       idiomaBase,
        idioma_outro: idiomaBase === 'outro' ? (document.getElementById('prod-nome-idioma-outro')?.value.trim() || '') : null,
        nome:         document.getElementById('prod-nome')?.value.trim() || '',
        descricao:    document.getElementById('prod-descricao')?.value.trim() || '',
    });

    document.querySelectorAll('#prod-idiomas-extra-container > div[id^="prod-idioma-row-"]').forEach(row => {
        const idioma    = row.querySelector('select[name^="idioma_idioma_"]')?.value || 'pt';
        const idiomaOut = row.querySelector('input[name^="idioma_outro_"]')?.value.trim() || '';
        const nome      = row.querySelector('input[name^="nome_idioma_"]')?.value.trim() || '';
        const descricao = row.querySelector('textarea[name^="descricao_idioma_"]')?.value.trim() || '';
        if (!nome && !descricao) return; // linha extra deixada em branco
        idiomas.push({ idioma, idioma_outro: idioma === 'outro' ? idiomaOut : null, nome, descricao });
    });

    return idiomas;
}

// Documentos — só os do tipo "Link externo" são persistidos: o tipo "Arquivo
// local" ainda não tem bucket de Storage configurado nesta app (o arquivo só
// existe como object URL temporário no navegador, se perde ao recarregar).
function _prodColetarDocumentos() {
    const documentos = [];
    document.querySelectorAll('#prod-docs-lista > div[id^="prod-doc-item-"]').forEach(item => {
        const id  = item.id.replace('prod-doc-item-', '');
        const tipo = document.getElementById(`prod-doc-tipo-${id}`)?.value || '';
        if (!tipo) return;
        const ehLink = document.getElementById(`prod-doc-fonte-link-${id}`)?.classList.contains('ativo');
        if (!ehLink) return;
        const url = document.getElementById(`prod-doc-url-${id}`)?.value.trim() || '';
        if (!url) return;
        const descricao = document.getElementById(`prod-doc-desc-${id}`)?.value.trim() || null;
        documentos.push({ tipo, descricao, url });
    });
    return documentos;
}

function _coletarDadosProduto() {
    const g  = id => document.getElementById(id)?.value.trim() || '';
    const gv = id => _prodValorMonetario(document.getElementById(id));
    const { margem, lucro_liquido } = _prodCalcularMargemLucroBrutos();

    return {
        sku:                    g('prod-sku'),
        nome:                   g('prod-nome'),
        status:                 g('prod-status') || 'ativo',
        ncm:                    g('prod-ncm'),
        cest:                   g('prod-cest'),
        gtin:                   g('prod-gtin'),
        hscode:                 g('prod-hscode'),
        naladi_nesh:            g('prod-naladi-nesh'),
        dun14:                  g('prod-dun14'),
        ncm_utrib:              g('prod-ncm-utrib'),
        ncm_descricao:          g('prod-ncm-descricao'),
        ncm_descricao_completa: g('prod-ncm-descricao-completa'),
        imagem_url:             g('prod-imagem-url'),
        descricao:              g('prod-descricao'),
        categoria:              g('prod-categoria'),
        tipo:                   g('prod-tipo'),
        marca:                  g('prod-marca'),
        unidade_medida:         g('prod-unidade'),
        lote:                   g('prod-lote'),
        data_fabricacao:        g('prod-data-fabricacao') || null,
        data_validade:          g('prod-data-validade') || null,
        referencia_interna:     g('prod-ref-interna'),
        referencia_fornecedor:  g('prod-ref-fornecedor'),
        referencia_outra:       g('prod-ref-outra'),
        empresa_parceira_id:    g('prod-empresa-id') || null,
        preco_custo:            gv('prod-preco-custo')   || null,
        custos_fixos:           gv('prod-custos-fixos')  || null,
        imposto:                gv('prod-imposto')       || null,
        preco_venda:            gv('prod-preco-venda')   || null,
        margem,
        lucro_liquido,
        moeda:                  g('prod-moeda-codigo'),
        obs_preco:              g('prod-obs-preco'),
        controla_estoque:       document.getElementById('prod-controla-estoque')?.checked ?? true,
        venda_sem_estoque:      document.getElementById('prod-venda-sem-estoque')?.checked ?? false,
        estoque_atual:          parseFloat(g('prod-estoque-atual'))   || null,
        estoque_minimo:         parseFloat(g('prod-estoque-minimo'))  || null,
        estoque_maximo:         parseFloat(g('prod-estoque-maximo'))  || null,
        obs_estoque:            g('prod-obs-estoque'),
        obs_logistica:          g('prod-obs-logistica'),
        nomes_idiomas:          _prodColetarIdiomas(),
        embalagens:             _prodEmbalagens,
        documentos:             _prodColetarDocumentos(),
    };
}

async function salvarProduto(e) {
    e.preventDefault();

    const dados = _coletarDadosProduto();
    if (!dados.sku)  { alert('Informe o SKU do produto.');           document.getElementById('prod-sku')?.focus();  return; }
    if (!dados.nome) { alert('Informe o Nome do Produto.');          document.getElementById('prod-nome')?.focus(); return; }

    const btn = document.querySelector('#form-produto .btn-save');
    const textoOriginal = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...'; }

    const jaExistia = !!_prodEditandoId;
    const res = jaExistia
        ? await window.supabaseAPI.editarProduto(_prodEditandoId, dados)
        : await window.supabaseAPI.salvarProduto(dados);

    if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }

    if (!res.sucesso) {
        mostrarNotificacao('Erro ao salvar produto: ' + (res.mensagem || 'Tente novamente.'), 'erro');
        return;
    }

    if (!jaExistia && res.data?.id) _prodEditandoId = res.data.id;
    mostrarNotificacao(jaExistia ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'sucesso');
}

function _prodFormatarMonetario(num) {
    if (num === null || num === undefined || num === '') return '';
    return Number(num).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function _prodPreencherEdicao(dados) {
    if (!dados) return;
    _prodEditandoId = dados.id;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };

    set('prod-sku', dados.sku);
    set('prod-nome', dados.nome);
    set('prod-status', dados.status || 'ativo');
    set('prod-ncm', dados.ncm);
    set('prod-cest', dados.cest);
    set('prod-gtin', dados.gtin);
    set('prod-hscode', dados.hscode);
    set('prod-naladi-nesh', dados.naladi_nesh);
    set('prod-dun14', dados.dun14);
    set('prod-ncm-utrib', dados.ncm_utrib);
    set('prod-ncm-descricao', dados.ncm_descricao);
    set('prod-ncm-descricao-completa', dados.ncm_descricao_completa);
    set('prod-imagem-url', dados.imagem_url);
    set('prod-descricao', dados.descricao);
    set('prod-categoria', dados.categoria);
    set('prod-tipo', dados.tipo);
    set('prod-marca', dados.marca);
    set('prod-unidade', dados.unidade_medida);
    set('prod-lote', dados.lote);
    set('prod-data-fabricacao', dados.data_fabricacao);
    set('prod-data-validade', dados.data_validade);
    set('prod-ref-interna', dados.referencia_interna);
    set('prod-ref-fornecedor', dados.referencia_fornecedor);
    set('prod-ref-outra', dados.referencia_outra);

    // Empresa parceira ("Identificação da Empresa") — busca à parte só pra exibir
    // nome/documento, já que buscarProdutoPorId não traz esse join.
    if (dados.empresa_parceira_id) {
        set('prod-empresa-id', dados.empresa_parceira_id);
        try {
            const { data: emp } = await supabaseClient.from('empresas')
                .select('razao_social, nome_fantasia, documento').eq('id', dados.empresa_parceira_id).single();
            if (emp) {
                set('prod-empresa-busca', emp.nome_fantasia || emp.razao_social);
                set('prod-empresa-doc', emp.documento);
            }
        } catch (_) {}
    }

    set('prod-preco-custo', _prodFormatarMonetario(dados.preco_custo));
    set('prod-custos-fixos', _prodFormatarMonetario(dados.custos_fixos));
    set('prod-imposto', _prodFormatarMonetario(dados.imposto));
    set('prod-preco-venda', _prodFormatarMonetario(dados.preco_venda));
    set('prod-obs-preco', dados.obs_preco);

    // Moeda — mesma lógica: hidden guarda o código, texto exibido busca a descrição
    if (dados.moeda) {
        set('prod-moeda-codigo', dados.moeda);
        try {
            const moedas = await _carregarMoedas();
            const m = (moedas || []).find(x => x.codigo === dados.moeda);
            set('prod-moeda', m?.descricao || dados.moeda);
        } catch (_) { set('prod-moeda', dados.moeda); }
    }

    const controlaEl = document.getElementById('prod-controla-estoque');
    if (controlaEl) controlaEl.checked = dados.controla_estoque !== false;
    const vendaSemEl = document.getElementById('prod-venda-sem-estoque');
    if (vendaSemEl) vendaSemEl.checked = !!dados.venda_sem_estoque;
    set('prod-estoque-atual', dados.estoque_atual);
    set('prod-estoque-minimo', dados.estoque_minimo);
    set('prod-estoque-maximo', dados.estoque_maximo);
    set('prod-obs-estoque', dados.obs_estoque);
    set('prod-obs-logistica', dados.obs_logistica);

    if (typeof prodAtualizarEstoqueConfig === 'function') prodAtualizarEstoqueConfig();
    if (typeof prodCalcularNivelEstoque   === 'function') prodCalcularNivelEstoque();
    if (typeof prodCalcularResultados     === 'function') prodCalcularResultados();

    // Idiomas: linha base + recria as extras (máx. 3) já salvas
    const idiomas = dados.nomes_idiomas || [];
    if (idiomas[0]) {
        set('prod-nome-idioma', idiomas[0].idioma || 'pt');
        set('prod-nome', idiomas[0].nome ?? dados.nome);
        set('prod-descricao', idiomas[0].descricao ?? dados.descricao);
        const selBase = document.getElementById('prod-nome-idioma');
        if (selBase) prodToggleIdiomaOutro(selBase);
        if (idiomas[0].idioma === 'outro') set('prod-nome-idioma-outro', idiomas[0].idioma_outro);
    }
    idiomas.slice(1).forEach(item => {
        prodAdicionarIdiomaExtra();
        const rows = document.querySelectorAll('#prod-idiomas-extra-container > div[id^="prod-idioma-row-"]');
        const row  = rows[rows.length - 1];
        if (!row) return;
        const selectEl = row.querySelector('select[name^="idioma_idioma_"]');
        const outroEl  = row.querySelector('input[name^="idioma_outro_"]');
        const nomeEl   = row.querySelector('input[name^="nome_idioma_"]');
        const descEl   = row.querySelector('textarea[name^="descricao_idioma_"]');
        if (selectEl) { selectEl.value = item.idioma || 'pt'; prodToggleIdiomaOutro(selectEl); }
        if (outroEl && item.idioma === 'outro') outroEl.value = item.idioma_outro || '';
        if (nomeEl) nomeEl.value = item.nome || '';
        if (descEl) descEl.value = item.descricao || '';
    });

    // Embalagens — array pronto, só re-renderiza a tabela
    _prodEmbalagens = dados.embalagens || [];
    if (typeof _prodRenderTabelaEmbalagens === 'function') _prodRenderTabelaEmbalagens();

    // Documentos (só os do tipo link — arquivos locais nunca foram persistidos)
    (dados.documentos || []).forEach(doc => {
        prodAdicionarDocumento();
        const id = _prodDocCount;
        const tipoEl = document.getElementById(`prod-doc-tipo-${id}`);
        if (tipoEl) { tipoEl.value = doc.tipo || ''; prodTipoDocChange(tipoEl, id); }
        const descEl = document.getElementById(`prod-doc-desc-${id}`);
        if (descEl && doc.descricao) descEl.value = doc.descricao;
        prodToggleFonteDoc(id, 'link');
        const urlEl = document.getElementById(`prod-doc-url-${id}`);
        if (urlEl) { urlEl.value = doc.url || ''; prodAtualizarPreviewLink(id); }
    });
}

// Pré-preenchimento vindo do upload de Excel/PDF em produtos.html — só os
// campos escalares simples do topo do formulário (o parser não tenta
// extrair estrutura aninhada como embalagens/idiomas/documentos).
async function _prodPreencherDoUpload(dados) {
    if (!dados || !Object.keys(dados).length) return;

    const set = (id, val) => {
        if (val === undefined || val === null || val === '') return;
        const el = document.getElementById(id);
        if (el) el.value = val;
    };

    set('prod-sku', dados.sku);
    set('prod-nome', dados.nome);
    set('prod-descricao', dados.descricao);
    set('prod-categoria', dados.categoria);
    set('prod-tipo', dados.tipo);
    set('prod-marca', dados.marca);
    set('prod-ncm', dados.ncm);
    set('prod-unidade', dados.unidade_medida);
    set('prod-status', dados.status || 'ativo');
    set('prod-estoque-atual', dados.estoque_atual);
    set('prod-estoque-minimo', dados.estoque_minimo);

    if (dados.preco_custo != null) set('prod-preco-custo', _prodFormatarMonetario(dados.preco_custo));
    if (dados.preco_venda != null) set('prod-preco-venda', _prodFormatarMonetario(dados.preco_venda));

    if (dados.moeda) {
        set('prod-moeda-codigo', dados.moeda);
        try {
            const moedas = await _carregarMoedas();
            const m = (moedas || []).find(x => x.codigo === dados.moeda);
            set('prod-moeda', m?.descricao || dados.moeda);
        } catch (_) { set('prod-moeda', dados.moeda); }
    }

    if (typeof prodCalcularResultados === 'function') prodCalcularResultados();

    mostrarNotificacao('Dados do arquivo preenchidos automaticamente. Confira antes de salvar.', 'sucesso');
}

// ========================================
// SALVAR — PROCESSO
// ========================================

function salvarProcesso(e) {
    e.preventDefault();

    const tipo = document.getElementById('proc-tipo')?.value;
    if (!tipo) {
        mostrarNotificacao('Selecione o Tipo do processo antes de salvar.', 'warning');
        document.getElementById('proc-tipo')?.focus();
        return;
    }

    const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;
    if (emissorTipo === 'terceiro' && !document.getElementById('proc-cliente-id')?.value) {
        mostrarNotificacao('Selecione o Remetente antes de salvar.', 'warning');
        document.getElementById('proc-cliente')?.focus();
        return;
    }

    const modal = document.getElementById('modal-confirmar-salvar');
    modal.dataset.origem = 'processo';
    modal.style.display = 'flex';
}

function fecharConfirmSalvar() {
    document.getElementById('modal-confirmar-salvar').style.display = 'none';
}

async function confirmarSalvar() {
    const origem = document.getElementById('modal-confirmar-salvar').dataset.origem || 'processo';
    fecharConfirmSalvar();

    if (origem === 'proposta') {
        const dados = _coletarDadosProposta();
        const btnSim = document.querySelector('#modal-confirmar-salvar .modal-confirm-sim');

        const editandoId = document.getElementById('prop-id')?.value || '';
        const res = editandoId
            ? await window.supabaseAPI.atualizarProforma(editandoId, dados)
            : await window.supabaseAPI.salvarProposta(dados);

        const posModal = document.getElementById('modal-pos-salvo');
        posModal.dataset.origem = origem;

        if (res.sucesso) {
            const codigo = res.data?.codigo || dados.codigo;
            const tituloEl  = document.getElementById('pos-salvo-titulo');
            const msgEl     = document.getElementById('pos-salvo-msg');
            const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
            const codigoEl  = document.getElementById('pos-salvo-codigo');
            const pdfWrap   = document.getElementById('pos-salvo-pdf-wrap');
            const pdfBtn    = document.getElementById('pos-salvo-pdf-btn');

            if (tituloEl)   tituloEl.textContent  = editandoId ? 'Proforma atualizada!' : 'Proforma salva!';
            if (msgEl)      msgEl.textContent      = 'O que deseja fazer agora?';
            if (codigoEl)   codigoEl.textContent   = codigo;
            if (codigoWrap) codigoWrap.style.display = '';
            if (pdfWrap)    pdfWrap.style.display    = '';
            if (pdfBtn) {
                pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Gerar PDF da Proposta';
                pdfBtn.onclick   = () => gerarPDFProposta();
            }

            posModal.style.display = 'flex';

            // Proforma gerada a partir de um Pedido: vincula de volta ao pedido
            const pedidoOrigemId = document.getElementById('prop-pedido-id')?.value || '';
            if (!editandoId && pedidoOrigemId && res.data?.id) {
                await window.supabaseAPI.vincularProformaAoPedido(pedidoOrigemId, res.data.id);
            }

            // Auto-gerar PDF ao salvar (layout unificado — precisa do registro
            // completo, não só id/codigo, por isso salvarProposta/atualizarProforma
            // agora retornam a linha inteira)
            _propUltimoSalvo = res.data;
            gerarPDFProposta();
        } else {
            mostrarNotificacao('Erro ao salvar proposta: ' + (res.mensagem || 'Tente novamente.'), 'erro');
        }
        return;
    }

    // Processo — salvar no Supabase
    const dadosProc = _coletarDadosProcesso();
    const editandoIdProc = document.getElementById('proc-id')?.value || '';

    // Propaga o pedido de origem: se o processo nasce de uma proforma que por
    // sua vez veio de um pedido, vincula o processo diretamente ao pedido
    // (evita depender do salto processo → proforma_id → pedidos.proforma_id)
    if (!editandoIdProc && dadosProc.proforma_id && !dadosProc.pedido_id) {
        const resPedOrigem = await window.supabaseAPI.buscarPedidoIdPorProforma(dadosProc.proforma_id);
        if (resPedOrigem?.data?.id) dadosProc.pedido_id = resPedOrigem.data.id;
    }

    const resProc = editandoIdProc
        ? await window.supabaseAPI.atualizarProcesso(editandoIdProc, dadosProc)
        : await window.supabaseAPI.salvarProcesso(dadosProc);

    const posModal = document.getElementById('modal-pos-salvo');
    posModal.dataset.origem = origem;

    if (resProc.sucesso) {
        localStorage.setItem('processos_updated', Date.now());

        // Processo gerado a partir de uma proforma: marca a proforma como finalizada
        const propostaOrigemId = document.getElementById('proc-proposta-id')?.value || '';
        if (!editandoIdProc && propostaOrigemId && resProc.data?.id) {
            await window.supabaseAPI.marcarProformaFinalizada(propostaOrigemId, resProc.data.id);
        }

        // Processo gerado a partir de um pedido: avança o status pra "Em produção"
        if (!editandoIdProc && dadosProc.pedido_id) {
            await window.supabaseAPI.avancarStatusPedido(dadosProc.pedido_id, 'em_producao');
        }

        const tituloEl   = document.getElementById('pos-salvo-titulo');
        const msgEl      = document.getElementById('pos-salvo-msg');
        const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
        const codigoEl   = document.getElementById('pos-salvo-codigo');
        const pdfWrap    = document.getElementById('pos-salvo-pdf-wrap');
        const pdfBtn     = document.getElementById('pos-salvo-pdf-btn');

        const numeroProcesso = resProc.data?.numero_processo || '—';

        if (tituloEl)   tituloEl.textContent = editandoIdProc ? 'Processo atualizado!' : 'Processo salvo!';
        if (msgEl)      msgEl.textContent    = 'O que deseja fazer agora?';
        if (codigoEl)   codigoEl.textContent = numeroProcesso;
        if (codigoWrap) codigoWrap.style.display = '';
        if (pdfWrap)    pdfWrap.style.display    = '';
        if (pdfBtn) {
            pdfBtn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Gerar PDF do Processo';
            pdfBtn.onclick   = () => gerarPDFProcesso();
        }

        posModal.style.display = 'flex';
    } else {
        mostrarNotificacao('Erro ao salvar processo: ' + (resProc.mensagem || 'Tente novamente.'), 'erro');
    }
}

async function procCarregarEdicao(id) {
    const res = await window.supabaseAPI.buscarProcessoPorId(id);
    if (!res.sucesso || !res.data) {
        mostrarNotificacao('Processo não encontrado.', 'erro');
        return;
    }
    const p = res.data;

    // Preenche campos do formulário
    const set = (sel, val) => { const el = document.getElementById(sel); if (el && val != null) el.value = val; };
    const fire = (sel, evt) => document.getElementById(sel)?.dispatchEvent(new Event(evt));

    // Dados do Processo
    set('proc-tipo',            p.tipo);
    set('proc-proposito',       p.proposito);
    set('proc-documento-tipo',  p.documento_tipo);
    set('proc-documento',       p.documento);
    set('proc-incoterm',        p.incoterm);
    fire('proc-incoterm', 'change');
    set('proc-modal',           p.modal);
    fire('proc-modal', 'change');
    set('proc-observacoes',     p.observacoes);
    set('proc-codigo',          p.numero_processo);

    if (p.emissor_tipo === 'terceiro') {
        const radio = document.getElementById('proc-emissor-terceiro');
        if (radio) { radio.checked = true; fire('proc-emissor-terceiro', 'change'); }
        if (p.remetente_parceiro_id) {
            const { data: remetente } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').eq('id', p.remetente_parceiro_id).single();
            if (remetente) {
                set('proc-cliente',    remetente.nome_fantasia || remetente.razao_social);
                set('proc-cliente-id', remetente.id);
            }
        }
    }

    // Status / prazos / container
    set('proc-status',            p.status);
    fire('proc-status', 'change');
    set('proc-data-abertura',     p.data_abertura);
    set('proc-data-embarque',     p.data_embarque);
    set('proc-data-chegada',      p.data_chegada);
    set('proc-data-cancelamento', p.data_cancelamento);
    set('proc-obs-prazos',        p.obs_prazos);
    set('proc-container-tipo',    p.container_tipo);
    set('proc-container-num',    p.container_numero);

    // Origem
    set('proc-origem-pais',        p.pais_origem);
    set('proc-origem-pais-codigo', p.origem_pais_codigo);
    set('proc-navio',              p.navio);
    set('proc-aeronave',           p.aeronave);
    set('proc-porto-origem',       p.porto_origem);
    set('proc-aeroporto-origem',   p.aeroporto_origem);
    set('proc-fronteira-saida',    p.fronteira_saida);
    const oe = p.origem_endereco || {};
    set('proc-origem-cep',         oe.cep);
    set('proc-origem-estado',      oe.estado);
    set('proc-origem-cidade',      oe.cidade);
    set('proc-origem-bairro',      oe.bairro);
    set('proc-origem-endereco',    oe.endereco);
    set('proc-origem-numero',      oe.numero);
    set('proc-origem-complemento', oe.complemento);
    const oc = p.origem_coleta || {};
    const coletaMesmoEl = document.getElementById('proc-origem-coleta-mesmo');
    if (coletaMesmoEl) coletaMesmoEl.checked = !!oc.mesmo;
    set('proc-origem-coleta-cep',         oc.cep);
    set('proc-origem-coleta-estado',      oc.estado);
    set('proc-origem-coleta-cidade',      oc.cidade);
    set('proc-origem-coleta-bairro',      oc.bairro);
    set('proc-origem-coleta-endereco',    oc.endereco);
    set('proc-origem-coleta-numero',      oc.numero);
    set('proc-origem-coleta-complemento', oc.complemento);
    set('proc-origem-coleta-horario',     oc.horario);
    set('proc-origem-coleta-intervalo',   oc.intervalo);

    // Destino
    if (p.empresa_parceira_id) {
        const { data: dest } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia, documento').eq('id', p.empresa_parceira_id).single();
        if (dest) {
            set('proc-emp-dest-busca',    dest.nome_fantasia || dest.razao_social);
            set('proc-emp-dest-id',       dest.id);
            set('proc-emp-dest-auto-doc', dest.documento);
        }
    }
    set('proc-destino-pais',        p.pais_destino);
    set('proc-destino-pais-codigo', p.destino_pais_codigo);
    set('proc-porto-destino',       p.porto_destino);
    set('proc-aeroporto-destino',   p.aeroporto_destino);
    set('proc-fronteira-entrada',   p.fronteira_entrada);
    const de = p.destino_endereco || {};
    set('proc-destino-cep',         de.cep);
    set('proc-destino-estado',      de.estado);
    set('proc-destino-cidade',      de.cidade);
    set('proc-destino-bairro',      de.bairro);
    set('proc-destino-endereco',    de.endereco);
    set('proc-destino-numero',      de.numero);
    set('proc-destino-complemento', de.complemento);
    const dr = p.destino_responsavel || {};
    set('proc-destino-responsavel',         dr.nome);
    set('proc-destino-responsavel-contato', dr.contato);
    set('proc-destino-responsavel-email',   dr.email);

    if (typeof restaurarIntermediarios === 'function') restaurarIntermediarios(p.rota_intermediarios || []);

    // Etapas
    if (Array.isArray(p.etapas) && p.etapas.length && typeof renderEtapas === 'function') {
        _etapas = p.etapas;
        renderEtapas();
    }

    // Documentos
    const docs = p.documentos || {};
    Object.entries(docs).forEach(([chave, valor]) => set(`doc-num-${chave}`, valor));

    // Transporte
    const t = p.transporte || {};
    set('transp-tipo',              t.tipo);
    set('transp-nome',              t.nome);
    set('transp-razao',             t.razao);
    set('transp-cnpj',              t.cnpj);
    set('transp-num-coleta',        t.num_coleta);
    set('transp-tipo-veiculo',      t.tipo_veiculo);
    set('transp-placa',             t.placa);
    set('transp-motorista',         t.motorista);
    set('transp-motorista-cnh',     t.motorista_cnh);
    set('transp-motorista-contato', t.motorista_contato);
    set('transp-data-coleta',       t.data_coleta);
    set('transp-data-entrega',      t.data_entrega);
    set('transp-frete-moeda',       t.frete_moeda);
    set('transp-frete-valor',       t.frete_valor);
    set('transp-frete-incoterm',    t.frete_incoterm);
    set('transp-seguro',            t.seguro);
    set('transp-obs',               t.obs);

    // Proforma de origem
    set('proc-proposta-id', p.proforma_id);
    set('proc-pedido-id',   p.pedido_id);

    // Guarda ID para atualização
    const idEl = document.getElementById('proc-id');
    if (idEl) idEl.value = p.id;

    // Exibe número do processo no título
    const titulo = document.querySelector('#tab-processo .section-title span');
    if (titulo && p.numero_processo) titulo.textContent = `Editar Processo — ${p.numero_processo}`;
}

function procAplicarModoVisualizacao() {
    const form = document.getElementById('form-processo');
    if (!form) return;

    form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="button"]').forEach(el => {
        el.disabled = true;
    });

    const actions = form.querySelector('.form-actions');
    if (actions) actions.style.display = 'none';

    const banner = document.createElement('div');
    banner.style.cssText = 'position:sticky;top:0;z-index:100;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.3px;border-radius:8px;margin-bottom:12px;';
    banner.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Modo Visualização — somente leitura';
    form.insertBefore(banner, form.firstChild);
}

function _coletarDadosProcesso() {
    const v = id => document.getElementById(id)?.value?.trim() || null;
    const destinatarioId = document.getElementById('proc-emp-dest-id')?.value || null;
    const remetenteId    = document.getElementById('proc-cliente-id')?.value || null;

    return {
        // Dados do Processo
        proforma_id:            document.getElementById('proc-proposta-id')?.value || null,
        pedido_id:               document.getElementById('proc-pedido-id')?.value || null,
        tipo:                   v('proc-tipo'),
        proposito:              v('proc-proposito'),
        emissor_tipo:            document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value || 'usuario',
        documento_tipo:          v('proc-documento-tipo'),
        documento:               v('proc-documento'),
        remetente_parceiro_id:   remetenteId,
        incoterm:                v('proc-incoterm'),
        modal:                   v('proc-modal'),
        observacoes:             v('proc-observacoes'),

        // Status / prazos / container
        status:                  document.getElementById('proc-status')?.value || 'aberto',
        data_abertura:           document.getElementById('proc-data-abertura')?.value || null,
        data_embarque:           document.getElementById('proc-data-embarque')?.value || null,
        data_chegada:            document.getElementById('proc-data-chegada')?.value || null,
        data_cancelamento:       document.getElementById('proc-data-cancelamento')?.value || null,
        obs_prazos:              v('proc-obs-prazos'),
        container_tipo:          v('proc-container-tipo'),
        container_numero:        v('proc-container-num'),

        // Origem
        pais_origem:             v('proc-origem-pais'),
        origem_pais_codigo:      v('proc-origem-pais-codigo'),
        navio:                   v('proc-navio'),
        aeronave:                v('proc-aeronave'),
        porto_origem:            v('proc-porto-origem'),
        aeroporto_origem:        v('proc-aeroporto-origem'),
        fronteira_saida:         v('proc-fronteira-saida'),
        origem_endereco: {
            cep:         v('proc-origem-cep'),
            estado:      v('proc-origem-estado'),
            cidade:      v('proc-origem-cidade'),
            bairro:      v('proc-origem-bairro'),
            endereco:    v('proc-origem-endereco'),
            numero:      v('proc-origem-numero'),
            complemento: v('proc-origem-complemento'),
        },
        origem_coleta: {
            mesmo:       !!document.getElementById('proc-origem-coleta-mesmo')?.checked,
            cep:         v('proc-origem-coleta-cep'),
            estado:      v('proc-origem-coleta-estado'),
            cidade:      v('proc-origem-coleta-cidade'),
            bairro:      v('proc-origem-coleta-bairro'),
            endereco:    v('proc-origem-coleta-endereco'),
            numero:      v('proc-origem-coleta-numero'),
            complemento: v('proc-origem-coleta-complemento'),
            horario:     v('proc-origem-coleta-horario'),
            intervalo:   v('proc-origem-coleta-intervalo'),
        },

        // Destino
        empresa_parceira_id:     destinatarioId,
        pais_destino:            v('proc-destino-pais'),
        destino_pais_codigo:     v('proc-destino-pais-codigo'),
        porto_destino:           v('proc-porto-destino'),
        aeroporto_destino:       v('proc-aeroporto-destino'),
        fronteira_entrada:       v('proc-fronteira-entrada'),
        destino_endereco: {
            cep:         v('proc-destino-cep'),
            estado:      v('proc-destino-estado'),
            cidade:      v('proc-destino-cidade'),
            bairro:      v('proc-destino-bairro'),
            endereco:    v('proc-destino-endereco'),
            numero:      v('proc-destino-numero'),
            complemento: v('proc-destino-complemento'),
        },
        destino_responsavel: {
            nome:    v('proc-destino-responsavel'),
            contato: v('proc-destino-responsavel-contato'),
            email:   v('proc-destino-responsavel-email'),
        },

        rota_intermediarios: (typeof coletarIntermediarios === 'function') ? coletarIntermediarios() : [],

        // Etapas
        etapas: (typeof _etapas !== 'undefined') ? _etapas : [],

        // Documentos (numeração — sem arquivos anexados)
        documentos: {
            proforma:   v('doc-num-proforma'),
            commercial: v('doc-num-commercial'),
            packing:    v('doc-num-packing'),
            due:        v('doc-num-due'),
            le:         v('doc-num-le'),
            certorigem: v('doc-num-certorigem'),
            ctn:        v('doc-num-ctn'),
            nfe:        v('doc-num-nfe'),
            awb:        v('doc-num-awb'),
            manifesto:  v('doc-num-manifesto'),
            fcl:        v('doc-num-fcl'),
            lcl:        v('doc-num-lcl'),
            bl:         v('doc-num-bl'),
            apolice:    v('doc-num-apolice'),
            crt:        v('doc-num-crt'),
            micdta:     v('doc-num-micdta'),
        },

        // Transporte
        transporte: {
            tipo:               v('transp-tipo'),
            nome:               v('transp-nome'),
            razao:              v('transp-razao'),
            cnpj:               v('transp-cnpj'),
            num_coleta:         v('transp-num-coleta'),
            tipo_veiculo:       v('transp-tipo-veiculo'),
            placa:              v('transp-placa'),
            motorista:          v('transp-motorista'),
            motorista_cnh:      v('transp-motorista-cnh'),
            motorista_contato:  v('transp-motorista-contato'),
            data_coleta:        document.getElementById('transp-data-coleta')?.value || null,
            data_entrega:       document.getElementById('transp-data-entrega')?.value || null,
            frete_moeda:        v('transp-frete-moeda'),
            frete_valor:        v('transp-frete-valor'),
            frete_incoterm:     v('transp-frete-incoterm'),
            seguro:             v('transp-seguro'),
            obs:                v('transp-obs'),
        },
    };
}

// Alias mantido para compatibilidade com HTML existente
function confirmarSalvarProcesso() { confirmarSalvar(); }

function criarNovo() {
    const origem = document.getElementById('modal-pos-salvo').dataset.origem || 'processo';
    document.getElementById('modal-pos-salvo').style.display = 'none';
    // Notificar a aba pai para recarregar a lista
    try {
        if (window.opener && !window.opener.closed) {
            if (typeof window.opener.profCarregarLista === 'function') window.opener.profCarregarLista();
            if (typeof window.opener.carregarProcessos === 'function') window.opener.carregarProcessos();
        }
    } catch (e) {}
    if (origem === 'proposta') {
        document.getElementById('form-proposta')?.reset();
        _propItens = [];
        propRenderizarItens();
        propGerarCodigo();
        const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
        const pdfWrap    = document.getElementById('pos-salvo-pdf-wrap');
        if (codigoWrap) codigoWrap.style.display = 'none';
        if (pdfWrap)    pdfWrap.style.display    = 'none';
    } else {
        document.getElementById('form-processo')?.reset();
    }
}

function fecharGuia() {
    document.getElementById('modal-pos-salvo').style.display = 'none';
    // Notificar a aba pai para recarregar a lista
    try {
        if (window.opener && !window.opener.closed) {
            if (typeof window.opener.profCarregarLista === 'function') window.opener.profCarregarLista();
            if (typeof window.opener.carregarProcessos === 'function') window.opener.carregarProcessos();
        }
    } catch (e) {}
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

    const erros = [];
    let primeiroEl = null;

    function marcar(id, mensagem) {
        const el = document.getElementById(id);
        if (el) {
            el.style.borderColor = '#dc2626';
            const limpar = () => { el.style.borderColor = ''; };
            el.addEventListener('input',  limpar, { once: true });
            el.addEventListener('change', limpar, { once: true });
            if (!primeiroEl) primeiroEl = el;
        }
        erros.push(mensagem);
    }

    function checar(id, msg) {
        const el = document.getElementById(id);
        if (!el) return;
        const vazio = el.tagName === 'SELECT' ? !el.value : !el.value?.trim();
        if (vazio) marcar(id, msg);
    }

    // ── Dados da Proforma ──────────────────
    checar('prop-tipo',      'Selecione o Tipo da proforma.');
    checar('prop-proposito', 'Selecione o Propósito da proforma.');

    const emissorTipo = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value || 'usuario';
    if (emissorTipo === 'terceiro') {
        checar('prop-cliente', 'Selecione o Remetente (Terceiro).');
    }

    checar('prop-documento', 'Informe o Número de Identificação do emissor.');
    checar('prop-modal',     'Selecione o Modal de transporte.');

    const modal = document.getElementById('prop-modal')?.value;
    checar('prop-incoterm',  'Selecione o Incoterm.');

    // ── Rota ──────────────────────────────
    checar('prop-origem-pais',  'Informe o País de Origem.');
    checar('prop-destino-pais', 'Informe o País de Destino.');

    if (modal === 'maritimo') {
        checar('prop-porto-origem',  'Informe o Porto de Origem.');
        checar('prop-porto-destino', 'Informe o Porto de Destino.');
    } else if (modal === 'aereo') {
        checar('prop-aeroporto-origem',  'Informe o Aeroporto de Origem.');
        checar('prop-aeroporto-destino', 'Informe o Aeroporto de Destino.');
    } else if (modal === 'terrestre') {
        checar('prop-fronteira-saida',   'Informe a Fronteira de Saída.');
        checar('prop-fronteira-entrada', 'Informe a Fronteira de Entrada.');
    }

    // ── Destinatário ──────────────────────
    const btnCad = document.getElementById('prop-btn-emp-dest-cadastrada');
    if (btnCad?.classList.contains('ativo')) {
        checar('prop-emp-dest-busca', 'Selecione o Destinatário.');
    } else {
        checar('prop-emp-dest-razao', 'Informe a Razão Social do Destinatário.');
    }
    if (!btnCad?.classList.contains('ativo')) {
        checar('prop-emp-dest-doc', 'Informe a identificação fiscal do Destinatário.');
    }

    // ── Datas ─────────────────────────────
    checar('prop-validade-dias', 'Selecione a Validade da proposta.');

    // ── Itens ─────────────────────────────
    if (!_propItens || _propItens.length === 0) {
        erros.push('Adicione pelo menos um item à proforma.');
    } else {
        _propItens.forEach((item, i) => {
            if (!item.produto?.trim()) erros.push(`Item ${i + 1}: informe o nome do produto.`);
            if (!(item.qtd  > 0))     erros.push(`Item ${i + 1}: a quantidade deve ser maior que zero.`);
            if (!(item.preco > 0))    erros.push(`Item ${i + 1}: o preço deve ser maior que zero.`);
        });
    }

    // ── Condições Comerciais ───────────────
    checar('prop-forma-pagamento', 'Selecione a Forma de Pagamento.');
    checar('prop-prazo-pagamento', 'Selecione o Prazo de Pagamento.');

    if (document.getElementById('prop-prazo-pagamento')?.value === 'personalizado') {
        checar('prop-prazo-personalizado', 'Informe a condição de pagamento personalizada.');
    }

    // ── Pedido de origem (obrigatório para proforma nova) ──
    const _propIdExistente = document.getElementById('prop-id')?.value || '';
    if (!_propIdExistente && !document.getElementById('prop-pedido-id')?.value) {
        erros.push('Esta proforma precisa ser gerada a partir de um Pedido. Volte para Pedidos e use "Gerar Proforma".');
    }

    // ── Resultado ─────────────────────────
    if (erros.length > 0) {
        mostrarNotificacao(erros[0], 'warning');
        primeiroEl?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // ── Abre modal de confirmação ──
    const modalEl = document.getElementById('modal-confirmar-salvar');
    modalEl.dataset.origem = 'proposta';
    const titulo = modalEl.querySelector('.modal-confirm-title');
    const msg    = modalEl.querySelector('.modal-confirm-msg');
    if (titulo) titulo.textContent = 'Salvar Proposta';
    if (msg)    msg.textContent    = 'Deseja salvar as informações desta proposta?';
    modalEl.style.display = 'flex';
}


// ========================================
// PDF — PROPOSTA
// ========================================
// Layout unificado com o PDF gerado a partir de registros já salvos (Proforma
// e Pedidos) — pdf-proforma.js:gerarPDFProformaDados(d), formato A4 paisagem.
// _propUltimoSalvo é preenchido em confirmarSalvar() logo após o insert/update.

let _propUltimoSalvo = null;

async function gerarPDFProposta() {
    if (!_propUltimoSalvo) {
        mostrarNotificacao('Não há uma proforma salva pra gerar o PDF.', 'erro');
        return;
    }
    await gerarPDFProformaDados(_propUltimoSalvo);
}

// ========================================
// PROPOSTA — PRAZO PERSONALIZADO
// ========================================

function togglePrazoPersonalizado(valor) {
    const grupo = document.getElementById('prop-prazo-personalizado-group');
    if (grupo) grupo.style.display = valor === 'personalizado' ? '' : 'none';
    if (valor !== 'personalizado') {
        const input = document.getElementById('prop-prazo-personalizado');
        if (input) input.value = '';
    }
}

// ========================================
// PROPOSTA — COLETAR DADOS
// ========================================

function _coletarDadosProposta() {
    const g = id => document.getElementById(id)?.value || '';
    const emissorTipo = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value || 'usuario';
    const prazo = g('prop-prazo-pagamento');

    return {
        codigo:              g('prop-codigo'),
        idioma:              g('prop-idioma'),
        idioma_outro:        g('prop-idioma') === 'outro' ? (g('prop-idioma-outro') || null) : null,
        tipo:                g('prop-tipo'),
        proposito:           g('prop-proposito'),
        emissor_tipo:        emissorTipo,
        parceiro_id:         g('prop-cliente-id') || null,
        // Snapshot em texto do nome do remetente terceiro — parceiro_id só é
        // válido quando aponta pra um registro real de "empresas"; quando a
        // proforma nasce de um Pedido, o remetente vem de "parceiros" (tabela
        // diferente, outro espaço de ID), então esse texto é o que garante a
        // exibição correta mesmo sem um parceiro_id (empresas) válido.
        parceiro_razao_social: emissorTipo === 'terceiro' ? (g('prop-cliente') || null) : null,
        documento:           g('prop-documento'),
        documento_tipo:      g('prop-documento-tipo'),
        modal:               g('prop-modal'),
        incoterm:            g('prop-incoterm'),
        origem_pais:         g('prop-origem-pais'),
        origem_pais_codigo:  g('prop-origem-pais-codigo'),
        destino_pais:        g('prop-destino-pais'),
        destino_pais_codigo: g('prop-destino-pais-codigo'),
        porto_origem:        g('prop-porto-origem'),
        porto_destino:       g('prop-porto-destino'),
        aeroporto_origem:    g('prop-aeroporto-origem'),
        aeroporto_destino:   g('prop-aeroporto-destino'),
        fronteira_saida:     g('prop-fronteira-saida'),
        fronteira_entrada:   g('prop-fronteira-entrada'),
        forma_pagamento:     g('prop-forma-pagamento'),
        prazo_pagamento:     prazo === 'personalizado' ? (g('prop-prazo-personalizado') || 'personalizado') : prazo,
        condicoes_obs:       g('prop-condicoes-obs'),
        observacoes:         g('prop-observacoes'),
        data_emissao:        g('prop-data-emissao') || null,
        data_validade:       g('prop-data-validade') || null,
        itens:               _propItens || [],
        valor_total:         (_propItens || []).reduce((s, i) => s + (i.qtd * i.preco), 0),
        moeda_principal:     _propItens?.find(i => i.moeda)?.moeda || 'USD',
        destinatario_id:         g('prop-emp-dest-id') || null,
        destinatario_razao_social: g('prop-emp-dest-razao') || null,
        destinatario_doc:        g('prop-emp-dest-doc') || null,
        destinatario_doc_tipo:   g('prop-emp-dest-doc-tipo') || null,
        validade_dias:           g('prop-validade-dias') || null,
        obs_status:              g('prop-obs-status') || null,
        pedido_id:               g('prop-pedido-id') || null,
    };
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
            (e.razao_social  || '').toLowerCase().includes(q) ||
            (e.nome_fantasia || '').toLowerCase().includes(q))
        : _acEmpresas;

    if (filtradas.length === 0) {
        listaEl.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
    } else {
        listaEl.innerHTML = filtradas.slice(0, 30).map(e => `
            <div class="autocomplete-item"
                 data-id="${e.id}"
                 data-nome="${(e.razao_social || '').replace(/"/g, '&quot;')}"
                 data-doc="${(e.documento || '').replace(/"/g, '&quot;')}"
                 data-pais="${(e.pais || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${e.razao_social || ''}</span>
                ${e.nome_fantasia ? `<span class="ac-fantasia">${e.nome_fantasia}</span>` : ''}
            </div>`).join('');
    }
    _acPosicionar(inputEl, listaEl);
    listaEl.classList.add('aberta');
}

function _acFechar(listaEl) {
    listaEl.classList.remove('aberta');
}

function _acMostrarProformas(inputEl, listaEl, termo) {
    const q = (termo || '').trim().toLowerCase();
    const filtradas = q
        ? _acPropostas.filter(p => (p.nome || '').toLowerCase().includes(q))
        : _acPropostas;

    if (filtradas.length === 0) {
        listaEl.innerHTML = '<div class="autocomplete-vazio">Nenhuma proforma encontrada</div>';
    } else {
        listaEl.innerHTML = filtradas.slice(0, 30).map(p => `
            <div class="autocomplete-item"
                 data-id="${p.id}"
                 data-nome="${(p.nome || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.nome || ''}</span>
            </div>`).join('');
    }
    _acPosicionar(inputEl, listaEl);
    listaEl.classList.add('aberta');
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
    const input  = document.getElementById('proc-origem-pais');
    const lista  = document.getElementById('proc-origem-pais-lista');
    const codigo = document.getElementById('proc-origem-pais-codigo');
    if (!input || !lista || !codigo) return;

    async function mostrarPaises() {
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
        const excluirBrasil = input.getAttribute('data-excluir-brasil') === '1';
        let base = excluirBrasil
            ? _acPaises.filter(p => !['BR', 'BRA'].includes(p.codigo.toUpperCase()) && p.descricao.toLowerCase() !== 'brasil')
            : _acPaises;
        const filtrados = q
            ? base.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : base;
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
    const tipoCadSel     = document.getElementById('emp-tipo-cadastro');
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
    if (imGroup)        imGroup.style.display         = modelo === 'empresa' ? '' : 'none';

    if (modelo === 'empresa' || modelo === 'transportadora') {
        // BR only — auto-set Brasil, hide country picker
        if (paisInput)  { paisInput.value = 'Brasil'; }
        if (paisCodigo) paisCodigo.value = 'BR';
        if (paisGroup)  paisGroup.style.display = 'none';
        if (ieGroup)    ieGroup.style.display = '';
        if (sufrGroup)  sufrGroup.style.display = '';
        if (tipoCadSel) {
            Array.from(tipoCadSel.options).forEach(o => { o.style.display = o.value === 'outros' ? 'none' : ''; });
            if (tipoCadSel.value === 'outros') tipoCadSel.value = '';
        }
        if (window._empPaisAtualizar) window._empPaisAtualizar();
    } else if (isCompany) {
        // Foreign only — clear country, show picker but exclude Brasil
        if (paisInput)  { paisInput.value = ''; paisInput.setAttribute('data-excluir-brasil', '1'); }
        if (paisCodigo) paisCodigo.value = '';
        if (paisGroup)  paisGroup.style.display = '';
        if (ieGroup)    ieGroup.style.display = 'none';
        if (ieInput)    ieInput.value = '';
        if (sufrGroup)  sufrGroup.style.display = 'none';
        if (tipoCadSel) {
            Array.from(tipoCadSel.options).forEach(o => {
                o.style.display = o.value === 'outros' ? 'none' : '';
            });
            if (tipoCadSel.value === 'outros') tipoCadSel.value = '';
        }
        if (window._empPaisAtualizar) window._empPaisAtualizar();
    } else {
        // Outros — BR + foreign, show everything
        if (paisInput)  { paisInput.removeAttribute('data-excluir-brasil'); }
        if (paisGroup)  paisGroup.style.display = '';
        if (ieGroup)    ieGroup.style.display = '';
        if (sufrGroup)  sufrGroup.style.display = '';
        if (tipoCadSel) Array.from(tipoCadSel.options).forEach(o => { o.style.display = ''; });
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
        preview.innerHTML = `<img src="${e.target.result}" alt="Marca" class="marca-preview-img">`;
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
                    <label>Tipo de Documento</label>
                    <select id="emp-doc-tipo-${id}" name="doc_tipo_${id}" onchange="empTipoDocChange(this, ${id})">
                        <option value="">Selecione...</option>
                        ${tiposOpts}
                    </select>
                </div>
                <div class="form-group emp-doc-outros-group" id="emp-doc-outros-group-${id}" style="display:none;">
                    <label>Descrição do Documento</label>
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
            <span>${usuario}</span>
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
// PRODUTO — DOCUMENTOS
// ========================================

let _prodDocCount = 0;

const _PROD_DOC_TIPOS = ['FICHA TÉCNICA', 'FISPQ / FDS', 'HACCP', 'CERTIFICADO', 'Outros'];

const _PROD_DOC_INFO = {
    'FISPQ / FDS': '(Ficha de Informações de Segurança de Produtos Químicos) ou (Ficha com Dados de Segurança), é um documento técnico obrigatório que detalha os riscos, manuseio, transporte e descarte de produtos químicos.',
    'HACCP': 'O HACCP ou APPCC, na (sigla em português) é um sistema de gestão de segurança alimentar, serve para identificar, avaliar e controlar riscos físicos, químicos e biológicos, prevenindo contaminações e garantindo que o produto seja seguro para o consumidor.',
};

function prodAdicionarDocumento() {
    const lista = document.getElementById('prod-docs-lista');
    if (!lista) return;

    _prodDocCount++;
    const id = _prodDocCount;

    const tiposOpts = _PROD_DOC_TIPOS.map(t => `<option value="${t}">${t}</option>`).join('');
    const usuario   = _empDocUsuario();
    const dataStr   = _empDocFormatarData(new Date());

    const div = document.createElement('div');
    div.className = 'emp-doc-item';
    div.id = `prod-doc-item-${id}`;
    div.innerHTML = `
        <div class="emp-doc-item-top">
            <div class="emp-doc-item-fields">
                <div class="form-group emp-doc-tipo-group" style="flex-direction:column;">
                    <label>Tipo de Documento</label>
                    <select id="prod-doc-tipo-${id}" name="prod_doc_tipo_${id}" onchange="prodTipoDocChange(this, ${id})">
                        <option value="">Selecione...</option>
                        ${tiposOpts}
                    </select>
                    <div id="prod-doc-info-${id}" style="display:none; margin-top:6px; background:#eff6ff; border-radius:8px; padding:8px 12px; font-size:12px; color:#1e40af; line-height:1.5;"></div>
                </div>
                <div class="form-group emp-doc-outros-group" id="prod-doc-desc-group-${id}" style="display:none;">
                    <label>Descrição</label>
                    <input type="text" id="prod-doc-desc-${id}" name="prod_doc_desc_${id}" placeholder="Descrição...">
                </div>
            </div>
            <button type="button" class="btn-remover-doc-emp" onclick="prodRemoverDocumento(${id})" title="Remover documento">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>

        <div class="emp-doc-fonte-toggle">
            <button type="button" class="emp-doc-fonte-btn ativo" id="prod-doc-fonte-arquivo-${id}" onclick="prodToggleFonteDoc(${id},'arquivo')">
                <i class="fa-solid fa-file-arrow-up"></i> Arquivo local
            </button>
            <button type="button" class="emp-doc-fonte-btn" id="prod-doc-fonte-link-${id}" onclick="prodToggleFonteDoc(${id},'link')">
                <i class="fa-solid fa-link"></i> Link externo
            </button>
        </div>

        <div class="emp-doc-file-area" id="prod-doc-area-arquivo-${id}">
            <div class="emp-doc-upload-zone" id="prod-doc-upload-zone-${id}">
                <label class="emp-doc-upload-btn" for="prod-doc-file-${id}">
                    <i class="fa-solid fa-file-arrow-up"></i> Selecionar PDF
                    <input type="file" id="prod-doc-file-${id}" accept=".pdf,application/pdf" style="display:none"
                        onchange="prodPreviewDocumento(this, ${id})">
                </label>
                <span class="emp-doc-upload-hint">Somente arquivos .PDF</span>
            </div>
            <div class="emp-doc-uploaded" id="prod-doc-uploaded-${id}" style="display:none;">
                <div class="emp-doc-uploaded-info">
                    <i class="fa-solid fa-circle-check emp-doc-ok-icon"></i>
                    <div class="emp-doc-uploaded-meta">
                        <span class="emp-doc-uploaded-name" id="prod-doc-uploaded-name-${id}"></span>
                        <span class="emp-doc-uploaded-size" id="prod-doc-uploaded-size-${id}"></span>
                    </div>
                </div>
                <div class="emp-doc-uploaded-actions">
                    <button type="button" class="emp-doc-action-btn emp-doc-btn-ver" onclick="prodVisualizarDoc(${id})" title="Visualizar">
                        <i class="fa-solid fa-eye"></i> Visualizar
                    </button>
                    <label class="emp-doc-action-btn emp-doc-btn-editar" for="prod-doc-file-${id}" title="Substituir arquivo">
                        <i class="fa-solid fa-pen"></i> Editar
                    </label>
                    <button type="button" class="emp-doc-action-btn emp-doc-btn-excluir" onclick="prodRemoverArquivoDoc(${id})" title="Remover arquivo">
                        <i class="fa-solid fa-xmark"></i> Remover
                    </button>
                </div>
            </div>
        </div>

        <div class="emp-doc-file-area" id="prod-doc-area-link-${id}" style="display:none;">
            <div class="emp-doc-link-wrapper">
                <i class="fa-solid fa-cloud emp-doc-link-icon"></i>
                <div class="emp-doc-link-fields">
                    <input type="url" id="prod-doc-url-${id}" name="prod_doc_url_${id}"
                        placeholder="Cole aqui o link do Google Drive, Dropbox, OneDrive..."
                        data-no-caps oninput="prodAtualizarPreviewLink(${id})">
                    <span class="emp-doc-link-hint">O link deve estar configurado como "qualquer pessoa com o link pode visualizar"</span>
                </div>
            </div>
            <div class="emp-doc-uploaded-actions" id="prod-doc-link-actions-${id}" style="display:none;">
                <button type="button" class="emp-doc-action-btn emp-doc-btn-ver" onclick="prodAbrirLinkDoc(${id})">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir link
                </button>
                <button type="button" class="emp-doc-action-btn emp-doc-btn-excluir" onclick="prodLimparLinkDoc(${id})">
                    <i class="fa-solid fa-xmark"></i> Remover
                </button>
            </div>
        </div>

        <div class="emp-doc-footer">
            <i class="fa-solid fa-user"></i>
            <span>${usuario}</span>
            <span class="emp-doc-footer-sep">•</span>
            <i class="fa-regular fa-calendar"></i>
            <span id="prod-doc-data-${id}">${dataStr}</span>
        </div>`;
    lista.appendChild(div);
}

function prodRemoverDocumento(id) {
    document.getElementById(`prod-doc-item-${id}`)?.remove();
}

function prodToggleFonteDoc(id, fonte) {
    const areaArquivo = document.getElementById(`prod-doc-area-arquivo-${id}`);
    const areaLink    = document.getElementById(`prod-doc-area-link-${id}`);
    const btnArquivo  = document.getElementById(`prod-doc-fonte-arquivo-${id}`);
    const btnLink     = document.getElementById(`prod-doc-fonte-link-${id}`);
    if (!areaArquivo || !areaLink) return;
    const isLink = fonte === 'link';
    areaArquivo.style.display = isLink ? 'none' : '';
    areaLink.style.display    = isLink ? '' : 'none';
    btnArquivo.classList.toggle('ativo', !isLink);
    btnLink.classList.toggle('ativo', isLink);
}

function prodAtualizarPreviewLink(id) {
    const input   = document.getElementById(`prod-doc-url-${id}`);
    const actions = document.getElementById(`prod-doc-link-actions-${id}`);
    if (!input || !actions) return;
    actions.style.display = input.value.trim() ? '' : 'none';
}

function prodAbrirLinkDoc(id) {
    const url = document.getElementById(`prod-doc-url-${id}`)?.value.trim();
    if (url) window.open(url, '_blank', 'noopener');
}

function prodLimparLinkDoc(id) {
    const input   = document.getElementById(`prod-doc-url-${id}`);
    const actions = document.getElementById(`prod-doc-link-actions-${id}`);
    if (input)   input.value = '';
    if (actions) actions.style.display = 'none';
}

function prodTipoDocChange(sel, id) {
    const val       = sel.value;
    const descGroup = document.getElementById(`prod-doc-desc-group-${id}`);
    const infoBox   = document.getElementById(`prod-doc-info-${id}`);

    const comDescricao = ['CERTIFICADO', 'Outros'];

    if (descGroup) {
        const mostrar = comDescricao.includes(val);
        descGroup.style.display = mostrar ? '' : 'none';
        if (!mostrar) {
            const inp = document.getElementById(`prod-doc-desc-${id}`);
            if (inp) inp.value = '';
        }
    }

    if (infoBox) {
        const info = _PROD_DOC_INFO[val] || '';
        infoBox.textContent  = info;
        infoBox.style.display = info ? '' : 'none';
    }
}

function prodPreviewDocumento(input, id) {
    const file = input.files[0];
    if (!file) return;
    const uploadZone  = document.getElementById(`prod-doc-upload-zone-${id}`);
    const uploadedBox = document.getElementById(`prod-doc-uploaded-${id}`);
    const nameEl      = document.getElementById(`prod-doc-uploaded-name-${id}`);
    const sizeEl      = document.getElementById(`prod-doc-uploaded-size-${id}`);
    const dataEl      = document.getElementById(`prod-doc-data-${id}`);
    if (nameEl) nameEl.textContent = file.name;
    if (sizeEl) sizeEl.textContent = _empDocFormatarTamanho(file.size);
    if (dataEl) dataEl.textContent = _empDocFormatarData(new Date());
    if (uploadZone)  uploadZone.style.display  = 'none';
    if (uploadedBox) uploadedBox.style.display  = '';
    input._objectUrl = URL.createObjectURL(file);
}

function prodRemoverArquivoDoc(id) {
    const fileInput   = document.getElementById(`prod-doc-file-${id}`);
    const uploadZone  = document.getElementById(`prod-doc-upload-zone-${id}`);
    const uploadedBox = document.getElementById(`prod-doc-uploaded-${id}`);
    if (fileInput) {
        if (fileInput._objectUrl) { URL.revokeObjectURL(fileInput._objectUrl); fileInput._objectUrl = null; }
        fileInput.value = '';
    }
    if (uploadZone)  uploadZone.style.display  = '';
    if (uploadedBox) uploadedBox.style.display  = 'none';
}

function prodVisualizarDoc(id) {
    const fileInput = document.getElementById(`prod-doc-file-${id}`);
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

// Cache local (não depende do timing/sucesso do fetch feito lá no
// DOMContentLoaded pra window._dadosEmpresaTenant) — se aquele tiver
// falhado silenciosamente, essa função tenta buscar de novo na hora.
let _procEmpresaPropria = null;

// Nome do remetente do Pedido de origem (via Proforma → pedido_id →
// remetente_parceiro_id) — mostrado no campo "Remetente" quando Emissor =
// Usuário, no lugar do dropdown Identificação da Empresa. Preenchido por
// _procPreencherDaProforma().
let _procPedidoRemetenteNome = null;
async function _procCarregarEmpresaPropria() {
    if (_procEmpresaPropria) return _procEmpresaPropria;
    if (window._dadosEmpresaTenant) return (_procEmpresaPropria = window._dadosEmpresaTenant);
    try {
        const res = await window.supabaseAPI.buscarTenantEmpresa();
        if (res.sucesso) {
            _procEmpresaPropria = res.data;
        } else {
            console.warn('[Processo] buscarTenantEmpresa() não retornou sucesso:', res);
            mostrarNotificacao('Falha ao buscar dados da empresa: ' + (res.mensagem || 'erro desconhecido') + (res.empresaIdUsada ? ' (empresa_id: ' + res.empresaIdUsada + ')' : ''), 'erro');
        }
    } catch (e) {
        console.error('[Processo] erro ao buscar dados da própria empresa:', e);
        mostrarNotificacao('Erro ao buscar dados da empresa: ' + e.message, 'erro');
    }
    return _procEmpresaPropria;
}

function iniciarEmissor() {
    const radios      = document.querySelectorAll('input[name="proc-emissor-tipo"]');
    const grupoEmp    = document.getElementById('proc-emissor-empresa-group');
    const docInput    = document.getElementById('proc-documento');
    const origemPais  = document.getElementById('proc-origem-pais');

    async function atualizar() {
        const val = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;

        document.querySelectorAll('.emissor-opcao').forEach(l => l.classList.remove('ativo'));
        document.querySelector('input[name="proc-emissor-tipo"]:checked')
            ?.closest('.emissor-opcao')?.classList.add('ativo');

        const grupoTipoDoc     = document.getElementById('proc-documento-tipo-group');
        const grupoPedidoRem   = document.getElementById('proc-emissor-pedido-remetente-group');

        if (val === 'usuario') {
            if (grupoEmp)      grupoEmp.style.display      = 'none';
            if (grupoTipoDoc)  grupoTipoDoc.style.display  = 'none';
            if (grupoPedidoRem) grupoPedidoRem.style.display = '';
            const remetentePedidoEl = document.getElementById('proc-emissor-pedido-remetente');
            if (remetentePedidoEl) remetentePedidoEl.value = _procPedidoRemetenteNome || '';
            const emp = await _procCarregarEmpresaPropria();
            if (docInput) {
                docInput.readOnly    = false;
                docInput.placeholder = 'Informe o CNPJ / CPF';
                if (!docInput.value) docInput.value = emp?.cnpj || '';
            }
            if (origemPais) {
                origemPais.readOnly    = false;
                origemPais.placeholder = 'Selecione o país de origem';
                if (!origemPais.value) await _preencherPaisPorPrefixo('proc-origem', 'Brasil');
            }
            // Endereço de Origem = endereço registrado da própria empresa
            const _setSeVazio = (id, val) => { const el = document.getElementById(id); if (el && !el.value) el.value = val || ''; };
            _setSeVazio('proc-origem-cep',         emp?.cep);
            _setSeVazio('proc-origem-estado',      emp?.estado);
            _setSeVazio('proc-origem-cidade',      emp?.cidade);
            _setSeVazio('proc-origem-endereco',    emp?.endereco);
            _setSeVazio('proc-origem-numero',      emp?.numero);
            _setSeVazio('proc-origem-complemento', emp?.complemento);
        } else {
            if (grupoEmp)      grupoEmp.style.display      = '';
            if (grupoTipoDoc)  grupoTipoDoc.style.display  = 'none';
            if (grupoPedidoRem) grupoPedidoRem.style.display = 'none';
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
    _intermediarios.push({ id, tipo, valor: '' });
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
            <input type="text" name="${item.tipo}_intermediario_${idx}" placeholder="${cfg.placeholder}" class="rota-inter-input" data-id="${item.id}" value="${(item.valor || '').replace(/"/g, '&quot;')}">
        </div>`;
    }).join('');

    lista.querySelectorAll('.rota-inter-input').forEach(inp => {
        inp.addEventListener('input', () => {
            const it = _intermediarios.find(i => i.id === inp.getAttribute('data-id'));
            if (it) it.valor = inp.value;
        });
    });
}

function removerIntermediario(id) {
    _intermediarios = _intermediarios.filter(i => i.id !== id);
    _renderIntermediarios();
}

function limparIntermediarios() {
    _intermediarios = [];
    _renderIntermediarios();
}

function coletarIntermediarios() {
    return _intermediarios.map(i => ({ id: i.id, tipo: i.tipo, valor: i.valor || '' }));
}

function restaurarIntermediarios(lista) {
    _intermediarios = (lista || []).map(i => ({ id: i.id || ('inter-' + i.tipo + '-' + Date.now() + Math.random()), tipo: i.tipo, valor: i.valor || '' }));
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
// AUTOCOMPLETE — CÓDIGO DA PROFORMA (PROCESSO)
// ========================================

let _acPropostas = [];

async function _acCarregarPropostas() {
    if (_acPropostas.length > 0) return;
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient.from('proformas').select('id, codigo').neq('status', 'excluido').order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data } = await query;
        _acPropostas = (data || []).map(p => ({ id: p.id, nome: p.codigo, label: p.codigo }));
    } catch { _acPropostas = []; }
}

let _acPedidosAbertos = [];

async function _acCarregarPedidosAbertos() {
    if (_acPedidosAbertos.length > 0) return;
    try {
        const usuario = obterUsuarioLogado();
        // "Em aberto" = ainda em andamento (fora excluído/cancelado/entregue).
        let query = supabaseClient
            .from('pedidos')
            .select('id, numero')
            .not('status', 'in', '(excluido,cancelado,entregue)')
            .order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        const { data } = await query;
        _acPedidosAbertos = (data || []).map(p => ({ id: p.id, nome: p.numero, label: p.numero }));
    } catch { _acPedidosAbertos = []; }
}

function _acMostrarPedidos(inputEl, listaEl, termo) {
    const q = (termo || '').trim().toLowerCase();
    const filtrados = q
        ? _acPedidosAbertos.filter(p => (p.nome || '').toLowerCase().includes(q))
        : _acPedidosAbertos;

    if (filtrados.length === 0) {
        listaEl.innerHTML = '<div class="autocomplete-vazio">Nenhum pedido em aberto encontrado</div>';
    } else {
        listaEl.innerHTML = filtrados.slice(0, 30).map(p => `
            <div class="autocomplete-item"
                 data-id="${p.id}"
                 data-nome="${(p.nome || '').replace(/"/g, '&quot;')}">
                <span class="ac-nome">${p.nome || ''}</span>
            </div>`).join('');
    }
    _acPosicionar(inputEl, listaEl);
    listaEl.classList.add('aberta');
}

function iniciarAutocompletePropPedido() {
    const input    = document.getElementById('prop-pedido-origem');
    const lista    = document.getElementById('prop-pedido-origem-lista');
    const idOculto = document.getElementById('prop-pedido-id');
    if (!input || !lista) return;

    input.addEventListener('focus', async () => {
        await _acCarregarPedidosAbertos();
        _acMostrarPedidos(input, lista, input.value);
    });

    input.addEventListener('input', () => {
        if (idOculto) idOculto.value = '';
        _acMostrarPedidos(input, lista, input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.getAttribute('data-nome');
        const selId = item.getAttribute('data-id');
        if (idOculto) idOculto.value = selId;
        _acFechar(lista);
        _propPreencherDoPedido(selId);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

async function _propPreencherDoPedido(pedidoId) {
    if (!pedidoId) return;
    try {
        const { data: pedido, error } = await supabaseClient
            .from('pedidos')
            .select('*, pedido_itens(*)')
            .eq('id', pedidoId)
            .single();
        if (error || !pedido) return;

        // ── Exibição do pedido de origem (somente leitura) ──
        const origemEl    = document.getElementById('prop-pedido-origem');
        const origemGroup = document.getElementById('prop-pedido-origem-group');
        if (origemEl)    origemEl.value = pedido.numero || pedidoId;
        if (origemGroup) origemGroup.style.display = '';

        // ── Destinatário (cliente do pedido) ──
        // O cliente do pedido vem da tabela "parceiros" (BIGINT), não
        // "empresas" (UUID) — que é o que prop-emp-dest-id normalmente
        // referencia. Usa o modo de texto livre (mesmo campo que já existe
        // pra empresa não cadastrada) em vez de gravar um ID de tabela errada,
        // que fazia o card da proforma mostrar "Destinatário: —".
        if (pedido.cliente_id) {
            const { data: parceiro } = await supabaseClient
                .from('parceiros').select('id, razao_social, nome_fantasia, documento')
                .eq('id', pedido.cliente_id).single();
            if (parceiro) {
                const razaoEl    = document.getElementById('prop-emp-dest-razao');
                const razaoGroup = document.getElementById('prop-emp-dest-razao-group');
                const buscaGroup = document.getElementById('prop-emp-dest-busca-group');
                const btnCad     = document.getElementById('prop-btn-emp-dest-cadastrada');
                if (razaoEl)    razaoEl.value = parceiro.nome_fantasia || parceiro.razao_social || '';
                if (razaoGroup) razaoGroup.style.display = '';
                if (buscaGroup) buscaGroup.style.display = 'none';
                // A validação em confirmarSalvar() decide qual campo checar
                // com base nessa classe — sem tirar "ativo" daqui, ela
                // continuava exigindo prop-emp-dest-busca (vazio) mesmo com
                // a Razão Social já preenchida, bloqueando o envio.
                if (btnCad) btnCad.classList.remove('ativo');
                if (parceiro.documento) {
                    const docEl     = document.getElementById('prop-emp-dest-doc');
                    const docTipoEl = document.getElementById('prop-emp-dest-doc-tipo');
                    const docGroup  = document.getElementById('prop-emp-dest-doc-group');
                    if (docEl) docEl.value = parceiro.documento;
                    if (docTipoEl) {
                        const digitos = String(parceiro.documento).replace(/\D/g, '');
                        docTipoEl.value = digitos.length === 11 ? 'cpf' : 'cnpj';
                    }
                    if (docGroup) docGroup.style.display = '';
                }
            }
        }

        // ── Emissor (remetente terceiro do pedido, quando houver) ──
        // Mesmo problema do destinatário: remetente_parceiro_id é um ID de
        // "parceiros", não de "empresas" (prop-cliente-id normalmente espera
        // um ID de empresas via autocomplete) — não seta o hidden, só o nome
        // visível, que agora é salvo em parceiro_razao_social (snapshot).
        if (pedido.remetente_parceiro_id) {
            const { data: remetente } = await supabaseClient
                .from('parceiros').select('id, razao_social, nome_fantasia, documento')
                .eq('id', pedido.remetente_parceiro_id).single();
            if (remetente) {
                const radioTerceiro = document.getElementById('prop-emissor-terceiro');
                if (radioTerceiro) {
                    radioTerceiro.checked = true;
                    radioTerceiro.dispatchEvent(new Event('change'));
                }
                const clienteEl = document.getElementById('prop-cliente');
                if (clienteEl) clienteEl.value = remetente.nome_fantasia || remetente.razao_social || '';
                const docEl = document.getElementById('prop-documento');
                if (docEl && remetente.documento) docEl.value = _mascaraDocBR(remetente.documento);
            }
        }
        // Sem remetente_parceiro_id: mantém "Própria empresa" (padrão já marcado no form)

        // ── Itens + Moeda ──
        const itensPedido = pedido.pedido_itens || [];
        if (itensPedido.length) {
            await _carregarMoedas();
            const moeda = _acMoedas.find(m => m.sigla === pedido.moeda);
            const moedaDescricao = moeda?.descricao || _acMoedas[0]?.descricao || '';

            _propItens = itensPedido.map(it => ({
                produto_id: it.produto_id || null,
                produto: it.produto_nome || '',
                qtd:     Number(it.quantidade) || 1,
                unidade: it.unidade_medida || 'UN',
                preco:   Number(it.preco_unitario) || 0,
                moeda:   moedaDescricao,
            }));
            propRenderizarItens();
        }
    } catch { /* silêncio */ }
}

async function _procPreencherDaProforma(id) {
    if (!id) return;
    try {
        const { data, error } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
        if (error || !data) return;

        // Remetente do Pedido de origem (mostrado no campo "Remetente" quando
        // Emissor = Usuário — ver iniciarEmissor()). Se o pedido não tem
        // remetente_parceiro_id, o remetente é a própria empresa do tenant.
        if (data.pedido_id) {
            const { data: pedidoOrigem } = await supabaseClient
                .from('pedidos').select('remetente_parceiro_id').eq('id', data.pedido_id).single();
            if (pedidoOrigem?.remetente_parceiro_id) {
                const { data: remetenteParceiro } = await supabaseClient
                    .from('parceiros').select('razao_social, nome_fantasia')
                    .eq('id', pedidoOrigem.remetente_parceiro_id).single();
                _procPedidoRemetenteNome = remetenteParceiro?.nome_fantasia || remetenteParceiro?.razao_social || null;
            } else if (pedidoOrigem) {
                _procPedidoRemetenteNome = 'Própria empresa';
            }
            const remetentePedidoEl = document.getElementById('proc-emissor-pedido-remetente');
            if (remetentePedidoEl) remetentePedidoEl.value = _procPedidoRemetenteNome || '';
        }

        // Tipo
        const tipoEl = document.getElementById('proc-tipo');
        if (tipoEl && data.tipo) { tipoEl.value = data.tipo; tipoEl.dispatchEvent(new Event('change')); }

        // Propósito
        const propositoEl = document.getElementById('proc-proposito');
        if (propositoEl && data.proposito) propositoEl.value = data.proposito;

        // Incoterm → dispara o handler que habilita/bloqueia Modal
        const incotermEl = document.getElementById('proc-incoterm');
        if (incotermEl && data.incoterm) {
            incotermEl.value = data.incoterm;
            incotermEl.dispatchEvent(new Event('change'));
        }

        // Modal (define depois do incoterm para não ser sobrescrito)
        const modalEl = document.getElementById('proc-modal');
        if (modalEl && data.modal) {
            modalEl.value = data.modal;
            modalEl.dispatchEvent(new Event('change'));
        }

        // País de Origem / Destino
        const origemEl = document.getElementById('proc-origem-pais');
        if (origemEl && data.origem_pais) origemEl.value = data.origem_pais;
        const destinoEl = document.getElementById('proc-destino-pais');
        if (destinoEl && data.destino_pais) destinoEl.value = data.destino_pais;

        // Campos específicos por modal (porto, aeroporto, fronteira)
        const _set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        _set('proc-porto-origem',     data.porto_origem);
        _set('proc-porto-destino',    data.porto_destino);
        _set('proc-aeroporto-origem', data.aeroporto_origem);
        _set('proc-aeroporto-destino',data.aeroporto_destino);
        _set('proc-fronteira-saida',  data.fronteira_saida);
        _set('proc-fronteira-entrada',data.fronteira_entrada);

        // Emissor / parceiro (terceiro) — parceiro_id referencia "parceiros" (bigint),
        // não uma tabela "empresas_cadastradas" (que nem existe ao vivo).
        if (data.emissor_tipo === 'terceiro' && data.parceiro_id) {
            const radioTerceiro = document.getElementById('proc-emissor-terceiro');
            if (radioTerceiro) {
                radioTerceiro.checked = true;
                radioTerceiro.dispatchEvent(new Event('change'));
            }
            const { data: emp } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').eq('id', data.parceiro_id).single();
            if (emp) {
                const clienteEl = document.getElementById('proc-cliente');
                const clienteIdEl = document.getElementById('proc-cliente-id');
                if (clienteEl) clienteEl.value = emp.nome_fantasia || emp.razao_social;
                if (clienteIdEl) clienteIdEl.value = emp.id;
            }
        }

        // Destinatário — endereço registrado do parceiro de destino da proforma
        // (destinatario_id também referencia "parceiros"). Preenche o mesmo
        // endereço completo já cadastrado, em vez de deixar em branco.
        if (data.destinatario_id) {
            const { data: destParceiro } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social, nome_fantasia, cep, estado, cidade, bairro, endereco, numero, complemento')
                .eq('id', data.destinatario_id).single();
            if (destParceiro) {
                const buscaEl = document.getElementById('proc-emp-dest-busca');
                const idEl    = document.getElementById('proc-emp-dest-id');
                if (buscaEl) buscaEl.value = destParceiro.nome_fantasia || destParceiro.razao_social || '';
                if (idEl)    idEl.value    = destParceiro.id;

                _set('proc-destino-cep',         destParceiro.cep);
                _set('proc-destino-estado',      destParceiro.estado);
                _set('proc-destino-cidade',      destParceiro.cidade);
                _set('proc-destino-bairro',      destParceiro.bairro);
                _set('proc-destino-endereco',    destParceiro.endereco);
                _set('proc-destino-numero',      destParceiro.numero);
                _set('proc-destino-complemento', destParceiro.complemento);
            }
        } else if (data.destinatario_razao_social) {
            // Proforma nasceu de um Pedido em modo texto-livre (sem destinatario_id) — só o nome
            const buscaEl = document.getElementById('proc-emp-dest-busca');
            if (buscaEl) buscaEl.value = data.destinatario_razao_social;
        }
    } catch { /* silêncio */ }
}

// ========================================
// CEP — AUTO-PREENCHIMENTO (ViaCEP)
// ========================================

function _cepMascara(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    input.value = v;
}

async function procBuscarCep(input, prefixo) {
    _cepMascara(input);
    const cep = input.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return;

        set(`proc-${prefixo}-estado`,   data.uf);
        set(`proc-${prefixo}-cidade`,   data.localidade);
        set(`proc-${prefixo}-bairro`,   data.bairro);
        set(`proc-${prefixo}-endereco`, data.logradouro);
        document.getElementById(`proc-${prefixo}-numero`)?.focus();
    } catch { /* CEP inválido ou sem conexão */ }
}

// ========================================
// ENDEREÇO DE COLETA — ORIGEM
// ========================================

function procToggleColetaOrigem(mesmo) {
    const campos  = document.getElementById('proc-origem-coleta-campos');
    const resumo  = document.getElementById('proc-origem-coleta-resumo');
    if (!campos || !resumo) return;

    if (mesmo) {
        const end  = document.getElementById('proc-origem-endereco')?.value   || '';
        const num  = document.getElementById('proc-origem-numero')?.value      || '';
        const comp = document.getElementById('proc-origem-complemento')?.value || '';
        const bai  = document.getElementById('proc-origem-bairro')?.value      || '';
        const cid  = document.getElementById('proc-origem-cidade')?.value      || '';
        resumo.value = [end, num, comp, bai, cid].filter(Boolean).join(', ');
        campos.style.display  = 'none';
        resumo.style.display  = '';
    } else {
        campos.style.display = '';
        resumo.style.display = 'none';
        resumo.value = '';
    }
}


function iniciarAutocompleteProcCodProposta() {
    const input    = document.getElementById('proc-codigo');
    const lista    = document.getElementById('proc-codigo-lista');
    const idOculto = document.getElementById('proc-proposta-id');
    if (!input || !lista) return;

    input.addEventListener('focus', async () => {
        await _acCarregarPropostas();
        _acMostrarProformas(input, lista, input.value);
    });

    input.addEventListener('input', () => {
        if (idOculto) idOculto.value = '';
        _acMostrarProformas(input, lista, input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.getAttribute('data-nome');
        const selId = item.getAttribute('data-id');
        if (idOculto) idOculto.value = selId;
        _acFechar(lista);
        _procPreencherDaProforma(selId);
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
                (e.razao_social  || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento     || '').includes(q))
            : _acEmpresas;

        if (filtradas.length === 0) {
            lista.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        } else {
            lista.innerHTML = filtradas.slice(0, 30).map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-razao="${(e.razao_social  || '').replace(/"/g,'&quot;')}"
                     data-fantasia="${(e.nome_fantasia || '').replace(/"/g,'&quot;')}"
                     data-doc="${e.documento || ''}"
                     data-idint="${(e.identificacao_empresa || '').replace(/"/g,'&quot;')}">
                    <span class="ac-nome">${e.razao_social || ''}</span>
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

        if (docEl) docEl.value = doc;
        if (idEl) idEl.value = idInt;

        if (validarDocDestino(doc)) {
            input.value = '';
            if (idInput) idInput.value = '';
            if (docEl) docEl.value = '';
            if (idEl) idEl.value = '';
        }
    }

    function limparCamposAuto() {
        ['proc-emp-dest-auto-doc', 'proc-emp-dest-auto-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
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
        if (!isBrasil()) {
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

// ========================================
// PRODUTO — CÁLCULO DE MARGEM
// ========================================

// ── Idiomas do produto ────────────────────

// Mostra/esconde o campo de texto livre ao lado do select quando "Outro" é
// escolhido — usado tanto na linha base (prod-nome-idioma) quanto nas linhas
// extras criadas por prodAdicionarIdiomaExtra().
function prodToggleIdiomaOutro(selectEl) {
    const outroInput = selectEl.nextElementSibling;
    if (!outroInput) return;
    const ehOutro = selectEl.value === 'outro';
    outroInput.style.display = ehOutro ? '' : 'none';
    if (!ehOutro) outroInput.value = '';
}

function prodToggleObs(toggle) {
    const content = toggle.nextElementSibling;
    const aberto  = toggle.classList.contains('aberto');
    toggle.classList.toggle('aberto', !aberto);
    content.style.display = aberto ? 'none' : 'block';
}

function prodMascaraDecimal(el) {
    const cursor = el.selectionStart;
    const oldLen = el.value.length;
    let raw = el.value.replace(/[^\d,]/g, '');
    const partes = raw.split(',');
    if (partes.length > 2) raw = partes[0] + ',' + partes.slice(1).join('');
    el.value = raw;
    const diff = el.value.length - oldLen;
    el.setSelectionRange(cursor + diff, cursor + diff);
}

function prodMascaraMonetaria(el) {
    const cursor = el.selectionStart;
    const oldLen = el.value.length;
    let raw = el.value.replace(/[^\d,]/g, '');
    const partes = raw.split(',');
    if (partes.length > 2) raw = partes[0] + ',' + partes.slice(1).join('');
    const p = raw.split(',');
    p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = p.join(',');
    const diff = el.value.length - oldLen;
    el.setSelectionRange(cursor + diff, cursor + diff);
}

function _prodValorMonetario(el) {
    if (!el) return 0;
    return parseFloat((el.value || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function prodCalcularResultados() {
    const preco       = _prodValorMonetario(document.getElementById('prod-preco-venda'));
    const custo       = _prodValorMonetario(document.getElementById('prod-preco-custo'));
    const fixos       = _prodValorMonetario(document.getElementById('prod-custos-fixos'));
    const taxas       = _prodValorMonetario(document.getElementById('prod-imposto'));
    const totalCusto  = custo + fixos + taxas;
    const lucro       = preco - totalCusto;

    const campoMargem = document.getElementById('prod-margem');
    const campoLucro  = document.getElementById('prod-lucro-liquido');

    if (campoMargem) {
        if (preco <= 0) { campoMargem.value = '—'; }
        else { campoMargem.value = ((lucro / preco) * 100).toFixed(2) + '%'; }
    }
    if (campoLucro) {
        if (preco <= 0) { campoLucro.value = '—'; }
        else {
            const sinal = lucro >= 0 ? '' : '-';
            campoLucro.value = sinal + 'R$ ' + Math.abs(lucro).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }
    }
}

function prodCalcularNivelEstoque() {
    const atual  = parseFloat(document.getElementById('prod-estoque-atual')?.value)  || 0;
    const minimo = parseFloat(document.getElementById('prod-estoque-minimo')?.value) || 0;
    const maximo = parseFloat(document.getElementById('prod-estoque-maximo')?.value) || 0;
    const campo  = document.getElementById('prod-nivel-estoque');
    if (!campo) return;
    if (maximo <= minimo) { campo.value = '—'; return; }
    const nivel = ((atual - minimo) / (maximo - minimo)) * 100;
    campo.value = Math.min(100, Math.max(0, nivel)).toFixed(1) + '%';
}

// ========================================
// PRODUTO — MOEDA AUTOCOMPLETE
// ========================================

function iniciarAutocompleteEmpresaProduto() {
    const input    = document.getElementById('prod-empresa-busca');
    const lista    = document.getElementById('prod-empresa-lista');
    const idOculto = document.getElementById('prod-empresa-id');
    const docEl    = document.getElementById('prod-empresa-doc');
    if (!input || !lista || !idOculto) return;

    async function mostrar() {
        await _acCarregarEmpresas();
        const q = input.value.trim().toLowerCase();
        const filtradas = q
            ? _acEmpresas.filter(e =>
                (e.razao_social || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento || '').replace(/\D/g,'').includes(q.replace(/\D/g,''))
              )
            : _acEmpresas;
        lista.innerHTML = filtradas.length
            ? filtradas.map(e => `<div class="autocomplete-item" data-id="${e.id}" data-nome="${e.nome_fantasia || e.razao_social}" data-doc="${e.documento || ''}">${e.nome_fantasia || e.razao_social}${e.documento ? `<span class="autocomplete-sub">${e.documento}</span>` : ''}</div>`).join('')
            : '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        lista.style.display = 'block';
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { idOculto.value = ''; if (docEl) docEl.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value    = item.getAttribute('data-nome');
        idOculto.value = item.getAttribute('data-id');
        if (docEl) docEl.value = item.getAttribute('data-doc');
        lista.style.display = 'none';
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('#prod-empresa-busca') && !e.target.closest('#prod-empresa-lista'))
            lista.style.display = 'none';
    });
}

function iniciarAutocompleteMoedaProduto() {
    const input   = document.getElementById('prod-moeda');
    const hidden  = document.getElementById('prod-moeda-codigo');
    const lista   = document.getElementById('prod-moeda-lista');
    if (!input || !lista) return;

    async function mostrar() {
        await _carregarMoedas();
        const q = input.value.trim().toLowerCase();
        const filtradas = q
            ? _acMoedas.filter(m => (m.descricao || '').toLowerCase().includes(q))
            : _acMoedas;
        if (!filtradas.length) { lista.classList.remove('aberta'); return; }
        lista.innerHTML = filtradas.slice(0, 30).map(m => `
            <div class="autocomplete-item" data-codigo="${m.codigo || ''}" data-descricao="${m.descricao || ''}">
                <span class="ac-nome">${m.descricao || ''}</span>
                <span class="ac-fantasia">${m.codigo || ''}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    let _selecionando = false;

    input.addEventListener('input', () => { if (!_selecionando) mostrar(); });
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        e.preventDefault();
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        _selecionando = true;
        input.value = item.dataset.descricao;
        if (hidden) hidden.value = item.dataset.codigo;
        lista.classList.remove('aberta');
        setTimeout(() => { _selecionando = false; }, 0);
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
}

// ========================================
// PRODUTO — NCM AUTOCOMPLETE
// ========================================

function iniciarAutocompleteNcmProduto() {
    const input = document.getElementById('prod-ncm');
    const lista  = document.getElementById('prod-ncm-lista');
    if (!input || !lista) return;

    function limparCamposNcm() {
        ['prod-ncm-descricao', 'prod-ncm-descricao-completa', 'prod-ncm-utrib', 'prod-hscode'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // HS Code são os (até) 6 primeiros dígitos do NCM (NCM = HS + 2 dígitos
    // específicos do Mercosul), formatado em pares "XX.XX.XX". Alguns registros
    // de apoio_ncm são níveis mais amplos da hierarquia (capítulo/posição, com
    // só 2 ou 4 dígitos) — nesses casos deriva com o que tiver, sem exigir 6.
    function _derivarHsCodeDoNcm(ncmValor) {
        const digitos = String(ncmValor || '').replace(/\D/g, '').slice(0, 6);
        if (!digitos) return '';
        return digitos.match(/.{1,2}/g).join('.');
    }

    function preencherCamposNcm(item) {
        const desc    = document.getElementById('prod-ncm-descricao');
        const full    = document.getElementById('prod-ncm-descricao-completa');
        const utrib   = document.getElementById('prod-ncm-utrib');
        const hscode  = document.getElementById('prod-hscode');
        if (desc)   desc.value   = item.dataset.descricao || '';
        if (full)   full.value   = item.dataset.descricaoCompleta || '';
        if (utrib)  utrib.value  = item.dataset.utrib || '';
        if (hscode) hscode.value = _derivarHsCodeDoNcm(item.dataset.ncm);
    }

    async function mostrar() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 1) { lista.classList.remove('aberta'); limparCamposNcm(); return; }
        try {
            const { data } = await supabaseClient
                .from('apoio_ncm')
                .select('ncm, descricao, descricao_concat, utrib_abrev, utrib_descricao')
                .ilike('ncm', `${q}%`)
                .limit(40);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(n => {
                const utrib = n.utrib_abrev ? `${n.utrib_abrev}${n.utrib_descricao ? ' — ' + n.utrib_descricao : ''}` : '';
                return `<div class="autocomplete-item"
                    data-ncm="${n.ncm}"
                    data-descricao="${(n.descricao || '').replace(/"/g, '&quot;')}"
                    data-descricao-completa="${(n.descricao_concat || '').replace(/"/g, '&quot;')}"
                    data-utrib="${utrib.replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${n.ncm}</span>
                    <span class="ac-fantasia">${n.descricao_concat || n.descricao || ''}</span>
                </div>`;
            }).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    input.addEventListener('input', mostrar);
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.ncm;
        preencherCamposNcm(item);
        lista.classList.remove('aberta');
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
}

// ========================================
// PRODUTO — PROTEÇÃO DO RADICAL (HS CODE / NALADI-NESH)
// ========================================
// HS Code (e futuramente NALADI/NESH) são derivados do NCM — mudar o "radical"
// à mão pode gerar divergência no SISCOMEX. Usuário não-admin não pode editar
// esses campos (fica readonly); admin pode, mas passa por uma confirmação.

let _prodRadicalPendente = null; // { el, valorAnterior }

function prodAplicarBloqueioRadical() {
    const usuario = obterUsuarioLogado();
    const ehAdmin = usuario?.perfil === 'admin';

    ['prod-hscode', 'prod-naladi-nesh'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;

        if (!ehAdmin) {
            el.readOnly = true;
            el.style.background = '#f8faff';
            el.style.cursor = 'not-allowed';
            el.title = 'Somente um administrador pode alterar este campo';
            el.addEventListener('focus', prodAvisoBloqueioRadical);
        } else {
            el.addEventListener('focus', () => { el.dataset.valorAnterior = el.value; });
            el.addEventListener('change', () => prodChangeCampoRadical(el));
        }
    });
}

function prodAvisoBloqueioRadical() {
    mostrarNotificacao('Somente um administrador pode alterar este campo. Peça para um administrador da empresa fazer essa alteração.', 'warning');
    document.activeElement?.blur();
}

// Dispara só quando o valor realmente mudou por digitação do admin — não
// quando o autocomplete de NCM preenche o campo programaticamente (setar
// .value via JS não dispara 'change').
function prodChangeCampoRadical(inputEl) {
    const anterior = inputEl.dataset.valorAnterior ?? '';
    if (inputEl.value.trim() === anterior.trim()) return;

    _prodRadicalPendente = { el: inputEl, valorAnterior: anterior };
    const modal = document.getElementById('prod-modal-confirmar-radical');
    if (modal) modal.style.display = 'flex';
}

function prodCancelarAlteracaoRadical() {
    if (_prodRadicalPendente) _prodRadicalPendente.el.value = _prodRadicalPendente.valorAnterior;
    _prodRadicalPendente = null;
    const modal = document.getElementById('prod-modal-confirmar-radical');
    if (modal) modal.style.display = 'none';
}

function prodConfirmarAlteracaoRadical() {
    if (_prodRadicalPendente) _prodRadicalPendente.el.dataset.valorAnterior = _prodRadicalPendente.el.value;
    _prodRadicalPendente = null;
    const modal = document.getElementById('prod-modal-confirmar-radical');
    if (modal) modal.style.display = 'none';
}

// ========================================
// PRODUTO — IDIOMAS EXTRAS (Nome + Descrição)
// ========================================

let _prodIdiomaExtraCount = 0;

function prodAdicionarIdiomaExtra() {
    if (_prodIdiomaExtraCount >= 3) return;
    _prodIdiomaExtraCount++;
    const num = _prodIdiomaExtraCount;
    const id  = Date.now();

    const container = document.getElementById('prod-idiomas-extra-container');
    if (!container) return;

    // Ler títulos dos labels acima
    const labelNome = document.querySelector('label[for="prod-nome"]')?.childNodes[0]?.textContent?.trim() || 'Nome do Produto';
    const labelDesc = document.querySelector('label[for="prod-descricao"]')?.textContent?.trim() || 'Descrição';

    const row = document.createElement('div');
    row.id = `prod-idioma-row-${id}`;
    row.style.cssText = 'display:grid; grid-template-columns: 0.5fr 1fr 1.5fr; gap:16px; align-items:end; position:relative;';
    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
            <label>Idioma</label>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <select name="idioma_idioma_${id}" onchange="prodToggleIdiomaOutro(this)">
                    <option value="de">Alemão</option>
                    <option value="zh">Chinês</option>
                    <option value="es">Espanhol</option>
                    <option value="fr">Francês</option>
                    <option value="en">Inglês</option>
                    <option value="pt" selected>Português</option>
                    <option value="outro">Outro</option>
                </select>
                <input type="text" name="idioma_outro_${id}" placeholder="Qual idioma?" style="display:none;">
            </div>
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>${labelNome} — Idioma ${num + 1}</label>
            <input type="text" name="nome_idioma_${id}" placeholder="Nome em outro idioma">
        </div>
        <div class="form-group" style="margin-bottom:0; position:relative;">
            <label>${labelDesc} — Idioma ${num + 1}</label>
            <textarea name="descricao_idioma_${id}" placeholder="Descrição em outro idioma..." maxlength="500" rows="1"
                style="resize:none;overflow:hidden;height:42px;min-height:42px;padding-right:36px;"
                oninput="this.style.setProperty('height','42px','important');this.style.setProperty('height',this.scrollHeight+'px','important')"></textarea>
            <button type="button" onclick="prodRemoverIdiomaExtra('${id}')"
                style="position:absolute;top:0;right:0;background:none;border:none;cursor:pointer;color:#dc2626;font-size:15px;padding:2px 6px;"
                title="Remover idioma">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`;
    container.appendChild(row);
    _prodIdiomaExtraAtualizarBotao();
}

function prodRemoverIdiomaExtra(id) {
    const row = document.getElementById(`prod-idioma-row-${id}`);
    if (row) { row.remove(); _prodIdiomaExtraCount--; }
    _prodIdiomaExtraAtualizarBotao();
}

function _prodIdiomaExtraAtualizarBotao() {
    const btn = document.getElementById('btn-add-idioma-prod');
    if (btn) btn.style.display = _prodIdiomaExtraCount >= 3 ? 'none' : '';
}

// ========================================
// PRODUTO — MEDIDAS DE CAIXA EXTRAS
// ========================================

let _prodMedidaCaixaCount = 0;

function prodAdicionarMedidaCaixa() {
    _prodMedidaCaixaCount++;
    const id = Date.now();
    const num = _prodMedidaCaixaCount;

    const container = document.getElementById('prod-medidas-caixas-container');
    if (!container) return;

    const row = document.createElement('div');
    row.id = `prod-medida-caixa-row-${id}`;
    row.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap:12px; align-items:end;';
    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
            <label>Volume ${num > 1 ? num : ''}</label>
            <input type="text" inputmode="decimal" name="caixa_volume_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Comprimento ${num > 1 ? num : ''} (cm)</label>
            <input type="text" inputmode="decimal" name="caixa_comprimento_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Largura ${num > 1 ? num : ''} (cm)</label>
            <input type="text" inputmode="decimal" name="caixa_largura_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label>Altura ${num > 1 ? num : ''} (cm)</label>
            <input type="text" inputmode="decimal" name="caixa_altura_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <button type="button" onclick="prodRemoverMedidaCaixa('${id}')"
            style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:16px;padding:8px 6px;margin-bottom:0;flex-shrink:0;"
            title="Remover">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    container.appendChild(row);
}

function prodRemoverMedidaCaixa(id) {
    const row = document.getElementById(`prod-medida-caixa-row-${id}`);
    if (row) { row.remove(); _prodMedidaCaixaCount--; }
}

// ========================================
// PRODUTO — EMBALAGENS (LOGÍSTICA)
// ========================================
// Cada "Embalagem" cadastrada guarda uma cópia dos valores dos campos abaixo.
// O mesmo formulário (com os mesmos ids/autocompletes) é reaproveitado para
// criar, editar e visualizar — por isso só um registro é editado por vez.

let _prodEmbalagens = [];
let _prodEmbalagemEditandoId = null;

const _PROD_EMBALAGEM_CAMPOS = [
    'prod-embalagem-nome', 'prod-embalagem', 'prod-embalagem-codigo',
    'prod-acondicionamento', 'prod-acondicionamento-numero', 'prod-acond-descricao',
    'prod-embalagem-transporte',
    'prod-comprimento', 'prod-largura', 'prod-altura',
    'prod-peso-bruto', 'prod-peso-liquido', 'prod-empilhamento', 'prod-obs-logistica'
];

const _PROD_EMBALAGEM_TRANSPORTE_LABELS = {
    aereo: 'Aéreo',
    maritimo: 'Marítimo',
    rodoviario: 'Rodoviário'
};

function _prodEscapeHtml(valor) {
    if (valor === null || valor === undefined) return '';
    return String(valor).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}

function _prodEmbalagemBotoes(modo) {
    // modo: 'novo' | 'edicao' | 'visualizacao'
    document.getElementById('btn-embalagem-salvar').style.display  = modo === 'novo'          ? '' : 'none';
    document.getElementById('btn-embalagem-editar').style.display  = modo === 'edicao'        ? '' : 'none';
    document.getElementById('btn-embalagem-excluir').style.display = modo !== 'visualizacao'  ? '' : 'none';
    document.getElementById('btn-embalagem-fechar').style.display  = modo === 'visualizacao'  ? '' : 'none';
}

function _prodEmbalagemSetCamposDisabled(desabilitado) {
    document.querySelectorAll('#prod-embalagem-form input, #prod-embalagem-form select, #prod-embalagem-form textarea, #prod-embalagem-form button.btn-add-idioma')
        .forEach(el => { el.disabled = desabilitado; });
}

// Mostra o lembrete de cubagem aérea (C x L x A / 6000) só quando o Modal de
// Transporte escolhido for Aéreo.
function prodAtualizarCubagemAviso(selectEl) {
    const aviso = document.getElementById('prod-cubagem-aereo-aviso');
    if (aviso) aviso.style.display = selectEl?.value === 'aereo' ? '' : 'none';
}

function prodLimparFormEmbalagem() {
    _PROD_EMBALAGEM_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    prodAtualizarCubagemAviso(document.getElementById('prod-embalagem-transporte'));

    const outrosWrapper = document.getElementById('prod-acond-outros-wrapper');
    if (outrosWrapper) outrosWrapper.style.display = 'none';

    const medidasContainer = document.getElementById('prod-medidas-caixas-container');
    if (medidasContainer) medidasContainer.innerHTML = '';
    _prodMedidaCaixaCount = 0;

    document.querySelectorAll('#prod-embalagem-form .prod-obs-toggle').forEach(t => t.classList.remove('aberto'));
    document.querySelectorAll('#prod-embalagem-form .prod-obs-content').forEach(c => c.style.display = 'none');
}

function prodAbrirFormEmbalagem() {
    _prodEmbalagemEditandoId = null;
    prodLimparFormEmbalagem();
    _prodEmbalagemSetCamposDisabled(false);
    _prodEmbalagemBotoes('novo');

    const form = document.getElementById('prod-embalagem-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _prodEmbalagemColetarDados() {
    const dados = { id: _prodEmbalagemEditandoId || Date.now() };
    _PROD_EMBALAGEM_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        dados[id] = el ? el.value.trim() : '';
    });

    // Medidas de caixa extras (linhas dinâmicas) — antes eram só decorativas,
    // nunca entravam no objeto salvo em _prodEmbalagens.
    dados.medidas_caixa = [];
    document.querySelectorAll('#prod-medidas-caixas-container > div').forEach(row => {
        const volume      = row.querySelector('input[name^="caixa_volume_"]')?.value.trim() || '';
        const comprimento = row.querySelector('input[name^="caixa_comprimento_"]')?.value.trim() || '';
        const largura     = row.querySelector('input[name^="caixa_largura_"]')?.value.trim() || '';
        const altura      = row.querySelector('input[name^="caixa_altura_"]')?.value.trim() || '';
        if (volume || comprimento || largura || altura) dados.medidas_caixa.push({ volume, comprimento, largura, altura });
    });

    return dados;
}

function _prodEmbalagemPreencherForm(dados) {
    _PROD_EMBALAGEM_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = dados[id] || '';
    });

    const isOutros       = /^outros?$/i.test((dados['prod-acondicionamento'] || '').trim());
    const outrosWrapper  = document.getElementById('prod-acond-outros-wrapper');
    if (outrosWrapper) outrosWrapper.style.display = isOutros ? '' : 'none';

    prodAtualizarCubagemAviso(document.getElementById('prod-embalagem-transporte'));

    // Recria as linhas de medida de caixa extras salvas (prodLimparFormEmbalagem
    // já zerou o container antes desta função ser chamada em editar/visualizar)
    (dados.medidas_caixa || []).forEach(m => {
        prodAdicionarMedidaCaixa();
        const rows = document.querySelectorAll('#prod-medidas-caixas-container > div');
        const row = rows[rows.length - 1];
        if (!row) return;
        const vol  = row.querySelector('input[name^="caixa_volume_"]');
        const comp = row.querySelector('input[name^="caixa_comprimento_"]');
        const larg = row.querySelector('input[name^="caixa_largura_"]');
        const alt  = row.querySelector('input[name^="caixa_altura_"]');
        if (vol)  vol.value  = m.volume || '';
        if (comp) comp.value = m.comprimento || '';
        if (larg) larg.value = m.largura || '';
        if (alt)  alt.value  = m.altura || '';
    });
}

function _prodEmbalagemFecharForm() {
    _prodEmbalagemEditandoId = null;
    document.getElementById('prod-embalagem-form').style.display = 'none';
    prodLimparFormEmbalagem();
    _prodEmbalagemSetCamposDisabled(false);
}

// Antes de salvar de verdade, pede pro usuário conferir se as dimensões batem
// com o modal de transporte escolhido (o app não valida isso automaticamente
// — é só um lembrete visual, ver prodConfirmarSalvarEmbalagem/prodAjustarDimensoes).
function prodSalvarEmbalagem() {
    const nomeEl = document.getElementById('prod-embalagem-nome');
    if (!nomeEl.value.trim()) {
        alert('Informe o Nome da Embalagem.');
        nomeEl.focus();
        return;
    }

    // Tipo de Embalagem e Tipo de Acondicionamento são livres, mas pelo menos
    // um dos dois precisa estar preenchido antes de salvar — sinaliza direto
    // nos dois campos (borda vermelha) em vez de um alert() do navegador.
    const embalagemEl = document.getElementById('prod-embalagem');
    const acondicionamentoEl = document.getElementById('prod-acondicionamento');
    if (!embalagemEl.value.trim() && !acondicionamentoEl.value.trim()) {
        [embalagemEl, acondicionamentoEl].forEach(el => {
            el.style.borderColor = '#dc2626';
            el.addEventListener('input',  () => { el.style.borderColor = ''; }, { once: true });
        });
        mostrarNotificacao('Preencha pelo menos o Tipo de Embalagem ou o Tipo de Acondicionamento.', 'warning');
        embalagemEl.focus();
        return;
    }

    const transporteEl = document.getElementById('prod-embalagem-transporte');
    const modalLabel = _PROD_EMBALAGEM_TRANSPORTE_LABELS[transporteEl?.value] || 'não informado';
    const msgEl = document.getElementById('prod-confirmar-dimensoes-msg');
    if (msgEl) msgEl.innerHTML = `Verificar se as dimensões informadas são aceitas dentro do modal de transporte informado: <strong>${_prodEscapeHtml(modalLabel)}</strong>.`;

    const modal = document.getElementById('prod-modal-confirmar-dimensoes');
    if (modal) modal.style.display = 'flex';
}

// "Ajustar" — só fecha o aviso, mantém o formulário de embalagem aberto pro
// usuário corrigir as dimensões antes de tentar salvar de novo.
function prodAjustarDimensoes() {
    const modal = document.getElementById('prod-modal-confirmar-dimensoes');
    if (modal) modal.style.display = 'none';
}

// "Confirmar/Salvar" — segue com o salvamento de verdade (lógica que antes
// estava direto em prodSalvarEmbalagem).
function prodConfirmarSalvarEmbalagem() {
    const modal = document.getElementById('prod-modal-confirmar-dimensoes');
    if (modal) modal.style.display = 'none';

    const dados = _prodEmbalagemColetarDados();

    if (_prodEmbalagemEditandoId) {
        const idx = _prodEmbalagens.findIndex(e => e.id === _prodEmbalagemEditandoId);
        if (idx > -1) _prodEmbalagens[idx] = dados;
    } else {
        _prodEmbalagens.push(dados);
    }

    _prodEmbalagemFecharForm();
    _prodRenderTabelaEmbalagens();
}

function prodExcluirEmbalagemForm() {
    if (_prodEmbalagemEditandoId) {
        if (!confirm('Deseja realmente excluir esta embalagem?')) return;
        _prodEmbalagens = _prodEmbalagens.filter(e => e.id !== _prodEmbalagemEditandoId);
        _prodRenderTabelaEmbalagens();
    }
    _prodEmbalagemFecharForm();
}

function prodFecharVisualizacaoEmbalagem() {
    _prodEmbalagemFecharForm();
}

function prodEditarEmbalagem(id) {
    const dados = _prodEmbalagens.find(e => e.id === id);
    if (!dados) return;
    _prodEmbalagemEditandoId = id;
    prodLimparFormEmbalagem();
    _prodEmbalagemPreencherForm(dados);
    _prodEmbalagemSetCamposDisabled(false);
    _prodEmbalagemBotoes('edicao');

    const form = document.getElementById('prod-embalagem-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prodVerEmbalagem(id) {
    const dados = _prodEmbalagens.find(e => e.id === id);
    if (!dados) return;
    _prodEmbalagemEditandoId = id;
    prodLimparFormEmbalagem();
    _prodEmbalagemPreencherForm(dados);
    _prodEmbalagemSetCamposDisabled(true);
    _prodEmbalagemBotoes('visualizacao');

    const form = document.getElementById('prod-embalagem-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prodExcluirEmbalagemTabela(id) {
    if (!confirm('Deseja realmente excluir esta embalagem?')) return;
    _prodEmbalagens = _prodEmbalagens.filter(e => e.id !== id);
    if (_prodEmbalagemEditandoId === id) _prodEmbalagemFecharForm();
    _prodRenderTabelaEmbalagens();
}

function _prodEmbalagemDimensoesTexto(dados) {
    const c = dados['prod-comprimento'], l = dados['prod-largura'], a = dados['prod-altura'];
    if (!c && !l && !a) return '—';
    return `${c || '—'} × ${l || '—'} × ${a || '—'} cm`;
}

function _prodRenderTabelaEmbalagens() {
    const wrapper = document.getElementById('prod-embalagens-tabela-wrapper');
    const corpo   = document.getElementById('prod-embalagens-tabela-corpo');
    if (!wrapper || !corpo) return;

    if (!_prodEmbalagens.length) {
        wrapper.style.display = 'none';
        corpo.innerHTML = '';
        return;
    }

    wrapper.style.display = '';
    corpo.innerHTML = _prodEmbalagens.map(dados => `
        <tr>
            <td>${_prodEscapeHtml(dados['prod-embalagem-nome'] || '—')}</td>
            <td>${_prodEscapeHtml(_PROD_EMBALAGEM_TRANSPORTE_LABELS[dados['prod-embalagem-transporte']] || '—')}</td>
            <td>${_prodEscapeHtml(_prodEmbalagemDimensoesTexto(dados))}</td>
            <td>${_prodEscapeHtml(dados['prod-peso-liquido'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-peso-bruto'] || '—')}</td>
            <td>
                <button type="button" class="btn-acao btn-visualizar" title="Ver" onclick="prodVerEmbalagem(${dados.id})"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="btn-acao btn-editar" title="Editar" onclick="prodEditarEmbalagem(${dados.id})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-acao btn-excluir" title="Excluir" onclick="prodExcluirEmbalagemTabela(${dados.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

// ========================================
// PRODUTO — UNIDADE DE MEDIDA AUTOCOMPLETE
// ========================================

function iniciarAutocompleteUnidadeProduto() {
    const input = document.getElementById('prod-unidade');
    const lista = document.getElementById('prod-unidade-lista');
    if (!input || !lista) return;

    async function mostrar() {
        await _carregarUnidades();
        const q = input.value.trim().toLowerCase();
        const filtradas = q
            ? _acUnidades.filter(u => (u.unidade || '').toLowerCase().includes(q) || (u.descricao || '').toLowerCase().includes(q))
            : _acUnidades;
        if (!filtradas.length) { lista.classList.remove('aberta'); return; }
        lista.innerHTML = filtradas.slice(0, 100).map(u => `
            <div class="autocomplete-item" data-valor="${u.unidade}">
                <span class="ac-nome">${u.unidade}</span>
                <span class="ac-fantasia">${u.descricao || ''}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('input', mostrar);
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.valor;
        lista.classList.remove('aberta');
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
}

// ========================================
// PRODUTO — PREVIEW IMAGEM
// ========================================

let _prodImgDataUrl = null;

function prodPreviewImagem(fileInput) {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        _prodImgDataUrl = e.target.result;
        const label = document.getElementById('prod-img-label');
        const acoes = document.getElementById('prod-img-acoes');
        if (label) label.textContent = file.name;
        if (acoes) acoes.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function prodVerImagem() {
    if (!_prodImgDataUrl) return;
    const win = window.open('', '_blank');
    win.document.write(`<img src="${_prodImgDataUrl}" style="max-width:100%;display:block;margin:auto;">`);
}

function prodRemoverImagem() {
    _prodImgDataUrl = null;
    const fileInput = document.getElementById('prod-imagem-file');
    const label     = document.getElementById('prod-img-label');
    const acoes     = document.getElementById('prod-img-acoes');
    if (fileInput) fileInput.value = '';
    if (label)     label.textContent = 'Selecionar imagem';
    if (acoes)     acoes.style.display = 'none';
}

// ========================================
// PRODUTO — EMBALAGEM AUTOCOMPLETE
// ========================================

function iniciarAutocompleteEmbalagemProduto() {
    const input  = document.getElementById('prod-embalagem');
    const hidden = document.getElementById('prod-embalagem-codigo');
    const lista  = document.getElementById('prod-embalagem-lista');
    if (!input || !lista) return;

    async function mostrar() {
        const q = input.value.trim().toLowerCase();
        try {
            let query = supabaseClient.from('embalagens').select('codigo, descricao').order('descricao');
            if (q) query = query.or(`descricao.ilike.%${q}%,codigo.ilike.%${q}%`);
            const { data } = await query.limit(30);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(e => `
                <div class="autocomplete-item" data-codigo="${e.codigo || ''}" data-descricao="${(e.descricao || '').replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${e.descricao || ''}</span>
                </div>`).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    let _sel = false;
    input.addEventListener('input', () => { if (!_sel) mostrar(); });
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        e.preventDefault();
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        _sel = true;
        input.value = item.dataset.descricao;
        if (hidden) hidden.value = item.dataset.codigo;
        lista.classList.remove('aberta');
        setTimeout(() => { _sel = false; }, 0);
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
}

// ========================================
// PRODUTO — ACONDICIONAMENTO AUTOCOMPLETE
// ========================================

function iniciarAutocompleteAcondicionamentoProduto() {
    const input  = document.getElementById('prod-acondicionamento');
    const hidden = document.getElementById('prod-acondicionamento-numero');
    const lista  = document.getElementById('prod-acondicionamento-lista');
    if (!input || !lista) return;

    async function mostrar() {
        const q = input.value.trim().toLowerCase();
        try {
            let query = supabaseClient.from('apoio_acondicionamento').select('numero, descricao').order('descricao');
            if (q) query = query.or(`descricao.ilike.%${q}%,numero.ilike.%${q}%`);
            const { data } = await query.limit(30);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(a => `
                <div class="autocomplete-item" data-numero="${a.numero || ''}" data-descricao="${(a.descricao || '').replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${a.descricao || ''}</span>
                </div>`).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    const outrosWrapper = document.getElementById('prod-acond-outros-wrapper');
    const outrosInput   = document.getElementById('prod-acond-descricao');

    function _toggleOutros(descricao) {
        const isOutros = /^outros?$/i.test(descricao.trim());
        if (outrosWrapper) outrosWrapper.style.display = isOutros ? '' : 'none';
        if (outrosInput)   outrosInput.required = isOutros;
        if (!isOutros && outrosInput) outrosInput.value = '';
    }

    let _sel = false;
    input.addEventListener('input', () => {
        if (!_sel) { _toggleOutros(''); mostrar(); }
    });
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        e.preventDefault();
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        _sel = true;
        input.value = item.dataset.descricao;
        if (hidden) hidden.value = item.dataset.numero;
        _toggleOutros(item.dataset.descricao);
        lista.classList.remove('aberta');
        setTimeout(() => { _sel = false; }, 0);
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
}

function prodAtualizarEstoqueConfig() {
    const controla = document.getElementById('prod-controla-estoque');
    const campos   = ['prod-estoque-atual', 'prod-estoque-minimo', 'prod-estoque-maximo'];
    const desativa = controla && !controla.checked;
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.disabled = desativa;
        el.style.opacity = desativa ? '0.4' : '';
    });
}

function _ativarMaiusculas(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    const seletores = 'input[type="text"], input[type="tel"], textarea';
    form.querySelectorAll(seletores).forEach(el => {
        if (el.readOnly || el.dataset.noCaps) return;
        el.addEventListener('input', () => { el.value = el.value.toUpperCase(); });
    });
    new MutationObserver(mutations => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
            if (node.nodeType !== 1) return;
            node.querySelectorAll?.(seletores).forEach(el => {
                if (el.readOnly || el.dataset.noCaps || el._capsAtivado) return;
                el._capsAtivado = true;
                el.addEventListener('input', () => { el.value = el.value.toUpperCase(); });
            });
        }));
    }).observe(form, { childList: true, subtree: true });
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
    ['fabricante', 'fornecedor'].forEach(t => {
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

document.addEventListener('DOMContentLoaded', async function () {
    window._usuarioLogado = obterUsuarioLogado() || {};

    // Carregar dados da empresa tenant para auto-preenchimento
    try {
        const resEmp = await window.supabaseAPI.buscarTenantEmpresa();
        if (resEmp.sucesso && resEmp.data) {
            window._dadosEmpresaTenant = resEmp.data;
            window._usuarioLogado.empresa     = resEmp.data.razao_social || window._usuarioLogado.empresa || '';
            window._usuarioLogado.nome_empresa = resEmp.data.razao_social || '';
            window._usuarioLogado.documento   = resEmp.data.cnpj || '';
        }
    } catch (_) {}

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
    iniciarMascaraCEPColeta();
    empIniciarTags();
    empContatoIniciar();
    onModeloChange('');
    empAdicionarDocumento();

    // Edição da empresa proprietária (vindo de perfil.html)
    const _empModoTenant = new URLSearchParams(window.location.search).get('modo') === 'tenant';
    if (_empModoTenant) {
        const raw = sessionStorage.getItem('_tenantEmpresaEdicao');
        if (raw) {
            sessionStorage.removeItem('_tenantEmpresaEdicao');
            const dados = JSON.parse(raw);
            window._tenantEmpresaId = dados._tenantId;
            _empPreencherEdicao(dados);
            // Oculta campos de tipo (não se aplica à empresa própria)
            document.querySelector('.emp-modelo-row')?.style.setProperty('display', 'none');
            document.querySelector('.emp-tipos-row')?.style.setProperty('display', 'none');
            // Banner informativo
            const form = document.getElementById('form-empresa');
            if (form) form.insertAdjacentHTML('afterbegin',
                '<div style="background:#eff6ff;border-left:3px solid #4776ec;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;color:#3b82f6;">' +
                '<i class="fa-solid fa-circle-info" style="margin-right:6px;"></i>Você está editando os dados da sua própria empresa.</div>');
        }
    }

    // Edição / Visualização via empresa_id (vindo de cadastros.html)
    const _empIdEdicaoParam = new URLSearchParams(window.location.search).get('empresa_id');
    const _empModoVisualizar = new URLSearchParams(window.location.search).get('modo') === 'visualizar';
    if (_empIdEdicaoParam) {
        const res = await window.supabaseAPI.buscarEmpresaPorId(_empIdEdicaoParam);
        if (res.sucesso && res.data) {
            _empPreencherEdicao(res.data);
            if (_empModoVisualizar) _empAtivarModoVisualizar();
        } else {
            mostrarNotificacao('Empresa não encontrada.', 'erro');
        }
    }

    // Pré-preenchimento via upload (vindo de cadastros.html)
    if (new URLSearchParams(window.location.search).get('from_upload') === '1') {
        const dadosRaw = sessionStorage.getItem('_uploadEmpresaDados');
        if (dadosRaw) {
            sessionStorage.removeItem('_uploadEmpresaDados');
            _empPreencherDoUpload(JSON.parse(dadosRaw));
        }
    }
    _ativarMaiusculas('form-empresa');
    _ativarMaiusculas('form-processo');
    _ativarMaiusculas('form-proposta');
    _ativarMaiusculas('form-produto');
    _carregarMoedas().then(moedas => {
        const sel = document.getElementById('fin-rec-moeda');
        if (!sel || !moedas) return;
        moedas.forEach(m => {
            const o = document.createElement('option');
            o.value = m.codigo;
            o.textContent = m.descricao || m.codigo;
            sel.appendChild(o);
        });
    });

    // Processo
    const _hoje = new Date().toISOString().split('T')[0];
    const _inputAbertura = document.getElementById('proc-data-abertura');
    if (_inputAbertura && !_inputAbertura.value) _inputAbertura.value = _hoje;
    const _selectStatusProc = document.getElementById('proc-status');
    if (_selectStatusProc && !_selectStatusProc.value) _selectStatusProc.value = 'aberto';

    aplicarMascaraDocumentoProcesso();
    iniciarEmissor();
    iniciarCamposModal();
    iniciarEtapas();
    iniciarCamposStatus();
    iniciarAutocompleteProcCliente();
    iniciarAutocompleteProcCodProposta();
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

    // Pré-preenchimento via proforma_id — APÓS todos os iniciar* para que os listeners estejam prontos
    const _procProformaIdParam = new URLSearchParams(window.location.search).get('proforma_id');
    if (_procProformaIdParam) {
        await _acCarregarPropostas();
        const proformaAc = _acPropostas.find(x => x.id === _procProformaIdParam);
        const codigoEl   = document.getElementById('proc-codigo');
        const idOcultoEl = document.getElementById('proc-proposta-id');
        if (codigoEl)   codigoEl.value   = proformaAc?.nome || '';
        if (idOcultoEl) idOcultoEl.value = _procProformaIdParam;
        await _procPreencherDaProforma(_procProformaIdParam);
    }

    // Produto
    iniciarAutocompleteEmpresaProduto();
    iniciarAutocompleteNcmProduto();
    iniciarAutocompleteUnidadeProduto();
    iniciarAutocompleteMoedaProduto();
    iniciarAutocompleteEmbalagemProduto();
    iniciarAutocompleteAcondicionamentoProduto();
    prodAplicarBloqueioRadical();

    // Proposta
    const _urlParams    = new URLSearchParams(window.location.search);
    const _urlTab       = _urlParams.get('tab');
    const _urlId        = _urlParams.get('id');
    const _urlModo      = _urlParams.get('modo');

    // ?id= só é ID de proposta quando tab != processo
    const _propIdEdicao = _urlTab !== 'processo' ? _urlId : null;

    if (!_propIdEdicao) {
        propGerarCodigo();
        const _propDataCriacao = document.getElementById('prop-data-emissao');
        if (_propDataCriacao) _propDataCriacao.value = new Date().toISOString().slice(0, 10);
    }
    iniciarResumoProposta();
    iniciarEmissorProposta();
    iniciarModalIncotermProposta();
    iniciarMascaraDocumentoProposta();
    iniciarValidadeProposta();
    iniciarAutocompletePaisOrigemProposta();
    iniciarAutocompletePaisDestinoProposta();
    iniciarAutocompletePropPedido();
    iniciarAutocompletePropCliente();
    iniciarAutocompleteEmpresaDestinoProposta();
    iniciarAutocompleteAeroportos();
    iniciarAutocompletePortos();
    propIniciarItens();

    if (_propIdEdicao) {
        await propCarregarEdicao(_propIdEdicao);
        if (_urlModo === 'visualizar') propAplicarModoVisualizacao();
    } else {
        // Proforma gerada a partir de um Pedido — pré-preenche o destinatário
        const _propPedidoIdParam = _urlParams.get('pedido_id');
        if (_propPedidoIdParam) {
            document.getElementById('prop-pedido-id').value = _propPedidoIdParam;
            await _propPreencherDoPedido(_propPedidoIdParam);
        }
    }

    // Processo — pré-preencher ao editar via ?tab=processo&id=...
    if (_urlTab === 'processo' && _urlId) {
        await procCarregarEdicao(_urlId);
        if (_urlModo === 'visualizar') procAplicarModoVisualizacao();
        if (_urlModo === 'pdf') {
            procAplicarModoVisualizacao();
            setTimeout(() => {
                if (typeof gerarPDFProcesso === 'function') gerarPDFProcesso();
                setTimeout(() => window.close(), 800);
            }, 600);
        }
    }

    // Produto — pré-preencher ao editar via ?tab=produto&id=...
    if (_urlTab === 'produto' && _urlId) {
        const resProd = await window.supabaseAPI.buscarProdutoPorId(_urlId);
        if (resProd.sucesso && resProd.data) {
            await _prodPreencherEdicao(resProd.data);
        } else {
            mostrarNotificacao('Produto não encontrado.', 'erro');
        }
    }

    // Produto — pré-preenchimento via upload (vindo de produtos.html)
    if (_urlTab === 'produto' && _urlParams.get('from_upload') === '1') {
        const dadosRaw = sessionStorage.getItem('_uploadProdutoDados');
        if (dadosRaw) {
            sessionStorage.removeItem('_uploadProdutoDados');
            await _prodPreencherDoUpload(JSON.parse(dadosRaw));
        }
    }

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
    const tipoSelect = document.getElementById('transp-tipo');
    const nomeInput  = document.getElementById('transp-razao');
    const nomeHidden = document.getElementById('transp-nome');
    const nomeLista  = document.getElementById('transp-nome-lista');
    const cnpjInput  = document.getElementById('transp-cnpj');
    const aviso      = _criarAvisoTransp();
    if (!tipoSelect || !nomeInput) return;

    let _transpCache = null;

    async function _carregarTransps() {
        if (_transpCache) return _transpCache;
        const usuario = obterUsuarioLogado();
        if (!usuario) return [];
        try {
            const { data } = await supabaseClient
                .from('empresas_cadastradas')
                .select('id, nome_empresa, nome_fantasia, documento')
                .eq('empresa_proprietaria_id', usuario.empresa_id)
                .contains('tipos', ['transportadora']);
            _transpCache = data || [];
        } catch { _transpCache = []; }
        return _transpCache;
    }

    function _selecionarTransp(item) {
        const nome = item.nome_empresa || item.nome_fantasia || '';
        nomeInput.value = nome;
        if (nomeHidden) nomeHidden.value = nome;
        if (cnpjInput) cnpjInput.value = item.documento || '';
        if (nomeLista) nomeLista.classList.remove('aberta');
    }

    async function _mostrarSugestoes() {
        if (tipoSelect.value !== 'solicitada') return;
        const lista = await _carregarTransps();
        if (!lista.length || !nomeLista) return;
        const q = nomeInput.value.trim().toLowerCase();
        const filtradas = q
            ? lista.filter(t => (t.nome_empresa || t.nome_fantasia || '').toLowerCase().includes(q))
            : lista;
        if (!filtradas.length) { nomeLista.classList.remove('aberta'); return; }
        nomeLista.innerHTML = filtradas.slice(0, 20).map(t => `
            <div class="autocomplete-item"
                 data-nome="${(t.nome_empresa || t.nome_fantasia || '').replace(/"/g,'&quot;')}"
                 data-doc="${t.documento || ''}">
                <span class="ac-nome">${t.nome_empresa || t.nome_fantasia || '—'}</span>
                ${t.nome_fantasia && t.nome_empresa ? `<span class="ac-fantasia">${t.nome_fantasia}</span>` : ''}
            </div>`).join('');
        _acPosicionar(nomeInput, nomeLista);
        nomeLista.classList.add('aberta');
    }

    if (nomeLista) {
        nomeInput.addEventListener('focus', _mostrarSugestoes);
        nomeInput.addEventListener('input', _mostrarSugestoes);
        nomeLista.addEventListener('mousedown', e => {
            const item = e.target.closest('.autocomplete-item');
            if (!item) return;
            _selecionarTransp({ nome_empresa: item.dataset.nome, documento: item.dataset.doc });
        });
        document.addEventListener('click', e => {
            if (!nomeInput.contains(e.target) && !nomeLista.contains(e.target))
                nomeLista.classList.remove('aberta');
        });
    }

    tipoSelect.addEventListener('change', async function () {
        aviso.style.display = 'none';
        if (nomeLista) nomeLista.classList.remove('aberta');
        nomeInput.value = '';
        if (nomeHidden) nomeHidden.value = '';
        if (cnpjInput) cnpjInput.value = '';

        if (this.value !== 'propria') return;

        const lista = await _carregarTransps();
        if (!lista.length) {
            aviso.textContent = 'Nenhuma transportadora cadastrada encontrada.';
            aviso.style.display = 'block';
            return;
        }
        if (lista.length === 1) {
            _selecionarTransp(lista[0]);
            aviso.textContent = 'Transportadora preenchida automaticamente.';
            aviso.className = 'transp-aviso transp-aviso-ok';
            aviso.style.display = 'block';
            return;
        }
        _mostrarDropdownTransp(lista, nomeInput, cnpjInput);
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
    if (_acMoedas.length > 0) return _acMoedas;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('codigo', { ascending: true });
        _acMoedas = data || [];
    } catch { _acMoedas = []; }
    return _acMoedas;
}

// UNIDADES DE MEDIDA — CACHE COMPARTILHADO
// ========================================

async function _carregarUnidades() {
    if (_acUnidades.length > 0) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_unidades_medida')
            .select('unidade, descricao')
            .order('unidade', { ascending: true })
            .limit(10000);
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

function _mascaraIE(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 12);
    if (d.length <= 9) {
        let o = d.slice(0, 3);
        if (d.length > 3) o += '.' + d.slice(3, 6);
        if (d.length > 6) o += '.' + d.slice(6, 8);
        if (d.length > 8) o += '-' + d.slice(8, 9);
        return o;
    } else {
        let o = d.slice(0, 3);
        if (d.length > 3) o += '.' + d.slice(3, 6);
        if (d.length > 6) o += '.' + d.slice(6, 9);
        if (d.length > 9) o += '.' + d.slice(9, 12);
        return o;
    }
}

function _mascaraIM(valor) {
    const d = valor.replace(/\D/g, '').slice(0, 7);
    let o = d.slice(0, 6);
    if (d.length > 6) o += '-' + d.slice(6, 7);
    return o;
}

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
                (e.razao_social  || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento     || '').includes(q))
            : _acEmpresas;

        lista.innerHTML = filtradas.length
            ? filtradas.slice(0, 30).map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-razao="${(e.razao_social  || '').replace(/"/g,'&quot;')}"
                     data-fantasia="${(e.nome_fantasia || '').replace(/"/g,'&quot;')}"
                     data-doc="${e.documento || ''}"
                     data-idint="${(e.identificacao_empresa || '').replace(/"/g,'&quot;')}">
                    <span class="ac-nome">${e.razao_social || ''}</span>
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

        const docEl = document.getElementById('prop-emp-dest-doc');
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

async function _preencherPaisPorPrefixo(prefixoId, valorPais) {
    const paisInput = document.getElementById(`${prefixoId}-pais`);
    const paisCod   = document.getElementById(`${prefixoId}-pais-codigo`);
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

async function _propPreencherPaisOrigem(valorPais) {
    return _preencherPaisPorPrefixo('prop-origem', valorPais);
}

// ========================================
// PROPOSTA — MODO VISUALIZAÇÃO
// ========================================

function propAplicarModoVisualizacao() {
    const form = document.getElementById('form-proposta');
    if (!form) return;

    // Desabilita todos os inputs, selects e textareas
    form.querySelectorAll('input, select, textarea, button[type="submit"]').forEach(el => {
        el.disabled = true;
    });

    // Oculta botões de ação (salvar, limpar)
    const actions = form.querySelector('.form-actions');
    if (actions) actions.style.display = 'none';

    // Oculta botões de adicionar itens
    form.querySelectorAll('.btn-add-item, .btn-add-idioma, [id^="btn-add"]').forEach(el => {
        el.style.display = 'none';
    });

    // Banner de modo visualização
    const banner = document.createElement('div');
    banner.style.cssText = 'position:sticky;top:0;z-index:100;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.3px;';
    banner.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Modo Visualização — somente leitura';
    form.insertBefore(banner, form.firstChild);
}

// ========================================
// PROPOSTA — CARREGAR EDIÇÃO
// ========================================

async function propCarregarEdicao(id) {
    const res = await window.supabaseAPI.buscarProforma(id);
    if (!res.sucesso || !res.data) {
        mostrarNotificacao('Proforma não encontrada.', 'erro');
        return;
    }
    const d = res.data;
    const g = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };

    // ID e código
    g('prop-id',             d.id);
    g('prop-codigo',         d.codigo);
    const display = document.getElementById('prop-codigo-display');
    if (display) display.textContent = d.codigo || '—';

    // Pedido de origem (somente leitura)
    if (d.pedido_id) {
        g('prop-pedido-id', d.pedido_id);
        const origemEl    = document.getElementById('prop-pedido-origem');
        const origemGroup = document.getElementById('prop-pedido-origem-group');
        if (origemGroup) origemGroup.style.display = '';
        try {
            const { data: pedido } = await supabaseClient.from('pedidos').select('numero').eq('id', d.pedido_id).single();
            if (origemEl) origemEl.value = pedido?.numero || d.pedido_id;
        } catch (_) {
            if (origemEl) origemEl.value = d.pedido_id;
        }
    }

    // Idioma
    g('prop-idioma', d.idioma || 'pt');
    const idiomaOutroEl = document.getElementById('prop-idioma-outro');
    if (idiomaOutroEl) {
        idiomaOutroEl.value = d.idioma === 'outro' ? (d.idioma_outro || '') : '';
        idiomaOutroEl.style.display = d.idioma === 'outro' ? '' : 'none';
    }

    // Campos simples
    g('prop-tipo',           d.tipo);
    g('prop-proposito',      d.proposito);
    g('prop-documento',      d.documento);
    g('prop-documento-tipo', d.documento_tipo);
    g('prop-incoterm',       d.incoterm);
    g('prop-origem-pais',    d.origem_pais);
    g('prop-origem-pais-codigo', d.origem_pais_codigo);
    g('prop-destino-pais',   d.destino_pais);
    g('prop-destino-pais-codigo', d.destino_pais_codigo);
    g('prop-porto-origem',   d.porto_origem);
    g('prop-porto-destino',  d.porto_destino);
    g('prop-aeroporto-origem',  d.aeroporto_origem);
    g('prop-aeroporto-destino', d.aeroporto_destino);
    g('prop-fronteira-saida',   d.fronteira_saida);
    g('prop-fronteira-entrada', d.fronteira_entrada);
    g('prop-forma-pagamento',   d.forma_pagamento);
    g('prop-prazo-pagamento',   d.prazo_pagamento);
    g('prop-condicoes-obs',     d.condicoes_obs);
    g('prop-observacoes',       d.observacoes);
    g('prop-data-emissao',      d.data_emissao);
    g('prop-data-validade',     d.data_validade);
    g('prop-validade-dias',     d.validade_dias);
    g('prop-obs-status',        d.obs_status);

    // Modal — dispara change para mostrar grupos corretos e habilitar incoterm
    const modalEl = document.getElementById('prop-modal');
    if (modalEl && d.modal) {
        modalEl.value = d.modal;
        modalEl.dispatchEvent(new Event('change'));
    }

    // Emissor
    const emissorTipo = d.emissor_tipo || 'usuario';
    const radioEl = document.querySelector(`input[name="prop-emissor-tipo"][value="${emissorTipo}"]`);
    if (radioEl) {
        radioEl.checked = true;
        radioEl.dispatchEvent(new Event('change'));
    }
    if (emissorTipo === 'terceiro') {
        if (d.parceiro_id) g('prop-cliente-id', d.parceiro_id);
        // Nome visível: prioriza o snapshot em texto (sempre confiável) — o
        // autocomplete por ID só re-preenche o texto se o usuário reabrir a
        // busca, então sem isso o campo ficava em branco na edição.
        if (d.parceiro_razao_social) g('prop-cliente', d.parceiro_razao_social);
    }

    // Destinatário
    if (d.destinatario_id) {
        g('prop-emp-dest-id', d.destinatario_id);
    }
    if (d.destinatario_razao_social) {
        g('prop-emp-dest-razao', d.destinatario_razao_social);
        const razaoGroup = document.getElementById('prop-emp-dest-razao-group');
        const buscaGroup = document.getElementById('prop-emp-dest-busca-group');
        if (razaoGroup) razaoGroup.style.display = '';
        if (buscaGroup) buscaGroup.style.display = 'none';
    }
    if (d.destinatario_doc) {
        g('prop-emp-dest-doc',      d.destinatario_doc);
        g('prop-emp-dest-doc-tipo', d.destinatario_doc_tipo);
        const docGroup = document.getElementById('prop-emp-dest-doc-group');
        if (docGroup) docGroup.style.display = '';
    }

    // Itens
    if (Array.isArray(d.itens) && d.itens.length > 0) {
        await Promise.all([_carregarMoedas(), _carregarUnidades()]);
        _propItens = d.itens.map(it => ({
            produto_id: it.produto_id || null,
            produto:  it.produto  || '',
            qtd:      it.qtd      ?? it.quantidade ?? 1,
            unidade:  it.unidade  || (_acUnidades[0]?.unidade || 'UN'),
            preco:    it.preco    ?? it.preco_unit ?? 0,
            moeda:    it.moeda    || (_acMoedas[0]?.descricao || 'USD'),
        }));
        propRenderizarItens();
    }

    // Indicar modo edição no botão salvar
    const btnSalvar = document.querySelector('#form-proposta button[type="submit"]');
    if (btnSalvar) btnSalvar.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Atualizar Proforma';
}

async function propGerarCodigo() {
    const now  = new Date();
    const ano  = String(now.getFullYear());
    const cont = await window.supabaseAPI.contarPropostas().catch(() => 0);
    const codigo  = `PRO${ano}${String(cont + 1).padStart(6, '0')}`;
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
    _propItens.push({ produto_id: null, produto: '', qtd: 1, unidade: _unidadeDefault, preco: 0, moeda: _moedaDefault });
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
