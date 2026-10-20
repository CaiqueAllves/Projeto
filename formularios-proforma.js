// ========================================
// FORMULÁRIOS — Aba Proforma (salvar, emissor, importador, modal/incoterm, edição/duplicação, código)
// ========================================
// Parte do antigo formularios.js (dividido por aba em 2026-10). Tudo continua
// global: funções de uma aba podem chamar as das outras e as de formularios.js.

// ========================================
// SALVAR — PROPOSTA
// ========================================

function salvarProposta(e) {
    e.preventDefault();
    if (!exigirEmpresaVinculada()) return;

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

    // ── Código (gerado de forma assíncrona ao abrir o formulário) ──
    if (!document.getElementById('prop-codigo')?.value) {
        mostrarNotificacao('Aguarde o código da proforma ser gerado.', 'warning');
        return;
    }

    // ── Dados da Proforma ──────────────────
    checar('prop-tipo',      'Selecione o Tipo da proforma.');
    checar('prop-proposito', 'Selecione o Propósito da proforma.');

    const emissorTipo = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value;
    if (!emissorTipo) {
        erros.push('Selecione o Emissor (Usuário ou Terceiro).');
        if (!primeiroEl) primeiroEl = document.getElementById('prop-emissor-usuario')?.closest('.emissor-toggle');
    }
    if (emissorTipo === 'terceiro') {
        checar('prop-cliente', 'Selecione o Exportador (Terceiro).');
    }

    checar('prop-documento', 'Informe o Número de Identificação do emissor.');
    checar('prop-modal',     'Selecione o Modal de transporte.');

    const modal = document.getElementById('prop-modal')?.value;
    checar('prop-incoterm',  'Selecione o Incoterm.');
    if (modal && modal !== 'maritimo' && INCOTERMS_MARITIMOS.includes(document.getElementById('prop-incoterm')?.value)) {
        marcar('prop-incoterm', `O Incoterm ${document.getElementById('prop-incoterm').value} é exclusivo do modal Marítimo — escolha outro Incoterm ou mude o modal.`);
    }

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
        checar('prop-emp-dest-busca', 'Selecione o Importador.');
    } else {
        checar('prop-emp-dest-razao', 'Informe a Razão Social do Importador.');
    }
    if (!btnCad?.classList.contains('ativo')) {
        checar('prop-emp-dest-doc', 'Informe a identificação fiscal do Importador.');
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
        itens:               _itensComSigla(_propItens || []),
        valor_total:         (_propItens || []).reduce((s, i) => s + (i.qtd * i.preco), 0),
        moeda_principal:     _propItens?.find(i => i.moeda)?.moeda || 'USD',
        destinatario_id:         g('prop-emp-dest-id') || null,
        destinatario_razao_social: g('prop-emp-dest-razao') || null,
        destinatario_doc:        g('prop-emp-dest-doc') || null,
        destinatario_doc_tipo:   g('prop-emp-dest-doc-tipo') || null,
        validade_dias:           g('prop-validade-dias') || null,
        obs_status:              g('prop-obs-status') || null,
        ..._propContaEscolhida(emissorTipo),
        incoterm_local:          g('prop-incoterm-local').trim() || null,
        previsao_embarque:       g('prop-previsao-embarque') || null,
        frete_valor:             _propFreteSeguroAtivo() ? _propLerValor('prop-frete-valor') : null,
        seguro_valor:            _propFreteSeguroAtivo() ? _propLerValor('prop-seguro-valor') : null,
    };
}

// ── Frete / Seguro (Incoterms em que o vendedor paga o transporte: C e D) ──
const PROP_INCOTERMS_FRETE = ['CFR', 'CIF', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP'];
function _propFreteSeguroAtivo() { return PROP_INCOTERMS_FRETE.includes(document.getElementById('prop-incoterm')?.value); }
function propToggleFreteSeguro() {
    const ativo = _propFreteSeguroAtivo();
    document.querySelectorAll('.prop-frete-seguro').forEach(el => { el.style.display = ativo ? '' : 'none'; });
}
// máscara contábil: digita só números, centavos à direita (1234567 → 12.345,67)
function propMascaraValor(input) {
    const raw = input.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
    input.value = raw ? (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
}
function _propLerValor(id) {
    const v = (document.getElementById(id)?.value || '').replace(/\./g, '').replace(',', '.');
    return v ? Number(v) || null : null;
}
function _propPreencherCamposPdf(d) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    const fmt = v => (v === null || v === undefined || v === '') ? '' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    set('prop-incoterm-local', d.incoterm_local);
    set('prop-previsao-embarque', d.previsao_embarque);
    set('prop-frete-valor', fmt(d.frete_valor));
    set('prop-seguro-valor', fmt(d.seguro_valor));
    propToggleFreteSeguro();
}

// ── Conta para pagamento (contas de recebimento do Exportador) ──────────
// Guarda o id da conta e uma CÓPIA dos dados: a Proforma emitida não muda
// se a conta for editada ou apagada depois.
let _propContas = [];
let _propContaSelecionar = null;   // id a selecionar quando a lista chegar (edição)
let _propContasSeq = 0;            // só a carga mais recente vale (troca rápida de Exportador)

async function propCarregarContasBancarias() {
    const sel = document.getElementById('prop-conta-bancaria');
    const aviso = document.getElementById('prop-conta-bancaria-aviso');
    if (!sel) return;
    const terceiro = document.querySelector('input[name="prop-emissor-tipo"]:checked')?.value === 'terceiro';
    const parceiroId = terceiro ? (document.getElementById('prop-cliente-id')?.value || null) : null;
    const anterior = _propContaSelecionar ?? sel.value;
    sel.innerHTML = '<option value="">— Não informar dados bancários —</option>';
    _propContas = [];
    if (terceiro && !parceiroId) { if (aviso) aviso.style.display = 'none'; return; }
    const seq = ++_propContasSeq;
    const r = await window.supabaseAPI.buscarContasBancarias(parceiroId);
    if (seq !== _propContasSeq) return;
    _propContas = r.data || [];
    _propContas.forEach(c => {
        const o = document.createElement('option');
        o.value = c.id; o.textContent = contaBancariaResumo(c);
        sel.appendChild(o);
    });
    if (anterior && _propContas.some(c => String(c.id) === String(anterior))) sel.value = String(anterior);
    else if (_propContas.length === 1 && _propContaSelecionar == null) sel.value = String(_propContas[0].id);
    _propContaSelecionar = null;
    if (aviso) {
        aviso.style.display = (r.sucesso && !_propContas.length) ? '' : 'none';
        aviso.textContent = terceiro
            ? 'Este Exportador não tem conta de recebimento cadastrada (Empresas › editar › Dados Financeiros).'
            : 'Sua empresa não tem conta de recebimento cadastrada (Perfil › Editar Dados da Empresa › Dados Financeiros).';
    }
}

function _propContaEscolhida(emissorTipo) {
    const id = document.getElementById('prop-conta-bancaria')?.value || '';
    const c = _propContas.find(x => String(x.id) === String(id));
    if (!c) return { conta_bancaria_id: null, dados_bancarios: null };
    const beneficiario = c.beneficiario || (emissorTipo === 'terceiro' ? document.getElementById('prop-cliente')?.value : null) || null;
    const { apelido, banco, agencia, conta, tipo_conta, swift, iban, endereco_banco, moeda } = c;
    return { conta_bancaria_id: c.id, dados_bancarios: { apelido, beneficiario, banco, agencia, conta, tipo_conta, swift, iban, endereco_banco, moeda } };
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
    document.getElementById('prop-incoterm')?.addEventListener('change', propToggleFreteSeguro);
    // Exportador mudou (própria empresa ⇄ terceiro): recarrega as contas para pagamento
    document.querySelectorAll('input[name="prop-emissor-tipo"]').forEach(r => r.addEventListener('change', () => propCarregarContasBancarias()));
    propCarregarContasBancarias();
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

// Editar/Duplicar Proforma: marcar o Emissor (evento change) limpa o
// documento e o País de Origem quando é Terceiro — então, depois de marcar,
// reaplica o que veio salvo. Proforma antiga sem documento/nome do Exportador
// Terceiro busca do cadastro do parceiro.
async function _propReaplicarEmissor(d) {
    const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
    let documento = d.documento, nome = d.parceiro_razao_social;
    if (d.emissor_tipo === 'terceiro' && d.parceiro_id && (!documento || !nome)) {
        const { data: parc } = await supabaseClient.from('parceiros')
            .select('razao_social, nome_fantasia, documento').eq('id', d.parceiro_id).maybeSingle();
        if (parc) {
            documento ||= parc.documento;
            nome      ||= parc.nome_fantasia || parc.razao_social;
        }
    }
    if (d.emissor_tipo === 'terceiro' && nome) set('prop-cliente', nome);
    if (documento) {
        const digitos = String(documento).replace(/\D/g, '');
        set('prop-documento', [11, 14].includes(digitos.length) ? _mascaraDocBR(documento) : documento);
        set('prop-documento-tipo', d.documento_tipo || _tipoDocBR(documento));
    }
    set('prop-origem-pais', d.origem_pais);
    set('prop-origem-pais-codigo', d.origem_pais_codigo);
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

        // Formulário abre sem emissor escolhido: nada é preenchido até o usuário escolher
        if (!val) {
            if (usuarioEmpGrupo) usuarioEmpGrupo.style.display = '';
            if (usuarioEmpInput) { usuarioEmpInput.value = ''; usuarioEmpInput.placeholder = 'Selecione o emissor'; }
            if (grupoEmp) grupoEmp.style.display = 'none';
            if (docInput) { docInput.readOnly = true; docInput.placeholder = 'Selecione o emissor'; }
            return;
        }
        if (usuarioEmpInput) usuarioEmpInput.placeholder = 'Empresa do usuário';

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
    let incotermAnterior = incotermSelect.value;

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
            incotermAnterior        = '';
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
        incotermAnterior = incotermSelect.value;
        atualizarInfoIncoterm();
    });

    // Incoterms exclusivos do Marítimo pedem confirmação (mesma regra do Processo).
    // Só em escolha feita pelo usuário — editar/duplicar (troca programática) não abre o aviso.
    incotermSelect.addEventListener('change', async function (e) {
        const val = this.value;
        if (e.isTrusted) this.value = await _incotermValidarEscolha(val, modalSelect.value, incotermAnterior);
        incotermAnterior = this.value;
        atualizarInfoIncoterm();
    });
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
                     data-razao="${escHtml(e.razao_social  || '')}"
                     data-fantasia="${escHtml(e.nome_fantasia || '')}"
                     data-doc="${escHtml(e.documento || '')}"
                     data-tipo="${escHtml(e.tipo_cadastro || '')}"
                     data-idint="${escHtml(e.codigo || '')}">
                    <span class="ac-nome">${escHtml(e.razao_social || '')}</span>
                    ${e.nome_fantasia ? `<span class="ac-fantasia">${escHtml(e.nome_fantasia)}</span>` : ''}
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
        const tipoDestEl = document.getElementById('prop-emp-dest-doc-tipo');
        const tipoCad = (item.dataset.tipo || '').toLowerCase();
        if (tipoDestEl && doc) tipoDestEl.value = ['cnpj', 'cpf', 'tin', 'ein', 'vat'].includes(tipoCad) ? tipoCad : _tipoDocBR(doc);
        if (idEl && idGrp) { idEl.value = idInt; idGrp.style.display = idInt ? '' : 'none'; }
    }

    input.addEventListener('input', () => {
        // Trocando de empresa: a identificação da anterior não vale mais
        if (idInput) idInput.value = '';
        const docEl = document.getElementById('prop-emp-dest-doc');
        if (docEl) docEl.value = '';
        validarDocDestino('');
        renderLista(input.value);
    });
    document.getElementById('prop-emp-dest-doc')?.addEventListener('input', function () {
        const tipoDestEl = document.getElementById('prop-emp-dest-doc-tipo');
        const digitos = this.value.replace(/\D/g, '');
        if (tipoDestEl && ['cnpj', 'cpf'].includes(tipoDestEl.value) && digitos) tipoDestEl.value = _tipoDocBR(digitos);
    });
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
    await _propReaplicarEmissor(d);
    _propContaSelecionar = d.conta_bancaria_id || '';
    propCarregarContasBancarias();
    _propPreencherCamposPdf(d);

    // Destinatário
    if (d.destinatario_id) {
        g('prop-emp-dest-id', d.destinatario_id);
        // Destinatário cadastrado: o nome não fica salvo na proforma (só o id,
        // BIGINT em "parceiros") — busca pra exibir no campo Destinatário.
        if (!d.destinatario_razao_social) {
            const { data: parc } = await supabaseClient.from('parceiros')
                .select('razao_social, tipo_cadastro, documento').eq('id', d.destinatario_id).maybeSingle();
            if (parc) {
                g('prop-emp-dest-busca', parc.razao_social);
                if (!d.destinatario_doc && parc.documento) {
                    g('prop-emp-dest-doc', _mascaraDocBR(parc.documento));
                    g('prop-emp-dest-doc-tipo', parc.tipo_cadastro || _tipoDocBR(parc.documento));
                }
            }
        }
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

// Duplicar: mesma leitura de dados que propCarregarEdicao, mas NÃO seta
// prop-id (salva como registro novo) nem copia código/data de emissão —
// o código já foi gerado do zero (propGerarCodigo, chamado antes desta
// função por não haver _propIdEdicao) e a emissão vira hoje, com a validade
// recalculada a partir de hoje (dispara o listener de iniciarValidadeProposta).
async function propCarregarDuplicar(id) {
    const res = await window.supabaseAPI.buscarProforma(id);
    if (!res.sucesso || !res.data) {
        mostrarNotificacao('Proforma não encontrada para duplicar.', 'erro');
        return;
    }
    const d = res.data;
    const g = (elId, val) => { const el = document.getElementById(elId); if (el) el.value = val ?? ''; };

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
    g('prop-condicoes-obs',     d.condicoes_obs);
    g('prop-observacoes',       d.observacoes);
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
        if (d.parceiro_razao_social) g('prop-cliente', d.parceiro_razao_social);
    }
    await _propReaplicarEmissor(d);
    _propContaSelecionar = d.conta_bancaria_id || '';
    propCarregarContasBancarias();
    _propPreencherCamposPdf(d);

    // Destinatário
    if (d.destinatario_id) {
        g('prop-emp-dest-id', d.destinatario_id);
        // Destinatário cadastrado: o nome não fica salvo na proforma (só o id,
        // BIGINT em "parceiros") — busca pra exibir no campo Destinatário.
        if (!d.destinatario_razao_social) {
            const { data: parc } = await supabaseClient.from('parceiros')
                .select('razao_social, tipo_cadastro, documento').eq('id', d.destinatario_id).maybeSingle();
            if (parc) {
                g('prop-emp-dest-busca', parc.razao_social);
                if (!d.destinatario_doc && parc.documento) {
                    g('prop-emp-dest-doc', _mascaraDocBR(parc.documento));
                    g('prop-emp-dest-doc-tipo', parc.tipo_cadastro || _tipoDocBR(parc.documento));
                }
            }
        }
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

    // Validade — recalcula a data a partir de HOJE (o prazo em dias é o
    // mesmo, mas a contagem começa na duplicata, não na proforma original).
    if (d.validade_dias) {
        g('prop-validade-dias', d.validade_dias);
        document.getElementById('prop-validade-dias')?.dispatchEvent(new Event('change'));
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

    mostrarNotificacao('Dados da proforma original copiados. Confira antes de salvar.', 'sucesso');
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
            <div class="autocomplete-item" data-codigo="${escHtml(p.codigo)}" data-nome="${escHtml(p.descricao || '')}">
                <span class="ac-nome">${escHtml(p.descricao)}</span>
                <span class="ac-fantasia">${escHtml(p.codigo)}</span>
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
            <div class="autocomplete-item" data-nome="${escHtml(p.descricao)}" data-codigo="${escHtml(p.codigo || '')}">
                <span class="ac-nome">${escHtml(p.descricao)}</span>
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
        propCarregarContasBancarias();

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
// PRODUTOS — PROFORMA (pfx 'prop') E PROCESSO (pfx 'proc')
// ========================================
// Mesma UI nos dois formulários. O nome do item tem autocomplete que lista
// SÓ os produtos da empresa remetente escolhida (produtos.empresa_parceira_id):
//   - Emissor Terceiro → o parceiro escolhido em "Remetente" (<pfx>-cliente-id)
//   - Emissor Usuário  → o(s) parceiro(s) cujo documento = CNPJ da própria
//     empresa (tenant), já que todo produto pertence a um parceiro.

let _propItens = [];

async function propIniciarItens() {
    if (!document.getElementById('prop-itens-body')) return;
    await itemAdicionar('prop');
}

// Compatibilidade com os chamadores antigos da Proforma.
function propAdicionarItem()   { return itemAdicionar('prop'); }
function propRenderizarItens() { itensRenderizar('prop'); }
function propRecalcularTotais() { itensRecalcular('prop'); }
