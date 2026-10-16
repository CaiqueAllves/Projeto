// ========================================
// MOEDA nas Contas a Pagar / Receber
// ========================================
// O Operacional guarda a moeda de jeitos diferentes: sigla ("USD"), descrição
// da tabela apoio_moedas ("REAL/BRASIL") ou o nome escolhido no item
// ("Dólar Americano"). O campo Moeda das contas usa a sigla — sem converter,
// ele ficava em branco e a conta era salva sem moeda.

// Devolve o valor de <option> do select que corresponde à moeda informada
// (sigla, código ou descrição), ou '' se não reconhecer.
function finMoedaParaOpcao(select, valor) {
    if (!select || !valor) return '';
    const v = String(valor).trim();
    const opcoes = [...select.options];
    const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    const alvo = norm(v);
    const porValor = opcoes.find(o => norm(o.value) === alvo);
    if (porValor) return porValor.value;
    const porTexto = opcoes.find(o => norm(o.textContent) === alvo || (o.dataset.codigo && norm(o.dataset.codigo) === alvo));
    if (porTexto) return porTexto.value;
    // nomes comuns digitados/escolhidos nos itens
    const conhecidas = [[/DOLAR/, 'USD'], [/EURO/, 'EUR'], [/REAL|REAIS/, 'BRL'], [/LIBRA/, 'GBP'], [/PESO ARG|ARGENTIN/, 'ARS'], [/YUAN|IUAN|RENMINBI/, 'CNY'], [/IENE|YEN/, 'JPY']];
    const sigla = conhecidas.find(([re]) => re.test(alvo))?.[1];
    return sigla && opcoes.some(o => o.value === sigla) ? sigla : '';
}

// Formata valor com moeda sem nunca quebrar a tela: moeda inválida/vazia
// (registros antigos) sai como número + texto da moeda.
function finFormatarValor(v, moeda = 'BRL') {
    const n = Number(v) || 0;
    try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda || 'BRL', minimumFractionDigits: 2 }).format(n);
    } catch (_) {
        return `${moeda ? moeda + ' ' : ''}${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
}
