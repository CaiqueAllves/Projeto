// ========================================
// FORMULÁRIO DE LANÇAMENTO — Contas a Pagar / Receber
// ========================================
// Peças compartilhadas pelos dois formulários (px = 'cp' / 'cr'):
//   • Linha de valores: Data | Moeda | Valor | Câmbio | Valor em R$ — ids
//     {p}Data, {p}Moeda, {p}Valor, {p}Cambio, {p}BRL, {p}Info, com p =
//     px + 'Prev' (seção 1, previsão) ou px + 'Pag' (seção 2, realizado).
//     Câmbio = PTAX da data (fin-moeda.js); digitado à mão, não é sobrescrito.
//   • Plano de Contas (bloco) → Categoria (contas do bloco, agrupadas).
//   • Comprovante anexado (bucket financeiro-comprovantes,
//     database-financeiro-pagamento.sql).
//   • Seção 2 só editável com acesso ao Financeiro (ou administrador).

// Modo janela (?janela=1): a tela de Contas aberta por abrirJanelaConta()
// (auth.js) sobre o card de Proforma/Processo mostra só o formulário.
const FIN_JANELA = new URLSearchParams(location.search).get('janela') === '1' && window.parent !== window;
if (FIN_JANELA) document.documentElement.classList.add('fin-janela');

function finJanelaFechar(salvo) {
    window.parent.postMessage({ tipo: 'fin-janela', salvo: !!salvo }, location.origin);
}

const FIN_MEIOS_PAGAMENTO = [
    ['deposito', 'Depósito bancário'], ['transferencia', 'Transferência / PIX'], ['boleto', 'Boleto'],
    ['dinheiro', 'Dinheiro'], ['cartao-credito', 'Cartão de crédito'], ['cartao-debito', 'Cartão de débito'],
    ['swift', 'Remessa internacional (SWIFT)'], ['carta-credito', 'Carta de crédito'], ['cheque', 'Cheque'], ['outro', 'Outro'],
];
const FIN_BUCKET_COMPROVANTES = 'financeiro-comprovantes';

const _flNum = v => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const _flTxtValor = n => (n === null || n === undefined || n === '') ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _flTxtTaxa = n => Number(n) > 0 ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : '';
const _flEl = id => document.getElementById(id);

function finLancPodePagar() {
    return typeof usuarioTemModulo === 'function' ? usuarioTemModulo('financeiro') !== false : true;
}

function finLancMascara(el) {
    const cursor = el.selectionStart, antes = el.value.length;
    let raw = el.value.replace(/[^\d,]/g, '');
    const p = raw.split(',');
    if (p.length > 2) raw = p[0] + ',' + p.slice(1).join('');
    const q = raw.split(',');
    q[0] = q[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = q.join(',');
    const d = el.value.length - antes;
    try { el.setSelectionRange(cursor + d, cursor + d); } catch (_) { /* campo sem seleção */ }
}

// ── Linha de valores ──
function finLinhaIniciar(p) {
    _flEl(p + 'Moeda')?.addEventListener('change', () => _finLinhaCambio(p, { forcar: true }));
    _flEl(p + 'Data')?.addEventListener('change', () => _finLinhaCambio(p));
    _flEl(p + 'Valor')?.addEventListener('input', e => { finLancMascara(e.target); _finLinhaBRL(p); });
    _flEl(p + 'Cambio')?.addEventListener('input', e => { e.target.dataset.manual = '1'; _finLinhaBRL(p, 'taxa informada'); });
}

function _finLinhaBRL(p, origem) {
    const moeda = _flEl(p + 'Moeda')?.value || 'BRL';
    const valor = _flNum(_flEl(p + 'Valor')?.value);
    const digitada = _flNum(_flEl(p + 'Cambio')?.value);
    const taxa = moeda === 'BRL' ? (digitada || 1) : digitada;
    _flEl(p + 'BRL').value = valor !== null && taxa ? finFormatarValor(valor * taxa, 'BRL') : '';
    const info = _flEl(p + 'Info');
    if (!info) return;
    if (origem !== undefined) info.dataset.origem = origem;
    info.textContent = moeda === 'BRL' ? '' : (taxa ? (info.dataset.origem || '') : `Sem cotação PTAX para ${moeda} — informe o câmbio.`);
}

// Câmbio pela PTAX da data (hoje, sem data) — a não ser que tenha sido digitado
async function _finLinhaCambio(p, { forcar = false } = {}) {
    const moeda = _flEl(p + 'Moeda')?.value || 'BRL';
    const campo = _flEl(p + 'Cambio');
    if (!campo) return;
    // Real: taxa 1 por padrão, mas o campo fica aberto para digitar outra
    if (moeda === 'BRL') {
        campo.disabled = !!campo.dataset.bloqueado;
        campo.placeholder = '1,0000';
        if (forcar || !campo.dataset.manual) { campo.value = ''; delete campo.dataset.manual; }
        return _finLinhaBRL(p, '');
    }
    campo.disabled = !!campo.dataset.bloqueado;
    campo.placeholder = '0,0000';
    if (forcar) delete campo.dataset.manual;
    if (campo.dataset.manual && campo.value) return _finLinhaBRL(p, 'taxa informada');
    const cot = await finCotacaoPtax(moeda, _flEl(p + 'Data')?.value || null);
    if (cot) {
        const anterior = campo.dataset.salvo;
        campo.value = _flTxtTaxa(cot.taxa);
        const [a, m, d] = cot.data.split('-');
        const antes = anterior && anterior !== campo.value ? ` (antes: ${anterior})` : '';
        _finLinhaBRL(p, `PTAX ${d}/${m}/${a}${cot.estimada ? ' (estimativa)' : ''}${antes}`);
    } else {
        campo.value = '';
        _finLinhaBRL(p, '');
    }
}

// v = { data, moeda, valor, cambio }
function finLinhaCarregar(p, v = {}) {
    _flEl(p + 'Data').value = v.data || '';
    const sel = _flEl(p + 'Moeda');
    sel.value = finMoedaParaOpcao(sel, v.moeda) || 'BRL';
    _flEl(p + 'Valor').value = _flTxtValor(v.valor);
    const campo = _flEl(p + 'Cambio');
    delete campo.dataset.manual; delete campo.dataset.salvo;
    if (Number(v.cambio) > 0) {
        campo.value = _flTxtTaxa(v.cambio);
        campo.dataset.salvo = campo.value;
        campo.disabled = !!campo.dataset.bloqueado;
        _finLinhaBRL(p, 'taxa salva');
    } else {
        campo.value = '';
        _finLinhaCambio(p);
    }
}

function finLinhaLer(p) {
    const moeda = _flEl(p + 'Moeda')?.value || 'BRL';
    return {
        data: _flEl(p + 'Data')?.value || null,
        moeda,
        valor: _flNum(_flEl(p + 'Valor')?.value),
        cambio: _flNum(_flEl(p + 'Cambio')?.value),   // Real sem taxa digitada = null
    };
}

function finMoedasPreencher(ids, moedas) {
    const html = moedas.map(m => `<option value="${escHtml(m.sigla || m.codigo)}">${escHtml(m.descricao || m.sigla || m.codigo)}</option>`).join('');
    ids.forEach(id => { const s = _flEl(id); if (s && html) s.innerHTML = html; });
}

// ── Plano de Contas → Categoria ──
const _flPlano = {};

function finPlanoMontar(px, contas) {
    _flPlano[px] = contas || [];
    const blocos = [...new Map(_flPlano[px].map(c => [String(c.bloco), c.bloco_nome])).entries()]
        .sort((a, b) => Number(a[0]) - Number(b[0]));
    _flEl(px + 'Bloco').innerHTML = '<option value="">Selecione o bloco...</option>'
        + blocos.map(([b, nome]) => `<option value="${escHtml(b)}">${escHtml(b + '. ' + nome)}</option>`).join('');
    _flEl(px + 'Bloco').onchange = () => _finPlanoCategorias(px, '');
    _finPlanoCategorias(px, '');
}

function _finPlanoCategorias(px, contaId) {
    const bloco = _flEl(px + 'Bloco').value;
    const sel = _flEl(px + 'Conta');
    if (!bloco) { sel.innerHTML = '<option value="">Escolha o Plano de Contas primeiro</option>'; sel.disabled = true; return; }
    const grupos = new Map();
    _flPlano[px].filter(c => String(c.bloco) === bloco).forEach(c => {
        const g = `${c.conta_codigo} — ${c.conta_nome}`;
        if (!grupos.has(g)) grupos.set(g, []);
        grupos.get(g).push(c);
    });
    sel.innerHTML = '<option value="">Selecione a categoria...</option>' + [...grupos.entries()].map(([g, lista]) =>
        `<optgroup label="${escHtml(g)}">${lista.map(c => `<option value="${escHtml(c.id)}" title="${escHtml(c.descricao || '')}">${escHtml(c.codigo + ' — ' + c.subfator_nome)}</option>`).join('')}</optgroup>`).join('');
    sel.disabled = false;
    sel.value = contaId || '';
}

function finPlanoDefinir(px, contaId) {
    const c = (_flPlano[px] || []).find(x => x.id === contaId);
    _flEl(px + 'Bloco').value = c ? String(c.bloco) : '';
    _finPlanoCategorias(px, c ? c.id : '');
}

function finPlanoConta(px) {
    const id = _flEl(px + 'Conta')?.value || '';
    return (_flPlano[px] || []).find(x => x.id === id) || null;
}

// ── Comprovante ──
const _flComp = {};

function finComprovanteCarregar(px, c) {
    _flComp[px] = { path: c?.comprovante_path || null, nome: c?.comprovante_nome || null, remover: false };
    _flEl(px + 'Comprovante').value = '';
    _finComprovanteRender(px);
}

function _finComprovanteRender(px) {
    const st = _flComp[px] || {};
    const box = _flEl(px + 'ComprovanteAtual');
    const arquivo = _flEl(px + 'Comprovante');
    if (st.path && !st.remover) {
        box.innerHTML = `<a href="#" class="fin-comp-link" data-px="${escHtml(px)}" onclick="finComprovanteAbrir(event, this.dataset.px)"><i class="fa-solid fa-paperclip"></i> ${escHtml(st.nome || 'comprovante')}</a>
            <button type="button" class="fin-comp-remover" data-px="${escHtml(px)}" onclick="finComprovanteRemover(this.dataset.px)" title="Remover comprovante"><i class="fa-solid fa-xmark"></i></button>`;
        arquivo.hidden = true;
    } else {
        box.innerHTML = '';
        arquivo.hidden = false;
    }
}

async function finComprovanteAbrir(ev, px) {
    ev.preventDefault();
    const st = _flComp[px];
    if (!st?.path) return;
    const { data, error } = await supabaseClient.storage.from(FIN_BUCKET_COMPROVANTES).createSignedUrl(st.path, 120);
    if (error || !data?.signedUrl) return mostrarNotificacao('Não foi possível abrir o comprovante.', 'error');
    window.open(data.signedUrl, '_blank', 'noopener');
}

function finComprovanteRemover(px) {
    if (_flComp[px]) _flComp[px].remover = true;
    _finComprovanteRender(px);
}

// Envia o arquivo escolhido (se houver). Devolve { campos, apagarDepois } —
// apagarDepois = arquivo antigo, removido só depois que a conta for salva.
async function finComprovanteParaSalvar(px, tabela) {
    const st = _flComp[px] || {};
    const file = _flEl(px + 'Comprovante')?.files?.[0];
    if (file) {
        if (file.size > 10 * 1024 * 1024) throw new Error('O comprovante deve ter no máximo 10 MB.');
        const u = obterUsuarioLogado();
        const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${u.empresa_id}/${tabela}/${Date.now()}_${nomeSeguro}`;
        const { error } = await supabaseClient.storage.from(FIN_BUCKET_COMPROVANTES).upload(path, file, { contentType: file.type || undefined });
        if (error) throw new Error('Não foi possível enviar o comprovante: ' + error.message);
        return { campos: { comprovante_path: path, comprovante_nome: file.name }, apagarDepois: st.path };
    }
    if (st.remover) return { campos: { comprovante_path: null, comprovante_nome: null }, apagarDepois: st.path };
    return { campos: {}, apagarDepois: null };
}

function finComprovanteApagar(path) {
    if (path) supabaseClient.storage.from(FIN_BUCKET_COMPROVANTES).remove([path]).catch(() => {});
}

// ── Seção 2 recolhível: aberta quando já há pagamento/recebimento registrado ──
function finSecaoPagAlternar(px, abrir) {
    const corpo = _flEl(px + 'PagCorpo');
    const aberta = abrir === undefined ? corpo.hidden : !!abrir;
    corpo.hidden = !aberta;
    _flEl(px + 'PagToggle')?.setAttribute('aria-expanded', String(aberta));
    _flEl(px + 'SecaoPagamento')?.classList.toggle('aberta', aberta);
}

// realizado = { data, valor, moeda } da conta, ou null
function finSecaoPagDefinir(px, realizado, palavra) {
    const resumo = _flEl(px + 'PagResumo');
    if (resumo) resumo.textContent = realizado
        ? `· ${palavra} em ${new Date(realizado.data + 'T12:00:00').toLocaleDateString('pt-BR')} · ${finFormatarValor(realizado.valor, realizado.moeda || 'BRL')}`
        : '';
    finSecaoPagAlternar(px, !!realizado);
}

// ── Seção 2 (realizado): só com acesso ao Financeiro ──
function finLancAplicarPermissao(px) {
    const pode = finLancPodePagar();
    document.querySelectorAll(`#${px}SecaoPagamento input, #${px}SecaoPagamento select, #${px}SecaoPagamento button`).forEach(el => {
        if (el.id === px + 'PagCambio') el.dataset.bloqueado = pode ? '' : '1';
        if (!pode) el.disabled = true;
        else if (el.id !== px + 'PagCambio') el.disabled = false;
    });
    _flEl(px + 'PagAviso').hidden = pode;
    return pode;
}

// Status automático: realizado → pago/recebido; previsão vencida → vencido
function finLancStatus(realizado, statusRealizado, dataPrevista, statusAtual) {
    if (statusAtual === 'cancelado') return 'cancelado';
    if (realizado) return statusRealizado;
    const hoje = new Date().toISOString().slice(0, 10);
    return dataPrevista && dataPrevista < hoje ? 'vencido' : 'pendente';
}
