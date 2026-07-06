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
            data:      c.data_recebimento || c.data_vencimento,
            descricao: c.descricao,
            tipo:      'entrada',
            valor:     Number(c.valor || 0),
        }));

    const saidas = (resPagar.data || [])
        .filter(c => c.status === 'pago')
        .map(c => ({
            data:      c.data_pagamento || c.data_vencimento,
            descricao: c.descricao,
            tipo:      'saida',
            valor:     Number(c.valor || 0),
        }));

    const movs = [...entradas, ...saidas].sort((a, b) => a.data.localeCompare(b.data));

    fcRenderizar(movs);
}

function fcRenderizar(movs) {
    const tbody = document.getElementById('fcTbody');

    if (!movs.length) {
        tbody.innerHTML = `<tr><td colspan="5"><div class="fin-vazio">
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

        return `<tr>
            <td style="white-space:nowrap">${dataFmt}</td>
            <td>${_fcEsc(m.descricao)}</td>
            <td>
                ${m.tipo === 'entrada'
                    ? '<span class="fin-badge entrada"><i class="fa-solid fa-arrow-down"></i> Entrada</span>'
                    : '<span class="fin-badge saida"><i class="fa-solid fa-arrow-up"></i> Saída</span>'}
            </td>
            <td class="td-valor ${corValor}">${sinalValor} ${_fcFmtValor(m.valor)}</td>
            <td class="td-valor" style="color:${corSaldo}">${_fcFmtValor(saldoAcum)}</td>
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

function handleLogout() {
    sessionStorage.removeItem('usuarioLogado');
    window.location.href = 'index.html';
}
