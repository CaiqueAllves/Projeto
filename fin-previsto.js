// ========================================
// PREVISTO × REVISADO × PAGO nas Contas a Pagar / Receber
// ========================================
// database-financeiro-previsto-revisado.sql. Cada conta guarda:
//   Previsto — valor_previsto, cambio_previsto, previsto_em (abertura)
//   Revisado — valor_revisado, cambio_revisado, revisado_em (opcional)
//   Pago     — valor + cambio da própria conta
// Seção recolhível no modal (px = 'cp' / 'cr'); precisa de fin-moeda.js.

function finPrevistoMontar(px) {
    const box = document.getElementById(px + 'PrevistoBox');
    if (!box || box.dataset.montado) return;
    box.dataset.montado = '1';
    box.innerHTML = `
        <div class="fin-form-row">
            <div class="fin-form-group fin-full pl-obs-wrapper">
                <div class="pl-obs-toggle" onclick="finPrevistoAlternar('${px}')">
                    <span>Previsto / Revisado <small class="fin-prev-resumo" id="${px}PrevResumo"></small></span>
                    <i class="fa-solid fa-chevron-down pl-obs-icon"></i>
                </div>
                <div class="fin-prev-corpo" id="${px}PrevCorpo" hidden>
                    <div class="fin-prev-linha">
                        <span class="rotulo fin-prev-tit">Previsto (abertura)</span>
                        <label class="fin-prev-campo">Valor<input type="text" id="${px}ValorPrevisto" inputmode="decimal" placeholder="= valor da conta" oninput="finPrevistoMascara(this)"></label>
                        <label class="fin-prev-campo fin-prev-cambio">Câmbio<input type="text" id="${px}CambioPrevisto" inputmode="decimal" placeholder="PTAX do dia"></label>
                        <label class="fin-prev-campo">Data<input type="date" id="${px}PrevistoEm"></label>
                    </div>
                    <div class="fin-prev-linha">
                        <span class="rotulo fin-prev-tit">Revisado (opcional)</span>
                        <label class="fin-prev-campo">Valor<input type="text" id="${px}ValorRevisado" inputmode="decimal" placeholder="0,00" oninput="finPrevistoMascara(this)"></label>
                        <label class="fin-prev-campo fin-prev-cambio">Câmbio<input type="text" id="${px}CambioRevisado" inputmode="decimal" placeholder="PTAX da data"></label>
                        <label class="fin-prev-campo">Data<input type="date" id="${px}RevisadoEm"></label>
                    </div>
                    <small class="fin-cambio-info">O previsto é preenchido sozinho ao criar a conta (valor e câmbio do dia). O valor pago/recebido é o Valor da conta, com o câmbio da data de pagamento.</small>
                </div>
            </div>
        </div>`;
    document.getElementById(px + 'Moeda')?.addEventListener('change', () => _finPrevistoCambioVisivel(px));
}

function finPrevistoAlternar(px) {
    const corpo = document.getElementById(px + 'PrevCorpo');
    corpo.hidden = !corpo.hidden;
    corpo.closest('.pl-obs-wrapper')?.querySelector('.pl-obs-toggle')?.classList.toggle('aberto', !corpo.hidden);
}

function finPrevistoMascara(el) {
    let raw = el.value.replace(/[^\d,]/g, '');
    const p = raw.split(',');
    if (p.length > 2) raw = p[0] + ',' + p.slice(1).join('');
    const q = raw.split(',');
    q[0] = q[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    el.value = q.join(',');
}

const _finNum = v => { const n = parseFloat(String(v || '').replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const _finTxtValor = n => n === null || n === undefined ? '' : Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _finTxtTaxa = n => Number(n) > 0 ? Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 }) : '';

function _finPrevistoCambioVisivel(px) {
    const estrangeira = (document.getElementById(px + 'Moeda')?.value || 'BRL') !== 'BRL';
    document.querySelectorAll(`#${px}PrevCorpo .fin-prev-cambio`).forEach(el => { el.hidden = !estrangeira; });
}

// Preenche a seção com a conta aberta no modal (c = null para conta nova)
function finPrevistoCarregar(px, c) {
    finPrevistoMontar(px);
    const g = id => document.getElementById(px + id);
    g('ValorPrevisto').value  = _finTxtValor(c?.valor_previsto);
    g('CambioPrevisto').value = _finTxtTaxa(c?.cambio_previsto);
    g('PrevistoEm').value     = c?.previsto_em || '';
    g('ValorRevisado').value  = _finTxtValor(c?.valor_revisado);
    g('CambioRevisado').value = _finTxtTaxa(c?.cambio_revisado);
    g('RevisadoEm').value     = c?.revisado_em || '';
    g('PrevCorpo').hidden = true;
    g('PrevCorpo').closest('.pl-obs-wrapper')?.querySelector('.pl-obs-toggle')?.classList.remove('aberto');
    const resumo = [];
    if (c?.valor_previsto != null) resumo.push(`previsto ${_finTxtValor(c.valor_previsto)}`);
    if (c?.valor_revisado != null) resumo.push(`revisado ${_finTxtValor(c.valor_revisado)}`);
    g('PrevResumo').textContent = resumo.length ? `· ${resumo.join(' · ')}` : '';
    _finPrevistoCambioVisivel(px);
}

// Campos a gravar. Sem previsto informado: valor e câmbio atuais da conta
// (ou PTAX do dia), data de hoje. Revisado sem data: hoje; sem câmbio em
// moeda estrangeira: PTAX da data da revisão.
async function finPrevistoParaSalvar(px, valorConta, cambioConta) {
    const g = id => document.getElementById(px + id);
    const moeda = g('Moeda')?.value || 'BRL';
    const estrangeira = moeda !== 'BRL';
    const hoje = new Date().toISOString().slice(0, 10);
    const ptax = async (data) => estrangeira ? ((await finCotacaoPtax(moeda, data))?.taxa || null) : null;

    const previstoEm = g('PrevistoEm').value || hoje;
    const valorPrevisto = _finNum(g('ValorPrevisto').value) ?? valorConta;
    let cambioPrevisto = estrangeira ? _finNum(g('CambioPrevisto').value) : null;
    if (estrangeira && !cambioPrevisto) cambioPrevisto = cambioConta || await ptax(previstoEm);

    const valorRevisado = _finNum(g('ValorRevisado').value);
    let revisadoEm = null, cambioRevisado = null;
    if (valorRevisado !== null) {
        revisadoEm = g('RevisadoEm').value || hoje;
        cambioRevisado = estrangeira ? (_finNum(g('CambioRevisado').value) || await ptax(revisadoEm)) : null;
    }
    return {
        valor_previsto: valorPrevisto, cambio_previsto: cambioPrevisto, previsto_em: previstoEm,
        valor_revisado: valorRevisado, cambio_revisado: cambioRevisado, revisado_em: revisadoEm,
    };
}
