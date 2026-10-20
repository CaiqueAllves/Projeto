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

    // Estrutura do Bloco 7 do Plano de Contas (PDF "MARPEX - PLANO DE CONTAS"):
    //   Receita Bruta (Bloco 1) − Deduções (1.90) = Receita Líquida
    //   − Custo Direto (Bloco 2)      = Margem Bruta
    //   − Custo Comercial (Bloco 3)   = Margem Comercial
    //   − Custo Operacional (Bloco 4) = Margem Operacional
    //   ± Resultado Financeiro/Cambial (Bloco 5: ganhos − custos)
    //   − Outras despesas (sem conta do plano, pela categoria antiga)
    //   = Resultado do período (Bloco 6 / tributário entra depois)
    // Margens em % da Receita Líquida. Subfatores "(-)" (descontos/devoluções
    // de compra) reduzem o custo. Lançamentos antigos sem conta: receitas em
    // "Não classificado", despesas pela categoria.
    const somar = (obj, chave, v) => { obj[chave] = (obj[chave] || 0) + v; };
    const total = o => Object.values(o).reduce((s, v) => s + v, 0);
    const chaveConta = pc => `${pc.conta_codigo} — ${pc.conta_nome}`;

    const receitas = {}, deducoes = {}, ganhosFin = {};
    receber.filter(c => c.status === 'recebido').forEach(c => {
        const v = Number(c.valor || 0), pc = c.plano_contas;
        if (!pc) return somar(receitas, 'Não classificado', v);
        if (Number(pc.bloco) === 5) return somar(ganhosFin, chaveConta(pc), v);
        if (String(pc.conta_codigo).startsWith('1.90')) return somar(deducoes, chaveConta(pc), v);
        somar(receitas, chaveConta(pc), v);
    });

    const custos = { 2: {}, 3: {}, 4: {} }, custosFin = {}, cats = {};
    pagar.filter(c => c.status === 'pago').forEach(c => {
        const v = Number(c.valor || 0), pc = c.plano_contas, b = Number(pc?.bloco);
        if (!pc || ![2, 3, 4, 5].includes(b)) return somar(cats, c.categoria || 'outro', v);
        if (b === 5) {
            // ganho lançado em Contas a Pagar (ex.: diferença de liquidação a favor) reduz o custo financeiro
            return pc.natureza === 'ganho' ? somar(ganhosFin, chaveConta(pc), v) : somar(custosFin, chaveConta(pc), v);
        }
        const sinal = /^\(-\)/.test(pc.subfator_nome || '') ? -1 : 1;
        somar(custos[b], chaveConta(pc), sinal * v);
    });

    const receitaBruta    = total(receitas);
    const totalDeducoes   = total(deducoes);
    const receitaLiquida  = receitaBruta - totalDeducoes;
    const totalDireto     = total(custos[2]);
    const totalComercial  = total(custos[3]);
    const totalOperac     = total(custos[4]);
    const totalGanhosFin  = total(ganhosFin);
    const totalCustosFin  = total(custosFin);
    const totalOutras     = total(cats);
    const margemBruta     = receitaLiquida - totalDireto;
    const margemComercial = margemBruta - totalComercial;
    const margemOperac    = margemComercial - totalOperac;
    const resultadoFin    = totalGanhosFin - totalCustosFin;
    const resultado       = margemOperac + resultadoFin - totalOutras;
    const pct = v => receitaLiquida > 0 ? (v / receitaLiquida * 100) : 0;
    const comPct = (rotulo, v) => `${rotulo} <span style="font-size:12px;font-weight:500;opacity:.7">(${pct(v).toFixed(1)}%)</span>`;

    const receitaPendente = receber
        .filter(c => c.status === 'pendente' || c.status === 'vencido')
        .reduce((s, c) => s + Number(c.valor || 0), 0);

    const catLabels = {
        frete:       'Fretes e Logística',
        imposto:     'Impostos e Taxas',
        fornecedor:  'Fornecedores',
        operacional: 'Despesas Operacionais',
        comercial:   'Despesas Comerciais',
        financeiro:  'Despesas Financeiras / Bancárias',
        outro:       'Outras Despesas',
    };

    const periodo = `${_dreFmtPeriodo(inicio)} a ${_dreFmtPeriodo(fim)}`;
    const linhas = [];
    const vazio = txt => `<tr class="dre-indentado"><td style="color:#94a3b8;font-style:italic">${txt}</td><td></td></tr>`;
    const blocoCustos = (titulo, obj, totalRot, totalVal, txtVazio) => {
        linhas.push(_dreSecao(titulo));
        Object.entries(obj).forEach(([conta, val]) => linhas.push(_dreLinhaCusto(conta, val)));
        if (!Object.keys(obj).length) linhas.push(vazio(txtVazio));
        linhas.push(_dreTotal(totalRot, totalVal, 'vermelho'));
    };

    linhas.push(`<tr><td colspan="2" style="padding:14px 20px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;">
        Demonstração do Resultado — ${periodo}
    </td></tr>`);

    // RECEITAS
    linhas.push(_dreSecao('RECEITA BRUTA DE EXPORTAÇÃO'));
    Object.entries(receitas).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(escHtml(conta), val, 'verde')));
    if (!Object.keys(receitas).length) linhas.push(vazio('Nenhuma receita recebida no período'));
    linhas.push(_dreLinha('Receita Bruta (recebida)', receitaBruta, 'verde'));
    linhas.push(_dreLinhaIndent('Contas a Receber (pendente)', receitaPendente));
    if (Object.keys(deducoes).length) {
        linhas.push(_dreSecao('DEDUÇÕES DA RECEITA'));
        Object.entries(deducoes).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(conta)}`, val, 'vermelho')));
    }
    linhas.push(_dreTotal('(=) RECEITA LÍQUIDA', receitaLiquida));

    // CUSTOS E MARGENS
    blocoCustos('CUSTO DIRETO DO VENDIDO (CMV / CSV)', custos[2], '(=) TOTAL CUSTO DIRETO', totalDireto, 'Nenhum custo direto pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM BRUTA', margemBruta), margemBruta));
    blocoCustos('CUSTO COMERCIAL', custos[3], '(=) TOTAL CUSTO COMERCIAL', totalComercial, 'Nenhum custo comercial pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM COMERCIAL', margemComercial), margemComercial));
    blocoCustos('CUSTO OPERACIONAL', custos[4], '(=) TOTAL CUSTO OPERACIONAL', totalOperac, 'Nenhum custo operacional pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM OPERACIONAL', margemOperac), margemOperac));

    // RESULTADO FINANCEIRO / CAMBIAL
    linhas.push(_dreSecao('RESULTADO FINANCEIRO / CAMBIAL'));
    Object.entries(ganhosFin).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(+) ${escHtml(conta)}`, val, 'verde')));
    Object.entries(custosFin).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(conta)}`, val, 'vermelho')));
    if (!Object.keys(ganhosFin).length && !Object.keys(custosFin).length) linhas.push(vazio('Nenhum ganho ou custo financeiro no período'));
    linhas.push(_dreTotal('(=) RESULTADO FINANCEIRO LÍQUIDO', resultadoFin, resultadoFin < 0 ? 'vermelho' : ''));

    // OUTRAS DESPESAS (sem conta do plano — pela categoria antiga)
    if (Object.keys(cats).length) {
        linhas.push(_dreSecao('OUTRAS DESPESAS (sem conta do plano)'));
        Object.entries(cats).forEach(([cat, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(catLabels[cat] || cat)}`, val, 'vermelho')));
        linhas.push(_dreTotal('(=) TOTAL OUTRAS DESPESAS', totalOutras, 'vermelho'));
    }

    // RESULTADO
    linhas.push(_dreResultado(resultado, pct(resultado)));

    document.getElementById('dreTbody').innerHTML = linhas.join('');
}

// Linha de custo: ajustes que reduzem o custo (descontos/devoluções de
// compra, saldo negativo) aparecem como "(+)" com o valor sem sinal
function _dreLinhaCusto(conta, val) {
    return val < 0
        ? _dreLinhaIndent(`(+) ${escHtml(conta)}`, -val, 'verde')
        : _dreLinhaIndent(`(-) ${escHtml(conta)}`, val, 'vermelho');
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
