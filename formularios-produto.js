// ========================================
// FORMULÁRIOS — Aba Produto (tags, documentos, preços, NCM/HS, idiomas, embalagens, composição, imagem)
// ========================================
// Parte do antigo formularios.js (dividido por aba em 2026-10). Tudo continua
// global: funções de uma aba podem chamar as das outras e as de formularios.js.

// ========================================
// TAGS — PRODUTO (substituiu o campo "Referência Interna")
// ========================================
// Mesma mecânica das tags de Empresa, ids próprios. Guarda em produtos.tags
// (JSONB array — ver database-produtos-tags.sql). Cap de 10 (mais folgado que
// as 4 de Empresa, porque tag de produto é classificação, tende a ser mais).

let _prodTagsArray = [];

function prodIniciarTags() {
    const input = document.getElementById('prod-tags-input');
    if (!input) return;
    input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); prodAdicionarTag(); }
    });
}

function prodAdicionarTag() {
    const input = document.getElementById('prod-tags-input');
    const texto = input.value.trim().toLowerCase();
    if (!texto) return;
    if (_prodTagsArray.length >= 10) { mostrarNotificacao('Limite de 10 tags atingido.', 'warning'); input.value = ''; return; }
    if (_prodTagsArray.includes(texto)) { input.value = ''; return; }
    _prodTagsArray.push(texto);
    prodRenderizarTags();
    input.value = '';
    input.focus();
}

function prodRemoverTag(i) {
    _prodTagsArray.splice(i, 1);
    prodRenderizarTags();
}

function prodRenderizarTags() {
    const container = document.getElementById('prod-tags-container');
    const hidden    = document.getElementById('prod-tags');
    if (!container) return;

    if (_prodTagsArray.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
    } else {
        container.style.display = 'flex';
        container.innerHTML = _prodTagsArray.map((tag, i) => `
            <div class="tag-item">
                <i class="fa-solid fa-tag"></i>
                <span>${tag}</span>
                <i class="fa-solid fa-xmark tag-remove" onclick="prodRemoverTag(${i})"></i>
            </div>`).join('');
    }

    if (hidden) hidden.value = JSON.stringify(_prodTagsArray);
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
// ── Características (database-ci-colunas-modelos.sql) ──
// Lista livre nome/valor; vira opção de coluna na Commercial Invoice.
function prodAdicionarCaracteristica(nome = '', valor = '') {
    const lista = document.getElementById('prod-carac-lista');
    if (!lista) return;
    const row = document.createElement('div');
    row.className = 'prod-carac-linha';
    row.innerHTML = `
        <input type="text" class="prod-carac-nome" list="prod-carac-sugestoes" placeholder="Característica (ex.: Cor)" aria-label="Característica">
        <input type="text" class="prod-carac-valor" placeholder="Valor (ex.: Azul)" aria-label="Valor da característica">
        <button type="button" class="prod-carac-remover" title="Remover" onclick="this.parentElement.remove()"><i class="fa-solid fa-xmark"></i></button>`;
    row.querySelector('.prod-carac-nome').value = nome;
    row.querySelector('.prod-carac-valor').value = valor;
    lista.appendChild(row);
}

function _prodColetarCaracteristicas() {
    return [...document.querySelectorAll('#prod-carac-lista .prod-carac-linha')]
        .map(r => ({ nome: r.querySelector('.prod-carac-nome').value.trim(), valor: r.querySelector('.prod-carac-valor').value.trim() }))
        .filter(c => c.nome);
}

function _prodCarregarCaracteristicas(lista) {
    const box = document.getElementById('prod-carac-lista');
    if (!box) return;
    box.innerHTML = '';
    (Array.isArray(lista) ? lista : []).forEach(c => prodAdicionarCaracteristica(c?.nome || '', c?.valor || ''));
}

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

// Preços em outras moedas — lista de (Moeda, Preço de Venda, Preço de
// Compra), limitada a 4 linhas (mesmo teto já usado pelos idiomas do
// produto — ver prodAdicionarPrecoExtra) pra poder virar colunas fixas
// na planilha de atualização em lote (Moeda 2/Preço 2 ... Moeda 4/Preço 4).
function _prodColetarPrecos() {
    const precos = [];
    document.querySelectorAll('#prod-precos-extra-container > div[id^="prod-preco-row-"]').forEach(row => {
        const moeda      = row.querySelector('select[name^="preco_moeda_"]')?.value || '';
        const valorEl    = row.querySelector('input[name^="preco_valor_"]');
        const custoEl    = row.querySelector('input[name^="preco_custo_"]');
        const valor      = _prodValorMonetario(valorEl);
        const custo      = _prodValorMonetario(custoEl);
        if (!moeda || (!valor && !custo)) return; // linha incompleta, ignora
        const item = { moeda };
        if (valor) item.preco_venda = valor;
        if (custo) item.preco_custo = custo;
        precos.push(item);
    });
    return precos;
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
        tags:                   _prodTagsArray,
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
        caracteristicas:        _prodColetarCaracteristicas(),
        precos_alternativos:    _prodColetarPrecos(),
        documentos:             _prodColetarDocumentos(),
    };
}

async function salvarProduto(e) {
    e.preventDefault();
    if (!exigirEmpresaVinculada()) return;

    const dados = _coletarDadosProduto();
    if (!dados.sku)  { mostrarNotificacao('Informe o SKU do produto.', 'warning');           document.getElementById('prod-sku')?.focus();  return; }
    if (!dados.nome) { mostrarNotificacao('Informe o Nome do Produto.', 'warning');          document.getElementById('prod-nome')?.focus(); return; }

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

    // Embalagens/Composição têm tabela própria — só dá pra gravar depois de
    // ter o produto_id (na criação, só existe depois do insert acima). As 3
    // listas são independentes entre si — a falha de uma (ex: migração de
    // uma ainda não rodou) não deve impedir as outras de salvar.
    const avisos = [];

    const resEmb = await window.supabaseAPI.salvarEmbalagensProduto(_prodEditandoId, _prodEmbalagens.map(_prodEmbalagemParaLinhaDb), 'caixa');
    if (!resEmb.sucesso) avisos.push('embalagens: ' + (resEmb.mensagem || 'tente novamente'));

    const resEmbUnit = await window.supabaseAPI.salvarEmbalagensProduto(_prodEditandoId, _prodEmbalagensUnitarias.map(_prodEmbalagemUnitariaParaLinhaDb), 'unitaria');
    if (!resEmbUnit.sucesso) avisos.push('embalagens unitárias: ' + (resEmbUnit.mensagem || 'tente novamente'));

    const resComposicao = await window.supabaseAPI.salvarComposicaoProduto(_prodEditandoId, _prodComposicoes.map(_prodComposicaoParaLinhaDb));
    if (!resComposicao.sucesso) avisos.push('composição: ' + (resComposicao.mensagem || 'tente novamente'));

    if (avisos.length) {
        mostrarNotificacao('Produto salvo, mas houve erro ao salvar ' + avisos.join(' | '), 'warning');
    } else {
        mostrarNotificacao(jaExistia ? 'Produto atualizado com sucesso!' : 'Produto cadastrado com sucesso!', 'sucesso');
    }

    // Edição sempre abre numa aba nova (via editarProduto() em produtos.js) —
    // fecha sozinha depois de dar tempo do usuário ler a confirmação.
    // Cadastrar um novo continua aberto, pra dar pra cadastrar outro em seguida.
    if (jaExistia) _agendarFechamentoAutomatico();
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
    set('prod-ref-fornecedor', dados.referencia_fornecedor);
    set('prod-ref-outra', dados.referencia_outra);
    _prodTagsArray = Array.isArray(dados.tags) ? [...dados.tags] : [];
    prodRenderizarTags();

    // Empresa parceira ("Identificação da Empresa") — busca à parte só pra exibir
    // nome/documento, já que buscarProdutoPorId não traz esse join. Busca em
    // `parceiros` (próprios parceiros do usuário, id bigint), não em `empresas`
    // (diretório global de outros tenants) — ver database-produtos-empresa-parceira-fix.sql.
    if (dados.empresa_parceira_id) {
        set('prod-empresa-id', dados.empresa_parceira_id);
        try {
            const { data: emp } = await supabaseClient.from('parceiros')
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
    _prodCarregarCaracteristicas(dados.caracteristicas);
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

    // Preços em outras moedas — recria as linhas já salvas (até 3 extras)
    const precos = dados.precos_alternativos || [];
    for (const item of precos) {
        await prodAdicionarPrecoExtra();
        const rows = document.querySelectorAll('#prod-precos-extra-container > div[id^="prod-preco-row-"]');
        const row  = rows[rows.length - 1];
        if (!row) continue;
        const selectEl = row.querySelector('select[name^="preco_moeda_"]');
        const valorEl  = row.querySelector('input[name^="preco_valor_"]');
        const custoEl  = row.querySelector('input[name^="preco_custo_"]');
        if (selectEl) selectEl.value = item.moeda || '';
        if (valorEl)  valorEl.value  = item.preco_venda ? _prodFormatarMonetario(item.preco_venda) : '';
        if (custoEl)  custoEl.value  = item.preco_custo ? _prodFormatarMonetario(item.preco_custo) : '';
    }

    // Embalagens — tabela própria (produto_embalagens), busca à parte pelo produto_id
    const resEmbalagens = await window.supabaseAPI.buscarEmbalagensProduto(dados.id, 'caixa');
    _prodEmbalagens = (resEmbalagens.sucesso ? resEmbalagens.data : []).map(_prodEmbalagemDeLinhaDb);
    if (typeof _prodRenderTabelaEmbalagens === 'function') _prodRenderTabelaEmbalagens();

    const resEmbalagensUnit = await window.supabaseAPI.buscarEmbalagensProduto(dados.id, 'unitaria');
    _prodEmbalagensUnitarias = (resEmbalagensUnit.sucesso ? resEmbalagensUnit.data : []).map(_prodEmbalagemUnitariaDeLinhaDb);
    if (typeof _prodRenderTabelaEmbalagensUnitarias === 'function') _prodRenderTabelaEmbalagensUnitarias();

    // Composição — tabela própria (produto_composicao), busca à parte pelo produto_id
    const resComposicao = await window.supabaseAPI.buscarComposicaoProduto(dados.id);
    _prodComposicoes = (resComposicao.sucesso ? resComposicao.data : []).map(_prodComposicaoDeLinhaDb);
    if (typeof _prodRenderTabelaComposicao === 'function') _prodRenderTabelaComposicao();

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

    // mesma regra do formulário (_ativarMaiusculas): texto em maiúsculas, menos data-no-caps
    const set = (id, val) => {
        if (val === undefined || val === null || val === '') return;
        const el = document.getElementById(id);
        if (!el) return;
        const caps = el.matches('input[type="text"], input[type="tel"], textarea') && !el.readOnly && !el.dataset.noCaps;
        el.value = caps ? String(val).toUpperCase() : val;
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
                    <label for="prod-doc-tipo-${id}">Tipo de Documento</label>
                    <select id="prod-doc-tipo-${id}" name="prod_doc_tipo_${id}" onchange="prodTipoDocChange(this, ${id})">
                        <option value="">Selecione...</option>
                        ${tiposOpts}
                    </select>
                    <div id="prod-doc-info-${id}" style="display:none; margin-top:6px; background:#eff6ff; border-radius:8px; padding:8px 12px; font-size:12px; color:#1e40af; line-height:1.5;"></div>
                </div>
                <div class="form-group emp-doc-outros-group" id="prod-doc-desc-group-${id}" style="display:none;">
                    <label for="prod-doc-desc-${id}">Descrição</label>
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
            <span>${escHtml(usuario)}</span>
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
        // "".includes('') é sempre true — sem essa guarda, digitar só letras
        // (sem nenhum dígito) fazia esse pedaço bater com QUALQUER parceiro,
        // mesmo sem CNPJ/CPF, e a lista mostrava tudo em vez de filtrar.
        const qDigitos = q.replace(/\D/g, '');
        const filtradas = q
            ? _acEmpresas.filter(e =>
                (e.razao_social || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (qDigitos && (e.documento || '').replace(/\D/g,'').includes(qDigitos))
              )
            : _acEmpresas;
        lista.innerHTML = filtradas.length
            ? filtradas.map(e => `<div class="autocomplete-item" data-id="${e.id}" data-nome="${escHtml(e.nome_fantasia || e.razao_social)}" data-doc="${escHtml(e.documento || '')}">${escHtml(e.nome_fantasia || e.razao_social)}${e.documento ? `<span class="autocomplete-sub">${escHtml(e.documento)}</span>` : ''}</div>`).join('')
            : '<div class="autocomplete-vazio">Nenhum parceiro encontrado</div>';
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
            <div class="autocomplete-item" data-codigo="${escHtml(m.codigo || '')}" data-descricao="${escHtml(m.descricao || '')}">
                <span class="ac-nome">${escHtml(m.descricao || '')}</span>
                <span class="ac-fantasia">${escHtml(m.codigo || '')}</span>
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
        ['prod-ncm-descricao', 'prod-ncm-descricao-completa', 'prod-ncm-utrib', 'prod-hscode', 'prod-naladi-nesh'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    // HS Code e NALADI/NESH usam só os 4 primeiros dígitos do NCM (nível de
    // Posição), formatado em par "XX.XX". Alguns registros de apoio_ncm são
    // níveis mais amplos (capítulo com 2 dígitos) — nesses casos deriva com
    // o que tiver, sem exigir 4.
    function _derivarHsCodeDoNcm(ncmValor) {
        const digitos = String(ncmValor || '').replace(/\D/g, '').slice(0, 4);
        if (!digitos) return '';
        return digitos.match(/.{1,2}/g).join('.');
    }

    function _derivarNaladiNeshDoNcm(ncmValor) {
        const digitos = String(ncmValor || '').replace(/\D/g, '').slice(0, 4);
        if (!digitos) return '';
        return digitos.match(/.{1,2}/g).join('.');
    }

    function preencherCamposNcm(item) {
        const desc    = document.getElementById('prod-ncm-descricao');
        const full    = document.getElementById('prod-ncm-descricao-completa');
        const utrib   = document.getElementById('prod-ncm-utrib');
        const hscode  = document.getElementById('prod-hscode');
        const naladi  = document.getElementById('prod-naladi-nesh');
        if (desc)   desc.value   = item.dataset.descricao || '';
        if (full)   full.value   = item.dataset.descricaoCompleta || '';
        if (utrib)  utrib.value  = item.dataset.utrib || '';
        if (hscode) hscode.value = _derivarHsCodeDoNcm(item.dataset.ncm);
        if (naladi) naladi.value = _derivarNaladiNeshDoNcm(item.dataset.ncm);
    }

    async function mostrar() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 1) { lista.classList.remove('aberta'); limparCamposNcm(); return; }
        try {
            const { data } = await supabaseClient
                .from('apoio_ncm')
                .select('ncm, descricao, descricao_concat, utrib_abrev, utrib_descricao')
                .ilike('ncm', `${q}%`)
                .limit(120);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            // apoio_ncm guarda TODOS os níveis da hierarquia fiscal (Capítulo=2,
            // Posição=4, Subposição-1=5, Subposição-2/HS=6, Item=7, Subitem=8
            // dígitos) — só é uma classificação de verdade, declarável, no nível
            // completo de 8 dígitos; os demais existem só de apoio pra navegação
            // (ver link "Consultar tabela NCM"). Sem filtrar, dava pra escolher
            // um nível incompleto e HS Code/NALADI-NESH saíam truncados (ex: um
            // Produto de 5 dígitos gerava HS Code de só 5, não 6).
            const completos = data.filter(n => String(n.ncm || '').replace(/\D/g, '').length === 8).slice(0, 40);
            if (!completos.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = completos.map(n => {
                const utrib = n.utrib_abrev ? `${n.utrib_abrev}${n.utrib_descricao ? ' — ' + n.utrib_descricao : ''}` : '';
                return `<div class="autocomplete-item"
                    data-ncm="${escHtml(n.ncm)}"
                    data-descricao="${escHtml(n.descricao || '')}"
                    data-descricao-completa="${escHtml(n.descricao_concat || '')}"
                    data-utrib="${escHtml(utrib)}">
                    <span class="ac-nome">${escHtml(n.ncm)}</span>
                    <span class="ac-fantasia">${escHtml(n.descricao_concat || n.descricao || '')}</span>
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
// HS Code e NALADI/NESH (ambos os 4 primeiros dígitos do NCM) são
// derivados do NCM — mudar o "radical" à mão pode gerar divergência no
// SISCOMEX. Usuário não-admin não pode editar esses campos (fica readonly);
// admin pode, mas passa por uma confirmação.

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
            <label for="idioma_idioma_${id}">Idioma</label>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <select id="idioma_idioma_${id}" name="idioma_idioma_${id}" onchange="prodToggleIdiomaOutro(this)">
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
            <label for="nome_idioma_${id}">${labelNome} — Idioma ${num + 1}</label>
            <input id="nome_idioma_${id}" type="text" name="nome_idioma_${id}" placeholder="Nome em outro idioma">
        </div>
        <div class="form-group" style="margin-bottom:0; position:relative;">
            <label for="descricao_idioma_${id}">${labelDesc} — Idioma ${num + 1}</label>
            <textarea id="descricao_idioma_${id}" name="descricao_idioma_${id}" placeholder="Descrição em outro idioma..." maxlength="500" rows="1"
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
// PRODUTO — PREÇOS EM OUTRAS MOEDAS (Moeda + Venda + Compra, limitado a 3
// linhas extras — o Preço de Venda/Moeda principal lá em cima já conta
// como a 1ª moeda, então 1 principal + 3 extras = 4 moedas no total,
// batendo com as 4 colunas de moeda da planilha de atualização em lote
// (Moeda/Preço + Moeda 2/3/4); ver _prodColetarPrecos acima e
// project_produto_precos_multiplos na memória)
// ========================================

let _prodPrecoExtraCount = 0;

async function prodAdicionarPrecoExtra() {
    if (_prodPrecoExtraCount >= 3) return;
    const container = document.getElementById('prod-precos-extra-container');
    if (!container) return;
    _prodPrecoExtraCount++;
    const id = Date.now() + Math.floor(Math.random() * 1000);

    const moedas  = await _carregarMoedas();
    const opcoes  = moedas.map(m => `<option value="${escHtml(m.sigla)}">${escHtml(m.sigla)} — ${escHtml(m.descricao)}</option>`).join('');

    const row = document.createElement('div');
    row.id = `prod-preco-row-${id}`;
    row.style.cssText = 'display:grid; grid-template-columns: 1fr 1fr 1fr auto; gap:16px; align-items:end;';
    row.innerHTML = `
        <div class="form-group" style="margin-bottom:0;">
            <label for="preco_moeda_${id}">Moeda</label>
            <select id="preco_moeda_${id}" name="preco_moeda_${id}">
                <option value="">Selecione...</option>
                ${opcoes}
            </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label for="preco_valor_${id}">Preço de Venda</label>
            <input id="preco_valor_${id}" type="text" inputmode="decimal" name="preco_valor_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraMonetaria(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label for="preco_custo_${id}">Preço de Compra</label>
            <input id="preco_custo_${id}" type="text" inputmode="decimal" name="preco_custo_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraMonetaria(this)">
        </div>
        <button type="button" onclick="prodRemoverPrecoExtra('${id}')"
            style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:15px;padding:2px 6px;margin-bottom:10px;"
            title="Remover preço">
            <i class="fa-solid fa-xmark"></i>
        </button>`;
    container.appendChild(row);
    _prodPrecoExtraAtualizarBotao();
}

function prodRemoverPrecoExtra(id) {
    const row = document.getElementById(`prod-preco-row-${id}`);
    if (row) { row.remove(); _prodPrecoExtraCount--; }
    _prodPrecoExtraAtualizarBotao();
}

function _prodPrecoExtraAtualizarBotao() {
    const btn = document.getElementById('btn-add-preco-prod');
    if (btn) btn.style.display = _prodPrecoExtraCount >= 3 ? 'none' : '';
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
            <label for="caixa_volume_${id}">Volume ${num > 1 ? num : ''}</label>
            <input id="caixa_volume_${id}" type="text" inputmode="decimal" name="caixa_volume_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label for="caixa_comprimento_${id}">Comprimento ${num > 1 ? num : ''} (cm)</label>
            <input id="caixa_comprimento_${id}" type="text" inputmode="decimal" name="caixa_comprimento_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label for="caixa_largura_${id}">Largura ${num > 1 ? num : ''} (cm)</label>
            <input id="caixa_largura_${id}" type="text" inputmode="decimal" name="caixa_largura_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
        </div>
        <div class="form-group" style="margin-bottom:0;">
            <label for="caixa_altura_${id}">Altura ${num > 1 ? num : ''} (cm)</label>
            <input id="caixa_altura_${id}" type="text" inputmode="decimal" name="caixa_altura_${id}" placeholder="0,00" data-no-caps oninput="prodMascaraDecimal(this)">
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

// Embalagens têm tabela própria (produto_embalagens, ver
// database-produto-embalagens.sql) com produto_id como chave — sem isso não
// dá pra filtrar/agrupar por relatório. Só a fronteira de persistência muda;
// a lista em memória (_prodEmbalagens) continua no formato interno de sempre
// (chave = id do campo do formulário) pra não precisar reescrever toda a UI
// de criar/editar/tabela — essas 2 funções fazem a conversão.

function _prodEmbalagemParaLinhaDb(e) {
    const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    return {
        nome:                         e['prod-embalagem-nome'] || null,
        tipo_embalagem:               e['prod-embalagem'] || null,
        tipo_embalagem_codigo:        e['prod-embalagem-codigo'] || null,
        tipo_acondicionamento:        e['prod-acondicionamento'] || null,
        tipo_acondicionamento_numero: e['prod-acondicionamento-numero'] || null,
        acondicionamento_descricao:   e['prod-acond-descricao'] || null,
        modal_transporte:             e['prod-embalagem-transporte'] || null,
        comprimento:                  num(e['prod-comprimento']),
        largura:                      num(e['prod-largura']),
        altura:                       num(e['prod-altura']),
        peso_bruto:                   num(e['prod-peso-bruto']),
        peso_liquido:                 num(e['prod-peso-liquido']),
        empilhamento_maximo:          e['prod-empilhamento'] ? parseInt(e['prod-empilhamento'], 10) : null,
        observacoes:                  e['prod-obs-logistica'] || null,
        medidas_caixa:                e.medidas_caixa || [],
    };
}

// "id" aqui é só uma chave local pra editar/excluir dentro da lista da tela
// (mesma convenção que Date.now() já usava) — não é o UUID real da linha no
// banco, que é regerado a cada salvamento (o CRUD é "substitui tudo").
function _prodEmbalagemDeLinhaDb(row, indiceLocal) {
    const fmt = v => (v === null || v === undefined) ? '' : String(v).replace('.', ',');
    return {
        id: Date.now() + indiceLocal,
        'prod-embalagem-nome':          row.nome || '',
        'prod-embalagem':               row.tipo_embalagem || '',
        'prod-embalagem-codigo':        row.tipo_embalagem_codigo || '',
        'prod-acondicionamento':        row.tipo_acondicionamento || '',
        'prod-acondicionamento-numero': row.tipo_acondicionamento_numero || '',
        'prod-acond-descricao':         row.acondicionamento_descricao || '',
        'prod-embalagem-transporte':    row.modal_transporte || '',
        'prod-comprimento':             fmt(row.comprimento),
        'prod-largura':                 fmt(row.largura),
        'prod-altura':                  fmt(row.altura),
        'prod-peso-bruto':              fmt(row.peso_bruto),
        'prod-peso-liquido':            fmt(row.peso_liquido),
        'prod-empilhamento':            row.empilhamento_maximo ?? '',
        'prod-obs-logistica':           row.observacoes || '',
        medidas_caixa:                  row.medidas_caixa || [],
    };
}

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
    const info = document.getElementById('prod-cubagem-aereo-info');
    if (info) info.style.display = selectEl?.value === 'aereo' ? '' : 'none';
}

// Cubagem real (m³) da embalagem — Comprimento/Largura/Altura são digitados
// em cm, então divide por 100³ (1.000.000) pra converter pra m³. Não é a
// mesma coisa que a "cubagem aérea" (C x L x A / 6000, que dá peso cubado em
// kg pra frete aéreo, não volume) — por isso o aviso daquela fórmula fica
// como um balão de informação à parte, só quando o modal é Aéreo.
function prodCalcularCubagem() {
    const campo = document.getElementById('prod-cubagem');
    if (!campo) return;
    const num = id => parseFloat((document.getElementById(id)?.value || '').replace(',', '.')) || 0;
    const c = num('prod-comprimento'), l = num('prod-largura'), a = num('prod-altura');
    if (!c || !l || !a) { campo.value = ''; return; }
    const m3 = (c * l * a) / 1000000;
    campo.value = m3.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function prodLimparFormEmbalagem() {
    _PROD_EMBALAGEM_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });

    prodAtualizarCubagemAviso(document.getElementById('prod-embalagem-transporte'));
    prodCalcularCubagem();

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
    prodCalcularCubagem();

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
        mostrarNotificacao('Informe o Nome da Embalagem.', 'warning');
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

async function prodExcluirEmbalagemForm() {
    if (_prodEmbalagemEditandoId) {
        if (!(await confirmarAcao('Deseja realmente excluir esta embalagem?', { titulo: 'Excluir embalagem', confirmar: 'Excluir', perigo: true }))) return;
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

async function prodExcluirEmbalagemTabela(id) {
    if (!(await confirmarAcao('Deseja realmente excluir esta embalagem?', { titulo: 'Excluir embalagem', confirmar: 'Excluir', perigo: true }))) return;
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
// PRODUTO — EMBALAGENS UNITÁRIAS (LOGÍSTICA)
// ========================================
// Mesma tabela produto_embalagens da Embalagem/Dimensões da Caixa acima —
// só que filtrada por tipo='unitaria' (ver
// database-produto-embalagens-tipo-unitaria.sql). Descreve o produto em si
// (o que veio dos campos de Comprimento/Largura/Altura/Peso que existiam
// direto em Dados Gerais), não a caixa de transporte — por isso não tem
// Modal de Transporte/Acondicionamento/Cubagem aérea, mas ganha Volume
// (mesma fórmula da Cubagem) e Quantidade.

let _prodEmbalagensUnitarias = [];
let _prodEmbalagemUnitariaEditandoId = null;

const _PROD_EMBALAGEM_UNITARIA_CAMPOS = [
    'prod-embunit-nome',
    'prod-embunit-comprimento', 'prod-embunit-largura', 'prod-embunit-altura',
    'prod-embunit-peso-bruto', 'prod-embunit-peso-liquido', 'prod-embunit-quantidade',
];

function _prodEmbalagemUnitariaParaLinhaDb(e) {
    const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    return {
        nome:         e['prod-embunit-nome'] || null,
        comprimento:  num(e['prod-embunit-comprimento']),
        largura:      num(e['prod-embunit-largura']),
        altura:       num(e['prod-embunit-altura']),
        peso_bruto:   num(e['prod-embunit-peso-bruto']),
        peso_liquido: num(e['prod-embunit-peso-liquido']),
        quantidade:   e['prod-embunit-quantidade'] ? parseInt(e['prod-embunit-quantidade'], 10) : null,
    };
}

// "id" aqui é só uma chave local pra editar/excluir dentro da lista da tela
// (mesma convenção da Embalagem/Dimensões da Caixa) — não é o UUID real da
// linha no banco, que é regerado a cada salvamento (CRUD substitui-tudo).
function _prodEmbalagemUnitariaDeLinhaDb(row, indiceLocal) {
    const fmt = v => (v === null || v === undefined) ? '' : String(v).replace('.', ',');
    return {
        id: Date.now() + indiceLocal,
        'prod-embunit-nome':         row.nome || '',
        'prod-embunit-comprimento':  fmt(row.comprimento),
        'prod-embunit-largura':      fmt(row.largura),
        'prod-embunit-altura':       fmt(row.altura),
        'prod-embunit-peso-bruto':   fmt(row.peso_bruto),
        'prod-embunit-peso-liquido': fmt(row.peso_liquido),
        'prod-embunit-quantidade':   row.quantidade ?? '',
    };
}

function _prodEmbalagemUnitariaBotoes(modo) {
    // modo: 'novo' | 'edicao' | 'visualizacao'
    document.getElementById('btn-embunit-salvar').style.display  = modo === 'novo'         ? '' : 'none';
    document.getElementById('btn-embunit-editar').style.display  = modo === 'edicao'       ? '' : 'none';
    document.getElementById('btn-embunit-excluir').style.display = modo !== 'visualizacao' ? '' : 'none';
    document.getElementById('btn-embunit-fechar').style.display  = modo === 'visualizacao' ? '' : 'none';
}

function _prodEmbalagemUnitariaSetCamposDisabled(desabilitado) {
    document.querySelectorAll('#prod-embalagem-unitaria-form input, #prod-embalagem-unitaria-form select, #prod-embalagem-unitaria-form textarea')
        .forEach(el => { el.disabled = desabilitado; });
}

// Volume (m³) = C x L x A / 1.000.000, mesma fórmula da Cubagem da outra
// embalagem — chamado de "Volume" aqui porque essa seção não tem Modal de
// Transporte (não existe o conceito de cubagem aérea pra ela).
function prodCalcularVolumeUnitario() {
    const campo = document.getElementById('prod-embunit-volume');
    if (!campo) return;
    const num = id => parseFloat((document.getElementById(id)?.value || '').replace(',', '.')) || 0;
    const c = num('prod-embunit-comprimento'), l = num('prod-embunit-largura'), a = num('prod-embunit-altura');
    if (!c || !l || !a) { campo.value = ''; return; }
    const m3 = (c * l * a) / 1000000;
    campo.value = m3.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function prodLimparFormEmbalagemUnitaria() {
    _PROD_EMBALAGEM_UNITARIA_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    prodCalcularVolumeUnitario();
}

function prodAbrirFormEmbalagemUnitaria() {
    _prodEmbalagemUnitariaEditandoId = null;
    prodLimparFormEmbalagemUnitaria();
    _prodEmbalagemUnitariaSetCamposDisabled(false);
    _prodEmbalagemUnitariaBotoes('novo');

    const form = document.getElementById('prod-embalagem-unitaria-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _prodEmbalagemUnitariaColetarDados() {
    const dados = { id: _prodEmbalagemUnitariaEditandoId || Date.now() };
    _PROD_EMBALAGEM_UNITARIA_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        dados[id] = el ? el.value.trim() : '';
    });
    return dados;
}

function _prodEmbalagemUnitariaPreencherForm(dados) {
    _PROD_EMBALAGEM_UNITARIA_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = dados[id] || '';
    });
    prodCalcularVolumeUnitario();
}

function _prodEmbalagemUnitariaFecharForm() {
    _prodEmbalagemUnitariaEditandoId = null;
    document.getElementById('prod-embalagem-unitaria-form').style.display = 'none';
    prodLimparFormEmbalagemUnitaria();
    _prodEmbalagemUnitariaSetCamposDisabled(false);
}

// Sem modal de confirmação de dimensões aqui (aquilo era específico do
// Modal de Transporte da outra embalagem) — salva direto.
function prodSalvarEmbalagemUnitaria() {
    const nomeEl = document.getElementById('prod-embunit-nome');
    if (!nomeEl.value.trim()) {
        mostrarNotificacao('Informe o Nome da Embalagem Unitária.', 'warning');
        nomeEl.focus();
        return;
    }

    const dados = _prodEmbalagemUnitariaColetarDados();
    if (_prodEmbalagemUnitariaEditandoId) {
        const idx = _prodEmbalagensUnitarias.findIndex(e => e.id === _prodEmbalagemUnitariaEditandoId);
        if (idx > -1) _prodEmbalagensUnitarias[idx] = dados;
    } else {
        _prodEmbalagensUnitarias.push(dados);
    }

    _prodEmbalagemUnitariaFecharForm();
    _prodRenderTabelaEmbalagensUnitarias();
}

async function prodExcluirEmbalagemUnitariaForm() {
    if (_prodEmbalagemUnitariaEditandoId) {
        if (!(await confirmarAcao('Deseja realmente excluir esta embalagem unitária?', { titulo: 'Excluir embalagem unitária', confirmar: 'Excluir', perigo: true }))) return;
        _prodEmbalagensUnitarias = _prodEmbalagensUnitarias.filter(e => e.id !== _prodEmbalagemUnitariaEditandoId);
        _prodRenderTabelaEmbalagensUnitarias();
    }
    _prodEmbalagemUnitariaFecharForm();
}

function prodFecharVisualizacaoEmbalagemUnitaria() {
    _prodEmbalagemUnitariaFecharForm();
}

function prodEditarEmbalagemUnitaria(id) {
    const dados = _prodEmbalagensUnitarias.find(e => e.id === id);
    if (!dados) return;
    _prodEmbalagemUnitariaEditandoId = id;
    prodLimparFormEmbalagemUnitaria();
    _prodEmbalagemUnitariaPreencherForm(dados);
    _prodEmbalagemUnitariaSetCamposDisabled(false);
    _prodEmbalagemUnitariaBotoes('edicao');

    const form = document.getElementById('prod-embalagem-unitaria-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prodVerEmbalagemUnitaria(id) {
    const dados = _prodEmbalagensUnitarias.find(e => e.id === id);
    if (!dados) return;
    _prodEmbalagemUnitariaEditandoId = id;
    prodLimparFormEmbalagemUnitaria();
    _prodEmbalagemUnitariaPreencherForm(dados);
    _prodEmbalagemUnitariaSetCamposDisabled(true);
    _prodEmbalagemUnitariaBotoes('visualizacao');

    const form = document.getElementById('prod-embalagem-unitaria-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function prodExcluirEmbalagemUnitariaTabela(id) {
    if (!(await confirmarAcao('Deseja realmente excluir esta embalagem unitária?', { titulo: 'Excluir embalagem unitária', confirmar: 'Excluir', perigo: true }))) return;
    _prodEmbalagensUnitarias = _prodEmbalagensUnitarias.filter(e => e.id !== id);
    if (_prodEmbalagemUnitariaEditandoId === id) _prodEmbalagemUnitariaFecharForm();
    _prodRenderTabelaEmbalagensUnitarias();
}

function _prodEmbalagemUnitariaDimensoesTexto(dados) {
    const c = dados['prod-embunit-comprimento'], l = dados['prod-embunit-largura'], a = dados['prod-embunit-altura'];
    if (!c && !l && !a) return '—';
    return `${c || '—'} × ${l || '—'} × ${a || '—'} cm`;
}

function _prodEmbalagemUnitariaVolumeTexto(dados) {
    const c = parseFloat((dados['prod-embunit-comprimento'] || '').replace(',', '.'));
    const l = parseFloat((dados['prod-embunit-largura'] || '').replace(',', '.'));
    const a = parseFloat((dados['prod-embunit-altura'] || '').replace(',', '.'));
    if (!c || !l || !a) return '—';
    return ((c * l * a) / 1000000).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

function _prodRenderTabelaEmbalagensUnitarias() {
    const wrapper = document.getElementById('prod-embalagens-unitarias-tabela-wrapper');
    const corpo   = document.getElementById('prod-embalagens-unitarias-tabela-corpo');
    if (!wrapper || !corpo) return;

    if (!_prodEmbalagensUnitarias.length) {
        wrapper.style.display = 'none';
        corpo.innerHTML = '';
        return;
    }

    wrapper.style.display = '';
    corpo.innerHTML = _prodEmbalagensUnitarias.map(dados => `
        <tr>
            <td>${_prodEscapeHtml(dados['prod-embunit-nome'] || '—')}</td>
            <td>${_prodEscapeHtml(_prodEmbalagemUnitariaDimensoesTexto(dados))}</td>
            <td>${_prodEscapeHtml(_prodEmbalagemUnitariaVolumeTexto(dados))}</td>
            <td>${_prodEscapeHtml(dados['prod-embunit-quantidade'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-embunit-peso-liquido'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-embunit-peso-bruto'] || '—')}</td>
            <td>
                <button type="button" class="btn-acao btn-visualizar" title="Ver" onclick="prodVerEmbalagemUnitaria(${dados.id})"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="btn-acao btn-editar" title="Editar" onclick="prodEditarEmbalagemUnitaria(${dados.id})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-acao btn-excluir" title="Excluir" onclick="prodExcluirEmbalagemUnitariaTabela(${dados.id})"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>`).join('');
}

// ========================================
// PRODUTO — COMPOSIÇÃO (ingredientes/matérias-primas, produto_composicao)
// ========================================
// Lista própria (compliance regulatório de exportação — INS/E-number, CAS,
// país de origem do ingrediente). Mesmo padrão "substitui tudo" das
// Embalagens: CRUD local em memória, persistido só ao salvar o produto.

let _prodComposicoes = [];
let _prodComposicaoEditandoId = null;

const _PROD_COMPOSICAO_CAMPOS = [
    'prod-comp-ingrediente', 'prod-comp-nome-tecnico', 'prod-comp-cas', 'prod-comp-ins',
    'prod-comp-concentracao', 'prod-comp-funcao', 'prod-comp-pais-origem', 'prod-comp-observacao',
];

function _prodComposicaoParaLinhaDb(e) {
    const num = v => { const n = parseFloat(String(v || '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
    return {
        ingrediente:      e['prod-comp-ingrediente'] || null,
        nome_tecnico:     e['prod-comp-nome-tecnico'] || null,
        cas:              e['prod-comp-cas'] || null,
        ins_enumber:      e['prod-comp-ins'] || null,
        concentracao_pct: num(e['prod-comp-concentracao']),
        funcao:           e['prod-comp-funcao'] || null,
        pais_origem:      e['prod-comp-pais-origem'] || null,
        observacao:       e['prod-comp-observacao'] || null,
    };
}

// "id" aqui é só uma chave local pra editar/excluir dentro da lista da tela
// (mesma convenção das Embalagens) — não é o UUID real da linha no banco,
// que é regerado a cada salvamento (CRUD substitui-tudo).
function _prodComposicaoDeLinhaDb(row, indiceLocal) {
    const fmt = v => (v === null || v === undefined) ? '' : String(v).replace('.', ',');
    return {
        id: Date.now() + indiceLocal,
        'prod-comp-ingrediente':  row.ingrediente || '',
        'prod-comp-nome-tecnico': row.nome_tecnico || '',
        'prod-comp-cas':          row.cas || '',
        'prod-comp-ins':          row.ins_enumber || '',
        'prod-comp-concentracao': fmt(row.concentracao_pct),
        'prod-comp-funcao':       row.funcao || '',
        'prod-comp-pais-origem':  row.pais_origem || '',
        'prod-comp-observacao':  row.observacao || '',
    };
}

function _prodComposicaoBotoes(modo) {
    // modo: 'novo' | 'edicao' | 'visualizacao'
    document.getElementById('btn-composicao-salvar').style.display  = modo === 'novo'         ? '' : 'none';
    document.getElementById('btn-composicao-editar').style.display  = modo === 'edicao'       ? '' : 'none';
    document.getElementById('btn-composicao-excluir').style.display = modo !== 'visualizacao' ? '' : 'none';
    document.getElementById('btn-composicao-fechar').style.display  = modo === 'visualizacao' ? '' : 'none';
}

function _prodComposicaoSetCamposDisabled(desabilitado) {
    document.querySelectorAll('#prod-composicao-form input, #prod-composicao-form select, #prod-composicao-form textarea')
        .forEach(el => { el.disabled = desabilitado; });
}

function prodLimparFormComposicao() {
    _PROD_COMPOSICAO_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
}

function prodAbrirFormComposicao() {
    _prodComposicaoEditandoId = null;
    prodLimparFormComposicao();
    _prodComposicaoSetCamposDisabled(false);
    _prodComposicaoBotoes('novo');

    const form = document.getElementById('prod-composicao-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function _prodComposicaoColetarDados() {
    const dados = { id: _prodComposicaoEditandoId || Date.now() };
    _PROD_COMPOSICAO_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        dados[id] = el ? el.value.trim() : '';
    });
    return dados;
}

function _prodComposicaoPreencherForm(dados) {
    _PROD_COMPOSICAO_CAMPOS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = dados[id] || '';
    });
}

function _prodComposicaoFecharForm() {
    _prodComposicaoEditandoId = null;
    document.getElementById('prod-composicao-form').style.display = 'none';
    prodLimparFormComposicao();
    _prodComposicaoSetCamposDisabled(false);
}

function prodSalvarComposicao() {
    const ingredienteEl = document.getElementById('prod-comp-ingrediente');
    if (!ingredienteEl.value.trim()) {
        mostrarNotificacao('Informe o Ingrediente / Matéria-Prima.', 'warning');
        ingredienteEl.focus();
        return;
    }

    const dados = _prodComposicaoColetarDados();
    if (_prodComposicaoEditandoId) {
        const idx = _prodComposicoes.findIndex(e => e.id === _prodComposicaoEditandoId);
        if (idx > -1) _prodComposicoes[idx] = dados;
    } else {
        _prodComposicoes.push(dados);
    }

    _prodComposicaoFecharForm();
    _prodRenderTabelaComposicao();
}

async function prodExcluirComposicaoForm() {
    if (_prodComposicaoEditandoId) {
        if (!(await confirmarAcao('Deseja realmente excluir este ingrediente?', { titulo: 'Excluir ingrediente', confirmar: 'Excluir', perigo: true }))) return;
        _prodComposicoes = _prodComposicoes.filter(e => e.id !== _prodComposicaoEditandoId);
        _prodRenderTabelaComposicao();
    }
    _prodComposicaoFecharForm();
}

function prodFecharVisualizacaoComposicao() {
    _prodComposicaoFecharForm();
}

function prodEditarComposicao(id) {
    const dados = _prodComposicoes.find(e => e.id === id);
    if (!dados) return;
    _prodComposicaoEditandoId = id;
    prodLimparFormComposicao();
    _prodComposicaoPreencherForm(dados);
    _prodComposicaoSetCamposDisabled(false);
    _prodComposicaoBotoes('edicao');

    const form = document.getElementById('prod-composicao-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function prodVerComposicao(id) {
    const dados = _prodComposicoes.find(e => e.id === id);
    if (!dados) return;
    _prodComposicaoEditandoId = id;
    prodLimparFormComposicao();
    _prodComposicaoPreencherForm(dados);
    _prodComposicaoSetCamposDisabled(true);
    _prodComposicaoBotoes('visualizacao');

    const form = document.getElementById('prod-composicao-form');
    form.style.display = '';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function prodExcluirComposicaoTabela(id) {
    if (!(await confirmarAcao('Deseja realmente excluir este ingrediente?', { titulo: 'Excluir ingrediente', confirmar: 'Excluir', perigo: true }))) return;
    _prodComposicoes = _prodComposicoes.filter(e => e.id !== id);
    if (_prodComposicaoEditandoId === id) _prodComposicaoFecharForm();
    _prodRenderTabelaComposicao();
}

function _prodRenderTabelaComposicao() {
    const wrapper = document.getElementById('prod-composicao-tabela-wrapper');
    const corpo   = document.getElementById('prod-composicao-tabela-corpo');
    if (!wrapper || !corpo) return;

    if (!_prodComposicoes.length) {
        wrapper.style.display = 'none';
        corpo.innerHTML = '';
        return;
    }

    wrapper.style.display = '';
    corpo.innerHTML = _prodComposicoes.map(dados => `
        <tr>
            <td>${_prodEscapeHtml(dados['prod-comp-ingrediente'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-nome-tecnico'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-cas'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-ins'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-concentracao'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-funcao'] || '—')}</td>
            <td>${_prodEscapeHtml(dados['prod-comp-pais-origem'] || '—')}</td>
            <td>
                <button type="button" class="btn-acao btn-visualizar" title="Ver" onclick="prodVerComposicao(${dados.id})"><i class="fa-solid fa-eye"></i></button>
                <button type="button" class="btn-acao btn-editar" title="Editar" onclick="prodEditarComposicao(${dados.id})"><i class="fa-solid fa-pen"></i></button>
                <button type="button" class="btn-acao btn-excluir" title="Excluir" onclick="prodExcluirComposicaoTabela(${dados.id})"><i class="fa-solid fa-trash"></i></button>
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
            <div class="autocomplete-item" data-valor="${escHtml(u.unidade)}">
                <span class="ac-nome">${escHtml(u.unidade)}</span>
                <span class="ac-fantasia">${escHtml(u.descricao || '')}</span>
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
            // Tabela de apoio tem 62 tipos cadastrados — limite de 30 cortava
            // a lista pela metade (tudo de "ESTOJO" em diante, em ordem
            // alfabética, nunca aparecia sem digitar um filtro específico).
            const { data } = await query.limit(100);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(e => `
                <div class="autocomplete-item" data-codigo="${escHtml(e.codigo || '')}" data-descricao="${escHtml(e.descricao || '')}">
                    <span class="ac-nome">${escHtml(e.descricao || '')}</span>
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
                <div class="autocomplete-item" data-numero="${escHtml(a.numero || '')}" data-descricao="${escHtml(a.descricao || '')}">
                    <span class="ac-nome">${escHtml(a.descricao || '')}</span>
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
