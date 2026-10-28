// ========================================
// DRE / BALANCETE
// ========================================
// Três abas, todas sobre as mesmas contas pagas/recebidas do período,
// convertidas para R$ pelo câmbio de cada conta (ou PTAX da data, como
// estimativa — fin-moeda.js):
//   Resultado do período — DRE na estrutura do Bloco 7 do Plano de Contas
//                          + indicadores de rentabilidade (7.14)
//   Por operação         — resultado e custo unitário de cada Proforma (7.15)
//   Análise              — resultado por país, cliente, incoterm, modal,
//                          moeda e custos por fornecedor (7.17)
//   Previsto × Realizado — previsto, revisado e realizado por indicador (7.16)

let _dreDados = null;      // { pagar, receber, periodo, operacoes }
let _dreAba = 'resultado';

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

const _DRE_CARREGANDO = '<div style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></div>';

async function dreCarregar() {
    const inicio = document.getElementById('dreInicio').value;
    const fim    = document.getElementById('dreFim').value;
    if (!inicio || !fim) return;

    document.getElementById('dreTbody').innerHTML =
        '<tr><td colspan="2" style="padding:60px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';
    document.getElementById('dreIndicadores').innerHTML = '';
    document.getElementById('dreOperacoes').innerHTML = _DRE_CARREGANDO;
    document.getElementById('dreAnalise').innerHTML = _DRE_CARREGANDO;
    document.getElementById('drePrevisto').innerHTML = _DRE_CARREGANDO;

    const dataInicio = inicio + '-01';
    const [fAno, fMes] = fim.split('-');
    const dataFim = new Date(parseInt(fAno), parseInt(fMes), 0).toISOString().split('T')[0];

    const [resPagar, resReceber] = await Promise.all([
        buscarContasPagarPeriodo(dataInicio, dataFim),
        buscarContasReceberPeriodo(dataInicio, dataFim),
    ]);
    const pagar   = await finConverterContas(resPagar.data   || [], 'data_pagamento');
    const receber = await finConverterContas(resReceber.data || [], 'data_recebimento');

    _dreDados = {
        pagar, receber,
        periodo: `${_dreFmtPeriodo(inicio)} a ${_dreFmtPeriodo(fim)}`,
        operacoes: null,
        previsto: null,   // { pagar, receber } em valores previstos; revisado idem
    };
    _dreRenderAviso();
    _dreRenderResultado();
    // operações/análise carregam os dados das Proformas sob demanda
    if (_dreAba !== 'resultado') await _dreRenderAbaAtual();
}

function dreAbrirAba(aba) {
    _dreAba = aba;
    document.querySelectorAll('.dre-aba').forEach(b => b.classList.toggle('ativa', b.dataset.aba === aba));
    document.getElementById('drePainelResultado').hidden = aba !== 'resultado';
    document.getElementById('drePainelOperacoes').hidden = aba !== 'operacoes';
    document.getElementById('drePainelAnalise').hidden   = aba !== 'analise';
    document.getElementById('drePainelPrevisto').hidden  = aba !== 'previsto';
    _dreRenderAbaAtual();
}

async function _dreRenderAbaAtual() {
    if (!_dreDados) return;
    if (_dreAba === 'operacoes') { await _dreCarregarOperacoes(); _dreRenderOperacoes(); }
    if (_dreAba === 'analise')   { await _dreCarregarOperacoes(); dreRenderAnalise(); }
    if (_dreAba === 'previsto')  { await _dreCarregarOperacoes(); await _dreCarregarPrevisto(); _dreMontarFiltroPrevisto(); dreRenderPrevisto(); }
}

// ── Conversão / avisos ───────────────────────────────────────────────────────

const _drePago     = c => c.status === 'pago';
const _dreRecebido = c => c.status === 'recebido';
const _dreValor    = c => Number(c._valorBRL) || 0;

function _dreRenderAviso() {
    const el = document.getElementById('dreAviso');
    const efetivas = [..._dreDados.pagar.filter(_drePago), ..._dreDados.receber.filter(_dreRecebido)];
    const estimadas = efetivas.filter(c => c._cambioEstimado).length;
    const semTaxa = efetivas.filter(c => c._valorBRL === null);
    const partes = [];
    if (estimadas) partes.push(`<i class="fa-solid fa-circle-info"></i> ${estimadas} lançamento(s) em moeda estrangeira sem câmbio informado foram convertidos pela PTAX da data (estimativa). Informe o câmbio na conta para o valor exato.`);
    if (semTaxa.length) partes.push(`<i class="fa-solid fa-triangle-exclamation"></i> ${semTaxa.length} lançamento(s) ficaram fora do resultado por não haver cotação para ${escHtml([...new Set(semTaxa.map(c => c.moeda))].join(', '))} — informe o câmbio na conta.`);
    el.innerHTML = partes.map(p => `<div>${p}</div>`).join('');
    el.hidden = !partes.length;
}

// ── Apuração (estrutura do Bloco 7) ──────────────────────────────────────────
//   Receita Bruta (Bloco 1) − Deduções (1.90) = Receita Líquida
//   − Custo Direto (Bloco 2)      = Margem Bruta
//   − Custo Comercial (Bloco 3)   = Margem Comercial
//   − Custo Operacional (Bloco 4) = Margem Operacional
//   ± Resultado Financeiro/Cambial (Bloco 5: ganhos − custos)
//   − Outras despesas (sem conta do plano, pela categoria antiga)
//   = Resultado (Bloco 6 / tributário entra depois)
// Subfatores "(-)" (descontos/devoluções de compra) reduzem o custo.
function _dreApurar(pagar, receber) {
    const somar = (obj, chave, v) => { obj[chave] = (obj[chave] || 0) + v; };
    const total = o => Object.values(o).reduce((s, v) => s + v, 0);
    const chaveConta = pc => `${pc.conta_codigo} — ${pc.conta_nome}`;

    const receitas = {}, deducoes = {}, ganhosFin = {};
    receber.filter(_dreRecebido).forEach(c => {
        const v = _dreValor(c), pc = c.plano_contas;
        if (!pc) return somar(receitas, 'Não classificado', v);
        if (Number(pc.bloco) === 5) return somar(ganhosFin, chaveConta(pc), v);
        if (String(pc.conta_codigo).startsWith('1.90')) return somar(deducoes, chaveConta(pc), v);
        somar(receitas, chaveConta(pc), v);
    });

    const custos = { 2: {}, 3: {}, 4: {} }, custosFin = {}, cats = {};
    pagar.filter(_drePago).forEach(c => {
        const v = _dreValor(c), pc = c.plano_contas, b = Number(pc?.bloco);
        if (!pc || ![2, 3, 4, 5].includes(b)) return somar(cats, c.categoria || 'outro', v);
        if (b === 5) {
            // ganho lançado em Contas a Pagar (ex.: diferença de liquidação a favor) reduz o custo financeiro
            return pc.natureza === 'ganho' ? somar(ganhosFin, chaveConta(pc), v) : somar(custosFin, chaveConta(pc), v);
        }
        const sinal = /^\(-\)/.test(pc.subfator_nome || '') ? -1 : 1;
        somar(custos[b], chaveConta(pc), sinal * v);
    });

    const a = { receitas, deducoes, custos, ganhosFin, custosFin, cats };
    a.receitaBruta    = total(receitas);
    a.totalDeducoes   = total(deducoes);
    a.receitaLiquida  = a.receitaBruta - a.totalDeducoes;
    a.totalDireto     = total(custos[2]);
    a.totalComercial  = total(custos[3]);
    a.totalOperac     = total(custos[4]);
    a.totalGanhosFin  = total(ganhosFin);
    a.totalCustosFin  = total(custosFin);
    a.totalOutras     = total(cats);
    a.margemBruta     = a.receitaLiquida - a.totalDireto;
    a.margemComercial = a.margemBruta - a.totalComercial;
    a.margemOperac    = a.margemComercial - a.totalOperac;
    a.resultadoFin    = a.totalGanhosFin - a.totalCustosFin;
    a.resultado       = a.margemOperac + a.resultadoFin - a.totalOutras;
    a.custoTotal      = a.totalDireto + a.totalComercial + a.totalOperac + a.totalCustosFin + a.totalOutras;
    a.pct = v => a.receitaLiquida > 0 ? (v / a.receitaLiquida * 100) : null;
    return a;
}

// ── Aba: Resultado do período ────────────────────────────────────────────────

const _DRE_CAT_LABELS = {
    frete:       'Fretes e Logística',
    imposto:     'Impostos e Taxas',
    fornecedor:  'Fornecedores',
    operacional: 'Despesas Operacionais',
    comercial:   'Despesas Comerciais',
    financeiro:  'Despesas Financeiras / Bancárias',
    outro:       'Outras Despesas',
};

const _dreNum1 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function _drePctTxt(v) { return v === null ? '—' : `${_dreNum1(v)}%`; }

function _dreRenderResultado() {
    const { pagar, receber, periodo } = _dreDados;
    const a = _dreApurar(pagar, receber);
    const comPct = (rotulo, v) => `${rotulo} <span style="font-size:12px;font-weight:500;opacity:.7">(${_drePctTxt(a.pct(v))})</span>`;
    const receitaPendente = receber
        .filter(c => c.status === 'pendente' || c.status === 'vencido')
        .reduce((s, c) => s + (Number(c._valorBRL) || 0), 0);

    _dreRenderIndicadores(a);

    const linhas = [];
    const vazio = txt => `<tr class="dre-indentado"><td style="color:#94a3b8;font-style:italic">${txt}</td><td></td></tr>`;
    const blocoCustos = (titulo, obj, totalRot, totalVal, txtVazio) => {
        linhas.push(_dreSecao(titulo));
        Object.entries(obj).forEach(([conta, val]) => linhas.push(_dreLinhaCusto(conta, val)));
        if (!Object.keys(obj).length) linhas.push(vazio(txtVazio));
        linhas.push(_dreTotal(totalRot, totalVal, 'vermelho'));
    };

    linhas.push(`<tr><td colspan="2" style="padding:14px 20px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;">
        Demonstração do Resultado — ${periodo} <span style="font-size:12px;font-weight:500;color:#64748b">(valores em R$)</span>
    </td></tr>`);

    // RECEITAS
    linhas.push(_dreSecao('RECEITA BRUTA DE EXPORTAÇÃO'));
    Object.entries(a.receitas).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(escHtml(conta), val, 'verde')));
    if (!Object.keys(a.receitas).length) linhas.push(vazio('Nenhuma receita recebida no período'));
    linhas.push(_dreLinha('Receita Bruta (recebida)', a.receitaBruta, 'verde'));
    linhas.push(_dreLinhaIndent('Contas a Receber (pendente)', receitaPendente));
    if (Object.keys(a.deducoes).length) {
        linhas.push(_dreSecao('DEDUÇÕES DA RECEITA'));
        Object.entries(a.deducoes).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(conta)}`, val, 'vermelho')));
    }
    linhas.push(_dreTotal('(=) RECEITA LÍQUIDA', a.receitaLiquida));

    // CUSTOS E MARGENS
    blocoCustos('CUSTO DIRETO DO VENDIDO (CMV / CSV)', a.custos[2], '(=) TOTAL CUSTO DIRETO', a.totalDireto, 'Nenhum custo direto pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM BRUTA', a.margemBruta), a.margemBruta));
    blocoCustos('CUSTO COMERCIAL', a.custos[3], '(=) TOTAL CUSTO COMERCIAL', a.totalComercial, 'Nenhum custo comercial pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM COMERCIAL', a.margemComercial), a.margemComercial));
    blocoCustos('CUSTO OPERACIONAL', a.custos[4], '(=) TOTAL CUSTO OPERACIONAL', a.totalOperac, 'Nenhum custo operacional pago no período');
    linhas.push(_dreTotal(comPct('(=) MARGEM OPERACIONAL', a.margemOperac), a.margemOperac));

    // RESULTADO FINANCEIRO / CAMBIAL
    linhas.push(_dreSecao('RESULTADO FINANCEIRO / CAMBIAL'));
    Object.entries(a.ganhosFin).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(+) ${escHtml(conta)}`, val, 'verde')));
    Object.entries(a.custosFin).forEach(([conta, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(conta)}`, val, 'vermelho')));
    if (!Object.keys(a.ganhosFin).length && !Object.keys(a.custosFin).length) linhas.push(vazio('Nenhum ganho ou custo financeiro no período'));
    linhas.push(_dreTotal('(=) RESULTADO FINANCEIRO LÍQUIDO', a.resultadoFin, a.resultadoFin < 0 ? 'vermelho' : ''));

    // OUTRAS DESPESAS (sem conta do plano — pela categoria antiga)
    if (Object.keys(a.cats).length) {
        linhas.push(_dreSecao('OUTRAS DESPESAS (sem conta do plano)'));
        Object.entries(a.cats).forEach(([cat, val]) => linhas.push(_dreLinhaIndent(`(-) ${escHtml(_DRE_CAT_LABELS[cat] || cat)}`, val, 'vermelho')));
        linhas.push(_dreTotal('(=) TOTAL OUTRAS DESPESAS', a.totalOutras, 'vermelho'));
    }

    linhas.push(_dreResultado(a.resultado, a.pct(a.resultado) ?? 0));
    document.getElementById('dreTbody').innerHTML = linhas.join('');
}

// Indicadores de rentabilidade (7.14)
function _dreRenderIndicadores(a) {
    const markup = a.totalDireto > 0 ? (a.receitaLiquida / a.totalDireto) : null;
    const retorno = a.custoTotal > 0 ? (a.resultado / a.custoTotal * 100) : null;
    const cards = [
        ['Margem Bruta', _drePctTxt(a.pct(a.margemBruta)), 'Margem Bruta ÷ Receita Líquida'],
        ['Custo Comercial', _drePctTxt(a.pct(a.totalComercial)), 'Bloco 3 ÷ Receita Líquida'],
        ['Margem Comercial', _drePctTxt(a.pct(a.margemComercial)), 'Margem Comercial ÷ Receita Líquida'],
        ['Custo Operacional', _drePctTxt(a.pct(a.totalOperac)), 'Bloco 4 ÷ Receita Líquida'],
        ['Margem Operacional', _drePctTxt(a.pct(a.margemOperac)), 'Margem Operacional ÷ Receita Líquida'],
        ['Custo Financeiro', _drePctTxt(a.pct(a.totalCustosFin)), 'Custos financeiros ÷ Receita Líquida'],
        ['Margem Líquida', _drePctTxt(a.pct(a.resultado)), 'Resultado ÷ Receita Líquida'],
        ['Markup s/ CMV/CSV', markup === null ? '—' : `${markup.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`, 'Receita Líquida ÷ Custo Direto'],
        ['Retorno s/ Custo Total', _drePctTxt(retorno), 'Resultado ÷ Custo Total'],
    ];
    document.getElementById('dreIndicadores').innerHTML = cards.map(([t, v, d]) => `
        <div class="dre-ind" title="${escHtml(d)}">
            <span class="dre-ind-tit">${escHtml(t)}</span>
            <strong class="dre-ind-val">${escHtml(v)}</strong>
        </div>`).join('');
}

// ── Operações (Proformas) — base das abas Por operação e Análise ─────────────

// Proforma de cada conta: direto (proforma_id) ou pelo Processo
function _dreProformaDaConta(c) {
    return c.proforma_id || c.processos?.proforma_id || null;
}

async function _dreCarregarOperacoes() {
    if (_dreDados.operacoes) return;
    const { pagar, receber } = _dreDados;
    const ids = [...new Set([...pagar, ...receber].map(_dreProformaDaConta).filter(Boolean))];
    const mapa = {};
    if (ids.length) {
        const { data } = await supabaseClient.from('proformas')
            .select('id, codigo, destino_pais, incoterm, modal, itens, emissor_tipo, parceiro_id, destinatario_id, destinatario_razao_social')
            .in('id', ids);
        const parcIds = [...new Set((data || []).map(p => p.destinatario_id).filter(Boolean))];
        const nomes = {};
        if (parcIds.length) {
            const { data: parcs } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').in('id', parcIds);
            (parcs || []).forEach(p => { nomes[p.id] = p.nome_fantasia || p.razao_social; });
        }
        (data || []).forEach(p => {
            mapa[p.id] = { ...p, cliente: nomes[p.destinatario_id] || p.destinatario_razao_social || '—' };
        });
    }
    _dreDados.operacoes = mapa;
}

// Quantidade vendida da operação (7.15): soma das quantidades dos itens;
// unidade só quando todos os itens usam a mesma
function _dreQuantidade(p) {
    const itens = Array.isArray(p?.itens) ? p.itens : [];
    const qtd = itens.reduce((s, i) => s + (Number(i.qtd) || 0), 0);
    const unidades = [...new Set(itens.map(i => (i.unidade || '').trim()).filter(Boolean))];
    return { qtd, unidade: unidades.length === 1 ? unidades[0] : (unidades.length ? 'unid. mistas' : '') };
}

function _dreAgruparPorOperacao() {
    const { pagar, receber, operacoes } = _dreDados;
    const grupos = {};
    const g = id => (grupos[id || '_sem'] ||= { id: id || null, pagar: [], receber: [] });
    pagar.forEach(c => g(_dreProformaDaConta(c)).pagar.push(c));
    receber.forEach(c => g(_dreProformaDaConta(c)).receber.push(c));
    return Object.values(grupos).map(gr => ({ ...gr, proforma: gr.id ? operacoes[gr.id] : null, a: _dreApurar(gr.pagar, gr.receber) }))
        .filter(gr => gr.a.receitaLiquida || gr.a.custoTotal || gr.a.totalGanhosFin);
}

// ── Aba: Por operação (7.15) ─────────────────────────────────────────────────

function _dreRenderOperacoes() {
    const el = document.getElementById('dreOperacoes');
    const lista = _dreAgruparPorOperacao().sort((x, y) => (y.a.resultado) - (x.a.resultado));
    if (!lista.length) { el.innerHTML = '<div class="dre-vazio">Nenhuma conta paga ou recebida no período.</div>'; return; }
    const fmt = v => _dreFmt(v);
    const unit = (v, q) => q > 0 ? fmt(v / q) : '—';
    el.innerHTML = `
        <table class="dre-grade">
            <thead><tr>
                <th>Operação</th><th>Receita Líquida</th><th>Custo Direto</th><th>Comercial</th><th>Operacional</th>
                <th>Financeiro</th><th>Resultado</th><th>Margem</th><th>Qtd</th><th>Custo unit.</th><th>Receita unit.</th><th>Lucro unit.</th>
            </tr></thead>
            <tbody>${lista.map(({ proforma: p, a }) => {
                const { qtd, unidade } = _dreQuantidade(p);
                const custoUnitario = a.custoTotal - a.totalGanhosFin;   // custo total líquido dos ganhos financeiros
                const titulo = p
                    ? `<strong>${escHtml(p.codigo || '—')}</strong><br><span class="dre-sub">${escHtml(p.cliente)} · ${escHtml(p.destino_pais || '—')} · ${escHtml((p.incoterm || '').toUpperCase() || '—')}</span>`
                    : '<em>Sem operação vinculada</em>';
                return `<tr>
                    <td>${titulo}</td>
                    <td>${fmt(a.receitaLiquida)}</td><td>${fmt(a.totalDireto)}</td><td>${fmt(a.totalComercial)}</td><td>${fmt(a.totalOperac)}</td>
                    <td>${fmt(-a.resultadoFin)}</td>
                    <td class="${a.resultado < 0 ? 'dre-neg' : 'dre-pos'}">${fmt(a.resultado)}</td>
                    <td>${_drePctTxt(a.pct(a.resultado))}</td>
                    <td>${qtd ? `${qtd.toLocaleString('pt-BR')} ${escHtml(unidade)}` : '—'}</td>
                    <td>${unit(custoUnitario, qtd)}</td><td>${unit(a.receitaLiquida, qtd)}</td><td>${unit(a.resultado, qtd)}</td>
                </tr>`;
            }).join('')}</tbody>
        </table>
        <p class="dre-nota">Financeiro: custo financeiro líquido (custos − ganhos do Bloco 5). Unitários dividem pela quantidade dos itens da Proforma; contas sem Proforma (nem Processo) ficam em "Sem operação vinculada".</p>`;
}

// ── Aba: Análise gerencial (7.17) ────────────────────────────────────────────

function dreRenderAnalise() {
    const el = document.getElementById('dreAnalise');
    if (!_dreDados?.operacoes) { el.innerHTML = _DRE_CARREGANDO; return; }
    const dim = document.getElementById('dreDimensao').value;
    const fmt = v => _dreFmt(v);

    // Fornecedor: só custos (Contas a Pagar pagas), por parceiro
    if (dim === 'fornecedor') {
        const porForn = {};
        _dreDados.pagar.filter(_drePago).forEach(c => {
            const nome = c.parceiros ? (c.parceiros.nome_fantasia || c.parceiros.razao_social) : 'Sem fornecedor';
            porForn[nome] = (porForn[nome] || 0) + _dreValor(c);
        });
        const linhas = Object.entries(porForn).sort((x, y) => y[1] - x[1]);
        const tot = linhas.reduce((s, [, v]) => s + v, 0);
        el.innerHTML = linhas.length ? `
            <table class="dre-grade"><thead><tr><th>Fornecedor</th><th>Custo pago</th><th>% do custo total</th></tr></thead>
            <tbody>${linhas.map(([n, v]) => `<tr><td>${escHtml(n)}</td><td>${fmt(v)}</td><td>${tot ? _drePctTxt(v / tot * 100) : '—'}</td></tr>`).join('')}</tbody></table>`
            : '<div class="dre-vazio">Nenhum custo pago no período.</div>';
        return;
    }

    // Demais dimensões: agrupa as operações (moeda: moeda das receitas)
    const rotulo = {
        pais: g => g.proforma?.destino_pais,
        cliente: g => g.proforma?.cliente,
        incoterm: g => (g.proforma?.incoterm || '').toUpperCase(),
        modal: g => g.proforma?.modal,
        moeda: g => [...new Set(g.receber.filter(_dreRecebido).map(c => c.moeda || 'BRL'))].join(' + '),
    }[dim];
    const grupos = {};
    _dreAgruparPorOperacao().forEach(g => {
        const chave = g.proforma ? (rotulo(g) || 'Não informado') : 'Sem operação vinculada';
        const alvo = (grupos[chave] ||= { pagar: [], receber: [], ops: 0 });
        alvo.pagar.push(...g.pagar); alvo.receber.push(...g.receber); alvo.ops++;
    });
    const linhas = Object.entries(grupos).map(([k, v]) => [k, v.ops, _dreApurar(v.pagar, v.receber)])
        .sort((x, y) => y[2].receitaLiquida - x[2].receitaLiquida);
    el.innerHTML = linhas.length ? `
        <table class="dre-grade">
            <thead><tr><th>${escHtml(document.querySelector('#dreDimensao option:checked').textContent)}</th><th>Operações</th><th>Receita Líquida</th>
                <th>Margem Bruta</th><th>Margem Operacional</th><th>Resultado</th><th>Margem Líquida</th></tr></thead>
            <tbody>${linhas.map(([k, n, a]) => `<tr>
                <td><strong>${escHtml(k)}</strong></td><td>${n}</td><td>${fmt(a.receitaLiquida)}</td>
                <td>${fmt(a.margemBruta)} <span class="dre-sub">${_drePctTxt(a.pct(a.margemBruta))}</span></td>
                <td>${fmt(a.margemOperac)} <span class="dre-sub">${_drePctTxt(a.pct(a.margemOperac))}</span></td>
                <td class="${a.resultado < 0 ? 'dre-neg' : 'dre-pos'}">${fmt(a.resultado)}</td>
                <td><strong>${_drePctTxt(a.pct(a.resultado))}</strong></td>
            </tr>`).join('')}</tbody>
        </table>`
        : '<div class="dre-vazio">Nenhuma operação com contas pagas ou recebidas no período.</div>';
}

// ── Aba: Previsto × Realizado (7.16) ─────────────────────────────────────────
// Previsto: valor/câmbio de abertura de todas as contas não canceladas.
// Revisado: o revisado quando houver, senão o previsto.
// Realizado: só o que já foi pago/recebido (valor e câmbio do pagamento).
// Contas sem câmbio previsto/revisado usam a PTAX da data como estimativa.

async function _dreVersao(contas, tipo, versao) {
    const statusFinal = tipo === 'pagar' ? 'pago' : 'recebido';
    const out = [];
    for (const c of contas.filter(x => x.status !== 'cancelado')) {
        const prevValor = c.valor_previsto ?? c.valor;
        const valor = versao === 'revisado' ? (c.valor_revisado ?? prevValor) : prevValor;
        const taxaSalva = versao === 'revisado'
            ? (c.cambio_revisado ?? c.cambio_previsto ?? c.cambio)
            : (c.cambio_previsto ?? c.cambio);
        // a previsão pode ter moeda diferente do pagamento (database-financeiro-pagamento.sql)
        const moedaPrev = c.moeda_previsto || c.moeda;
        let brl = finValorEmReais(valor, moedaPrev, taxaSalva);
        if (brl === null) {
            const data = (versao === 'revisado' ? c.revisado_em : null) || c.previsto_em || String(c.criado_em || '').slice(0, 10) || c.data_vencimento;
            const cot = await finCotacaoPtax(moedaPrev, data);
            brl = cot ? (Number(valor) || 0) * cot.taxa : null;
        }
        out.push({ ...c, status: statusFinal, _valorBRL: brl });
    }
    return out;
}

async function _dreCarregarPrevisto() {
    if (_dreDados.previsto) return;
    const { pagar, receber } = _dreDados;
    _dreDados.previsto = {
        previsto: { pagar: await _dreVersao(pagar, 'pagar', 'previsto'), receber: await _dreVersao(receber, 'receber', 'previsto') },
        revisado: { pagar: await _dreVersao(pagar, 'pagar', 'revisado'), receber: await _dreVersao(receber, 'receber', 'revisado') },
    };
}

function _dreMontarFiltroPrevisto() {
    const sel = document.getElementById('drePrevOperacao');
    const atual = sel.value;
    const ids = [...new Set([..._dreDados.pagar, ..._dreDados.receber].map(c => _dreProformaDaConta(c) || '_sem'))];
    const ops = ids.map(id => [id, id === '_sem' ? 'Sem operação vinculada' : (_dreDados.operacoes[id]?.codigo || 'Proforma')])
        .sort((a, b) => a[1].localeCompare(b[1]));
    sel.innerHTML = '<option value="">Todas as operações do período</option>'
        + ops.map(([id, nome]) => `<option value="${escHtml(id)}">${escHtml(nome)}</option>`).join('');
    if ([...sel.options].some(o => o.value === atual)) sel.value = atual;
}

function dreRenderPrevisto() {
    const el = document.getElementById('drePrevisto');
    if (!_dreDados?.previsto) { el.innerHTML = _DRE_CARREGANDO; return; }
    const op = document.getElementById('drePrevOperacao').value;
    const daOp = lista => !op ? lista : lista.filter(c => (_dreProformaDaConta(c) || '_sem') === op);
    const ap = conj => _dreApurar(daOp(conj.pagar), daOp(conj.receber));
    const prev = ap(_dreDados.previsto.previsto);
    const rev  = ap(_dreDados.previsto.revisado);
    const real = ap({ pagar: _dreDados.pagar, receber: _dreDados.receber });
    if (!prev.receitaLiquida && !prev.custoTotal && !real.receitaLiquida && !real.custoTotal) {
        el.innerHTML = '<div class="dre-vazio">Nenhuma conta no período para comparar.</div>';
        return;
    }
    const fmt = v => _dreFmt(v);
    // [rótulo, campo, maior é melhor?, é porcentagem?]
    const linhas = [
        ['Receita Líquida', a => a.receitaLiquida, true],
        ['Custo Direto (CMV / CSV)', a => a.totalDireto, false],
        ['Custo Comercial', a => a.totalComercial, false],
        ['Custo Operacional', a => a.totalOperac, false],
        ['Resultado Financeiro / Cambial', a => a.resultadoFin, true],
        ['Outras despesas (sem conta)', a => a.totalOutras, false],
        ['Resultado', a => a.resultado, true],
        ['Margem Líquida', a => a.pct(a.resultado), true, true],
    ];
    el.innerHTML = `
        <table class="dre-grade">
            <thead><tr><th>Indicador</th><th>Previsto</th><th>Revisado</th><th>Realizado</th><th>Desvio</th><th>Desvio %</th></tr></thead>
            <tbody>${linhas.map(([rot, f, maiorMelhor, ehPct]) => {
                const p = f(prev), r = f(rev), x = f(real);
                if (ehPct) {
                    const d = (x ?? 0) - (p ?? 0);
                    return `<tr><td><strong>${rot}</strong></td><td>${_drePctTxt(p)}</td><td>${_drePctTxt(r)}</td><td>${_drePctTxt(x)}</td>
                        <td class="${d === 0 ? '' : (d > 0) === maiorMelhor ? 'dre-pos' : 'dre-neg'}">${p === null || x === null ? '—' : `${d > 0 ? '+' : ''}${_dreNum1(d)} p.p.`}</td><td>—</td></tr>`;
                }
                const d = x - p;
                const dPct = p ? (d / Math.abs(p) * 100) : null;
                const cls = Math.abs(d) < 0.005 ? '' : ((d > 0) === maiorMelhor ? 'dre-pos' : 'dre-neg');
                return `<tr><td><strong>${rot}</strong></td><td>${fmt(p)}</td><td>${fmt(r)}</td><td>${fmt(x)}</td>
                    <td class="${cls}">${d > 0 ? '+' : ''}${fmt(d)}</td><td class="${cls}">${dPct === null ? '—' : `${d > 0 ? '+' : ''}${_dreNum1(dPct)}%`}</td></tr>`;
            }).join('')}</tbody>
        </table>
        <p class="dre-nota">Previsto: valor e câmbio de abertura de cada conta. Revisado: o revisado quando houver, senão o previsto. Realizado: só o que já foi pago/recebido — contas ainda em aberto entram no previsto e não no realizado. Verde = desvio a favor; vermelho = contra.</p>`;
}

// ── Linhas da tabela do DRE ──────────────────────────────────────────────────

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
    const margemTx = `(margem ${_dreNum1(margem)}%)`;
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
