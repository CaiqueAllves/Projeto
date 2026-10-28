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

// Travas da conta (mesma regra das policies em database-historico-contas.sql):
//   antes da baixa → exclui quem lançou ou o Financeiro;
//   depois da baixa (pago/recebido) → alterar ou excluir só o administrador (master).
function finContaBaixada(c) {
    return !!c && (c.status === 'pago' || c.status === 'recebido' || !!c.data_pagamento || !!c.data_recebimento);
}
function _finEhAdmin() {
    const u = typeof obterUsuarioLogado === 'function' ? obterUsuarioLogado() : null;
    return u?.perfil === 'admin';
}
function finContaPodeAlterar(c) {
    return !finContaBaixada(c) || _finEhAdmin();
}
function finContaPodeExcluir(c) {
    if (!c) return false;
    if (finContaBaixada(c)) return _finEhAdmin();
    const u = typeof obterUsuarioLogado === 'function' ? obterUsuarioLogado() : null;
    return finLancPodePagar() || (!!u?.id && String(c.criado_por || '') === String(u.id));
}
function finContaAvisoTravada(acao) {
    mostrarNotificacao(`Conta já baixada (pagamento confirmado): só o administrador pode ${acao}.`, 'warning');
    return false;
}
// Editar conta já baixada (só o administrador chega aqui): janela de aviso antes
function finContaConfirmarEdicao() {
    return confirmarAcao(
        'Esta conta já teve o pagamento confirmado (baixa feita pelo Financeiro). Alterar valores, datas ou o comprovante muda um lançamento fechado'
        + ' — a alteração fica registrada no Histórico com o seu nome.',
        { titulo: 'Alterar conta já paga?', confirmar: 'Sim, alterar', cancelar: 'Não' });
}
function finContaAvisoSemExcluir() {
    mostrarNotificacao('Só quem lançou a conta ou o Financeiro pode excluí-la.', 'warning');
    return false;
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

// ── Meio de pagamento: "Outro" abre um campo para descrever ──
// Gravado junto em meio_pagamento como "outro: DESCRIÇÃO" (sem coluna nova).
function finMeioAlterado(px) {
    const outro = _flEl(px + 'MeioPagamento')?.value === 'outro';
    _flEl(px + 'MeioOutroGrupo').hidden = !outro;
    if (outro) _flEl(px + 'MeioOutro')?.focus();
}

function finMeioCarregar(px, valor) {
    const v = String(valor || '');
    const outro = /^outro(:|$)/i.test(v);
    _flEl(px + 'MeioPagamento').value = outro ? 'outro' : v;
    _flEl(px + 'MeioOutro').value = outro ? v.replace(/^outro:?\s*/i, '') : '';
    _flEl(px + 'MeioOutroGrupo').hidden = !outro;
}

function finMeioLer(px) {
    const v = _flEl(px + 'MeioPagamento')?.value || '';
    if (v !== 'outro') return v || null;
    const desc = (_flEl(px + 'MeioOutro')?.value || '').trim().toUpperCase();
    return desc ? `outro: ${desc}` : 'outro';
}

// ── Modo "Ver" (só leitura): esconde o Salvar e trava os campos; as seções
// recolhíveis e o link do comprovante continuam funcionando ──
function finLancModoVer(px, ligar, titulo) {
    const modal = document.querySelector(`#${px}ModalOverlay .fin-modal`);
    if (!modal) return;
    modal.classList.toggle('fin-modo-ver', !!ligar);
    const salvar = _flEl(px + 'BtnSalvar');
    if (salvar) salvar.hidden = !!ligar;
    if (ligar && titulo) _flEl(px + 'ModalTitulo').innerHTML = `<i class="fa-solid fa-eye"></i> ${escHtml(titulo)}`;
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
    _flComp[px] = { path: c?.comprovante_path || null, nome: c?.comprovante_nome || null, remover: false, baixada: finContaBaixada(c) };
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

// Conta já baixada: o comprovante é o que confirma o pagamento — avisa antes
// de tirar (sem ele a conta não pode continuar como paga).
async function finComprovanteRemover(px) {
    const st = _flComp[px];
    if (!st) return;
    if (st.baixada) {
        if (!_finEhAdmin()) return finContaAvisoTravada('remover ou trocar o comprovante');
        const ok = await confirmarAcao(
            'Este comprovante confirma um pagamento já baixado. Ao removê-lo, a conta só poderá ser salva com um novo comprovante'
            + ' (ou com o pagamento desfeito). A alteração fica registrada no Histórico.',
            { titulo: 'Remover comprovante de conta paga?', confirmar: 'Sim, remover', cancelar: 'Não', perigo: true });
        if (!ok) return;
    }
    st.remover = true;
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

// Há comprovante para esta conta? (arquivo escolhido agora ou já anexado e não removido)
function finComprovanteTem(px) {
    const st = _flComp[px] || {};
    return !!_flEl(px + 'Comprovante')?.files?.length || (!!st.path && !st.remover);
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

// Data de pagamento/recebimento realizado não pode ser futura (data local de hoje)
function finHojeLocal() {
    const d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
function finLancLimitarDataRealizada(px) {
    const el = _flEl(px + 'PagData');
    if (el) el.max = finHojeLocal();
}

// Status automático: realizado → pago/recebido; previsão vencida → vencido
function finLancStatus(realizado, statusRealizado, dataPrevista, statusAtual) {
    if (statusAtual === 'cancelado') return 'cancelado';
    if (realizado) return statusRealizado;
    const hoje = new Date().toISOString().slice(0, 10);
    return dataPrevista && dataPrevista < hoje ? 'vencido' : 'pendente';
}

// ── Commercial Invoice vinculada ──────────────────────────────────────────
// Lista as Commercial Invoices dos Processos disponíveis (nº em
// processos.documentos.commercial — 1 por Processo). Escolher a CI escolhe o
// Processo; escolher o Processo seleciona a CI dele. Grava o nº em
// commercial_invoice.
const _finCIProcessos = {};
const _finCISalvo = {};

// processos: lista nova (id, numero_processo, documentos); undefined = mantém
async function finCIAtualizar(px, processos, buscarProcessoId) {
    if (buscarProcessoId) {
        const { data } = await supabaseClient.from('processos').select('id, numero_processo, documentos').eq('id', buscarProcessoId).maybeSingle();
        processos = data ? [data] : [];
    }
    if (processos !== undefined) _finCIProcessos[px] = processos || [];
    const sel = document.getElementById(px + 'CommercialInvoice');
    if (!sel) return;
    const lista = (_finCIProcessos[px] || []).filter(p => String(p.documentos?.commercial || '').trim());
    const procId = document.getElementById(px + 'ProcessoId').value;
    const doProc = lista.find(p => String(p.id) === String(procId));
    const salvo = _finCISalvo[px] || '';
    const opcoes = lista.map(p => ({ valor: String(p.documentos.commercial).trim(), proc: p }));
    if (salvo && !opcoes.some(o => o.valor === salvo)) opcoes.unshift({ valor: salvo, proc: null });
    sel.innerHTML = `<option value="">${opcoes.length ? 'Selecione...' : 'Nenhuma Commercial Invoice'}</option>`
        + opcoes.map(o => `<option value="${escHtml(o.valor)}" data-proc="${o.proc ? escHtml(o.proc.id) : ''}" data-proc-nome="${o.proc ? escHtml(o.proc.numero_processo || '') : ''}">${escHtml(o.valor)}${o.proc ? ' — ' + escHtml(o.proc.numero_processo || '') : ''}</option>`).join('');
    // a CI do Processo escolhido; senão a que estava gravada
    sel.value = doProc ? String(doProc.documentos.commercial).trim() : salvo;
    sel.disabled = !opcoes.length;
    finEmbarqueAtualizar(px);
}

function finCIAlterado(px) {
    const sel = document.getElementById(px + 'CommercialInvoice');
    _finCISalvo[px] = sel.value;
    const op = sel.selectedOptions[0];
    if (op?.dataset.proc) {
        document.getElementById(px + 'ProcessoId').value = op.dataset.proc;
        document.getElementById(px + 'ProcessoNome').value = op.dataset.procNome || '';
    }
}

function finCICarregar(px, valor) {
    _finCISalvo[px] = String(valor || '').trim();
    _finCIProcessos[px] = [];
    finCIAtualizar(px);
}

function finCILer(px) {
    return document.getElementById(px + 'CommercialInvoice')?.value || null;
}

// ── Embarque confirmado → Financeiro (database-embarque-contas.sql) ───────
// A confirmação do embarque é a Data de Embarque do Processo vinculado:
//   Contas a Receber → vencimento = embarque + prazo da Proforma (À vista = 0);
//     antes do embarque, a previsão digitada vale só como estimativa.
//   Contas a Pagar (custas) → o pagamento só pode ser confirmado depois do embarque.
const _finEmb = {};

function _finDiasPrazo(prazo) {
    if (prazo === 'avista') return 0;
    return /^\d{1,4}$/.test(String(prazo || '')) ? Number(prazo) : null;
}
function _finSomarDias(iso, dias) {
    const d = new Date(String(iso).slice(0, 10) + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
}
const _finDataBR = iso => new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR');

async function finEmbarqueAtualizar(px) {
    const procId = _flEl(px + 'ProcessoId')?.value || '';
    const token = (_finEmb[px]?.token || 0) + 1;
    _finEmb[px] = { token, procId, bloqueiaPagamento: false };
    let proc = null, prazo = null;
    if (procId) {
        const { data } = await supabaseClient.from('processos').select('numero_processo, data_embarque, proforma_id').eq('id', procId).maybeSingle();
        if (data?.proforma_id) {
            const { data: prof } = await supabaseClient.from('proformas').select('prazo_pagamento').eq('id', data.proforma_id).maybeSingle();
            prazo = prof?.prazo_pagamento ?? null;
        }
        proc = data;
    }
    if (_finEmb[px].token !== token) return;   // processo trocado no meio da busca

    const info = _flEl(px + 'EmbarqueInfo');
    const baixada = !!_flComp[px]?.baixada;
    const embarque = proc?.data_embarque ? String(proc.data_embarque).slice(0, 10) : '';
    const numero = escHtml(proc?.numero_processo || '');
    let texto = '';

    if (px === 'cr' && proc) {
        const dias = _finDiasPrazo(prazo);
        const prazoTxt = dias === 0 ? 'à vista' : `+ ${dias} dias`;
        if (dias !== null && embarque) {
            if (!baixada) {
                const venc = _finSomarDias(embarque, dias);
                const campo = _flEl('crPrevData');
                if (campo && campo.value !== venc) campo.value = venc;
            }
            texto = `<i class="fa-solid fa-ship"></i> Vencimento conta do embarque confirmado em ${_finDataBR(embarque)} (${prazoTxt}, prazo da Proforma).`;
        } else if (dias !== null) {
            texto = `<i class="fa-solid fa-ship"></i> Embarque do Processo ${numero} ainda não confirmado: a previsão é estimativa — o vencimento será recalculado na Data de Embarque (${prazoTxt}).`;
        }
    }
    if (px === 'cp' && proc && !embarque && !baixada) {
        _finEmb[px].bloqueiaPagamento = true;
        texto = `<i class="fa-solid fa-ship"></i> Custas do Processo ${numero}: o pagamento só pode ser confirmado depois da confirmação do embarque.`;
    }
    if (info) { info.innerHTML = texto; info.hidden = !texto; }

    const aviso = _flEl(px + 'PagEmbarqueAviso');
    if (aviso) {
        aviso.querySelector('span').textContent = `Pagamento liberado após a confirmação do embarque do Processo ${proc?.numero_processo || ''} (Data de Embarque no Processo).`;
        aviso.hidden = !_finEmb[px].bloqueiaPagamento;
    }
    if (_finEmb[px].bloqueiaPagamento) {
        document.querySelectorAll(`#${px}PagCorpo input, #${px}PagCorpo select, #${px}PagCorpo button`).forEach(el => { el.disabled = true; });
    } else if (px === 'cp' && !_flEl(px + 'ModalOverlay')?.querySelector('.fin-modo-ver')) {
        finLancAplicarPermissao(px);
    }
}

function finEmbarqueBloqueiaPagamento(px) {
    return !!_finEmb[px]?.bloqueiaPagamento;
}

// ── Caixa alta (padrão dos formulários do sistema — formularios.js/_ativarMaiusculas) ──
// Textos do formulário de Conta em MAIÚSCULAS ao digitar e ao abrir uma conta
// antiga para editar (a gravação leva o que está nos campos). Valores e câmbio
// (inputmode decimal) ficam de fora.
function _finCamposTexto(px) {
    return [...document.querySelectorAll(`#${px}ModalOverlay input[type="text"], #${px}ModalOverlay textarea`)]
        .filter(el => !el.readOnly && el.inputMode !== 'decimal' && !el.dataset.noCaps);
}
function finLancMaiusculasAplicar(px) {
    _finCamposTexto(px).forEach(el => { if (el.value) el.value = el.value.toUpperCase(); });
}
document.addEventListener('DOMContentLoaded', () => {
    ['cp', 'cr'].forEach(px => _finCamposTexto(px).forEach(el =>
        el.addEventListener('input', () => {
            const ini = el.selectionStart, fim = el.selectionEnd;
            const maiusc = el.value.toUpperCase();
            if (maiusc !== el.value) { el.value = maiusc; try { el.setSelectionRange(ini, fim); } catch (_) {} }
        })));
});
