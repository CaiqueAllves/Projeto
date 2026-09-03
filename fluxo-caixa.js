// ========================================
// FLUXO DE CAIXA
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    _fcCarregarUsuario();
    // Período padrão: mês atual
    const hoje = new Date();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    document.getElementById('fcPeriodo').value = `${hoje.getFullYear()}-${mes}`;
    fcCarregar();
});

function _fcCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

async function fcCarregar() {
    const periodo = document.getElementById('fcPeriodo').value;
    if (!periodo) return;

    document.getElementById('fcTbody').innerHTML =
        '<tr><td colspan="5" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    const [ano, mes] = periodo.split('-');
    const inicio = `${ano}-${mes}-01`;
    const fim    = new Date(parseInt(ano), parseInt(mes), 0).toISOString().split('T')[0];

    const [resPagar, resReceber] = await Promise.all([
        buscarContasPagarPeriodo(inicio, fim),
        buscarContasReceberPeriodo(inicio, fim),
    ]);

    const entradas = (resReceber.data || [])
        .filter(c => c.status === 'recebido')
        .map(c => ({
            id:          c.id,
            tipoConta:   'receber',
            pedidoId:    c.pedido_id || null,
            data:        c.data_recebimento || c.data_vencimento,
            descricao:   c.descricao,
            tipo:        'entrada',
            valor:       Number(c.valor || 0),
            // Entrada = dinheiro vindo do parceiro pra cá — ele é o Remetente.
            parceiro:    c.parceiros?.nome_fantasia || c.parceiros?.razao_social || null,
            criadoPorId: c.criado_por || null,
        }));

    const saidas = (resPagar.data || [])
        .filter(c => c.status === 'pago')
        .map(c => ({
            id:          c.id,
            tipoConta:   'pagar',
            pedidoId:    c.pedido_id || null,
            data:        c.data_pagamento || c.data_vencimento,
            descricao:   c.descricao,
            tipo:        'saida',
            valor:       Number(c.valor || 0),
            // Saída = dinheiro indo daqui pro parceiro — ele é o Destinatário.
            parceiro:    c.parceiros?.nome_fantasia || c.parceiros?.razao_social || null,
            criadoPorId: c.criado_por || null,
        }));

    const movs = [...entradas, ...saidas].sort((a, b) => a.data.localeCompare(b.data));

    // Responsável (criado_por) é só o UUID do usuário — sem FK declarada na
    // tabela, então o PostgREST não embeda o nome automaticamente. Busca em
    // lote (1 query só) e resolve na mão, mesmo padrão já usado em
    // processos.js/proforma.js pra resolver nomes de empresa em lote.
    const idsUsuarios = [...new Set(movs.map(m => m.criadoPorId).filter(Boolean))];
    let mapaResponsaveis = {};
    if (idsUsuarios.length > 0) {
        const { data: usuariosData } = await supabaseClient
            .from('usuarios')
            .select('id, nome_completo')
            .in('id', idsUsuarios);
        (usuariosData || []).forEach(u => { mapaResponsaveis[u.id] = u.nome_completo; });
    }
    movs.forEach(m => { m.responsavel = m.criadoPorId ? (mapaResponsaveis[m.criadoPorId] || '—') : '—'; });

    fcRenderizar(movs);
}

function fcRenderizar(movs) {
    const tbody = document.getElementById('fcTbody');

    if (!movs.length) {
        tbody.innerHTML = `<tr><td colspan="8"><div class="fin-vazio">
            <i class="fa-solid fa-arrow-right-arrow-left"></i>
            <p>Nenhuma movimentação no período</p></div></td></tr>`;
        _fcAtualizarResumo(0, 0);
        return;
    }

    let totalEntradas = 0;
    let totalSaidas   = 0;
    let saldoAcum     = 0;

    tbody.innerHTML = movs.map(m => {
        const dataFmt = new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR');
        if (m.tipo === 'entrada') { totalEntradas += m.valor; saldoAcum += m.valor; }
        else                      { totalSaidas   += m.valor; saldoAcum -= m.valor; }

        const corValor = m.tipo === 'entrada' ? 'entrada' : 'saida';
        const sinalValor = m.tipo === 'entrada' ? '+' : '-';
        const corSaldo = saldoAcum >= 0 ? '#22c55e' : '#ef4444';
        const paginaConta = m.tipoConta === 'receber' ? 'contas-receber.html' : 'contas-pagar.html';

        return `<tr>
            <td style="white-space:nowrap">${dataFmt}</td>
            <td>${_fcEsc(m.descricao)}</td>
            <td>
                ${m.tipo === 'entrada'
                    ? '<span class="fin-badge entrada"><i class="fa-solid fa-arrow-down"></i> Entrada</span>'
                    : '<span class="fin-badge saida"><i class="fa-solid fa-arrow-up"></i> Saída</span>'}
            </td>
            <td>${_fcEsc(m.responsavel)}</td>
            <td>${m.parceiro
                ? `<span class="fc-parceiro-tag"><i class="fa-solid fa-building"></i> ${_fcEsc(m.parceiro)}</span>`
                : '—'}</td>
            <td class="td-valor ${corValor}">${sinalValor} ${_fcFmtValor(m.valor)}</td>
            <td class="td-valor" style="color:${corSaldo}">${_fcFmtValor(saldoAcum)}</td>
            <td>
                <div class="fin-acoes">
                    <button class="fin-btn-acao fin-btn-editar" onclick="window.open('${paginaConta}?editar=${m.id}', '_blank')" title="Editar"><i class="fa-solid fa-pen"></i></button>
                    ${m.pedidoId
                        ? `<button class="fin-btn-acao fin-btn-editar" onclick="window.open('pedidos.html?editar=${m.pedidoId}', '_blank')" title="Ver Pedido"><i class="fa-solid fa-eye"></i></button>`
                        : `<button class="fin-btn-acao" disabled title="Sem Pedido vinculado" style="opacity:.4;cursor:not-allowed;"><i class="fa-solid fa-eye"></i></button>`}
                </div>
            </td>
        </tr>`;
    }).join('');

    _fcAtualizarResumo(totalEntradas, totalSaidas);
}

function _fcAtualizarResumo(entradas, saidas) {
    const saldo = entradas - saidas;
    const elSaldo = document.getElementById('fcSaldo');
    document.getElementById('fcTotalEntradas').textContent = _fcFmtValor(entradas);
    document.getElementById('fcTotalSaidas').textContent   = _fcFmtValor(saidas);
    elSaldo.textContent  = _fcFmtValor(saldo);
    elSaldo.style.color  = saldo >= 0 ? '#22c55e' : '#ef4444';
}

function _fcFmtValor(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(v);
}

function _fcEsc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
