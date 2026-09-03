// ========================================
// CONTAS A RECEBER
// ========================================

let _crTodas    = [];
let _crFiltradas = [];
let _crExcluirId = null;

document.addEventListener('DOMContentLoaded', async () => {
    _crCarregarUsuario();
    await _crCarregarMoedas();
    await _crCarregarPlanoContas();
    await crCarregar();
    await _crVerificarGeracaoViaUrl();
});

// ── Moedas (tabela apoio_moedas) ─────────────────────────────────────────────

async function _crCarregarMoedas() {
    const sel = document.getElementById('crMoeda');
    if (!sel) return;
    try {
        const { data } = await supabaseClient
            .from('apoio_moedas')
            .select('codigo, descricao, sigla')
            .order('descricao', { ascending: true });
        if (data?.length) {
            sel.innerHTML = data.map(m => `<option value="${m.sigla || m.codigo}">${_crEsc(m.descricao || '')}</option>`).join('');
        }
    } catch (e) {
        console.warn('[Contas a Receber] Falha ao carregar moedas:', e);
    }
}

// ── Observações retrátil ─────────────────────────────────────────────────────

function crToggleObs(toggle) {
    const content = toggle.nextElementSibling;
    const aberto  = toggle.classList.contains('aberto');
    toggle.classList.toggle('aberto', !aberto);
    content.style.display = aberto ? 'none' : 'block';
}

// ── Plano de Contas (Bloco 1 — Receitas) ──────────────────────────
// Ver database/database-plano-contas-receitas.sql. Dropdown de busca
// customizado (não <select>, pra não estourar a largura do modal com
// os rótulos longos de Conta) — agrupa visualmente por Conta (ex:
// "01.01 — Exportação de Serviços") com os Subfatores dentro de cada
// grupo, mesmo padrão dos outros campos de busca (Parceiro/Pedido).
let _crPlanoContasTodas = [];

async function _crCarregarPlanoContas() {
    try {
        const res = await buscarPlanoContas(1);
        if (res.sucesso) _crPlanoContasTodas = res.data || [];
    } catch (e) {
        console.warn('[Contas a Receber] Falha ao carregar plano de contas:', e);
    }
}

function _crRenderPlanoContaLista(termo) {
    const box = document.getElementById('crAutoPlanoConta');
    const t = (termo || '').toLowerCase().trim();
    const filtradas = !t
        ? _crPlanoContasTodas
        : _crPlanoContasTodas.filter(c =>
            c.subfator_nome.toLowerCase().includes(t) ||
            c.codigo.toLowerCase().includes(t) ||
            c.conta_nome.toLowerCase().includes(t));

    if (!filtradas.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhuma conta encontrada</div>'; return; }

    let grupoAtual = null;
    box.innerHTML = filtradas.map(c => {
        const chave = `${c.conta_codigo} — ${c.conta_nome}`;
        const header = chave !== grupoAtual ? `<div class="pl-auto-group">${_crEsc(chave)}</div>` : '';
        grupoAtual = chave;
        return `${header}<div class="pl-auto-item" onclick="crSelecionarPlanoConta('${c.id}', '${_crEscAttr(c.codigo)} — ${_crEscAttr(c.subfator_nome)}')">
            <span class="pl-auto-nome">${_crEsc(c.codigo)} — ${_crEsc(c.subfator_nome)}</span>
        </div>`;
    }).join('');
}

function crBuscarPlanoConta(termo) {
    document.getElementById('crPlanoContaId').value = '';
    _crRenderPlanoContaLista(termo);
}

function crMostrarPlanoConta(termo) {
    _crRenderPlanoContaLista(termo);
}

function crSelecionarPlanoConta(id, label) {
    document.getElementById('crPlanoContaId').value   = id;
    document.getElementById('crPlanoContaNome').value = label;
    document.getElementById('crAutoPlanoConta').innerHTML = '';
}

// ── Abertura pré-preenchida a partir de Pedido/Processo (módulos Comercial/Operacional) ──

async function _crVerificarGeracaoViaUrl() {
    const params      = new URLSearchParams(window.location.search);
    const pedidoId    = params.get('gerar_pedido_id');
    const processoId  = params.get('gerar_processo_id');
    if (!pedidoId && !processoId) return;

    if (pedidoId) {
        const { data: pedido } = await supabaseClient
            .from('pedidos')
            .select('id, numero, cliente_id, valor_total, moeda, parceiros(razao_social, nome_fantasia)')
            .eq('id', pedidoId).maybeSingle();
        if (pedido) {
            crAbrirModal(null, {
                descricao:   `Pedido ${pedido.numero || ''}`.trim(),
                clienteId:   pedido.cliente_id || null,
                clienteNome: pedido.parceiros?.nome_fantasia || pedido.parceiros?.razao_social || '',
                pedidoId:    pedido.id,
                pedidoNome:  pedido.numero || '',
                valor:       pedido.valor_total || '',
                moeda:       pedido.moeda || 'BRL',
            });
        }
    } else if (processoId) {
        const { data: processo } = await supabaseClient
            .from('processos')
            .select('id, numero_processo, valor_total, moeda')
            .eq('id', processoId).maybeSingle();
        if (processo) {
            // Parceiro não é pré-preenchido: processos usa empresas_cadastradas,
            // uma tabela diferente de parceiros (usada nas contas). O usuário
            // seleciona o cliente manualmente.
            crAbrirModal(null, {
                descricao:    `Processo ${processo.numero_processo || ''}`.trim(),
                processoId:   processo.id,
                processoNome: processo.numero_processo || '',
                valor:        processo.valor_total || '',
                moeda:        processo.moeda || 'BRL',
            });
        }
    }
}

function _crCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

async function crCarregar() {
    document.getElementById('crTbody').innerHTML =
        '<tr><td colspan="6" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    // Filtro de período (revisão de performance) — só reduz o que vem do
    // banco pra contas já recebidas/canceladas; pendente/vencida sempre vem.
    const diasAtras = Number(document.getElementById('filtroPeriodoContas')?.value) || null;
    const res = await buscarContasReceber({ diasAtras });
    if (!res.sucesso) {
        document.getElementById('crTbody').innerHTML =
            '<tr><td colspan="6"><div class="fin-vazio"><i class="fa-solid fa-triangle-exclamation"></i><p>Erro ao carregar contas</p></div></td></tr>';
        return;
    }
    _crTodas    = res.data || [];
    _crFiltradas = [..._crTodas];
    _crAtualizarVencidos();
    crRenderizar();
}

function _crAtualizarVencidos() {
    const hoje = new Date().toISOString().split('T')[0];
    _crTodas.forEach(c => {
        if (c.status === 'pendente' && c.data_vencimento < hoje) c.status = 'vencido';
    });
}

function crRenderizar() {
    const tbody = document.getElementById('crTbody');

    if (!_crFiltradas.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="fin-vazio">
            <i class="fa-solid fa-file-invoice-dollar"></i>
            <p>Nenhuma conta encontrada</p></div></td></tr>`;
        _crAtualizarResumo();
        return;
    }

    tbody.innerHTML = _crFiltradas.map(c => {
        const cliente = c.parceiros?.nome_fantasia || c.parceiros?.razao_social || '—';
        const valor   = _crFmtValor(c.valor, c.moeda);
        const venc    = c.data_vencimento
            ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
            : '—';

        const badgeMap = {
            pendente:  '<span class="fin-badge pendente"><i class="fa-solid fa-clock"></i> Pendente</span>',
            vencido:   '<span class="fin-badge vencido"><i class="fa-solid fa-circle-exclamation"></i> Vencido</span>',
            recebido:  '<span class="fin-badge recebido"><i class="fa-solid fa-circle-check"></i> Recebido</span>',
            cancelado: '<span class="fin-badge cancelado"><i class="fa-solid fa-ban"></i> Cancelado</span>',
        };

        const podeReceber = c.status === 'pendente' || c.status === 'vencido';

        return `<tr>
            <td><strong>${_crEsc(c.descricao)}</strong>${c.plano_contas?.subfator_nome ? `<br><span style="font-size:11px;color:#94a3b8">${_crEsc(c.plano_contas.conta_codigo)} — ${_crEsc(c.plano_contas.subfator_nome)}</span>` : (c.categoria ? `<br><span style="font-size:11px;color:#94a3b8">${_crEsc(c.categoria)}</span>` : '')}${c.pedidos?.numero ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-bag-shopping"></i> Pedido ${_crEsc(c.pedidos.numero)}</span>` : ''}${c.processos?.numero_processo ? `<br><span class="fin-badge-vinculo"><i class="fa-solid fa-diagram-project"></i> Processo ${_crEsc(c.processos.numero_processo)}</span>` : ''}</td>
            <td>${_crEsc(cliente)}</td>
            <td class="td-valor entrada">${valor}</td>
            <td>${venc}</td>
            <td>${badgeMap[c.status] || c.status}</td>
            <td>
                <div class="fin-acoes">
                    <button class="fin-btn-acao fin-btn-editar" onclick="crAbrirModal('${c.id}')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${podeReceber ? `<button class="fin-btn-acao fin-btn-pagar" onclick="crMarcarRecebido('${c.id}')" title="Marcar como recebido"><i class="fa-solid fa-circle-check"></i></button>` : ''}
                    <button class="fin-btn-acao fin-btn-excluir" onclick="crAbrirModalExcluir('${c.id}')" title="Excluir"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    _crAtualizarResumo();
}

function _crAtualizarResumo() {
    const hoje = new Date();
    const mes  = hoje.getMonth();
    const ano  = hoje.getFullYear();

    const pendente = _crTodas.filter(c => c.status === 'pendente').reduce((s, c) => s + Number(c.valor || 0), 0);
    const vencido  = _crTodas.filter(c => c.status === 'vencido').reduce((s, c) => s + Number(c.valor || 0), 0);
    const recebido = _crTodas.filter(c => {
        if (c.status !== 'recebido') return false;
        const d = c.data_recebimento ? new Date(c.data_recebimento) : null;
        return d && d.getMonth() === mes && d.getFullYear() === ano;
    }).reduce((s, c) => s + Number(c.valor || 0), 0);

    document.getElementById('totalPendente').textContent = _crFmtValor(pendente, 'BRL');
    document.getElementById('totalVencido').textContent  = _crFmtValor(vencido,  'BRL');
    document.getElementById('totalRecebido').textContent = _crFmtValor(recebido, 'BRL');
}

// Debounce (revisão de performance): filtra um array em memória, sem ir
// ao banco, mas a cada tecla reconstruía a tabela inteira via innerHTML —
// imperceptível com dezenas de linhas, mas engasga conforme a lista cresce.
let _crFiltrarTimer = null;
function crFiltrar() {
    clearTimeout(_crFiltrarTimer);
    _crFiltrarTimer = setTimeout(() => {
        const termo  = document.getElementById('filtroContas')?.value.toLowerCase().trim() || '';
        const status = document.getElementById('filtroStatus')?.value || '';
        _crFiltradas = _crTodas.filter(c => {
            const txt = [c.descricao, c.parceiros?.razao_social, c.parceiros?.nome_fantasia]
                .filter(Boolean).join(' ').toLowerCase();
            return (!termo || txt.includes(termo)) && (!status || c.status === status);
        });
        crRenderizar();
    }, 200);
}

// Marcar "Recebido" no select do modal sem preencher a Data de Recebimento
// deixava a conta fora do card "Recebido este mês" pra sempre (garantia
// equivalente também existe em salvarContaReceber, supabase-api.js — essa
// aqui só evita o usuário nem perceber que devia preencher a data).
function crAoMudarStatus() {
    const dataEl = document.getElementById('crDataRecebimento');
    if (document.getElementById('crStatus').value === 'recebido' && !dataEl.value) {
        dataEl.value = new Date().toISOString().slice(0, 10);
    }
}

async function crMarcarRecebido(id) {
    const c = _crTodas.find(x => x.id === id);
    if (!c) return;
    const hoje = new Date().toISOString().split('T')[0];
    c.status = 'recebido';
    c.data_recebimento = hoje;
    crRenderizar();
    await atualizarContaReceber(id, { status: 'recebido', data_recebimento: hoje });
}

function crAbrirModal(id = null, prefill = null) {
    const c = id ? _crTodas.find(x => x.id === id) : null;
    document.getElementById('crEditId').value = c?.id || '';
    document.getElementById('crModalTitulo').innerHTML = c
        ? '<i class="fa-solid fa-pen"></i> Editar Conta a Receber'
        : '<i class="fa-solid fa-arrow-down"></i> Nova Conta a Receber';
    document.getElementById('crDescricao').value = c?.descricao || prefill?.descricao || '';

    // Reseta o estado derivado antes de recalcular pra este registro — evita
    // herdar o travamento de Cliente/Processo de uma abertura anterior do modal.
    _crResetCamposDerivados();
    const pedidoId = c?.pedido_id || prefill?.pedidoId || '';
    document.getElementById('crPedidoNome').value = c?.pedidos?.numero || prefill?.pedidoNome || '';
    document.getElementById('crPedidoId').value   = pedidoId;

    if (pedidoId) {
        const processoSalvoId   = c?.processo_id || prefill?.processoId || '';
        const processoSalvoNome = c?.processos?.numero_processo || prefill?.processoNome || '';
        _crDerivarDoPedido(pedidoId).then(() => {
            // Garante que o processo já salvo apareça mesmo se não estiver mais
            // entre os processos atuais do pedido (ex: processo trocado depois).
            if (processoSalvoId) {
                document.getElementById('crProcessoId').value   = processoSalvoId;
                document.getElementById('crProcessoNome').value = processoSalvoNome || document.getElementById('crProcessoNome').value;
            }
        });
    } else {
        document.getElementById('crClienteNome').value = c?.parceiros?.nome_fantasia || c?.parceiros?.razao_social || prefill?.clienteNome || '';
        document.getElementById('crClienteId').value    = c?.parceiro_id || prefill?.clienteId || '';
    }

    document.getElementById('crValor').value           = (c?.valor ?? prefill?.valor) ? _crFormatarMonetario(c?.valor ?? prefill?.valor) : '';
    document.getElementById('crMoeda').value           = c?.moeda || prefill?.moeda || 'BRL';
    document.getElementById('crVencimento').value      = c?.data_vencimento || '';
    document.getElementById('crDataRecebimento').value = c?.data_recebimento || '';
    document.getElementById('crStatus').value          = c?.status || 'pendente';

    const planoConta = c?.plano_conta_id
        ? _crPlanoContasTodas.find(p => p.id === c.plano_conta_id)
        : null;
    document.getElementById('crPlanoContaId').value   = c?.plano_conta_id || '';
    document.getElementById('crPlanoContaNome').value = planoConta ? `${planoConta.codigo} — ${planoConta.subfator_nome}` : '';

    document.getElementById('crObservacoes').value     = c?.observacoes || '';
    const obsToggle = document.querySelector('#crModalOverlay .pl-obs-toggle');
    if (obsToggle) { obsToggle.classList.remove('aberto'); obsToggle.nextElementSibling.style.display = 'none'; }

    document.getElementById('crModalOverlay').classList.add('ativo');
}

function crFecharModal() {
    document.getElementById('crModalOverlay').classList.remove('ativo');
    document.getElementById('crAutoParceiro').innerHTML = '';
    document.getElementById('crAutoPedido').innerHTML   = '';
    document.getElementById('crAutoProcesso').innerHTML = '';
    document.getElementById('crAutoPlanoConta').innerHTML = '';
}

// ── Máscara monetária (Valor) — mesmo padrão de propMascaraMonetaria (proposta.js) ──

function crMascaraMonetaria(el) {
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

function _crValorMonetario(el) {
    if (!el) return 0;
    return parseFloat((el.value || '').replace(/\./g, '').replace(',', '.')) || 0;
}

function _crFormatarMonetario(num) {
    return Number(num || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function crSalvar() {
    if (!exigirEmpresaVinculada()) return;
    const descricao = document.getElementById('crDescricao').value.trim();
    const valor     = _crValorMonetario(document.getElementById('crValor'));
    const venc      = document.getElementById('crVencimento').value;
    if (!descricao || !valor || !venc) { alert('Preencha Descrição, Valor e Vencimento.'); return; }

    const btn = document.getElementById('crBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        descricao,
        parceiro_id:      document.getElementById('crClienteId').value || null,
        pedido_id:        document.getElementById('crPedidoId').value || null,
        processo_id:      document.getElementById('crProcessoId').value || null,
        valor,
        moeda:            document.getElementById('crMoeda').value,
        data_vencimento:  venc,
        data_recebimento: document.getElementById('crDataRecebimento').value || null,
        status:           document.getElementById('crStatus').value,
        plano_conta_id:   document.getElementById('crPlanoContaId').value || null,
        observacoes:      document.getElementById('crObservacoes').value.trim() || null,
    };

    const id  = document.getElementById('crEditId').value || null;
    const res = await salvarContaReceber(dados, id);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Salvar';
    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    crFecharModal();
    await crCarregar();
}

// Busca (oninput, digitando) e Mostra (onfocus, ao clicar no campo) — mesmo
// padrão de Remetente/Destinatário no Pipeline/Proposta: clicar no campo já
// lista até 15 clientes, sem precisar digitar nada primeiro.
let _crBuscaTimer = null;

// Guarda de corrida: o fetch do "mostrar tudo" (onfocus) e o fetch filtrado
// (oninput, debounced) podem responder fora de ordem — sem isso, a resposta
// mais lenta sobrescreve a caixa por último, mesmo sendo a mais antiga, e o
// usuário pode acabar clicando num item da lista errada (sem filtro nenhum).
let _crParceiroReqToken = 0;

async function _crListarParceiros(termo) {
    const box = document.getElementById('crAutoParceiro');
    const meuToken = ++_crParceiroReqToken;
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
        if (meuToken !== _crParceiroReqToken) return; // resposta antiga, descarta
        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum cliente encontrado — cadastre em Empresas primeiro</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="crSelecionarParceiro(${p.id}, '${_crEsc(p.nome_fantasia || p.razao_social)}')">
                <span class="pl-auto-nome">${_crEsc(p.nome_fantasia || p.razao_social)}</span>
                ${p.nome_fantasia ? `<span class="pl-auto-razao">${_crEsc(p.razao_social)}</span>` : ''}
            </div>`).join('');
    } catch (e) {}
}

function crBuscarParceiro(termo) {
    document.getElementById('crClienteId').value = '';
    clearTimeout(_crBuscaTimer);
    _crBuscaTimer = setTimeout(() => _crListarParceiros(termo?.length >= 2 ? termo : ''), 300);
}

function crMostrarParceiro(termo) {
    _crListarParceiros(termo?.length >= 2 ? termo : '');
}

function crSelecionarParceiro(id, nome) {
    document.getElementById('crClienteId').value   = id;
    document.getElementById('crClienteNome').value = nome;
    document.getElementById('crAutoParceiro').innerHTML = '';
}

// ── Autocomplete vínculo — Pedido ────────────────────────────────────────────

let _crBuscaPedidoTimer = null;
let _crPedidoReqToken = 0; // mesma guarda de corrida do _crListarParceiros acima

async function _crListarPedidos(termo) {
    const box = document.getElementById('crAutoPedido');
    const meuToken = ++_crPedidoReqToken;
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('pedidos')
            .select('id, numero')
            .limit(termo ? 8 : 15);
        if (termo) query = query.ilike('numero', `%${termo}%`);
        else query = query.order('numero', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        const { data } = await query;
        if (meuToken !== _crPedidoReqToken) return; // resposta antiga, descarta
        if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum pedido encontrado</div>'; return; }
        box.innerHTML = data.map(p => `
            <div class="pl-auto-item" onclick="crSelecionarPedido('${p.id}', '${_crEsc(p.numero || '')}')">
                <span class="pl-auto-nome">${_crEsc(p.numero || '')}</span>
            </div>`).join('');
    } catch (e) {}
}

function crBuscarPedido(termo) {
    document.getElementById('crPedidoId').value = '';
    if (!termo) _crResetCamposDerivados();
    clearTimeout(_crBuscaPedidoTimer);
    _crBuscaPedidoTimer = setTimeout(() => _crListarPedidos(termo?.length >= 2 ? termo : ''), 300);
}

function crMostrarPedido(termo) {
    _crListarPedidos(termo?.length >= 2 ? termo : '');
}

async function crSelecionarPedido(id, numero) {
    document.getElementById('crPedidoId').value   = id;
    document.getElementById('crPedidoNome').value = numero;
    document.getElementById('crAutoPedido').innerHTML = '';
    await _crDerivarDoPedido(id);
}

// ── Derivação Cliente/Valor/Processo a partir do Pedido escolhido ──────────
// Pedido é o campo-âncora (opcional): sem ele, Cliente fica livre pra buscar
// e Processo fica desabilitado. Ao escolher um Pedido, o Cliente é travado
// (nome/razão social vem do próprio pedido — evita vincular a um parceiro
// que não bate com o pedido). Valor/Moeda vêm do valor_total do pedido só
// como sugestão (editável — uma conta pode ser só uma parcela/taxa dele, não
// o valor cheio). Já o Processo é restrito só aos processos deste pedido:
// 0 → trava vazio, 1 → preenche sozinho e trava, >1 → usuário escolhe entre
// eles. Mesmo padrão 0/1/vários usado em pedGerarProcesso (pedidos.js).
let _crPedidoProcessos = [];

function _crResetCamposDerivados() {
    const clienteInput  = document.getElementById('crClienteNome');
    const processoInput = document.getElementById('crProcessoNome');
    clienteInput.readOnly = false;
    document.getElementById('crClienteId').value = '';
    clienteInput.value = '';
    processoInput.disabled = true;
    processoInput.placeholder = 'Escolha um Pedido primeiro';
    processoInput.value = '';
    document.getElementById('crProcessoId').value = '';
    document.getElementById('crAutoProcesso').innerHTML = '';
    _crPedidoProcessos = [];
}

async function _crDerivarDoPedido(pedidoId) {
    const clienteInput  = document.getElementById('crClienteNome');
    const processoInput = document.getElementById('crProcessoNome');

    document.getElementById('crAutoParceiro').innerHTML = '';
    document.getElementById('crProcessoId').value = '';
    processoInput.value = '';
    _crPedidoProcessos = [];

    try {
        const usuario = obterUsuarioLogado();

        const { data: pedido } = await supabaseClient
            .from('pedidos')
            .select('cliente_id, valor_total, moeda, parceiros!pedidos_cliente_id_fkey(razao_social, nome_fantasia)')
            .eq('id', pedidoId)
            .single();

        document.getElementById('crClienteId').value = pedido?.cliente_id || '';
        clienteInput.value = pedido?.parceiros?.nome_fantasia || pedido?.parceiros?.razao_social || '';
        clienteInput.readOnly = true;

        // Sugere Valor/Moeda do pedido — só se o campo ainda estiver vazio, pra
        // não sobrescrever um valor já digitado ou o de uma conta já salva
        // (crAbrirModal preenche o valor salvo antes de chamar esta função).
        const valorInput = document.getElementById('crValor');
        if (!valorInput.value.trim() && pedido?.valor_total) {
            valorInput.value = _crFormatarMonetario(pedido.valor_total);
            if (pedido.moeda) document.getElementById('crMoeda').value = pedido.moeda;
        }

        let query = supabaseClient
            .from('processos')
            .select('id, numero_processo')
            .eq('pedido_id', pedidoId)
            .order('numero_processo', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_proprietaria_id', usuario.empresa_id);
        const { data: processos } = await query;
        _crPedidoProcessos = processos || [];

        if (_crPedidoProcessos.length === 0) {
            processoInput.disabled = true;
            processoInput.placeholder = 'Nenhum processo vinculado a este pedido';
        } else if (_crPedidoProcessos.length === 1) {
            document.getElementById('crProcessoId').value = _crPedidoProcessos[0].id;
            processoInput.value = _crPedidoProcessos[0].numero_processo || '';
            processoInput.disabled = true;
        } else {
            processoInput.disabled = false;
            processoInput.placeholder = 'Selecione um dos processos deste pedido...';
        }
    } catch (e) {}
}

// ── Autocomplete vínculo — Processo (restrito ao Pedido escolhido) ─────────

function _crRenderizarProcessos(termo) {
    const box = document.getElementById('crAutoProcesso');
    const lista = termo
        ? _crPedidoProcessos.filter(p => (p.numero_processo || '').toLowerCase().includes(termo.toLowerCase()))
        : _crPedidoProcessos;
    if (!lista.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum processo vinculado a este pedido</div>'; return; }
    box.innerHTML = lista.map(p => `
        <div class="pl-auto-item" onclick="crSelecionarProcesso('${p.id}', '${_crEsc(p.numero_processo || '')}')">
            <span class="pl-auto-nome">${_crEsc(p.numero_processo || '')}</span>
        </div>`).join('');
}

function crBuscarProcesso(termo) {
    document.getElementById('crProcessoId').value = '';
    _crRenderizarProcessos(termo);
}

function crMostrarProcesso(termo) {
    _crRenderizarProcessos(termo);
}

function crSelecionarProcesso(id, numero) {
    document.getElementById('crProcessoId').value   = id;
    document.getElementById('crProcessoNome').value = numero;
    document.getElementById('crAutoProcesso').innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#crAutoParceiro') && !e.target.closest('#crClienteNome')) {
        const box = document.getElementById('crAutoParceiro');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#crAutoPedido') && !e.target.closest('#crPedidoNome')) {
        const box = document.getElementById('crAutoPedido');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#crAutoProcesso') && !e.target.closest('#crProcessoNome')) {
        const box = document.getElementById('crAutoProcesso');
        if (box) box.innerHTML = '';
    }
    if (!e.target.closest('#crAutoPlanoConta') && !e.target.closest('#crPlanoContaNome')) {
        const box = document.getElementById('crAutoPlanoConta');
        if (box) box.innerHTML = '';
    }
});

function crAbrirModalExcluir(id) {
    _crExcluirId = id;
    const c = _crTodas.find(x => x.id === id);
    document.getElementById('crExcluirNome').textContent = c?.descricao || '';
    document.getElementById('crModalExcluirOverlay').classList.add('ativo');
}

function crFecharModalExcluir() {
    _crExcluirId = null;
    document.getElementById('crModalExcluirOverlay').classList.remove('ativo');
}

async function crConfirmarExcluir() {
    if (!_crExcluirId) return;
    const btn = document.getElementById('crBtnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    const res = await excluirContaReceber(_crExcluirId);
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';
    if (!res.sucesso) { alert('Erro: ' + res.mensagem); return; }
    crFecharModalExcluir();
    await crCarregar();
}

function _crFmtValor(v, moeda = 'BRL') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, minimumFractionDigits: 2 }).format(Number(v) || 0);
}

function _crEsc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Pra uso como argumento de string dentro de onclick="fn('...')" — além do
// escape de HTML acima, escapa barra invertida e aspas simples pra não
// quebrar o literal JS de aspas simples embutido no atributo.
function _crEscAttr(str) {
    return _crEsc(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// Sair sempre encerra a sessão de vez, mesmo com "Lembrar-me" ativo (login
// automático não deve sobreviver a um logout explícito). cpfSalvo é mantido
// de propósito, só pra não precisar redigitar o CPF na próxima vez.
function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    localStorage.removeItem('rememberMe');
    localStorage.removeItem('usuarioSalvo');
    localStorage.removeItem('lastLogin');
    window.location.href = 'login.html';
}
