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

// ========================================
// CÂMBIO (PTAX do Banco Central)
// ========================================
// Cada conta paga/recebida em moeda estrangeira guarda a taxa em R$ por 1
// unidade da moeda (contas_*.cambio — database-financeiro-cambio.sql). A
// taxa vem da PTAX de fechamento da data (último dia útil até ela) e pode ser
// editada. O DRE e o Bloco 7 convertem tudo para R$ por ela.
const _FIN_PTAX_URL = 'https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/';
const _finPtaxCache = {};

function _finDataBcb(d) { return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`; }

// { taxa, data (YYYY-MM-DD da cotação), estimada (data futura → cotação de hoje) } ou null
async function finCotacaoPtax(moeda, dataISO) {
    moeda = String(moeda || '').toUpperCase();
    if (!moeda || moeda === 'BRL') return { taxa: 1, data: dataISO, estimada: false };
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    let alvo = dataISO ? new Date(dataISO + 'T00:00:00') : new Date(hoje);
    const estimada = alvo > hoje;
    if (estimada || isNaN(alvo)) alvo = new Date(hoje);
    const chave = `${moeda}|${alvo.toISOString().slice(0, 10)}`;
    if (chave in _finPtaxCache) return _finPtaxCache[chave] && { ..._finPtaxCache[chave], estimada };
    const inicio = new Date(alvo); inicio.setDate(inicio.getDate() - 10);
    const url = `${_FIN_PTAX_URL}CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)`
        + `?@moeda='${encodeURIComponent(moeda)}'&@dataInicial='${_finDataBcb(inicio)}'&@dataFinalCotacao='${_finDataBcb(alvo)}'`
        + `&$format=json&$select=cotacaoVenda,dataHoraCotacao,tipoBoletim`;
    try {
        const r = await fetch(url);
        const lista = r.ok ? ((await r.json()).value || []) : [];
        const fech = lista.filter(c => c.tipoBoletim === 'Fechamento');
        const ult = (fech.length ? fech : lista).slice(-1)[0];
        _finPtaxCache[chave] = ult ? { taxa: Number(ult.cotacaoVenda), data: String(ult.dataHoraCotacao).slice(0, 10) } : null;
    } catch (e) {
        _finPtaxCache[chave] = null;
    }
    return _finPtaxCache[chave] && { ..._finPtaxCache[chave], estimada };
}

// Valor da conta em R$ (null quando é moeda estrangeira sem taxa)
function finValorEmReais(valor, moeda, cambio) {
    const v = Number(valor) || 0;
    if (!moeda || String(moeda).toUpperCase() === 'BRL') return v;
    return Number(cambio) > 0 ? v * Number(cambio) : null;
}

// Converte uma lista de contas para R$: usa o câmbio salvo; sem ele, busca a
// PTAX da data (pagamento/recebimento ou vencimento). Devolve as contas com
// _valorBRL (ou null) e _cambioEstimado.
async function finConverterContas(contas, campoData) {
    for (const c of contas) {
        let brl = finValorEmReais(c.valor, c.moeda, c.cambio);
        c._cambioEstimado = false;
        if (brl === null) {
            const cot = await finCotacaoPtax(c.moeda, c[campoData] || c.data_vencimento);
            if (cot) { brl = (Number(c.valor) || 0) * cot.taxa; c._cambioEstimado = true; }
        }
        c._valorBRL = brl;
    }
    return contas;
}

// ── Campo "Câmbio" nos formulários de Contas a Pagar / Receber ──
// px = prefixo dos ids ('cp' / 'cr'); ids usados: {px}Moeda, {px}Valor,
// {px}Cambio, {px}CambioGrupo, {px}CambioMoeda, {px}CambioInfo e os campos
// de data informados (o primeiro preenchido define a data da cotação).
const _finCambioCfg = {};

function finCambioIniciar(px, camposData) {
    _finCambioCfg[px] = camposData;
    const el = id => document.getElementById(px + id);
    el('Moeda')?.addEventListener('change', () => finCambioAtualizar(px, { forcar: !el('Cambio').dataset.manual }));
    camposData.forEach(id => document.getElementById(id)?.addEventListener('change', () => finCambioAtualizar(px)));
    el('Valor')?.addEventListener('input', () => _finCambioInfo(px));
    el('Cambio')?.addEventListener('input', () => { el('Cambio').dataset.manual = '1'; _finCambioInfo(px); });
}

function _finCambioNum(px) {
    const v = document.getElementById(px + 'Cambio')?.value || '';
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    return n > 0 ? n : null;
}

function _finCambioInfo(px, origem) {
    const info = document.getElementById(px + 'CambioInfo');
    if (!info) return;
    const moeda = document.getElementById(px + 'Moeda').value;
    const valor = parseFloat((document.getElementById(px + 'Valor').value || '').replace(/\./g, '').replace(',', '.')) || 0;
    const taxa = _finCambioNum(px);
    const partes = [];
    if (origem) partes.push(origem);
    if (taxa && valor) partes.push(`≈ ${finFormatarValor(valor * taxa, 'BRL')}`);
    if (!taxa) partes.push(`Sem cotação PTAX para ${moeda} — informe a taxa.`);
    info.textContent = partes.join(' · ');
}

// Preenche o câmbio pela PTAX (se não foi digitado à mão, ou se forcar)
async function finCambioAtualizar(px, { forcar = false } = {}) {
    const moeda = document.getElementById(px + 'Moeda').value;
    const grupo = document.getElementById(px + 'CambioGrupo');
    const campo = document.getElementById(px + 'Cambio');
    if (!grupo || !campo) return;
    grupo.hidden = !moeda || moeda === 'BRL';
    document.getElementById(px + 'CambioMoeda').textContent = moeda;
    if (grupo.hidden) { campo.value = ''; delete campo.dataset.manual; return; }
    if (forcar) delete campo.dataset.manual;
    if (campo.dataset.manual && campo.value) return _finCambioInfo(px, 'taxa informada');
    const data = (_finCambioCfg[px] || []).map(id => document.getElementById(id)?.value).find(Boolean);
    const cot = await finCotacaoPtax(moeda, data);
    if (cot) {
        const anterior = campo.dataset.salvo;
        campo.value = cot.taxa.toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
        const [a, m, d] = cot.data.split('-');
        const antes = anterior && anterior !== campo.value ? ` (antes: ${anterior})` : '';
        _finCambioInfo(px, `PTAX ${d}/${m}/${a}${cot.estimada ? ' (estimativa: data futura)' : ''}${antes}`);
    } else {
        campo.value = '';
        _finCambioInfo(px);
    }
}

// Para o modal: mostra a taxa salva sem travar — mudar a data de pagamento/
// recebimento depois troca pela PTAX da nova data (o aviso mostra a anterior).
// Só fica travada a taxa digitada durante a edição.
function finCambioCarregar(px, cambioSalvo) {
    const campo = document.getElementById(px + 'Cambio');
    if (!campo) return;
    delete campo.dataset.manual;
    delete campo.dataset.salvo;
    if (Number(cambioSalvo) > 0) {
        campo.value = Number(cambioSalvo).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
        campo.dataset.salvo = campo.value;
        const moeda = document.getElementById(px + 'Moeda').value;
        const grupo = document.getElementById(px + 'CambioGrupo');
        grupo.hidden = !moeda || moeda === 'BRL';
        document.getElementById(px + 'CambioMoeda').textContent = moeda;
        _finCambioInfo(px, 'taxa salva');
    } else {
        campo.value = '';
        finCambioAtualizar(px);
    }
}

// Valor a gravar em contas_*.cambio (null para BRL)
function finCambioParaSalvar(px) {
    const moeda = document.getElementById(px + 'Moeda').value;
    return !moeda || moeda === 'BRL' ? null : _finCambioNum(px);
}
