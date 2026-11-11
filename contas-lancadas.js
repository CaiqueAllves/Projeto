// ========================================
// CONTAS QUE LANCEI — janela para quem lança contas pelo Operacional
// ========================================
// Quem não tem o módulo Financeiro lança a PREVISÃO de contas pelos cards de
// Proforma/Processo (abrirJanelaConta, auth.js), mas não tinha onde ver o que
// lançou. Esta janela lista as contas a pagar e a receber criadas pelo próprio
// usuário, com a situação de cada uma; permite ver (só leitura) e excluir enquanto
// a conta não foi paga/recebida. O banco já garante isso (database-historico-contas.sql:
// quem lançou enxerga as próprias contas e exclui antes da baixa; alterar é do Financeiro).

let _clContas = [];

async function abrirContasLancadas() {
    document.getElementById('clOverlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'clOverlay';
    ov.className = 'cl-overlay';
    ov.innerHTML = `
        <div class="cl-janela" role="dialog" aria-modal="true" aria-labelledby="clTitulo">
            <div class="cl-cab">
                <h3 id="clTitulo"><i class="fa-solid fa-receipt"></i> Contas que lancei</h3>
                <button type="button" class="cl-fechar" title="Fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="cl-filtros">
                <label class="cl-filtro"><span class="rotulo">Situação</span>
                    <select id="clFiltroSituacao">
                        <option value="abertas">Em aberto</option>
                        <option value="baixadas">Pagas / recebidas</option>
                        <option value="">Todas</option>
                    </select>
                </label>
                <span class="cl-resumo" id="clResumo"></span>
            </div>
            <p class="cl-ajuda"><i class="fa-solid fa-circle-info"></i> Para corrigir uma conta em aberto, exclua e lance de novo pelo card do Processo. Depois de paga ou recebida, só o Financeiro altera.</p>
            <div class="cl-lista" id="clLista"><div class="cl-vazio"><i class="fa-solid fa-spinner fa-spin"></i> Carregando...</div></div>
        </div>`;
    document.body.appendChild(ov);
    const fechar = () => { document.removeEventListener('keydown', esc, true); ov.remove(); };
    const esc = e => { if (e.key === 'Escape' && !document.querySelector('.confirmar-overlay') && !document.getElementById('janelaConta')) fechar(); };
    document.addEventListener('keydown', esc, true);
    ov.querySelector('.cl-fechar').addEventListener('click', fechar);
    ov.addEventListener('mousedown', e => { if (e.target === ov) fechar(); });
    ov.querySelector('#clFiltroSituacao').addEventListener('change', _clRenderizar);
    ov.querySelector('#clLista').addEventListener('click', _clAcao);
    await _clCarregar();
}

async function _clCarregar() {
    const usuario = obterUsuarioLogado();
    if (!usuario?.id) return;
    const sel = 'id, descricao, status, data_vencimento, valor, moeda, valor_previsto, moeda_previsto, criado_em, processo_id, proforma_id, processos(numero_processo), proformas(codigo)';
    const buscar = async (tabela, baixa) => {
        let r = await supabaseClient.from(tabela).select(`${sel}, ${baixa}`).eq('criado_por', usuario.id).order('criado_em', { ascending: false }).limit(500);
        // banco sem alguma coluna/ligação nova: busca o básico
        if (r.error) r = await supabaseClient.from(tabela).select(`id, descricao, status, data_vencimento, valor, moeda, criado_em, ${baixa}`).eq('criado_por', usuario.id).order('criado_em', { ascending: false }).limit(500);
        return r;
    };
    const [p, r] = await Promise.all([buscar('contas_pagar', 'data_pagamento'), buscar('contas_receber', 'data_recebimento')]);
    if (p.error && r.error) {
        document.getElementById('clLista').innerHTML = `<div class="cl-vazio">Não foi possível carregar as contas: ${escHtml(p.error.message)}</div>`;
        return;
    }
    _clContas = [
        ...(p.data || []).map(c => ({ ...c, tipo: 'pagar', baixada: c.status === 'pago' || !!c.data_pagamento })),
        ...(r.data || []).map(c => ({ ...c, tipo: 'receber', baixada: c.status === 'recebido' || !!c.data_recebimento })),
    ].sort((a, b) => String(b.criado_em || '').localeCompare(String(a.criado_em || '')));
    _clRenderizar();
}

function _clSituacao(c) {
    if (c.status === 'cancelado') return ['Cancelada', 'cl-sit-cancelada'];
    if (c.baixada) return [c.tipo === 'pagar' ? 'Paga' : 'Recebida', 'cl-sit-baixada'];
    const hoje = new Date().toISOString().slice(0, 10);
    if (c.data_vencimento && c.data_vencimento < hoje) return ['Vencida', 'cl-sit-vencida'];
    return ['Prevista', 'cl-sit-prevista'];
}

function _clRenderizar() {
    const filtro = document.getElementById('clFiltroSituacao')?.value ?? 'abertas';
    const lista = _clContas.filter(c => !filtro || (filtro === 'abertas' ? !c.baixada && c.status !== 'cancelado' : c.baixada));
    const box = document.getElementById('clLista');
    if (!box) return;
    document.getElementById('clResumo').textContent = `${lista.length} de ${_clContas.length} conta(s)`;
    if (!lista.length) {
        box.innerHTML = `<div class="cl-vazio"><i class="fa-regular fa-folder-open"></i> ${_clContas.length ? 'Nenhuma conta nesta situação.' : 'Você ainda não lançou nenhuma conta. Lance pelo card do Processo (setas ↑ a pagar e ↓ a receber).'}</div>`;
        return;
    }
    const data = d => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—';
    box.innerHTML = lista.map(c => {
        const [sit, cls] = _clSituacao(c);
        const valor = c.valor_previsto ?? c.valor;
        const moeda = c.moeda_previsto || c.moeda || 'BRL';
        const ref = [c.processos?.numero_processo ? `Processo ${c.processos.numero_processo}` : '', c.proformas?.codigo ? `Proforma ${c.proformas.codigo}` : ''].filter(Boolean).join(' · ');
        return `
        <div class="cl-item">
            <div class="cl-item-topo">
                <span class="cl-tipo cl-tipo-${c.tipo}"><i class="fa-solid fa-arrow-${c.tipo === 'pagar' ? 'up' : 'down'}"></i> A ${c.tipo === 'pagar' ? 'pagar' : 'receber'}</span>
                <span class="cl-sit ${cls}">${sit}</span>
            </div>
            <div class="cl-desc">${escHtml(c.descricao || '—')}</div>
            ${ref ? `<div class="cl-ref">${escHtml(ref)}</div>` : ''}
            <div class="cl-linha">
                <span><span class="cl-rot">Vencimento</span> ${data(c.data_vencimento)}</span>
                <span><span class="cl-rot">Valor previsto</span> ${escHtml(typeof finFormatarValor === 'function' ? finFormatarValor(valor, moeda) : `${moeda} ${Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)}</span>
            </div>
            <div class="cl-acoes">
                <button type="button" class="cl-btn" data-acao="ver" data-tipo="${c.tipo}" data-id="${escHtml(c.id)}"><i class="fa-solid fa-eye"></i> Ver</button>
                ${!c.baixada && c.status !== 'cancelado' ? `<button type="button" class="cl-btn cl-btn-perigo" data-acao="excluir" data-tipo="${c.tipo}" data-id="${escHtml(c.id)}"><i class="fa-solid fa-trash"></i> Excluir</button>` : ''}
            </div>
        </div>`;
    }).join('');
}

async function _clAcao(e) {
    const btn = e.target.closest('button[data-acao]');
    if (!btn) return;
    const { acao, tipo, id } = btn.dataset;
    if (acao === 'ver') { abrirJanelaConta(tipo, `ver=${encodeURIComponent(id)}`); return; }
    if (acao !== 'excluir') return;
    const c = _clContas.find(x => x.id === id);
    const ok = await confirmarAcao(`Excluir a conta a ${tipo === 'pagar' ? 'pagar' : 'receber'} "${c?.descricao || ''}"? Fica registrado no Histórico.`,
        { titulo: 'Excluir conta', confirmar: 'Excluir', perigo: true });
    if (!ok) return;
    btn.disabled = true;
    const { data, error } = await supabaseClient.from(tipo === 'pagar' ? 'contas_pagar' : 'contas_receber').delete().eq('id', id).select('id');
    if (error || !data?.length) {
        btn.disabled = false;
        mostrarNotificacao('Não foi possível excluir: ' + (error?.message || 'a conta já foi paga/recebida ou você não tem permissão.'), 'erro');
        return;
    }
    mostrarNotificacao('Conta excluída.', 'sucesso');
    _clContas = _clContas.filter(x => x.id !== id);
    _clRenderizar();
}
