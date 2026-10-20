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

// Limpar formulário
async function limparForm(formId) {
    if (await confirmarAcao('Deseja limpar todos os campos?', { titulo: 'Limpar campos', confirmar: 'Limpar', perigo: true })) {
        document.getElementById(formId).reset();
    }
}

// ========================================
// FECHAR ABA SOZINHA APÓS EDITAR (Empresa/Processo/Proforma/Produto)
// ========================================
// Editar sempre abre numa aba nova (a lista chama editarX() com window.open)
// — depois de salvar a edição não faz sentido deixar a aba parada esperando
// o usuário fechar na mão. Conta 5s (dá tempo de ler a confirmação, e dá
// pra cancelar) e fecha sozinha, avisando a aba que abriu (a lista) pra
// recarregar. Só se aplica a EDITAR um registro já existente — cadastrar um
// novo continua como estava (permite cadastrar vários em seguida sem a aba
// fechar no meio).

let _fecharAbaTimeoutId  = null;
let _fecharAbaIntervalId = null;

function _fecharAbaAposSalvar() {
    try {
        if (window.opener && !window.opener.closed) {
            if (typeof window.opener.profCarregarLista === 'function') window.opener.profCarregarLista();
            if (typeof window.opener.carregarProcessos === 'function') window.opener.carregarProcessos();
            if (typeof window.opener.carregarProdutos === 'function')  window.opener.carregarProdutos();
            if (typeof window.opener.carregarEmpresas === 'function')  window.opener.carregarEmpresas();
        }
    } catch (e) {}
    window.close();
    if (!window.closed) window.history.back();
}

function _mostrarBadgeFechamento() {
    let badge = document.getElementById('fechamento-automatico-aviso');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'fechamento-automatico-aviso';
        badge.style.cssText = 'position:fixed; bottom:24px; right:24px; background:#1e293b; color:#fff; padding:12px 18px; border-radius:10px; font-size:13px; z-index:10000; display:flex; align-items:center; gap:12px; box-shadow:0 6px 20px rgba(0,0,0,.2);';
        badge.innerHTML = `
            <i class="fa-solid fa-clock"></i>
            <span id="fechamento-automatico-texto">Fechando esta aba em 5s...</span>
            <button type="button" onclick="_cancelarFechamentoAutomatico()" style="background:transparent;border:1px solid rgba(255,255,255,.45);color:#fff;border-radius:6px;padding:4px 10px;cursor:pointer;font-size:12px;">Manter aberta</button>
        `;
        document.body.appendChild(badge);
    }
    badge.style.display = 'flex';
    return document.getElementById('fechamento-automatico-texto');
}

function _agendarFechamentoAutomatico() {
    _cancelarFechamentoAutomatico();
    const textoEl = _mostrarBadgeFechamento();
    let restante = 5;
    _fecharAbaIntervalId = setInterval(() => {
        restante--;
        if (restante > 0) { textoEl.textContent = `Fechando esta aba em ${restante}s...`; }
        else clearInterval(_fecharAbaIntervalId);
    }, 1000);
    _fecharAbaTimeoutId = setTimeout(_fecharAbaAposSalvar, 5000);
}

function _cancelarFechamentoAutomatico() {
    if (_fecharAbaTimeoutId)  { clearTimeout(_fecharAbaTimeoutId);   _fecharAbaTimeoutId  = null; }
    if (_fecharAbaIntervalId) { clearInterval(_fecharAbaIntervalId); _fecharAbaIntervalId = null; }
    const badge = document.getElementById('fechamento-automatico-aviso');
    if (badge) badge.style.display = 'none';
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

            // Editar fecha a aba sozinha depois de 5s (dá tempo de ler e
            // ainda usar os botões do modal — "Criar outro" cancela).
            // Cadastrar uma nova continua aberto por padrão.
            if (editandoId) _agendarFechamentoAutomatico();

            // Não baixa o PDF sozinho: o aviso mostra as ações (botão "PDF" usa
            // o registro completo guardado aqui). Só o anexo no documento
            // "Nº Proforma Invoice" continua automático.
            _propUltimoSalvo = res.data;
            anexarPDFProformaAutomatico(res.data);
        } else {
            mostrarNotificacao('Erro ao salvar proposta: ' + (res.mensagem || 'Tente novamente.'), 'erro');
        }
        return;
    }

    // Processo — salvar no Supabase
    const dadosProc = _coletarDadosProcesso();
    const editandoIdProc = document.getElementById('proc-id')?.value || '';

    const resProc = editandoIdProc
        ? await window.supabaseAPI.atualizarProcesso(editandoIdProc, dadosProc)
        : await window.supabaseAPI.salvarProcesso(dadosProc);

    const posModal = document.getElementById('modal-pos-salvo');
    posModal.dataset.origem = origem;

    if (resProc.sucesso) {
        localStorage.setItem('processos_updated', Date.now());

        // Processo gerado a partir de uma proforma: atualiza a referência
        // "processo mais recente" nela (uma Proforma pode gerar vários)
        const propostaOrigemId = document.getElementById('proc-proposta-id')?.value || '';
        if (!editandoIdProc && propostaOrigemId && resProc.data?.id) {
            await window.supabaseAPI.marcarProformaFinalizada(propostaOrigemId, resProc.data.id);
        }
        // Itens que o usuário escolheu "Excluir da Proforma" ao remover do processo
        if (propostaOrigemId) await _procAplicarExclusoesNaProforma(propostaOrigemId);

        const tituloEl   = document.getElementById('pos-salvo-titulo');
        const msgEl      = document.getElementById('pos-salvo-msg');
        const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
        const codigoEl   = document.getElementById('pos-salvo-codigo');
        const pdfWrap    = document.getElementById('pos-salvo-pdf-wrap');
        const pdfBtn     = document.getElementById('pos-salvo-pdf-btn');

        const numeroProcesso = resProc.data?.numero_processo || '—';
        if (resProc.data?.numero_processo) window._procNumero = resProc.data.numero_processo;

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

        // Editar fecha a aba sozinha depois de 5s (dá tempo de ler e ainda
        // usar os botões do modal — "Criar outro" cancela). Cadastrar um
        // novo continua aberto por padrão.
        if (editandoIdProc) _agendarFechamentoAutomatico();
    } else {
        mostrarNotificacao('Erro ao salvar processo: ' + (resProc.mensagem || 'Tente novamente.'), 'erro');
    }
}

async function criarNovo() {
    // Usuário optou por continuar cadastrando nesta aba — cancela o
    // fechamento automático agendado (só se aplica quando a ação era editar).
    _cancelarFechamentoAutomatico();
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
        await propGerarCodigo();
        const codigoWrap = document.getElementById('pos-salvo-codigo-wrap');
        const pdfWrap    = document.getElementById('pos-salvo-pdf-wrap');
        if (codigoWrap) codigoWrap.style.display = 'none';
        if (pdfWrap)    pdfWrap.style.display    = 'none';
    } else {
        document.getElementById('form-processo')?.reset();
        _docLimparAnexosVisuais();
    }
}

function fecharGuia() {
    _cancelarFechamentoAutomatico();
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

// AUTOCOMPLETE — DADOS
// ========================================

let _acEmpresas    = [];
let _acPaises      = [];
let _acContainers  = [];
let _acAeroportos  = [];
let _acPortos      = [];
let _acMoedas      = [];
let _acUnidades    = [];

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
                 data-nome="${escHtml(e.razao_social || '')}"
                 data-doc="${escHtml(e.documento || '')}"
                 data-pais="${escHtml(e.pais || '')}">
                <span class="ac-nome">${escHtml(e.razao_social || '')}</span>
                ${e.nome_fantasia ? `<span class="ac-fantasia">${escHtml(e.nome_fantasia)}</span>` : ''}
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
                 data-nome="${escHtml(p.nome || '')}">
                <span class="ac-nome">${escHtml(p.nome || '')}</span>
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
// CEP — AUTO-PREENCHIMENTO (ViaCEP)
// ========================================

function _cepMascara(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 8);
    if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
    input.value = v;
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
    _empIniciarLogo();
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
            _empCarregarTenantLogoContas(dados._tenantId);
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

        // Veio do aviso "Proforma não assinada" (proforma.js/profSeguirProcesso)
        // com o aceite confirmado: registra quem aceitou e quando.
        const _urlProc = new URLSearchParams(window.location.search);
        if (_urlProc.get('sem_assinatura') === '1') {
            const aceiteEm = new Date(_urlProc.get('aceite_em') || '');
            const usuario  = obterUsuarioLogado();
            _procAplicarSemAssinatura({
                sem_assinatura: true,
                sem_assinatura_confirmado_por: usuario?.nome || usuario?.email || null,
                sem_assinatura_confirmado_em:  isNaN(aceiteEm) ? new Date().toISOString() : aceiteEm.toISOString(),
            }, proformaAc?.nome || '');
        }
    }

    // Produto
    iniciarAutocompleteEmpresaProduto();
    iniciarAutocompleteNcmProduto();
    iniciarAutocompleteUnidadeProduto();
    iniciarAutocompleteMoedaProduto();
    iniciarAutocompleteEmbalagemProduto();
    iniciarAutocompleteAcondicionamentoProduto();
    prodAplicarBloqueioRadical();
    prodIniciarTags();

    // Proposta
    const _urlParams    = new URLSearchParams(window.location.search);
    const _urlTab       = _urlParams.get('tab');
    const _urlId        = _urlParams.get('id');
    const _urlModo      = _urlParams.get('modo');
    const _urlDuplicar  = _urlParams.get('duplicar');

    // ?id= só é ID de proforma quando a aba ativa é a de proforma (aqui
    // chamada de "proposta" por legado) — não "qualquer aba que não seja
    // processo", que também pegava a de produto por engano (mesmo nome de
    // parâmetro ?id=, aba diferente) e tentava buscar o produto como se
    // fosse proforma, sempre falhando com "Proforma não encontrada."
    const _propIdEdicao    = _urlTab === 'proposta' ? _urlId : null;
    const _propIdDuplicar  = _urlTab === 'proposta' ? _urlDuplicar : null;

    if (!_propIdEdicao) {
        await propGerarCodigo();
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
    // Linha de produto em branco só numa Proforma nova. Na edição/duplicação
    // ela corria em paralelo com o carregamento e, se terminasse depois, era
    // somada aos itens já carregados (aparecia um item vazio a mais).
    if (!_propIdEdicao && !_propIdDuplicar) propIniciarItens();

    if (_propIdEdicao) {
        await propCarregarEdicao(_propIdEdicao);
        if (_urlModo === 'visualizar') propAplicarModoVisualizacao();
    } else if (_propIdDuplicar) {
        await propCarregarDuplicar(_propIdDuplicar);
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

});

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

function _itensDe(pfx) { return pfx === 'proc' ? _procItens : _propItens; }

// Guarda junto do nome da moeda (o que aparece nas telas/PDFs) o código ISO
// (USD, EUR, BRL...) — nome por extenso varia, o código não.
function _itensComSigla(itens) {
    return (itens || []).map(it => {
        const m = _acMoedas.find(x => x.descricao === it.moeda || x.sigla === it.moeda);
        return { ...it, moeda_sigla: m?.sigla || it.moeda_sigla || null };
    });
}

function _itensNormalizar(lista) {
    return (lista || []).map(it => ({
        produto_id: it.produto_id || null,
        produto:  it.produto  || '',
        qtd:      it.qtd      ?? it.quantidade ?? 1,
        unidade:  it.unidade  || (_acUnidades[0]?.unidade || 'UN'),
        preco:    it.preco    ?? it.preco_unit ?? 0,
        moeda:    it.moeda    || (_acMoedas[0]?.descricao || 'USD'),
    }));
}

async function itemAdicionar(pfx) {
    await Promise.all([_carregarMoedas(), _carregarUnidades()]);
    const _moedaDefault   = _acMoedas.length   > 0 ? _acMoedas[0].descricao   : '';
    const _unidadeDefault = _acUnidades.length  > 0 ? _acUnidades[0].unidade   : 'un';
    _itensDe(pfx).push({ produto_id: null, produto: '', qtd: 1, unidade: _unidadeDefault, preco: 0, moeda: _moedaDefault });
    itensRenderizar(pfx);
}

async function itemRemover(pfx, idx) {
    // Processo: item que veio da Proforma pergunta se sai só deste processo
    // (stand-by, saldo pendente) ou da Proforma também — formularios-processo.js
    if (pfx === 'proc' && typeof _procPerguntarRemocao === 'function') {
        if (!(await _procPerguntarRemocao(idx))) return;
    }
    _itensDe(pfx).splice(idx, 1);
    itensRenderizar(pfx);
}

function itemAtualizar(pfx, idx, campo, valor) {
    const itens = _itensDe(pfx);
    if (!itens[idx]) return;
    itens[idx][campo] = valor;
    itensRecalcular(pfx);
}

function itemMascaraPreco(pfx, input, idx) {
    let raw = input.value.replace(/\D/g, '');
    if (!raw) { itemAtualizar(pfx, idx, 'preco', 0); return; }
    const num = parseInt(raw, 10) / 100;
    input.value = num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    itemAtualizar(pfx, idx, 'preco', num);
}

function _itemEsc(v) {
    return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function itensRenderizar(pfx) {
    const tbody = document.getElementById(`${pfx}-itens-body`);
    if (!tbody) return;
    const itens = _itensDe(pfx);

    const unidades = _acUnidades.length > 0
        ? _acUnidades
        : [{unidade:'UN',descricao:'Unidade'},{unidade:'KG',descricao:'Quilograma'},{unidade:'CX',descricao:'Caixa'}];
    const moedas   = _acMoedas.length > 0
        ? _acMoedas
        : [{descricao:'Dólar Americano'},{descricao:'Euro'},{descricao:'Real Brasileiro'}];

    tbody.innerHTML = itens.map((item, i) => `
        <div class="prop-item-card" id="${pfx}-item-card-${i}">
            <div class="prop-item-top">
                <span class="prop-item-badge">${i + 1}</span>
                <div class="autocomplete-wrapper prop-item-produto-wrap">
                    <input type="text" class="prop-item-input" id="${pfx}-item-produto-${i}" value="${_itemEsc(item.produto)}"
                        autocomplete="off"
                        onfocus="itemBuscarProduto('${pfx}', ${i}, this.value)"
                        oninput="itemAtualizar('${pfx}', ${i}, 'produto', this.value); itemAtualizar('${pfx}', ${i}, 'produto_id', null); itemBuscarProduto('${pfx}', ${i}, this.value)"
                        placeholder="Buscar produto do Exportador ou digitar descrição...">
                    <div class="autocomplete-list" id="${pfx}-item-lista-${i}"></div>
                </div>
                <button type="button" class="prop-item-del" onclick="itemRemover('${pfx}', ${i})" title="Remover">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
            <div class="prop-item-bottom">
                <div class="prop-item-field prop-item-field--qtd">
                    <label for="${pfx}-item-qtd-${i}">Qtd</label>
                    <input id="${pfx}-item-qtd-${i}" type="number" class="prop-item-input prop-item-num" min="0" step="1" value="${escHtml(item.qtd)}"
                        oninput="itemAtualizar('${pfx}', ${i}, 'qtd', parseInt(this.value)||0)">
                </div>
                <div class="prop-item-field prop-item-field--un">
                    <label for="${pfx}-item-un-${i}">Un.</label>
                    <select id="${pfx}-item-un-${i}" class="prop-item-select" onchange="itemAtualizar('${pfx}', ${i}, 'unidade', this.value)">
                        ${unidades.map(u => `<option value="${escHtml(u.unidade)}"${item.unidade===u.unidade?' selected':''}>${escHtml(u.unidade)}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-item-field prop-item-field--preco">
                    <label for="${pfx}-item-preco-${i}">Preço Unit.</label>
                    <input id="${pfx}-item-preco-${i}" type="text" inputmode="decimal" class="prop-item-input prop-item-num"
                        value="${item.preco ? item.preco.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2}) : ''}"
                        placeholder="0,00"
                        oninput="itemMascaraPreco('${pfx}', this, ${i})">
                </div>
                <div class="prop-item-field prop-item-field--moeda">
                    <label for="${pfx}-item-moeda-${i}">Moeda</label>
                    <select id="${pfx}-item-moeda-${i}" class="prop-item-select" onchange="itemAtualizar('${pfx}', ${i}, 'moeda', this.value)">
                        ${moedas.map(m => `<option value="${escHtml(m.descricao)}"${item.moeda===m.descricao?' selected':''}>${escHtml(m.descricao)}</option>`).join('')}
                    </select>
                </div>
                <div class="prop-item-field prop-item-field--total">
                    <span class="rotulo">Total</span>
                    <span class="prop-item-total-val" id="${pfx}-item-total-${i}">${propFormatarValor(item.qtd * item.preco, item.moeda)}</span>
                </div>
            </div>
            ${pfx === 'proc' ? `<div class="item-saldo" id="proc-item-saldo-${i}"></div>` : ''}
        </div>`).join('');

    itensRecalcular(pfx);
}

function itensRecalcular(pfx) {
    const itens = _itensDe(pfx);
    if (pfx === 'proc') _procAtualizarSaldoVisual();
    itens.forEach((item, i) => {
        const el = document.getElementById(`${pfx}-item-total-${i}`);
        if (el) el.textContent = propFormatarValor(item.qtd * item.preco, item.moeda);
    });

    const totalEl = document.getElementById(`${pfx}-total-geral`);
    if (!totalEl) return;

    const totais = {};
    itens.forEach(item => {
        const val = item.qtd * item.preco;
        if (val) totais[item.moeda] = (totais[item.moeda] || 0) + val;
    });

    const keys = Object.keys(totais);
    totalEl.textContent = keys.length
        ? keys.map(m => propFormatarValor(totais[m], m)).join(' + ')
        : '—';
}

// ── Autocomplete de produto (filtrado pelo remetente) ─────────────

let _itemProdutosCache = {};   // chave: ids de parceiro ordenados → lista de produtos
let _itemPropriosIds   = null; // parceiros que representam a própria empresa
let _itemBuscaTimers   = {};

async function _itemIdsParceirosProprios() {
    if (_itemPropriosIds) return _itemPropriosIds;
    try {
        const usuario = obterUsuarioLogado();
        const { data: emp } = await supabaseClient
            .from('empresas').select('cnpj').eq('id', usuario.empresa_id).maybeSingle();
        const cnpj = String(emp?.cnpj || '').replace(/\D/g, '');
        let parceiros = [];
        if (cnpj) {
            const { data } = await supabaseClient.from('parceiros').select('id, documento').eq('empresa_id', usuario.empresa_id);
            parceiros = data || [];
        }
        _itemPropriosIds = parceiros
            .filter(e => String(e.documento || '').replace(/\D/g, '') === cnpj)
            .map(e => String(e.id));
    } catch { _itemPropriosIds = []; }
    return _itemPropriosIds;
}

// null = remetente ainda não definido; [] = remetente sem parceiro correspondente.
async function _itemIdsRemetente(pfx) {
    const tipo = document.querySelector(`input[name="${pfx}-emissor-tipo"]:checked`)?.value;
    if (tipo === 'terceiro') {
        const id = document.getElementById(`${pfx}-cliente-id`)?.value;
        return id ? [String(id)] : null;
    }
    if (tipo === 'usuario') return _itemIdsParceirosProprios();
    return null;
}

async function _itemProdutosDoRemetente(ids) {
    const chave = [...ids].sort().join(',');
    if (_itemProdutosCache[chave]) return _itemProdutosCache[chave];
    const usuario = obterUsuarioLogado();
    const { data, error } = await supabaseClient
        .from('produtos')
        .select('id, nome, sku, unidade_medida, preco_venda, moeda, status')
        .eq('empresa_id', usuario.empresa_id)
        .in('empresa_parceira_id', ids)
        .order('nome', { ascending: true });
    if (error) return [];
    const lista = (data || []).filter(p => p.status !== 'inativo' && p.status !== 'excluido');
    _itemProdutosCache[chave] = lista;
    return lista;
}

function itemBuscarProduto(pfx, idx, termo) {
    const lista = document.getElementById(`${pfx}-item-lista-${idx}`);
    if (!lista) return;
    clearTimeout(_itemBuscaTimers[pfx + idx]);
    _itemBuscaTimers[pfx + idx] = setTimeout(async () => {
        const ids = await _itemIdsRemetente(pfx);
        let html;
        if (ids === null) {
            html = '<div class="autocomplete-vazio">Escolha o Emissor/Exportador para listar os produtos dele</div>';
        } else if (ids.length === 0) {
            html = '<div class="autocomplete-vazio">A própria empresa não está cadastrada como parceira — sem produtos vinculados</div>';
        } else {
            const t = String(termo || '').trim().toLowerCase();
            const produtos = (await _itemProdutosDoRemetente(ids))
                .filter(p => !t || (p.nome || '').toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t))
                .slice(0, 30);
            html = produtos.length
                ? produtos.map(p => `
                    <div class="autocomplete-item" onmousedown="itemSelecionarProduto('${pfx}', ${idx}, '${p.id}')">
                        <span class="ac-nome">${_itemEsc(p.nome)}</span>
                        ${p.sku ? `<span class="ac-fantasia">SKU ${_itemEsc(p.sku)}</span>` : ''}
                    </div>`).join('')
                : '<div class="autocomplete-vazio">Nenhum produto desta empresa encontrado — usando o texto digitado</div>';
        }
        lista.innerHTML = html;
        const input = document.getElementById(`${pfx}-item-produto-${idx}`);
        if (input) _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }, 200);
}

function itemSelecionarProduto(pfx, idx, produtoId) {
    const todos = Object.values(_itemProdutosCache).flat();
    const p = todos.find(x => String(x.id) === String(produtoId));
    const item = _itensDe(pfx)[idx];
    if (!p || !item) return;
    item.produto_id = p.id;
    item.produto    = p.nome || '';
    if (p.unidade_medida) {
        const un = _acUnidades.find(u => String(u.unidade).toLowerCase() === String(p.unidade_medida).toLowerCase());
        item.unidade = un ? un.unidade : p.unidade_medida;
    }
    if (p.preco_venda) item.preco = Number(p.preco_venda) || 0;
    if (p.moeda) {
        const m = _acMoedas.find(x => [x.sigla, x.codigo, x.descricao].map(v => String(v ?? '')).includes(String(p.moeda)));
        if (m) item.moeda = m.descricao;
    }
    itensRenderizar(pfx);
}

document.addEventListener('mousedown', e => {
    if (e.target.closest('.prop-item-produto-wrap')) return;
    document.querySelectorAll('[id*="-item-lista-"]').forEach(l => l.classList.remove('aberta'));
});

function propFormatarValor(valor, moeda) {
    if (!valor) return '—';
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'USD', minimumFractionDigits: 2 }).format(valor);
    } catch (_) {
        return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) + ' ' + (moeda || '');
    }
}
