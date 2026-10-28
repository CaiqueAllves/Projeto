// ========================================
// CONTAS A PAGAR
// ========================================

let _cpTodas    = [];
let _cpFiltradas = [];
let _cpExcluirId = null;

document.addEventListener('DOMContentLoaded', async () => {
    _cpCarregarUsuario();
    await _cpCarregarMoedas();
    finLinhaIniciar('cpPrev');
    finLinhaIniciar('cpPag');
    await _cpCarregarPlanoContas();
    finPlanoMontar('cp', _cpPlanoContas);
    if (!FIN_JANELA) await cpCarregar();
    await _cpVerificarGeracaoViaUrl();
});

// ── Plano de Contas (Blocos 2 a 5 — custos) ──────────────────────────────────
// database-plano-contas-aquisicoes-operacional.sql (2 e 4) e
// database-plano-contas-comercial-financeiro.sql (3 e 5; os ganhos do Bloco 5
// ficam em Contas a Receber). No formulário: Plano de Contas = bloco,
// Categoria = conta do bloco (fin-lancamento.js); a coluna categoria antiga
// (resumo dos relatórios) é derivada da conta ao salvar.
let _cpPlanoContas = [];

async function _cpCarregarPlanoContas() {
    try {
        const res = await buscarPlanoContas([2, 3, 4, 5]);
        if (res.sucesso) _cpPlanoContas = (res.data || []).filter(c => c.natureza !== 'ganho');
    } catch (e) {
        console.warn('[Contas a Pagar] Falha ao carregar plano de contas:', e);
    }
}

function _cpRotuloConta(c) {
    return c ? `${c.codigo} — ${c.subfator_nome}` : '';
}

// Categoria-resumo a partir da conta: Aquisições = fornecedor; Comercial =
// comercial; frete, logística e agente de cargas = frete; o resto do
// Operacional = operacional; Financeiro/Cambial = financeiro
function _cpCategoriaDaConta(c) {
    if (!c) return '';
    const b = Number(c.bloco);
    if (b === 2) return 'fornecedor';
    if (b === 3) return 'comercial';
    if (b === 5) return 'financeiro';
    return ['04.04', '04.08', '04.10', '04.12'].includes(c.conta_codigo) ? 'frete' : 'operacional';
}


// ── Moedas (tabela apoio_moedas) ─────────────────────────────────────────────

async function _cpCarregarMoedas() {
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('descricao', { ascending: true });
        if (data?.length) finMoedasPreencher(['cpPrevMoeda', 'cpPagMoeda'], data);
    } catch (e) {
        console.warn('[Contas a Pagar] Falha ao carregar moedas:', e);
    }
}

// ── Observações retrátil ─────────────────────────────────────────────────────

function cpToggleObs(toggle) {
    const content = toggle.nextElementSibling;
    const aberto  = toggle.classList.contains('aberto');
    toggle.classList.toggle('aberto', !aberto);
    content.style.display = aberto ? 'none' : 'block';
}

// ── Abertura pré-preenchida a partir de Processo (módulo Operacional) ──────

async function _cpVerificarGeracaoViaUrl() {
    const params     = new URLSearchParams(window.location.search);

    // Vindo de outra tela (ex: Fluxo de Caixa) só pra abrir uma conta já
    // existente direto no modo de edição.
    const editarId = params.get('editar');
    if (editarId) { cpAbrirModal(editarId); return; }

    const processoId = params.get('gerar_processo_id');
    if (!processoId) return;

    // Vindo do Processo: traz a Proforma de origem e o Processo. O fornecedor
    // de uma conta a pagar (frete, despachante, fabricante...) não é deduzível
    // do Processo — a Proforma só sugere o Exportador quando ele é terceiro.
    // Valor fica em branco: o valor do Processo é o de VENDA, não um custo.
    const { data: processo } = await supabaseClient
        .from('processos')
        .select('id, numero_processo, moeda, itens, proforma_id')
        .eq('id', processoId).maybeSingle();
    if (processo) {
        const moedaItens = (Array.isArray(processo.itens) ? processo.itens : []).find(i => i.moeda)?.moeda;
        const { data: profOrigem } = processo.proforma_id
            ? await supabaseClient.from('proformas').select('codigo').eq('id', processo.proforma_id).maybeSingle()
            : { data: null };
        cpAbrirModal(null, {
            descricao:    `Processo ${processo.numero_processo || ''}`.trim(),
            proformaId:   processo.proforma_id || null,
            proformaNome: profOrigem?.codigo || '',
            processoId:   processo.id,
            processoNome: processo.numero_processo || '',
            moeda:        moedaItens || processo.moeda || 'BRL',
        });
    }
}

function _cpCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

// ── Carregar ───────────────────────────────────────────────────────────────

async function cpCarregar() {
    document.getElementById('cpTbody').innerHTML =
        '<tr><td colspan="6" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    // Filtro de período (revisão de performance) — só reduz o que vem do
    // banco pra contas já pagas/canceladas; pendente/vencida sempre vem.
    const diasAtras = Number(document.getElementById('filtroPeriodoContas')?.value) || null;
    const res = await buscarContasPagar({ diasAtras });
    if (!res.sucesso) {
        document.getElementById('cpTbody').innerHTML =
            '<tr><td colspan="6" class="fin-vazio"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar contas</p></td></tr>';
        return;
    }
    _cpTodas    = res.data || [];
    _cpFiltradas = [..._cpTodas];
    _cpAtualizarVencidos();
    cpRenderizar();
}

function _cpNomeFornecedor(c) {
    return c.parceiros?.nome_fantasia || c.parceiros?.razao_social || '—';
}

function _cpAtualizarVencidos() {
    const hoje = new Date().toISOString().split('T')[0];
    _cpTodas.forEach(c => {
        if (c.status === 'pendente' && c.data_vencimento < hoje) c.status = 'vencido';
    });
}

// ── Renderizar ─────────────────────────────────────────────────────────────

function cpRenderizar() {
    const tbody = document.getElementById('cpTbody');

    if (!_cpFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="fin-vazio">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <p>Nenhuma conta encontrada</p></div></td></tr>`;
        _cpAtualizarResumo();
        return;
    }

    tbody.innerHTML = _cpFiltradas.map(c => {
        const parceiro = _cpNomeFornecedor(c);
        const valor    = _cpFmtValor(c.valor, c.moeda);
        const venc     = c.data_vencimento
            ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';

        const badgeMap = {
            pendente:  '<span class="fin-badge pendente"><i class="fa-solid fa-clock"></i> Pendente</span>',
            vencido:   '<span class="fin-badge vencido"><i class="fa-solid fa-circle-exclamation"></i> Vencido</span>',
            pago:      '<span class="fin-badge pago"><i class="fa-solid fa-circle-check"></i> Pago</span>',
            cancelado: '<span class="fin-badge cancelado"><i class="fa-solid fa-ban"></i> Cancelado</span>',
        };

        const podePagar = c.status === 'pendente' || c.status === 'vencido';

        return `<tr>
            <td><strong>${_cpEsc(c.descricao)}</strong>${c.plano_contas ? `<br><span style="font-size:11px;color:#94a3b8">${_cpEsc(_cpRotuloConta(c.plano_contas))}</span>` : (c.categoria ? `<br><span style="font-size:11px;color:#94a3b8">${_cpEsc(c.categoria)}</span>` : '')}${c.proformas?.codigo ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-file-invoice-dollar"></i> Proforma ${_cpEsc(c.proformas.codigo)}</span>` : ''}${c.processos?.numero_processo ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-diagram-project"></i> Processo ${_cpEsc(c.processos.numero_processo)}</span>` : ''}</td>
            <td>${_cpEsc(parceiro)}</td>
            <td class="td-valor">${valor}</td>
            <td>${venc}</td>
            <td>${badgeMap[c.status] || escHtml(c.status)}</td>
            <td>
                <div class="fin-acoes">
                    <button class="fin-btn-acao fin-btn-editar" onclick="cpAbrirModal('${c.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${podePagar ? `<button class="fin-btn-acao fin-btn-pagar" onclick="cpMarcarPago('${c.id}')" title="Marcar como pago"><i class="fa-solid fa-circle-check"></i></button>` : ''}
                    <button class="fin-btn-acao fin-btn-excluir so-excluir" onclick="cpAbrirModalExcluir('${c.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    _cpAtualizarResumo();
}

function _cpAtualizarResumo() {
    const hoje = new Date();
    const mesAtual = hoje.getMonth();
    const anoAtual = hoje.getFullYear();

    const pendente = _cpTodas
        .filter(c => c.status === 'pendente')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const vencido = _cpTodas
        .filter(c => c.status === 'vencido')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const pago = _cpTodas
        .filter(c => {
            if (c.status !== 'pago') return false;
            const d = c.data_pagamento ? new Date(c.data_pagamento) : null;
            return d && d.getMonth() === mesAtual && d.getFullYear() === anoAtual;
        })
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    document.getElementById('totalPendente').textContent = _cpFmtValor(pendente, 'BRL');
    document.getElementById('totalVencido').textContent  = _cpFmtValor(vencido,  'BRL');
    document.getElementById('totalPago').textContent     = _cpFmtValor(pago,     'BRL');
}

// ── Filtro ─────────────────────────────────────────────────────────────────

// Debounce (revisão de performance) — ver mesmo comentário em contas-receber.js
let _cpFiltrarTimer = null;
function cpFiltrar() {
    clearTimeout(_cpFiltrarTimer);
    _cpFiltrarTimer = setTimeout(() => {
        const termo  = document.getElementById('filtroContas')?.value.toLowerCase().trim() || '';
        const status = document.getElementById('filtroStatus')?.value || '';

        _cpFiltradas = _cpTodas.filter(c => {
            const txt = [c.descricao, _cpNomeFornecedor(c)]
                .filter(Boolean).join(' ').toLowerCase();
            const okTermo  = !termo  || txt.includes(termo);
            const okStatus = !status || c.status === status;
            return okTermo && okStatus;
        });
        cpRenderizar();
    }, 200);
}

// ── Marcar como pago rapidamente ───────────────────────────────────────────


async function cpMarcarPago(id) {
    const c = _cpTodas.find(x => x.id === id);
    if (!c) return;
    if (!finLancPodePagar()) { mostrarNotificacao('Só usuários com acesso ao Financeiro ou administradores podem registrar o pagamento.', 'warning'); return; }
    const hoje = new Date().toISOString().split('T')[0];
    c.status = 'pago';
    c.data_pagamento = hoje;
    cpRenderizar();
    // moeda estrangeira: guarda a PTAX do dia do pagamento (sem a coluna, grava sem)
    const campos = { status: 'pago', data_pagamento: hoje };
    if (c.moeda && c.moeda !== 'BRL' && !c.cambio) {
        const cot = await finCotacaoPtax(c.moeda, hoje);
        if (cot) campos.cambio = cot.taxa;
    }
    const r = await atualizarContaPagar(id, campos);
    if (r && !r.sucesso && campos.cambio && /cambio/i.test(r.mensagem || '')) {
        delete campos.cambio;
        await atualizarContaPagar(id, campos);
    }
}

// ── Modal criar/editar ─────────────────────────────────────────────────────

function cpAbrirModal(id = null, prefill = null) {
    const c = id ? _cpTodas.find(x => x.id === id) : null;

    document.getElementById('cpEditId').value = c?.id || '';
    document.getElementById('cpModalTitulo').innerHTML = c
        ? '<i class="fa-solid fa-pen"></i> Editar Conta a Pagar'
        : '<i class="fa-solid fa-arrow-up"></i> Nova Conta a Pagar';

    document.getElementById('cpDescricao').value      = c?.descricao || prefill?.descricao || '';
    document.getElementById('cpFornecedorNome').value = c?.parceiros?.nome_fantasia || c?.parceiros?.razao_social || prefill?.fornecedorNome || '';
    document.getElementById('cpFornecedorId').value   = c?.parceiro_id || prefill?.fornecedorId || '';

    // Reseta o Processo antes de recalcular pra este registro — evita herdar
    // o estado (habilitado/desabilitado) de uma abertura anterior do modal.
    _cpResetProcesso();
    const proformaId = c?.proforma_id || prefill?.proformaId || '';
    document.getElementById('cpProformaNome').value = c?.proformas?.codigo || prefill?.proformaNome || '';
    document.getElementById('cpProformaId').value   = proformaId;

    if (proformaId) {
        const processoSalvoId   = c?.processo_id || prefill?.processoId || '';
        const processoSalvoNome = c?.processos?.numero_processo || prefill?.processoNome || '';
        // Fornecedor já foi preenchido acima (registro salvo ou prefill), então
        // a derivação abaixo só sugere o Remetente da proforma se ainda estiver vazio.
        _cpDerivarDaProforma(proformaId).then(() => {
            // Garante que o processo já salvo apareça mesmo se não estiver mais
            // entre os processos atuais da proforma (ex: processo trocado depois).
            if (processoSalvoId) {
                document.getElementById('cpProcessoId').value   = processoSalvoId;
                document.getElementById('cpProcessoNome').value = processoSalvoNome || document.getElementById('cpProcessoNome').value;
            }
        });
    } else {
        // Processo sem Proforma de origem: o vínculo com o Processo não pode se perder
        const procId = c?.processo_id || prefill?.processoId || '';
        if (procId) {
            document.getElementById('cpProcessoId').value   = procId;
            document.getElementById('cpProcessoNome').value = c?.processos?.numero_processo || prefill?.processoNome || '';
        }
    }

    finPlanoDefinir('cp', c?.plano_conta_id || '');
    // Seção 1 = previsão (contas antigas sem previsto: os valores da conta)
    finLinhaCarregar('cpPrev', {
        data: c?.data_vencimento || '',
        moeda: c?.moeda_previsto || c?.moeda || prefill?.moeda,
        valor: c ? (c.valor_previsto ?? c.valor) : (prefill?.valor || null),
        cambio: c ? (c.cambio_previsto ?? c.cambio) : null,
    });
    // Seção 2 = pagamento realizado (só se já foi pago)
    const pago = !!c && (c.status === 'pago' || !!c.data_pagamento);
    finLinhaCarregar('cpPag', pago
        ? { data: c.data_pagamento || '', moeda: c.moeda, valor: c.valor, cambio: c.cambio }
        : { moeda: c?.moeda_previsto || c?.moeda || prefill?.moeda });
    document.getElementById('cpMeioPagamento').value   = c?.meio_pagamento || '';
    document.getElementById('cpNumeroDocumento').value = c?.numero_documento || '';
    finComprovanteCarregar('cp', c);
    finLancAplicarPermissao('cp');
    finSecaoPagDefinir('cp', pago && c.data_pagamento ? { data: c.data_pagamento, valor: c.valor, moeda: c.moeda } : null, 'pago');
    document.getElementById('cpObservacoes').value    = c?.observacoes || '';

    const obsToggle = document.querySelector('#cpModalOverlay .pl-obs-toggle[onclick*="ToggleObs"]');
    if (obsToggle) { obsToggle.classList.remove('aberto'); obsToggle.nextElementSibling.style.display = 'none'; }

    document.getElementById('cpModalOverlay').classList.add('ativo');
}

function cpFecharModal() {
    if (FIN_JANELA) return finJanelaFechar(false);
    document.getElementById('cpModalOverlay').classList.remove('ativo');
    document.getElementById('cpAutoParceiro').innerHTML = '';
    document.getElementById('cpAutoProforma').innerHTML   = '';
    document.getElementById('cpAutoProcesso').innerHTML = '';
}

// (máscara dos campos de valor: finLancMascara, fin-lancamento.js)

function _cpFormatarMonetario(num) {
    return Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function cpSalvar() {
    if (!exigirEmpresaVinculada()) return;
    const id        = document.getElementById('cpEditId').value || null;
    const atual     = id ? _cpTodas.find(x => x.id === id) : null;
    const descricao = document.getElementById('cpDescricao').value.trim();
    const conta     = finPlanoConta('cp');
    const prev      = finLinhaLer('cpPrev');
    const pag       = finLinhaLer('cpPag');

    if (!conta) { mostrarNotificacao('Escolha o Plano de Contas e a Categoria.', 'warning'); return; }
    if (!descricao || !prev.valor || !prev.data) {
        mostrarNotificacao('Preencha a Previsão de Data de Pagamento, o Valor e a Descrição.', 'warning');
        return;
    }
    const podePagar = finLancPodePagar();
    if (podePagar && (pag.data || pag.valor) && !(pag.data && pag.valor)) {
        finSecaoPagAlternar('cp', true);
        mostrarNotificacao('Pagamento realizado: preencha a Data de Pagamento e o Valor (ou deixe os dois em branco).', 'warning');
        return;
    }

    const btn = document.getElementById('cpBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    let comp = { campos: {}, apagarDepois: null };
    if (podePagar) {
        try { comp = await finComprovanteParaSalvar('cp', 'pagar'); }
        catch (e) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar'; mostrarNotificacao(e.message, 'error'); return; }
    }

    // Sem acesso ao Financeiro, o pagamento já registrado fica como estava
    const pagoAntes = !!atual && (atual.status === 'pago' || !!atual.data_pagamento);
    const realizado = podePagar ? !!(pag.data && pag.valor) : pagoAntes;
    const real = podePagar ? pag : { data: atual?.data_pagamento, moeda: atual?.moeda, valor: atual?.valor, cambio: atual?.cambio };
    const dados = {
        descricao,
        parceiro_id:     document.getElementById('cpFornecedorId').value || null,
        proforma_id:     document.getElementById('cpProformaId').value || null,
        processo_id:     document.getElementById('cpProcessoId').value || null,
        plano_conta_id:  conta.id,
        categoria:       _cpCategoriaDaConta(conta) || null,
        // previsão (seção 1)
        data_vencimento: prev.data,
        moeda_previsto:  prev.moeda,
        valor_previsto:  prev.valor,
        cambio_previsto: prev.cambio,
        previsto_em:     atual?.previsto_em || new Date().toISOString().slice(0, 10),
        // valor da conta = o pago (realizado) ou, enquanto não pago, o previsto
        valor:           realizado ? real.valor : prev.valor,
        moeda:           realizado ? real.moeda : prev.moeda,
        cambio:          realizado ? real.cambio : prev.cambio,
        data_pagamento:  realizado ? real.data : null,
        status:          finLancStatus(realizado, 'pago', prev.data, atual?.status),
        observacoes:     document.getElementById('cpObservacoes').value.trim() || null,
        ...(podePagar ? {
            meio_pagamento:   document.getElementById('cpMeioPagamento').value || null,
            numero_documento: document.getElementById('cpNumeroDocumento').value.trim() || null,
            ...comp.campos,
        } : {}),
    };

    const res = await salvarContaPagar(dados, id);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';

    if (!res.sucesso) {
        if (comp.campos.comprovante_path) finComprovanteApagar(comp.campos.comprovante_path);
        mostrarNotificacao('Erro: ' + res.mensagem, 'error');
        return;
    }
    finComprovanteApagar(comp.apagarDepois);
    if (FIN_JANELA) return finJanelaFechar(true);
    cpFecharModal();
    await cpCarregar();
}

// ── Autocomplete parceiro ──────────────────────────────────────────────────
// Busca (oninput, digitando) e Mostra (onfocus, ao clicar no campo) — mesmo
// padrão de Remetente/Destinatário no Pipeline/Proposta: clicar no campo já
// lista até 15 parceiros, sem precisar digitar nada primeiro.

let _cpBuscaTimer = null;

// Guarda de corrida: o fetch do "mostrar tudo" (onfocus) e o fetch filtrado
// (oninput, debounced) podem responder fora de ordem — sem isso, a resposta
// mais lenta sobrescreve a caixa por último, mesmo sendo a mais antiga, e o
// usuário pode acabar clicando num item da lista errada (sem filtro nenhum).
let _cpParceiroReqToken = 0;

async function _cpListarParceiros(termo) {
    const box = document.getElementById('cpAutoParceiro');
    const meuToken = ++_cpParceiroReqToken;
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('parceiros')
            .select('id, razao_social, nome_fantasia')
            .limit(termo ? 8 : 15);
        if (termo) query = query.or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`);
        else query = query.order('razao_social', { ascending: true });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data } = await query;
        if (meuToken !== _cpParceiroReqToken) return; // resposta antiga, descarta

        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum parceiro encontrado — cadastre em Empresas primeiro</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" data-nome="${_cpEsc(p.nome_fantasia || p.razao_social)}" onclick="cpSelecionarParceiro(${p.id}, this.dataset.nome)">
                <span class="pl-auto-nome">${_cpEsc(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_cpEsc(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

function cpBuscarParceiro(termo) {
    document.getElementById('cpFornecedorId').value = '';
    clearTimeout(_cpBuscaTimer);
    _cpBuscaTimer = setTimeout(() => _cpListarParceiros(termo?.length >= 2 ? termo : ''), 300);
}

// Foco no campo: mostra a lista sem apagar o parceiro já selecionado (editar conta)
function cpMostrarParceiro(termo) {
    _cpListarParceiros(termo?.length >= 2 ? termo : '');
}

function cpSelecionarParceiro(id, nome) {
    document.getElementById('cpFornecedorId').value   = id;
    document.getElementById('cpFornecedorNome').value = nome;
    document.getElementById('cpAutoParceiro').innerHTML = '';
}

// ── Autocomplete vínculo — Proforma ──────────────────────────────────────────

let _cpBuscaProformaTimer = null;
let _cpProformaReqToken = 0; // mesma guarda de corrida do _cpListarParceiros acima

async function _cpListarProformas(termo) {
    const box = document.getElementById('cpAutoProforma');
    const meuToken = ++_cpProformaReqToken;
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('id, codigo')
            .neq('status', 'excluido')
            .limit(termo ? 8 : 15);
        if (termo) query = query.ilike('codigo', `%${termo}%`);
        else query = query.order('codigo', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data } = await query;
        if (meuToken !== _cpProformaReqToken) return; // resposta antiga, descarta
        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhuma proforma encontrada</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" data-nome="${_cpEsc(p.codigo || '')}" onclick="cpSelecionarProforma('${p.id}', this.dataset.nome)">
                <span class="pl-auto-nome">${_cpEsc(p.codigo || '')}</span>
            </div>`).join('');
    } catch (e) {}
}

function cpBuscarProforma(termo) {
    document.getElementById('cpProformaId').value = '';
    if (!termo) _cpResetProcesso();
    clearTimeout(_cpBuscaProformaTimer);
    _cpBuscaProformaTimer = setTimeout(() => _cpListarProformas(termo?.length >= 2 ? termo : ''), 300);
}

function cpMostrarProforma(termo) {
    _cpListarProformas(termo?.length >= 2 ? termo : '');
}

async function cpSelecionarProforma(id, codigo) {
    document.getElementById('cpProformaId').value   = id;
    document.getElementById('cpProformaNome').value = codigo;
    document.getElementById('cpAutoProforma').innerHTML = '';
    await _cpDerivarDaProforma(id);
}

// ── Derivação Fornecedor/Valor/Processo a partir da Proforma escolhida ────
// Diferente do Cliente em Contas a Receber, o Fornecedor aqui NÃO é travado:
// uma Proforma pode gerar contas a pagar pra vários fornecedores diferentes
// (frete, despachante, seguro...), não só quem remeteu a mercadoria. Então o
// Remetente da proforma (parceiro_id, BIGINT — quando emissor_tipo='terceiro')
// só é usado como sugestão (preenche cpFornecedorId se nada tiver sido
// escolhido ainda), o campo continua editável/buscável normalmente. Só a
// Moeda é sugerida — o valor fica em branco (o total da proforma é de venda,
// não um custo). Já o Processo é sempre restrito
// aos processos desta proforma (mesmo padrão 0/1/vários usado em Contas a
// Receber): 0 → trava vazio, 1 → preenche sozinho e trava, >1 → usuário
// escolhe entre eles.
let _cpProformaProcessos = [];

function _cpResetProcesso() {
    const processoInput = document.getElementById('cpProcessoNome');
    processoInput.disabled = true;
    processoInput.placeholder = 'Escolha uma Proforma primeiro';
    processoInput.value = '';
    document.getElementById('cpProcessoId').value = '';
    document.getElementById('cpAutoProcesso').innerHTML = '';
    _cpProformaProcessos = [];
}

async function _cpDerivarDaProforma(proformaId) {
    const fornecedorInput = document.getElementById('cpFornecedorNome');
    const processoInput   = document.getElementById('cpProcessoNome');

    document.getElementById('cpProcessoId').value = '';
    processoInput.value = '';
    _cpProformaProcessos = [];

    try {
        const usuario = obterUsuarioLogado();

        const { data: proforma } = await supabaseClient
            .from('proformas')
            .select('emissor_tipo, parceiro_id, parceiro_razao_social, moeda_principal')
            .eq('id', proformaId)
            .single();

        const semFornecedorEscolhido = !document.getElementById('cpFornecedorId').value;
        if (proforma?.emissor_tipo === 'terceiro' && semFornecedorEscolhido) {
            let nomeSugerido = proforma.parceiro_razao_social || '';
            if (proforma.parceiro_id) {
                const { data: parc } = await supabaseClient
                    .from('parceiros').select('razao_social, nome_fantasia').eq('id', proforma.parceiro_id).maybeSingle();
                if (parc) nomeSugerido = parc.nome_fantasia || parc.razao_social || nomeSugerido;
            }
            document.getElementById('cpFornecedorId').value = proforma.parceiro_id || '';
            fornecedorInput.value = nomeSugerido;
        }

        // Só a moeda da proforma é sugerida (se o valor ainda estiver vazio): o
        // total da proforma é o valor de VENDA, não um custo — o valor da conta
        // a pagar fica em branco para o usuário informar.
        if (!document.getElementById('cpPrevValor').value.trim() && proforma?.moeda_principal) {
            const selMoeda = document.getElementById('cpPrevMoeda');
            const moeda = finMoedaParaOpcao(selMoeda, proforma.moeda_principal);
            if (moeda) { selMoeda.value = moeda; _finLinhaCambio('cpPrev', { forcar: true }); }
        }

        let query = supabaseClient
            .from('processos')
            .select('id, numero_processo')
            .eq('proforma_id', proformaId)
            .order('numero_processo', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        const { data: processos } = await query;
        _cpProformaProcessos = processos || [];

        if (_cpProformaProcessos.length === 0) {
            processoInput.disabled = true;
            processoInput.placeholder = 'Nenhum processo vinculado a esta proforma';
        } else if (_cpProformaProcessos.length === 1) {
            document.getElementById('cpProcessoId').value = _cpProformaProcessos[0].id;
            processoInput.value = _cpProformaProcessos[0].numero_processo || '';
            processoInput.disabled = true;
        } else {
            processoInput.disabled = false;
            processoInput.placeholder = 'Selecione um dos processos desta proforma...';
        }
    } catch (e) {}
}

// ── Autocomplete vínculo — Processo (restrito à Proforma escolhida) ───────

function _cpRenderizarProcessos(termo) {
    const box = document.getElementById('cpAutoProcesso');
    const lista = termo
        ? _cpProformaProcessos.filter(p => (p.numero_processo || '').toLowerCase().includes(termo.toLowerCase()))
        : _cpProformaProcessos;
    if (!lista.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum processo vinculado a esta proforma</div>'; return; }
    box.innerHTML = lista.map(p => `
        <div class="pl-auto-item" data-nome="${_cpEsc(p.numero_processo || '')}" onclick="cpSelecionarProcesso('${p.id}', this.dataset.nome)">
            <span class="pl-auto-nome">${_cpEsc(p.numero_processo || '')}</span>
        </div>`).join('');
}

function cpBuscarProcesso(termo) {
    document.getElementById('cpProcessoId').value = '';
    _cpRenderizarProcessos(termo);
}

function cpMostrarProcesso(termo) {
    _cpRenderizarProcessos(termo);
}

function cpSelecionarProcesso(id, numero) {
    document.getElementById('cpProcessoId').value   = id;
    document.getElementById('cpProcessoNome').value = numero;
    document.getElementById('cpAutoProcesso').innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#cpAutoParceiro') && !e.target.closest('#cpFornecedorNome')) {
        const box = document.getElementById('cpAutoParceiro');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#cpAutoProforma') && !e.target.closest('#cpProformaNome')) {
        const box = document.getElementById('cpAutoProforma');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#cpAutoProcesso') && !e.target.closest('#cpProcessoNome')) {
        const box = document.getElementById('cpAutoProcesso');
        if (box) box.innerHTML = '';
    }
});

// ── Modal excluir ──────────────────────────────────────────────────────────

function cpAbrirModalExcluir(id) {
    if (!usuarioPodeExcluir()) return avisoSemPermissaoExcluir();
    _cpExcluirId = id;
    const c = _cpTodas.find(x => x.id === id);
    document.getElementById('cpExcluirNome').textContent = c?.descricao || '';
    document.getElementById('cpModalExcluirOverlay').classList.add('ativo');
}

function cpFecharModalExcluir() {
    _cpExcluirId = null;
    document.getElementById('cpModalExcluirOverlay').classList.remove('ativo');
}

async function cpConfirmarExcluir() {
    if (!_cpExcluirId) return;
    const btn = document.getElementById('cpBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const res = await excluirContaPagar(_cpExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    if (!res.sucesso) { mostrarNotificacao('Erro: ' + res.mensagem, 'error'); return; }
    cpFecharModalExcluir();
    await cpCarregar();
}

// ── Helpers ────────────────────────────────────────────────────────────────

// moeda inválida (registro antigo) não pode derrubar a lista inteira (fin-moeda.js)
function _cpFmtValor(v, moeda = 'BRL') {
    return finFormatarValor(v, moeda);
}

function _cpEsc(str) {
    return String(str || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Sair sempre encerra a sessão de vez, mesmo com "Lembrar-me" ativo (login
// automático não deve sobreviver a um logout explícito). cpfSalvo é mantido
// de propósito, só pra não precisar redigitar o CPF na próxima vez.
