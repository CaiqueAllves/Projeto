// ========================================
// LOGO e CONTAS BANCÁRIAS — componentes de tela
// ========================================
// Usados no cadastro de Empresa (formularios.html, parceiros) e no Perfil
// (dados da própria empresa). Gravação em supabase-api.js
// (enviarImagemLogo / salvarContasBancarias). Os PDFs (Proforma, Commercial
// Invoice, Packing List) usam o logo do Exportador e a conta escolhida na Proforma.

function _clcEsc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Logo ────────────────────────────────────────────────────────────────
// Estado por campo: arquivo escolhido (ainda não enviado), URL salva, removido.
const _logoCampos = {};

function logoCampoHtml(chave, titulo = 'Logo da empresa') {
    return `
        <div class="logo-campo" id="logo-campo-${chave}">
            <div class="logo-campo-preview" id="logo-preview-${chave}"><i class="fa-regular fa-image"></i></div>
            <div class="logo-campo-info">
                <strong>${_clcEsc(titulo)}</strong>
                <span>Aparece no cabeçalho da Proforma, Commercial Invoice e Packing List. PNG ou JPG, até 2 MB.</span>
                <div class="logo-campo-acoes">
                    <label class="logo-campo-btn"><i class="fa-solid fa-upload"></i> Escolher imagem
                        <input type="file" accept="image/png,image/jpeg,image/webp" hidden onchange="logoCampoEscolher('${chave}', this)">
                    </label>
                    <button type="button" class="logo-campo-btn logo-campo-btn--remover" id="logo-remover-${chave}" onclick="logoCampoRemover('${chave}')" style="display:none;">
                        <i class="fa-solid fa-trash"></i> Remover
                    </button>
                </div>
            </div>
        </div>`;
}

function _logoCampoMostrar(chave, src) {
    const prev = document.getElementById(`logo-preview-${chave}`);
    const rem = document.getElementById(`logo-remover-${chave}`);
    if (prev) prev.innerHTML = src ? `<img src="${_clcEsc(src)}" alt="Logo">` : '<i class="fa-regular fa-image"></i>';
    if (rem) rem.style.display = src ? '' : 'none';
}

function logoCampoDefinir(chave, url) {
    _logoCampos[chave] = { arquivo: null, url: url || null, removido: false };
    _logoCampoMostrar(chave, url);
}

function logoCampoEscolher(chave, input) {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > 2 * 1024 * 1024) { mostrarNotificacao('A imagem pode ter no máximo 2 MB.', 'aviso'); input.value = ''; return; }
    const est = (_logoCampos[chave] ||= { arquivo: null, url: null, removido: false });
    est.arquivo = arquivo; est.removido = false;
    const leitor = new FileReader();
    leitor.onload = e => _logoCampoMostrar(chave, e.target.result);
    leitor.readAsDataURL(arquivo);
}

function logoCampoRemover(chave) {
    const est = (_logoCampos[chave] ||= { arquivo: null, url: null, removido: false });
    est.arquivo = null; est.removido = true;
    _logoCampoMostrar(chave, null);
}

// Envia a imagem nova (se houver). Devolve { mudou, url } — url null = sem logo.
async function logoCampoResolver(chave, prefixo = 'logo') {
    const est = _logoCampos[chave];
    if (!est) return { mudou: false };
    if (est.arquivo) {
        const r = await window.supabaseAPI.enviarImagemLogo(est.arquivo, prefixo);
        if (!r.sucesso) { mostrarNotificacao('Não foi possível enviar o logo: ' + r.mensagem, 'erro'); return { mudou: false }; }
        est.url = r.url; est.arquivo = null;
        return { mudou: true, url: r.url };
    }
    if (est.removido) { est.url = null; est.removido = false; return { mudou: true, url: null }; }
    return { mudou: false };
}

// ── Contas bancárias ────────────────────────────────────────────────────
let _contaBancariaSeq = 0;
const CONTA_CAMPOS = [
    ['apelido',        'Identificação da conta', 'Ex.: Conta USD - Banco do Brasil'],
    ['beneficiario',   'Beneficiário (titular)', 'Se vazio, usa a razão social'],
    ['banco',          'Banco',                  'Nome ou código do banco'],
    ['agencia',        'Agência',                '0000'],
    ['conta',          'Conta',                  '000000-0'],
    ['tipo_conta',     'Tipo de conta',          ''],
    ['moeda',          'Moeda',                  'USD, EUR, BRL...'],
    ['swift',          'SWIFT / BIC',            'AAAABBCCXXX'],
    ['iban',           'IBAN',                   'BR00 0000 0000 0000000000000 00'],
    ['endereco_banco', 'Endereço do banco',      'Endereço completo da agência'],
];

function contaBancariaAdicionar(containerId, conta = {}) {
    const box = document.getElementById(containerId);
    if (!box) return;
    const n = ++_contaBancariaSeq;
    const div = document.createElement('div');
    div.className = 'conta-bancaria-item';
    div.dataset.id = conta.id || '';
    div.innerHTML = `
        <div class="conta-bancaria-cab">
            <span><i class="fa-solid fa-building-columns"></i> Conta bancária</span>
            <button type="button" class="conta-bancaria-remover" onclick="this.closest('.conta-bancaria-item').remove()" title="Remover conta"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div class="form-grid">
            ${CONTA_CAMPOS.map(([k, rot, ph]) => k === 'tipo_conta' ? `
                <div class="form-group">
                    <label for="cb-${k}-${n}">${rot}</label>
                    <select id="cb-${k}-${n}" data-campo="${k}">
                        <option value="">Selecione</option>
                        <option value="corrente">Conta Corrente</option>
                        <option value="poupanca">Conta Poupança</option>
                        <option value="pagamento">Conta de Pagamento</option>
                    </select>
                </div>` : `
                <div class="form-group${k === 'endereco_banco' || k === 'apelido' ? ' full-width' : ''}">
                    <label for="cb-${k}-${n}">${rot}</label>
                    <input type="text" id="cb-${k}-${n}" data-campo="${k}" placeholder="${_clcEsc(ph)}"${k === 'swift' ? ' style="text-transform:uppercase"' : ''} data-no-caps>
                </div>`).join('')}
        </div>`;
    box.appendChild(div);
    CONTA_CAMPOS.forEach(([k]) => { const el = div.querySelector(`[data-campo="${k}"]`); if (el && conta[k]) el.value = conta[k]; });
}

function contasBancariasRender(containerId, contas) {
    const box = document.getElementById(containerId);
    if (!box) return;
    box.innerHTML = '';
    (contas || []).forEach(c => contaBancariaAdicionar(containerId, c));
}

function contasBancariasColetar(containerId) {
    return [...document.querySelectorAll(`#${containerId} .conta-bancaria-item`)].map(div => {
        const c = { id: div.dataset.id || null };
        CONTA_CAMPOS.forEach(([k]) => { c[k] = (div.querySelector(`[data-campo="${k}"]`)?.value || '').trim(); });
        if (c.swift) c.swift = c.swift.toUpperCase();
        return c;
    });
}

// Texto curto de uma conta (seletor da Proforma)
function contaBancariaResumo(c) {
    const partes = [c.apelido, c.banco, c.moeda, c.conta ? `conta ${c.conta}` : '', c.iban ? `IBAN ${c.iban}` : ''].filter(Boolean);
    return partes.join(' · ') || 'Conta sem identificação';
}
