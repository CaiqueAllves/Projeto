// ========================================
// CONTAS A RECEBER
// ========================================

let _crTodas    = [];
let _crFiltradas = [];
let _crExcluirId = null;

document.addEventListener('DOMContentLoaded', async () => {
    _crCarregarUsuario();
    await crCarregar();
});

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

    const res = await buscarContasReceber();
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
            <td><strong>${_crEsc(c.descricao)}</strong>${c.categoria ? `<br><span style="font-size:11px;color:#94a3b8">${_crEsc(c.categoria)}</span>` : ''}</td>
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

function crFiltrar() {
    const termo  = document.getElementById('filtroContas')?.value.toLowerCase().trim() || '';
    const status = document.getElementById('filtroStatus')?.value || '';
    _crFiltradas = _crTodas.filter(c => {
        const txt = [c.descricao, c.parceiros?.razao_social, c.parceiros?.nome_fantasia]
            .filter(Boolean).join(' ').toLowerCase();
        return (!termo || txt.includes(termo)) && (!status || c.status === status);
    });
    crRenderizar();
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

function crAbrirModal(id = null) {
    const c = id ? _crTodas.find(x => x.id === id) : null;
    document.getElementById('crEditId').value = c?.id || '';
    document.getElementById('crModalTitulo').innerHTML = c
        ? '<i class="fa-solid fa-pen"></i> Editar Conta a Receber'
        : '<i class="fa-solid fa-arrow-down"></i> Nova Conta a Receber';
    document.getElementById('crDescricao').value       = c?.descricao || '';
    document.getElementById('crClienteNome').value     = c?.parceiros?.nome_fantasia || c?.parceiros?.razao_social || '';
    document.getElementById('crClienteId').value       = c?.parceiro_id || '';
    document.getElementById('crValor').value           = c?.valor || '';
    document.getElementById('crMoeda').value           = c?.moeda || 'BRL';
    document.getElementById('crVencimento').value      = c?.data_vencimento || '';
    document.getElementById('crDataRecebimento').value = c?.data_recebimento || '';
    document.getElementById('crStatus').value          = c?.status || 'pendente';
    document.getElementById('crCategoria').value       = c?.categoria || '';
    document.getElementById('crObservacoes').value     = c?.observacoes || '';
    document.getElementById('crModalOverlay').classList.add('ativo');
}

function crFecharModal() {
    document.getElementById('crModalOverlay').classList.remove('ativo');
    document.getElementById('crAutoParceiro').innerHTML = '';
}

async function crSalvar() {
    const descricao = document.getElementById('crDescricao').value.trim();
    const valor     = document.getElementById('crValor').value;
    const venc      = document.getElementById('crVencimento').value;
    if (!descricao || !valor || !venc) { alert('Preencha Descrição, Valor e Vencimento.'); return; }

    const btn = document.getElementById('crBtnSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Salvando...';

    const dados = {
        descricao,
        parceiro_id:      document.getElementById('crClienteId').value || null,
        valor:            parseFloat(valor),
        moeda:            document.getElementById('crMoeda').value,
        data_vencimento:  venc,
        data_recebimento: document.getElementById('crDataRecebimento').value || null,
        status:           document.getElementById('crStatus').value,
        categoria:        document.getElementById('crCategoria').value || null,
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

let _crBuscaTimer = null;
async function crBuscarParceiro(termo) {
    const box = document.getElementById('crAutoParceiro');
    document.getElementById('crClienteId').value = '';
    if (!termo || termo.length < 2) { box.innerHTML = ''; return; }
    clearTimeout(_crBuscaTimer);
    _crBuscaTimer = setTimeout(async () => {
        try {
            const { data } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social, nome_fantasia')
                .or(`razao_social.ilike.%${termo}%,nome_fantasia.ilike.%${termo}%`)
                .limit(8);
            if (!data?.length) { box.innerHTML = '<div class="pl-auto-vazio">Nenhum cliente encontrado</div>'; return; }
            box.innerHTML = data.map(p => `
                <div class="pl-auto-item" onclick="crSelecionarParceiro(${p.id}, '${_crEsc(p.nome_fantasia || p.razao_social)}')">
                    <span class="pl-auto-nome">${_crEsc(p.nome_fantasia || p.razao_social)}</span>
                    ${p.nome_fantasia ? `<span class="pl-auto-razao">${_crEsc(p.razao_social)}</span>` : ''}
                </div>`).join('');
        } catch (e) {}
    }, 300);
}

function crSelecionarParceiro(id, nome) {
    document.getElementById('crClienteId').value   = id;
    document.getElementById('crClienteNome').value = nome;
    document.getElementById('crAutoParceiro').innerHTML = '';
}

document.addEventListener('click', e => {
    if (!e.target.closest('#crAutoParceiro') && !e.target.closest('#crClienteNome')) {
        const box = document.getElementById('crAutoParceiro');
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

function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}
