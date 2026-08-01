// ========================================
// RELATÓRIOS FINANCEIROS
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    _rfCarregarUsuario();
    const hoje = new Date();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    const ym   = `${hoje.getFullYear()}-${mes}`;
    document.getElementById('rfInicio').value = ym;
    document.getElementById('rfFim').value    = ym;
    rfCarregar();
});

function _rfCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

async function rfCarregar() {
    const inicio = document.getElementById('rfInicio').value;
    const fim    = document.getElementById('rfFim').value;
    if (!inicio || !fim) return;

    const dataInicio = inicio + '-01';
    const [fAno, fMes] = fim.split('-');
    const dataFim = new Date(parseInt(fAno), parseInt(fMes), 0).toISOString().split('T')[0];

    const [resPagar, resReceber] = await Promise.all([
        buscarContasPagarPeriodo(dataInicio, dataFim),
        buscarContasReceberPeriodo(dataInicio, dataFim),
    ]);

    const pagar    = resPagar.data    || [];
    const receber  = resReceber.data  || [];

    // KPIs
    const receita  = receber.filter(c => c.status === 'recebido').reduce((s, c) => s + Number(c.valor || 0), 0);
    const despesas = pagar.filter(c => c.status === 'pago').reduce((s, c) => s + Number(c.valor || 0), 0);
    const resultado = receita - despesas;
    const margem   = receita > 0 ? ((resultado / receita) * 100).toFixed(1) : 0;

    const elRes = document.getElementById('rfResultado');
    document.getElementById('rfReceita').textContent   = _rfFmt(receita);
    document.getElementById('rfDespesas').textContent  = _rfFmt(despesas);
    elRes.textContent  = _rfFmt(resultado);
    elRes.style.color  = resultado >= 0 ? '#22c55e' : '#ef4444';
    const elMargem = document.getElementById('rfMargem');
    elMargem.textContent = `${margem}%`;
    elMargem.style.color = Number(margem) >= 0 ? '#22c55e' : '#ef4444';

    // Tabela Receber por status
    const statusesR = ['pendente','vencido','recebido','cancelado'];
    document.getElementById('rfTbodyReceber').innerHTML = statusesR.map(s => {
        const itens = receber.filter(c => c.status === s);
        const total = itens.reduce((sum, c) => sum + Number(c.valor || 0), 0);
        if (!itens.length) return '';
        return `<tr>
            <td>${_rfBadge(s)}</td>
            <td>${itens.length}</td>
            <td class="td-valor entrada">${_rfFmt(total)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px">Sem dados</td></tr>';

    // Tabela Pagar por status
    const statusesP = ['pendente','vencido','pago','cancelado'];
    document.getElementById('rfTbodyPagar').innerHTML = statusesP.map(s => {
        const itens = pagar.filter(c => c.status === s);
        const total = itens.reduce((sum, c) => sum + Number(c.valor || 0), 0);
        if (!itens.length) return '';
        return `<tr>
            <td>${_rfBadge(s)}</td>
            <td>${itens.length}</td>
            <td class="td-valor saida">${_rfFmt(total)}</td>
        </tr>`;
    }).join('') || '<tr><td colspan="3" style="text-align:center;color:#94a3b8;padding:20px">Sem dados</td></tr>';

    // Top 10 maiores despesas
    const top10 = [...pagar]
        .filter(c => c.status !== 'cancelado')
        .sort((a, b) => Number(b.valor) - Number(a.valor))
        .slice(0, 10);

    document.getElementById('rfTbodyTop').innerHTML = top10.length
        ? top10.map(c => {
            const venc = c.data_vencimento
                ? new Date(c.data_vencimento + 'T00:00:00').toLocaleDateString('pt-BR')
                : '—';
            return `<tr>
                <td><strong>${_rfEsc(c.descricao)}</strong></td>
                <td><span style="font-size:11px;color:#94a3b8">${_rfEsc(c.categoria || '—')}</span></td>
                <td>${venc}</td>
                <td class="td-valor saida">${_rfFmt(c.valor)}</td>
            </tr>`;
        }).join('')
        : '<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:20px">Sem despesas no período</td></tr>';
}

function _rfBadge(s) {
    const map = {
        pendente:  '<span class="fin-badge pendente">Pendente</span>',
        vencido:   '<span class="fin-badge vencido">Vencido</span>',
        pago:      '<span class="fin-badge pago">Pago</span>',
        recebido:  '<span class="fin-badge recebido">Recebido</span>',
        cancelado: '<span class="fin-badge cancelado">Cancelado</span>',
    };
    return map[s] || s;
}

function _rfFmt(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Number(v) || 0);
}

function _rfEsc(str) {
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
