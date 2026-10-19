// ========================================
// ASSINATURA DE PROFORMA — página pública (sem login)
// ========================================
// Aberta pelo link enviado no WhatsApp: assinar.html?t=<token>. Só conversa
// com o banco pelas funções assinatura_obter / assinatura_confirmar
// (database-assinatura-digital.sql), que validam o token.

const AS_BUCKET = 'proforma-documentos-assinados';
const asToken = new URLSearchParams(location.search).get('t') || '';
let asDados = null;
let asTemTraco = false;

const $ = id => document.getElementById(id);
const asEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const asNum = (n, d = 2) => Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const asData = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const AS_PAGAMENTO = { 'cartao-credito': 'Cartão de Crédito', 'cartao-debito': 'Cartão de Débito', boleto: 'Boleto Bancário',
    deposito: 'Depósito Bancário', swift: 'SWIFT', cad: 'CAD', '30-advanced': '30% ADVANCED', '70-against-document': '70% AGAINST DOCUMENT',
    duplicata: 'Duplicata Mercantil', dinheiro: 'Dinheiro', cheque: 'Cheque', avista: 'À Vista' };
const AS_MODAL = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' };

function asMostrar(id) {
    ['asCarregando', 'asErro', 'asConcluido', 'asConteudo'].forEach(x => { $(x).hidden = x !== id; });
}

function asErro(titulo, texto) {
    $('asErroTitulo').textContent = titulo;
    $('asErroTexto').textContent = texto;
    asMostrar('asErro');
}

async function asCarregar() {
    if (!asToken) return asErro('Link inválido', 'O link está incompleto. Abra novamente pelo link recebido no WhatsApp.');
    const { data, error } = await supabaseClient.rpc('assinatura_obter', { p_token: asToken });
    if (error || !data) return asErro('Não foi possível abrir', 'Tente novamente em alguns instantes.');
    if (data.erro) return asErro('Link inválido', 'Este link de assinatura não existe ou foi cancelado. Peça um novo link a quem enviou.');
    asDados = data;

    if (data.status === 'assinado') {
        $('asConcluidoTexto').textContent = `A Proforma ${data.proforma.codigo} já foi assinada por ${data.assinante_nome} em ${asData(data.assinado_em)}.`;
        return asMostrar('asConcluido');
    }
    if (data.status === 'expirado') return asErro('Link expirado', `Este link venceu em ${asData(data.expira_em)}. Peça um novo link a quem enviou.`);
    if (data.status !== 'pendente') return asErro('Link cancelado', 'Este link não é mais válido. Peça um novo link a quem enviou.');

    const p = data.proforma;
    $('asCodigo').textContent = p.codigo || '—';
    $('asCodigoAceite').textContent = p.codigo || '';
    $('asExportador').textContent = p.exportador || '—';
    $('asImportador').textContent = p.importador || '—';
    $('asImportadorDoc').textContent = p.importador_doc || '';
    $('asIncoterm').textContent = [p.incoterm, AS_MODAL[p.modal] || p.modal].filter(Boolean).join(' · ') || '—';
    $('asPagamento').textContent = [AS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento, AS_PAGAMENTO[p.prazo_pagamento] || (p.prazo_pagamento ? `${p.prazo_pagamento} dias` : '')].filter(Boolean).join(' · ') || '—';

    const itens = Array.isArray(p.itens) ? p.itens : [];
    const somas = {};
    $('asItens').innerHTML = itens.map(it => {
        const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0);
        somas[it.moeda || p.moeda || ''] = (somas[it.moeda || p.moeda || ''] || 0) + tot;
        return `<tr><td>${asEsc(it.produto)}</td><td class="dir">${asNum(it.qtd, 0)}</td><td>${asEsc(it.unidade || '')}</td><td class="dir">${asNum(it.preco)}</td><td class="dir">${asNum(tot)}</td></tr>`;
    }).join('') || '<tr><td colspan="5" class="vazio">Sem itens</td></tr>';
    $('asTotal').textContent = Object.entries(somas).map(([m, v]) => `${asNum(v)} ${m}`).join(' + ') || `${asNum(p.valor_total)} ${p.moeda || ''}`;

    if (data.arquivo_path) {
        // PDF em bucket privado: o link temporário foi gerado quando o link de
        // assinatura foi enviado (mesmo prazo). Links antigos: endereço público.
        let url = null;
        const r = await supabaseClient.rpc('assinatura_arquivo_url', { p_token: asToken });
        if (!r.error && typeof r.data === 'string' && /^https:\/\//.test(r.data)) url = r.data;
        if (!url) url = supabaseClient.storage.from(AS_BUCKET).getPublicUrl(data.arquivo_path).data?.publicUrl;
        if (url) { $('asLinkPdf').href = url; $('asLinkPdf').hidden = false; }
    }
    $('asValidade').textContent = `Link válido até ${asData(data.expira_em)}${data.criado_por ? ` · enviado por ${data.criado_por}` : ''}.`;
    asMostrar('asConteudo');
    asIniciarCanvas();
}

// ── Assinatura desenhada ───────────────────────────
function asIniciarCanvas() {
    const c = $('asCanvas');
    const ctx = c.getContext('2d');
    const ajustar = () => {
        const r = c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
        const img = asTemTraco ? c.toDataURL() : null;
        c.width = r.width * dpr; c.height = r.height * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0f172a';
        if (img) { const i = new Image(); i.onload = () => ctx.drawImage(i, 0, 0, r.width, r.height); i.src = img; }
    };
    ajustar();
    window.addEventListener('resize', ajustar);

    let desenhando = false;
    const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    c.addEventListener('pointerdown', e => { desenhando = true; c.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); });
    c.addEventListener('pointermove', e => {
        if (!desenhando) return;
        const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke();
        if (!asTemTraco) { asTemTraco = true; asValidar(); }
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => c.addEventListener(ev, () => { desenhando = false; }));
    $('asLimpar').addEventListener('click', () => { ctx.clearRect(0, 0, c.width, c.height); asTemTraco = false; asValidar(); });
}

function asValidar() {
    const ok = $('asNome').value.trim() && $('asDocumento').value.trim() && asTemTraco && $('asAceite').checked;
    $('asAssinar').disabled = !ok;
}

async function asHashPdf() {
    try {
        const href = $('asLinkPdf').href;
        if (!href || $('asLinkPdf').hidden) return '';
        const buf = await (await fetch(href)).arrayBuffer();
        const dig = await crypto.subtle.digest('SHA-256', buf);
        return [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2, '0')).join('');
    } catch { return ''; }
}

async function asAssinar() {
    const btn = $('asAssinar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Registrando assinatura...';
    $('asMsg').hidden = true;

    const imagem = $('asCanvas').toDataURL('image/png');
    const hash = await asHashPdf();
    const { data, error } = await supabaseClient.rpc('assinatura_confirmar', {
        p_token: asToken, p_nome: $('asNome').value, p_documento: $('asDocumento').value,
        p_cargo: $('asCargo').value, p_email: $('asEmail').value, p_imagem: imagem,
        p_hash: hash, p_user_agent: navigator.userAgent,
    });

    const motivos = { expirado: 'Este link expirou.', ja_assinado: 'Esta Proforma já foi assinada.', cancelado: 'Este link foi cancelado.',
        dados_incompletos: 'Preencha nome, documento e a assinatura.', imagem_grande: 'A assinatura ficou grande demais — limpe e desenhe de novo.' };
    if (error || !data || data.erro) {
        $('asMsg').textContent = motivos[data?.erro] || 'Não foi possível registrar a assinatura. Tente novamente.';
        $('asMsg').hidden = false;
        btn.innerHTML = '<i class="fa-solid fa-signature"></i> Assinar Proforma';
        asValidar();
        return;
    }
    $('asConcluidoTexto').textContent = `Obrigado, ${$('asNome').value.trim()}. A Proforma ${asDados.proforma.codigo} foi assinada em ${asData(data.assinado_em)}. Você já pode fechar esta página.`;
    asMostrar('asConcluido');
}

['asNome', 'asDocumento', 'asAceite'].forEach(id => $(id).addEventListener('input', asValidar));
$('asAceite').addEventListener('change', asValidar);
$('asAssinar').addEventListener('click', asAssinar);
asCarregar();
