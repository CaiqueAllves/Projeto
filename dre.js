// ========================================
// DRE / BALANCETE
// ========================================

document.addEventListener('DOMContentLoaded', () => {
    _dreCarregarUsuario();
    const hoje = new Date();
    const mes  = String(hoje.getMonth() + 1).padStart(2, '0');
    const ym   = `${hoje.getFullYear()}-${mes}`;
    document.getElementById('dreInicio').value = `${hoje.getFullYear()}-01`;
    document.getElementById('dreFim').value    = ym;
    dreCarregar();
});

function _dreCarregarUsuario() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        const el = document.getElementById('displayUsername');
        const em = document.getElementById('userEmail');
        if (el) el.textContent = u.nome  || '—';
        if (em) em.textContent = u.email || '—';
    } catch (e) {}
}

async function dreCarregar() {
    const inicio = document.getElementById('dreInicio').value;
    const fim    = document.getElementById('dreFim').value;
    if (!inicio || !fim) return;

    document.getElementById('dreTbody').innerHTML =
        '<tr><td colspan="2" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    const dataInicio = inicio + '-01';
    const [fAno, fMes] = fim.split('-');
    const dataFim = new Date(parseInt(fAno), parseInt(fMes), 0).toISOString().split('T')[0];

    const [resPagar, resReceber] = await Promise.all([
        buscarContasPagarPeriodo(dataInicio, dataFim),
        buscarContasReceberPeriodo(dataInicio, dataFim),
    ]);

    const pagar   = resPagar.data   || [];
    const receber = resReceber.data || [];

    // Receitas
    const receitaBruta = receber
        .filter(c => c.status === 'recebido')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const receitaPendente = receber
        .filter(c => c.status === 'pendente' || c.status === 'vencido')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    // Receitas por Conta (Plano de Contas — Bloco 1, ver
    // database/database-plano-contas-receitas.sql). Lançamentos antigos,
    // sem plano_conta_id vinculado, caem em "Não classificado".
    const receitasPorConta = {};
    receber.filter(c => c.status === 'recebido').forEach(c => {
        const chave = c.plano_contas
            ? `${c.plano_contas.conta_codigo} — ${c.plano_contas.conta_nome}`
            : 'Não classificado';
        receitasPorConta[chave] = (receitasPorConta[chave] || 0) + Number(c.valor || 0);
    });

    // Despesas por categoria
    const cats = {};
    pagar.filter(c => c.status === 'pago').forEach(c => {
        const cat = c.categoria || 'outro';
        cats[cat] = (cats[cat] || 0) + Number(c.valor || 0);
    });

    const despesaTotal = Object.values(cats).reduce((s, v) => s + v, 0);

    const catLabels = {
        frete:       'Fretes e Logística',
        imposto:     'Impostos e Taxas',
        fornecedor:  'Fornecedores',
        operacional: 'Despesas Operacionais',
        outro:       'Outras Despesas',
    };

    const resultadoBruto  = receitaBruta - despesaTotal;
    const margemBruta     = receitaBruta > 0 ? (resultadoBruto / receitaBruta * 100) : 0;

    const periodo = `${_dreFmtPeriodo(inicio)} a ${_dreFmtPeriodo(fim)}`;

    const linhas = [];

    // Cabeçalho
    linhas.push(`<tr><td colspan="2" style="padding:14px 20px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;">
        Demonstração do Resultado — ${periodo}
    </td></tr>`);

    // RECEITAS
    linhas.push(_dreSecao('RECEITAS'));
    Object.entries(receitasPorConta).forEach(([conta, val]) => {
        linhas.push(_dreLinhaIndent(conta, val, 'verde'));
    });
    if (!Object.keys(receitasPorConta).length) {
        linhas.push(`<tr class="dre-indentado"><td style="color:#94a3b8;font-style:italic">Nenhuma receita recebida no período</td><td></td></tr>`);
    }
    linhas.push(_dreLinha('Receita Bruta (recebida)', receitaBruta, 'verde'));
    linhas.push(_dreLinhaIndent('Contas a Receber (pendente)', receitaPendente));
    linhas.push(_dreTotal('(=) RECEITA LÍQUIDA', receitaBruta));

    // DESPESAS
    linhas.push(_dreSecao('DESPESAS'));
    Object.entries(cats).forEach(([cat, val]) => {
        linhas.push(_dreLinhaIndent(`(-) ${catLabels[cat] || cat}`, val, 'vermelho'));
    });
    if (!Object.keys(cats).length) {
        linhas.push(`<tr class="dre-indentado"><td style="color:#94a3b8;font-style:italic">Nenhuma despesa paga no período</td><td></td></tr>`);
    }
    linhas.push(_dreTotal('(=) TOTAL DESPESAS', despesaTotal, 'vermelho'));

    // RESULTADO
    linhas.push(_dreResultado(resultadoBruto, margemBruta));

    document.getElementById('dreTbody').innerHTML = linhas.join('');
}

function _dreSecao(label) {
    return `<tr class="dre-secao"><td colspan="2">${label}</td></tr>`;
}

function _dreLinha(label, valor, cor = '') {
    const corClass = cor === 'verde' ? 'style="color:#22c55e"' : cor === 'vermelho' ? 'style="color:#ef4444"' : '';
    return `<tr><td>${label}</td><td ${corClass}>${_dreFmt(valor)}</td></tr>`;
}

function _dreLinhaIndent(label, valor, cor = '') {
    const corClass = cor === 'vermelho' ? 'style="color:#ef4444"' : cor === 'verde' ? 'style="color:#22c55e"' : '';
    return `<tr class="dre-indentado"><td>${label}</td><td ${corClass}>${_dreFmt(valor)}</td></tr>`;
}

function _dreTotal(label, valor, cor = '') {
    const corClass = cor === 'vermelho' ? 'style="color:#ef4444"' : '';
    return `<tr class="dre-total"><td>${label}</td><td ${corClass}>${_dreFmt(valor)}</td></tr>`;
}

function _dreResultado(valor, margem) {
    const isPos    = valor >= 0;
    const label    = isPos ? 'LUCRO LÍQUIDO DO PERÍODO' : 'PREJUÍZO DO PERÍODO';
    const classTr  = isPos ? 'dre-resultado' : 'dre-resultado negativo';
    const margemTx = isPos ? `(margem ${margem.toFixed(1)}%)` : `(margem ${margem.toFixed(1)}%)`;
    return `<tr class="${classTr}">
        <td>${label} <span style="font-size:12px;font-weight:500;opacity:.7">${margemTx}</span></td>
        <td>${_dreFmt(Math.abs(valor))}</td>
    </tr>`;
}

function _dreFmt(v) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Number(v) || 0);
}

function _dreFmtPeriodo(ym) {
    const [ano, mes] = ym.split('-');
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
    return `${meses[parseInt(mes) - 1]}/${ano}`;
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
