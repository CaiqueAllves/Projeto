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

let _empEditandoId = null;

async function salvarEmpresa(event) {
    event.preventDefault();

    // Detectar modelo
    const modelo = document.querySelector('input[name="emp_modelo"]:checked')?.value || 'empresa';

    // Limpar bordas vermelhas anteriores
    document.querySelectorAll('#form-empresa .campo-invalido').forEach(el => el.classList.remove('campo-invalido'));

    const _camposBase = [
        { id: 'emp-documento', label: 'Número de Identificação' },
        { id: 'emp-nome',      label: 'Razão Social' },
        { id: 'emp-estado',    label: 'Estado' },
        { id: 'emp-cidade',    label: 'Cidade' },
        { id: 'emp-bairro',    label: 'Bairro' },
        { id: 'emp-endereco',  label: 'Endereço' },
        { id: 'emp-numero',    label: 'Número' },
    ];

    const _obrigatoriosPorModelo = {
        empresa: [
            ..._camposBase,
            { id: 'emp-ie', label: 'Inscrição Estadual' },
        ],
        transportadora: [
            ..._camposBase,
            { id: 'emp-ie',         label: 'Inscrição Estadual' },
            { id: 'emp-frota-tipo', label: 'Tipo de Frota' },
        ],
        company: [
            { id: 'emp-documento', label: 'Número de Identificação' },
            { id: 'emp-nome',      label: 'Razão Social' },
            { id: 'emp-pais',      label: 'País' },
            { id: 'emp-estado',    label: 'Estado / Província' },
            { id: 'emp-cidade',    label: 'Cidade' },
            { id: 'emp-bairro',    label: 'Bairro / Distrito' },
            { id: 'emp-endereco',  label: 'Endereço' },
            { id: 'emp-numero',    label: 'Número' },
        ],
        outros: [
            ..._camposBase,
            { id: 'emp-pais', label: 'País' },
        ],
    };

    const obrigatorios = _obrigatoriosPorModelo[modelo] || _obrigatoriosPorModelo.empresa;

    const faltando = [];
    for (const { id, label } of obrigatorios) {
        const el = document.getElementById(id);
        if (!el || !el.value.trim()) {
            if (el) el.classList.add('campo-invalido');
            faltando.push(label);
        }
    }
    if (faltando.length > 0) {
        mostrarNotificacao('Campos obrigatórios não preenchidos: ' + faltando.join(' | '), 'erro');
        return;
    }

    const tipos = [];
    ['fabricante','cliente','fornecedor','transportadora','remetente'].forEach(t => {
        if (document.querySelector(`[name="tipo_${t}"]`)?.checked) tipos.push(t);
    });

    const dados = {
        tipos,
        tipo_cadastro:       document.getElementById('emp-tipo-cadastro')?.value   || '',
        documento:           document.getElementById('emp-documento')?.value        || '',
        razao_social:        document.getElementById('emp-nome')?.value             || '',
        nome_fantasia:       document.getElementById('emp-fantasia')?.value         || '',
        inscricao_estadual:  document.getElementById('emp-ie')?.value              || '',
        suframa:             document.getElementById('emp-suframa')?.value          || '',
        pais:                document.getElementById('emp-pais')?.value             || '',
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

            if (tituloEl)   tituloEl.textContent  = editandoId ? 'Proforma atualizada!' : 'Proforma salva!';
            if (msgEl)      msgEl.textContent      = 'O que deseja fazer agora?';
            if (codigoEl)   codigoEl.textContent   = codigo;
            if (codigoWrap) codigoWrap.style.display = '';
            if (pdfWrap)    pdfWrap.style.display    = '';

            posModal.style.display = 'flex';
        } else {
            mostrarNotificacao('Erro ao salvar proposta: ' + (res.mensagem || 'Tente novamente.'), 'erro');
        }
        return;
    }

    // Processo (manter comportamento anterior)
    const posModal = document.getElementById('modal-pos-salvo');
    posModal.dataset.origem = origem;

    const tituloEl   = document.getElementById('pos-salvo-titulo');
    const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
    const pdfWrap    = document.getElementById('pos-salvo-pdf-wrap');

    if (tituloEl)   tituloEl.textContent = 'Processo salvo!';
    if (codigoWrap) codigoWrap.style.display = 'none';
    if (pdfWrap)    pdfWrap.style.display    = 'none';

    posModal.style.display = 'flex';
}

// Alias mantido para compatibilidade com HTML existente
function confirmarSalvarProcesso() { confirmarSalvar(); }

function criarNovo() {
    const origem = document.getElementById('modal-pos-salvo').dataset.origem || 'processo';
    document.getElementById('modal-pos-salvo').style.display = 'none';
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

    // Limpar marcações anteriores
    document.querySelectorAll('#form-proposta .campo-invalido').forEach(el => el.classList.remove('campo-invalido'));

    const g = id => (document.getElementById(id)?.value || '').trim();
    const erros = [];

    const obrigatorios = [
        { id: 'prop-tipo',             label: 'Tipo da Proforma' },
        { id: 'prop-modal',            label: 'Modal' },
        { id: 'prop-origem-pais',      label: 'País de Origem' },
        { id: 'prop-destino-pais',     label: 'País de Destino' },
        { id: 'prop-validade-dias',    label: 'Validade da Proposta' },
        { id: 'prop-forma-pagamento',  label: 'Forma de Pagamento' },
        { id: 'prop-prazo-pagamento',  label: 'Prazo de Pagamento' },
    ];

    for (const { id, label } of obrigatorios) {
        if (!g(id)) {
            document.getElementById(id)?.classList.add('campo-invalido');
            erros.push(label);
        }
    }

    // Destinatário: busca ou manual
    if (!g('prop-emp-dest-busca') && !g('prop-emp-dest-razao')) {
        document.getElementById('prop-emp-dest-busca')?.classList.add('campo-invalido');
        erros.push('Destinatário');
    }

    // Pelo menos 1 item
    if (!_propItens || _propItens.length === 0) {
        erros.push('Adicione pelo menos um item à proforma');
    }

    if (erros.length > 0) {
        mostrarNotificacao('Campos obrigatórios: ' + erros.join(' | '), 'erro');
        return;
    }

    const modal = document.getElementById('modal-confirmar-salvar');
    modal.dataset.origem = 'proposta';
    const titulo = modal.querySelector('.modal-confirm-title');
    const msg    = modal.querySelector('.modal-confirm-msg');
    if (titulo) titulo.textContent = 'Salvar Proposta';
    if (msg)    msg.textContent    = 'Deseja salvar as informações desta proposta?';
    modal.style.display = 'flex';
}

// ========================================
// PDF — PROPOSTA
// ========================================

function gerarPDFProposta() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const W  = 210;
    const ML = 14;
    const MR = 196;
    let   Y  = 0;

    const TEAL       = [15,  118, 110];
    const TEAL_CLARO = [240, 253, 250];
    const CINZA      = [100, 116, 139];
    const CINZA_BG   = [248, 250, 252];
    const BORDA      = [226, 232, 240];
    const PRETO      = [15,  23,  42];

    function setFont(style, size, color) {
        doc.setFont('helvetica', style);
        doc.setFontSize(size);
        doc.setTextColor(...(color || PRETO));
    }

    function linha(x1, y, x2, cor, esp) {
        doc.setDrawColor(...(cor || BORDA));
        doc.setLineWidth(esp || 0.3);
        doc.line(x1, y, x2, y);
    }

    function rect(x, y, w, h, cor, raio) {
        doc.setFillColor(...cor);
        doc.setDrawColor(...cor);
        if (raio) doc.roundedRect(x, y, w, h, raio, raio, 'F');
        else      doc.rect(x, y, w, h, 'F');
    }

    function campo(label, valor, x, y, w) {
        setFont('bold', 7, CINZA);
        doc.text(label.toUpperCase(), x, y);
        setFont('normal', 9, PRETO);
        const txt = doc.splitTextToSize(String(valor || '—'), w);
        doc.text(txt[0], x, y + 5);
    }

    function secHeader(titulo) {
        Y += 4;
        rect(ML, Y, W - ML * 2, 7, TEAL_CLARO);
        setFont('bold', 9, TEAL);
        doc.text(titulo.toUpperCase(), ML + 3, Y + 5);
        Y += 10;
    }

    function checkPage(needed) {
        if (Y + needed > 275) { doc.addPage(); Y = 20; }
    }

    function val(id) {
        const el = document.getElementById(id);
        if (!el) return '—';
        if (el.tagName === 'SELECT') return el.options[el.selectedIndex]?.text || '—';
        return el.value?.trim() || '—';
    }

    function rawVal(id) {
        return document.getElementById(id)?.value?.trim() || '';
    }

    function fmtData(raw) {
        if (!raw) return '—';
        const d = new Date(raw + 'T00:00:00');
        return isNaN(d.getTime()) ? raw : d.toLocaleDateString('pt-BR');
    }

    // ══ CABEÇALHO ════════════════════════════
    rect(0, 0, W, 28, TEAL);

    setFont('bold', 18, [255, 255, 255]);
    doc.text('MARPEX', ML, 12);

    setFont('normal', 8, [167, 243, 208]);
    doc.text('Gestão de Comércio Exterior', ML, 18);

    setFont('bold', 12, [255, 255, 255]);
    doc.text('PROFORMA INVOICE', W - ML, 10, { align: 'right' });

    const codigo = rawVal('prop-codigo') || 'SEM-CÓDIGO';
    setFont('normal', 9, [167, 243, 208]);
    doc.text(codigo, W - ML, 17, { align: 'right' });

    const dataGeracao = new Date().toLocaleDateString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
    setFont('normal', 7, [110, 231, 183]);
    doc.text('Gerado em: ' + dataGeracao, W - ML, 24, { align: 'right' });

    Y = 34;

    // ══ BARRA TIPO / MODAL / INCOTERM / DATAS ═
    const tipoEl   = document.getElementById('prop-tipo');
    const tipoTxt  = tipoEl?.options[tipoEl?.selectedIndex]?.text || '—';
    const modalEl  = document.getElementById('prop-modal');
    const modalTxt = modalEl?.options[modalEl?.selectedIndex]?.text || '—';
    const modalVal = rawVal('prop-modal');
    const incoterm = rawVal('prop-incoterm') || '—';
    const dataEmissao  = fmtData(rawVal('prop-data-emissao'));
    const dataValidade = fmtData(rawVal('prop-data-validade'));

    rect(ML, Y, 48, 7, TEAL, 2);
    setFont('bold', 8, [255, 255, 255]);
    doc.text(tipoTxt, ML + 24, Y + 5, { align: 'center' });

    setFont('normal', 8, CINZA);   doc.text('Modal:',     ML + 52,  Y + 5);
    setFont('bold',   8, PRETO);   doc.text(modalTxt,     ML + 65,  Y + 5);
    setFont('normal', 8, CINZA);   doc.text('Incoterm:',  ML + 100, Y + 5);
    setFont('bold',   8, PRETO);   doc.text(incoterm,     ML + 118, Y + 5);
    setFont('normal', 8, CINZA);   doc.text('Emissão:',   ML + 135, Y + 5);
    setFont('bold',   8, PRETO);   doc.text(dataEmissao,  ML + 150, Y + 5);
    setFont('normal', 8, CINZA);   doc.text('Val.:',      ML + 168, Y + 5);
    setFont('bold',   8, PRETO);   doc.text(dataValidade, ML + 176, Y + 5);

    Y += 12;
    linha(ML, Y, MR, BORDA, 0.3);
    Y += 4;

    // ══ VENDEDOR | COMPRADOR ══════════════════
    const colMid = W / 2;
    const colGap = 5;
    const colW   = colMid - ML - colGap / 2;

    const emissorTipo = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value || 'usuario';
    const emissorNome = emissorTipo === 'terceiro'
        ? (rawVal('prop-cliente') || '—')
        : (window._usuarioLogado?.nome || window._usuarioLogado?.empresa || window._usuarioLogado?.email || '—');
    const docEmissor     = rawVal('prop-documento') || '—';
    const docTipoEmissor = rawVal('prop-documento-tipo') || 'Documento';
    const propositoTxt   = val('prop-proposito');

    const destRazao  = rawVal('prop-emp-dest-razao') || rawVal('prop-emp-dest-busca') || '—';
    const destDoc    = rawVal('prop-emp-dest-doc') || '—';
    const destDocTipo= val('prop-emp-dest-doc-tipo');

    rect(ML,              Y, colW,                     7, TEAL_CLARO);
    rect(colMid + colGap / 2, Y, MR - colMid - colGap / 2, 7, TEAL_CLARO);
    setFont('bold', 9, TEAL);
    doc.text('VENDEDOR / EMISSOR',          ML + 3,                Y + 5);
    doc.text('COMPRADOR / DESTINATÁRIO',    colMid + colGap / 2 + 3, Y + 5);
    Y += 11;

    campo('Nome / Razão Social', emissorNome, ML,                   Y, colW - 2);
    campo('Nome / Razão Social', destRazao,   colMid + colGap / 2, Y, colW - 2);
    Y += 10;

    campo(docTipoEmissor !== '—' ? docTipoEmissor : 'Documento', docEmissor, ML,                   Y, colW - 2);
    campo(destDocTipo    !== '—' ? destDocTipo    : 'Documento', destDoc,    colMid + colGap / 2, Y, colW - 2);
    Y += 10;

    if (propositoTxt !== '—') {
        campo('Propósito', propositoTxt, ML, Y, colW - 2);
        Y += 10;
    }

    linha(ML, Y, MR, BORDA, 0.3);
    Y += 4;

    // ══ ROTA ══════════════════════════════════
    checkPage(25);
    secHeader('Rota');

    campo('País de Origem',  rawVal('prop-origem-pais')  || '—', ML,      Y, 55);
    campo('País de Destino', rawVal('prop-destino-pais') || '—', ML + 60, Y, 55);

    if (modalVal === 'maritimo') {
        campo('Porto de Origem',  rawVal('prop-porto-origem')  || '—', ML + 120, Y, 38);
        campo('Porto de Destino', rawVal('prop-porto-destino') || '—', ML + 161, Y, 34);
    } else if (modalVal === 'aereo') {
        campo('Aeroporto de Origem',  rawVal('prop-aeroporto-origem')  || '—', ML + 120, Y, 38);
        campo('Aeroporto de Destino', rawVal('prop-aeroporto-destino') || '—', ML + 161, Y, 34);
    } else if (modalVal === 'terrestre') {
        campo('Fronteira de Saída',   rawVal('prop-fronteira-saida')   || '—', ML + 120, Y, 38);
        campo('Fronteira de Entrada', rawVal('prop-fronteira-entrada') || '—', ML + 161, Y, 34);
    }
    Y += 14;

    // ══ ITENS ══════════════════════════════════
    checkPage(30);
    secHeader('Produtos / Serviços');

    const COL = {
        num:   ML,
        prod:  ML + 8,
        qtd:   ML + 98,
        un:    ML + 108,
        preco: ML + 136,
        moeda: ML + 152,
        total: MR,
    };

    rect(ML, Y, W - ML * 2, 7, TEAL);
    setFont('bold', 8, [255, 255, 255]);
    doc.text('#',               COL.num  + 1,  Y + 5);
    doc.text('PRODUTO / DESCRIÇÃO', COL.prod,  Y + 5);
    doc.text('QTD',             COL.qtd,       Y + 5, { align: 'right' });
    doc.text('UN',              COL.un,        Y + 5);
    doc.text('PREÇO UNIT.',     COL.preco,     Y + 5, { align: 'right' });
    doc.text('MOEDA',           COL.moeda,     Y + 5);
    doc.text('TOTAL',           COL.total,     Y + 5, { align: 'right' });
    Y += 9;

    const totaisPorMoeda = {};

    (_propItens || []).forEach((item, i) => {
        checkPage(9);
        rect(ML, Y, W - ML * 2, 8, i % 2 === 0 ? CINZA_BG : [255, 255, 255]);

        const total    = (item.qtd || 0) * (item.preco || 0);
        const precoFmt = item.preco ? item.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—';
        const totalFmt = total      ? total.toLocaleString('pt-BR',      { minimumFractionDigits: 2 }) : '—';

        setFont('normal', 8, PRETO);
        doc.text(String(i + 1), COL.num + 1, Y + 5.5);

        const prodLines = doc.splitTextToSize(item.produto || '—', COL.qtd - COL.prod - 3);
        doc.text(prodLines[0], COL.prod, Y + 5.5);

        doc.text(String(item.qtd ?? 0), COL.qtd,   Y + 5.5, { align: 'right' });
        doc.text(item.unidade || '—',   COL.un,    Y + 5.5);
        doc.text(precoFmt,              COL.preco, Y + 5.5, { align: 'right' });
        doc.text(item.moeda || '—',     COL.moeda, Y + 5.5);
        setFont('bold', 8, PRETO);
        doc.text(totalFmt,              COL.total, Y + 5.5, { align: 'right' });

        if (total && item.moeda) {
            totaisPorMoeda[item.moeda] = (totaisPorMoeda[item.moeda] || 0) + total;
        }
        Y += 8;
    });

    linha(ML, Y, MR, BORDA, 0.5);
    Y += 2;

    const totaisKeys = Object.keys(totaisPorMoeda);
    if (totaisKeys.length > 0) {
        checkPage(10);
        rect(ML, Y, W - ML * 2, 8, TEAL_CLARO);
        setFont('bold', 9, TEAL);
        doc.text('TOTAL GERAL', ML + 3, Y + 5.5);
        const totaisStr = totaisKeys
            .map(m => totaisPorMoeda[m].toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ' + m)
            .join('   +   ');
        doc.text(totaisStr, MR, Y + 5.5, { align: 'right' });
        Y += 10;
    }

    // ══ CONDIÇÕES COMERCIAIS ══════════════════
    checkPage(25);
    secHeader('Condições Comerciais');

    const formaPagto  = val('prop-forma-pagamento');
    const prazoPagtoEl = document.getElementById('prop-prazo-pagamento');
    const prazoPagto  = prazoPagtoEl?.value === 'personalizado'
        ? (rawVal('prop-prazo-personalizado') || 'Personalizado')
        : (prazoPagtoEl?.options[prazoPagtoEl.selectedIndex]?.text || '—');

    campo('Forma de Pagamento', formaPagto, ML,      Y, 85);
    campo('Prazo de Pagamento', prazoPagto, ML + 90, Y, 85);
    Y += 14;

    const condicoesObs = rawVal('prop-condicoes-obs');
    if (condicoesObs) {
        checkPage(15);
        setFont('bold', 7, CINZA);
        doc.text('CONDIÇÕES E OBSERVAÇÕES', ML, Y);
        Y += 4;
        setFont('normal', 9, PRETO);
        doc.splitTextToSize(condicoesObs, W - ML * 2 - 6).forEach(l => {
            checkPage(6);
            doc.text(l, ML + 3, Y);
            Y += 5;
        });
        Y += 3;
    }

    // ══ OBSERVAÇÕES GERAIS ════════════════════
    const obs = rawVal('prop-observacoes');
    if (obs) {
        checkPage(20);
        secHeader('Observações Gerais');
        setFont('normal', 9, PRETO);
        doc.splitTextToSize(obs, W - ML * 2 - 6).forEach(l => {
            checkPage(6);
            doc.text(l, ML + 3, Y);
            Y += 5;
        });
        Y += 3;
    }

    // ══ ASSINATURAS ══════════════════════════
    checkPage(40);
    Y += 12;
    const sigW = 72;
    linha(ML,       Y, ML + sigW,   BORDA, 0.5);
    linha(MR - sigW, Y, MR,         BORDA, 0.5);
    Y += 4;
    setFont('normal', 8, CINZA);
    doc.text('Emissor / Vendedor',       ML,          Y);
    doc.text('Destinatário / Comprador', MR - sigW,  Y);
    Y += 5;
    setFont('normal', 7, CINZA);
    doc.text(doc.splitTextToSize(emissorNome, sigW)[0], ML,         Y);
    doc.text(doc.splitTextToSize(destRazao,   sigW)[0], MR - sigW, Y);

    // ══ RODAPÉ (todas as páginas) ═════════════
    const totalPags = doc.getNumberOfPages();
    for (let p = 1; p <= totalPags; p++) {
        doc.setPage(p);
        linha(ML, 284, MR, BORDA, 0.3);
        setFont('normal', 7, CINZA);
        doc.text('Marpex — Gestão de Comércio Exterior', ML, 289);
        doc.text(`Página ${p} de ${totalPags}`, W / 2, 289, { align: 'center' });
        doc.text(dataGeracao, MR, 289, { align: 'right' });
    }

    const nomeArq = `proforma_${codigo !== 'SEM-CÓDIGO' ? codigo : 'sem-codigo'}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(nomeArq);
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
        tipo:                g('prop-tipo'),
        proposito:           g('prop-proposito'),
        emissor_tipo:        emissorTipo,
        parceiro_id:         g('prop-cliente-id') || null,
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
    } else if (modelo === 'company') {
        // Foreign only — clear country, show picker but exclude Brasil
        if (paisInput)  { paisInput.value = ''; paisInput.setAttribute('data-excluir-brasil', '1'); }
        if (paisCodigo) paisCodigo.value = '';
        if (paisGroup)  paisGroup.style.display = '';
        if (ieGroup)    ieGroup.style.display = 'none';
        if (sufrGroup)  sufrGroup.style.display = 'none';
        if (tipoCadSel) {
            Array.from(tipoCadSel.options).forEach(o => { o.style.display = ''; });
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

        const grupoTipoDoc = document.getElementById('proc-documento-tipo-group');

        if (val === 'usuario') {
            if (grupoEmp)    grupoEmp.style.display    = 'none';
            if (grupoTipoDoc) grupoTipoDoc.style.display = '';
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
            if (grupoEmp)    grupoEmp.style.display    = '';
            if (grupoTipoDoc) grupoTipoDoc.style.display = 'none';
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

async function _procPreencherDaProforma(id) {
    if (!id) return;
    try {
        const { data, error } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
        if (error || !data) return;

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

        // Emissor / parceiro
        if (data.emissor_tipo === 'terceiro' && data.parceiro_id) {
            const radioTerceiro = document.getElementById('proc-emissor-terceiro');
            if (radioTerceiro) {
                radioTerceiro.checked = true;
                radioTerceiro.dispatchEvent(new Event('change'));
            }
            // Preenche campo empresa/cliente com o nome do parceiro (buscado separadamente)
            const { data: emp } = await supabaseClient.from('empresas').select('id, razao_social, nome_fantasia').eq('id', data.parceiro_id).single();
            if (emp) {
                const clienteEl = document.getElementById('proc-cliente');
                const clienteIdEl = document.getElementById('proc-cliente-id');
                if (clienteEl) clienteEl.value = emp.nome_fantasia || emp.razao_social;
                if (clienteIdEl) clienteIdEl.value = emp.id;
            }
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
    const lista = document.getElementById('prod-ncm-lista');
    if (!input || !lista) return;

    async function mostrar() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { lista.classList.remove('aberta'); return; }
        try {
            const { data } = await supabaseClient
                .from('apoio_ncm')
                .select('codigo, descricao_concatenada')
                .or(`codigo.ilike.%${q}%,descricao_concatenada.ilike.%${q}%`)
                .limit(20);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(n => `
                <div class="autocomplete-item" data-codigo="${n.codigo}">
                    <span class="ac-nome">${n.codigo}</span>
                    <span class="ac-fantasia">${n.descricao_concatenada || ''}</span>
                </div>`).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    input.addEventListener('input', mostrar);
    input.addEventListener('focus', mostrar);
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.codigo;
        lista.classList.remove('aberta');
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
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
        lista.innerHTML = filtradas.slice(0, 30).map(u => `
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
// PRODUTO — EMPRESA AUTOCOMPLETE
// ========================================

function iniciarAutocompleteEmpresaProduto() {
    const input  = document.getElementById('prod-empresa');
    const hidden = document.getElementById('prod-empresa-id');
    const docEl  = document.getElementById('prod-empresa-doc');
    const lista  = document.getElementById('prod-empresa-lista');
    if (!input || !lista) return;

    async function mostrar() {
        const q = input.value.trim();
        if (q.length < 2) { lista.classList.remove('aberta'); return; }
        try {
            const { data } = await supabaseClient
                .from('parceiros')
                .select('id, nome, documento')
                .or(`nome.ilike.%${q}%,documento.ilike.%${q}%`)
                .limit(20);
            if (!data?.length) { lista.classList.remove('aberta'); return; }
            lista.innerHTML = data.map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-nome="${(e.nome || '').replace(/"/g, '&quot;')}"
                     data-doc="${(e.documento || '').replace(/"/g, '&quot;')}">
                    <span class="ac-nome">${e.nome || ''}</span>
                    <span class="ac-fantasia">${e.documento || ''}</span>
                </div>`).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    let _sel = false;
    input.addEventListener('input', () => { if (!_sel) mostrar(); });
    input.addEventListener('focus', () => { if (input.value.length >= 2) mostrar(); });
    lista.addEventListener('mousedown', e => {
        e.preventDefault();
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        _sel = true;
        input.value = item.dataset.nome;
        if (hidden) hidden.value = item.dataset.id;
        if (docEl)  docEl.value  = item.dataset.doc;
        lista.classList.remove('aberta');
        setTimeout(() => { _sel = false; }, 0);
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });
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
                    <span class="ac-fantasia">${e.codigo || ''}</span>
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
                    <span class="ac-fantasia">${a.numero || ''}</span>
                </div>`).join('');
            _acPosicionar(input, lista);
            lista.classList.add('aberta');
        } catch { lista.classList.remove('aberta'); }
    }

    const outrosWrapper = document.getElementById('prod-acond-outros-wrapper');
    const outrosInput   = document.getElementById('prod-acond-descricao');
    const row           = document.getElementById('prod-acond-row');

    function _toggleOutros(descricao) {
        const isOutros = /^outros?$/i.test(descricao.trim());
        if (outrosWrapper) outrosWrapper.style.display = isOutros ? '' : 'none';
        if (outrosInput)   outrosInput.required = isOutros;
        if (!isOutros && outrosInput) outrosInput.value = '';
        if (row) row.style.gridTemplateColumns = isOutros ? '1fr 1fr 1fr' : '1fr 1fr';
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
    onModeloChange('empresa');
    empAdicionarDocumento();
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

    // Produto
    iniciarAutocompleteEmpresaProduto();
    iniciarAutocompleteNcmProduto();
    iniciarAutocompleteUnidadeProduto();
    iniciarAutocompleteMoedaProduto();
    iniciarAutocompleteEmbalagemProduto();
    iniciarAutocompleteAcondicionamentoProduto();

    // Proposta
    const _propIdEdicao = new URLSearchParams(window.location.search).get('id');
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
    iniciarAutocompletePropCliente();
    iniciarAutocompleteEmpresaDestinoProposta();
    iniciarAutocompleteAeroportos();
    iniciarAutocompletePortos();
    propIniciarItens();

    if (_propIdEdicao) propCarregarEdicao(_propIdEdicao);

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
            .select('codigo, descricao')
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
    if (emissorTipo === 'terceiro' && d.parceiro_id) {
        g('prop-cliente-id', d.parceiro_id);
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
