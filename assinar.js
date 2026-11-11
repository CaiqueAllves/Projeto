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
let asAssinatura = null;   // { nome, documento, cargo, email, imagem, hash, assinado_em }

const $ = id => document.getElementById(id);
const asEsc = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ── Idioma da página: o do link (&l=, vem do idioma da Proforma) ou o do navegador.
// Português, inglês e espanhol; os outros caem no inglês.
const AS_TEXTOS = {
    pt: {
        marca_sub: 'Gestão de Comércio Exterior', topo_titulo: 'Assinatura de Proforma', carregando: 'Carregando a Proforma...',
        link_invalido: 'Link inválido', link_inexistente: 'Este link de assinatura não existe ou foi cancelado. Peça um novo link a quem enviou.',
        link_incompleto: 'O link está incompleto. Abra novamente pelo link recebido no WhatsApp.',
        nao_abriu: 'Não foi possível abrir', tente: 'Tente novamente em alguns instantes.',
        expirado: 'Link expirado', expirado_txt: d => `Este link venceu em ${d}. Peça um novo link a quem enviou.`,
        cancelado: 'Link cancelado', cancelado_txt: 'Este link não é mais válido. Peça um novo link a quem enviou.',
        ja_assinada: (c, n, d) => `A Proforma ${c} já foi assinada por ${n} em ${d}.`,
        assinada_titulo: 'Proforma assinada', baixar: 'Baixar Proforma assinada', ver_pdf: 'Ver PDF completo',
        exportador: 'Exportador', importador: 'Importador', pagamento: 'Pagamento',
        produto: 'Produto', qtd: 'Qtd', un: 'Un.', preco: 'Preço', total: 'Total', sem_itens: 'Sem itens', dias: n => `${n} dias`,
        dados_assinante: 'Dados de quem assina', nome: 'Nome completo', documento: 'CPF / CNPJ / Passaporte', cargo: 'Cargo',
        assinatura: 'Assinatura', desenhe: '(desenhe com o dedo ou o mouse)', limpar: 'Limpar',
        aceite_a: 'Li a Proforma', aceite_b: 'e concordo com os seus termos. Reconheço esta assinatura eletrônica como válida, com a data, a hora e o endereço de acesso registrados.',
        assinar: 'Assinar Proforma', registrando: 'Registrando assinatura...', rodape: 'assinatura eletrônica',
        privacidade: 'Os dados informados (nome, documento, cargo, e-mail e assinatura), com data, hora, IP e navegador, ficam registrados como prova desta assinatura. Quem os controla é a empresa que enviou a Proforma; a Marpex os processa em nome dela.',
        privacidade_link: 'Política de Privacidade',
        validade: (d, por) => `Link válido até ${d}${por ? ` · enviado por ${por}` : ''}.`,
        motivos: { expirado: 'Este link expirou.', ja_assinado: 'Esta Proforma já foi assinada.', cancelado: 'Este link foi cancelado.',
            dados_incompletos: 'Preencha nome, documento e a assinatura.', imagem_grande: 'A assinatura ficou grande demais — limpe e desenhe de novo.' },
        erro_registrar: 'Não foi possível registrar a assinatura. Tente novamente.',
        obrigado: (n, c, d) => `Obrigado, ${n}. A Proforma ${c} foi assinada em ${d}. A sua via assinada está sendo baixada.`,
        pdf_falhou: ' Não foi possível gerar o PDF agora — toque em "Baixar Proforma assinada" para tentar de novo.',
        preparando: 'Preparando o PDF...',
        comp_titulo: 'COMPROVANTE DE ASSINATURA', assinado_por: 'Assinado por', assinado_em: 'Assinado em', hash: 'Hash SHA-256 do PDF',
        comp_texto: 'Assinatura eletrônica realizada pelo link enviado ao assinante, com aceite expresso dos termos da Proforma. '
            + 'Data/hora, endereço IP, navegador e hash do documento foram registrados no momento da assinatura '
            + '(MP 2.200-2/2001, art. 10, par. 2 - Lei 14.063/2020).',
        modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
        pag: { 'cartao-credito': 'Cartão de Crédito', 'cartao-debito': 'Cartão de Débito', boleto: 'Boleto Bancário', deposito: 'Depósito Bancário',
            duplicata: 'Duplicata Mercantil', dinheiro: 'Dinheiro', cheque: 'Cheque', avista: 'À Vista' },
    },
    en: {
        marca_sub: 'Foreign Trade Management', topo_titulo: 'Proforma Signature', carregando: 'Loading the Proforma...',
        link_invalido: 'Invalid link', link_inexistente: 'This signature link does not exist or was cancelled. Please ask the sender for a new link.',
        link_incompleto: 'The link is incomplete. Please open it again from the message you received.',
        nao_abriu: 'Could not open', tente: 'Please try again in a few moments.',
        expirado: 'Link expired', expirado_txt: d => `This link expired on ${d}. Please ask the sender for a new link.`,
        cancelado: 'Link cancelled', cancelado_txt: 'This link is no longer valid. Please ask the sender for a new link.',
        ja_assinada: (c, n, d) => `Proforma ${c} was already signed by ${n} on ${d}.`,
        assinada_titulo: 'Proforma signed', baixar: 'Download signed Proforma', ver_pdf: 'View full PDF',
        exportador: 'Exporter', importador: 'Importer', pagamento: 'Payment',
        produto: 'Product', qtd: 'Qty', un: 'Unit', preco: 'Price', total: 'Total', sem_itens: 'No items', dias: n => `${n} days`,
        dados_assinante: 'Signer details', nome: 'Full name', documento: 'Tax ID / Passport', cargo: 'Position',
        assinatura: 'Signature', desenhe: '(draw with your finger or mouse)', limpar: 'Clear',
        aceite_a: 'I have read Proforma', aceite_b: 'and agree to its terms. I acknowledge this electronic signature as valid, with the date, time and access address recorded.',
        assinar: 'Sign Proforma', registrando: 'Recording signature...', rodape: 'electronic signature',
        privacidade: 'The data provided (name, ID, position, e-mail and signature), together with date, time, IP address and browser, is recorded as evidence of this signature. It is controlled by the company that sent the Proforma; Marpex processes it on that company\'s behalf.',
        privacidade_link: 'Privacy Policy (in Portuguese)',
        validade: (d, por) => `Link valid until ${d}${por ? ` · sent by ${por}` : ''}.`,
        motivos: { expirado: 'This link has expired.', ja_assinado: 'This Proforma has already been signed.', cancelado: 'This link was cancelled.',
            dados_incompletos: 'Please fill in name, ID and the signature.', imagem_grande: 'The signature is too large — clear it and draw again.' },
        erro_registrar: 'Could not record the signature. Please try again.',
        obrigado: (n, c, d) => `Thank you, ${n}. Proforma ${c} was signed on ${d}. Your signed copy is being downloaded.`,
        pdf_falhou: ' The PDF could not be generated now — tap "Download signed Proforma" to try again.',
        preparando: 'Preparing the PDF...',
        comp_titulo: 'SIGNATURE CERTIFICATE', assinado_por: 'Signed by', assinado_em: 'Signed on', hash: 'PDF SHA-256 hash',
        comp_texto: 'Electronic signature made through the link sent to the signer, with express acceptance of the Proforma terms. '
            + 'Date/time, IP address, browser and document hash were recorded at the moment of signature '
            + '(Brazilian law: MP 2.200-2/2001, art. 10, par. 2 - Law 14.063/2020).',
        modal: { aereo: 'Air', maritimo: 'Sea', terrestre: 'Road' },
        pag: { 'cartao-credito': 'Credit Card', 'cartao-debito': 'Debit Card', boleto: 'Bank Slip', deposito: 'Bank Deposit',
            duplicata: 'Trade Bill', dinheiro: 'Cash', cheque: 'Check', avista: 'At sight' },
    },
    es: {
        marca_sub: 'Gestión de Comercio Exterior', topo_titulo: 'Firma de Proforma', carregando: 'Cargando la Proforma...',
        link_invalido: 'Enlace inválido', link_inexistente: 'Este enlace de firma no existe o fue cancelado. Solicite un nuevo enlace a quien lo envió.',
        link_incompleto: 'El enlace está incompleto. Ábralo nuevamente desde el mensaje recibido.',
        nao_abriu: 'No se pudo abrir', tente: 'Inténtelo de nuevo en unos instantes.',
        expirado: 'Enlace vencido', expirado_txt: d => `Este enlace venció el ${d}. Solicite un nuevo enlace a quien lo envió.`,
        cancelado: 'Enlace cancelado', cancelado_txt: 'Este enlace ya no es válido. Solicite un nuevo enlace a quien lo envió.',
        ja_assinada: (c, n, d) => `La Proforma ${c} ya fue firmada por ${n} el ${d}.`,
        assinada_titulo: 'Proforma firmada', baixar: 'Descargar Proforma firmada', ver_pdf: 'Ver PDF completo',
        exportador: 'Exportador', importador: 'Importador', pagamento: 'Pago',
        produto: 'Producto', qtd: 'Cant.', un: 'Un.', preco: 'Precio', total: 'Total', sem_itens: 'Sin ítems', dias: n => `${n} días`,
        dados_assinante: 'Datos de quien firma', nome: 'Nombre completo', documento: 'Identificación fiscal / Pasaporte', cargo: 'Cargo',
        assinatura: 'Firma', desenhe: '(dibuje con el dedo o el mouse)', limpar: 'Borrar',
        aceite_a: 'He leído la Proforma', aceite_b: 'y acepto sus términos. Reconozco esta firma electrónica como válida, con la fecha, la hora y la dirección de acceso registradas.',
        assinar: 'Firmar Proforma', registrando: 'Registrando la firma...', rodape: 'firma electrónica',
        privacidade: 'Los datos informados (nombre, identificación, cargo, correo y firma), junto con fecha, hora, IP y navegador, quedan registrados como prueba de esta firma. Los controla la empresa que envió la Proforma; Marpex los procesa en su nombre.',
        privacidade_link: 'Política de Privacidad (en portugués)',
        validade: (d, por) => `Enlace válido hasta ${d}${por ? ` · enviado por ${por}` : ''}.`,
        motivos: { expirado: 'Este enlace venció.', ja_assinado: 'Esta Proforma ya fue firmada.', cancelado: 'Este enlace fue cancelado.',
            dados_incompletos: 'Complete nombre, identificación y la firma.', imagem_grande: 'La firma quedó demasiado grande — bórrela y dibuje de nuevo.' },
        erro_registrar: 'No se pudo registrar la firma. Inténtelo de nuevo.',
        obrigado: (n, c, d) => `Gracias, ${n}. La Proforma ${c} fue firmada el ${d}. Su copia firmada se está descargando.`,
        pdf_falhou: ' No se pudo generar el PDF ahora — toque "Descargar Proforma firmada" para intentarlo de nuevo.',
        preparando: 'Preparando el PDF...',
        comp_titulo: 'COMPROBANTE DE FIRMA', assinado_por: 'Firmado por', assinado_em: 'Firmado el', hash: 'Hash SHA-256 del PDF',
        comp_texto: 'Firma electrónica realizada mediante el enlace enviado al firmante, con aceptación expresa de los términos de la Proforma. '
            + 'Fecha/hora, dirección IP, navegador y hash del documento fueron registrados en el momento de la firma '
            + '(ley brasileña: MP 2.200-2/2001, art. 10, párr. 2 - Ley 14.063/2020).',
        modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
        pag: { 'cartao-credito': 'Tarjeta de Crédito', 'cartao-debito': 'Tarjeta de Débito', boleto: 'Boleto Bancario', deposito: 'Depósito Bancario',
            duplicata: 'Letra Comercial', dinheiro: 'Efectivo', cheque: 'Cheque', avista: 'Al contado' },
    },
};
const AS_PAG_FIXOS = { swift: 'SWIFT', cad: 'CAD', '30-advanced': '30% ADVANCED', '70-against-document': '70% AGAINST DOCUMENT' };
const asIdioma = (() => {
    const pedido = (new URLSearchParams(location.search).get('l') || navigator.language || 'pt').slice(0, 2).toLowerCase();
    return AS_TEXTOS[pedido] ? pedido : 'en';
})();
const T = AS_TEXTOS[asIdioma];
const AS_LOCALE = { pt: 'pt-BR', en: 'en-US', es: 'es-ES' }[asIdioma];
const asNum = (n, d = 2) => Number(n || 0).toLocaleString(AS_LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
const asData = iso => iso ? new Date(iso).toLocaleString(AS_LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const AS_PAGAMENTO = { ...AS_PAG_FIXOS, ...T.pag };
const AS_MODAL = T.modal;
document.documentElement.lang = AS_LOCALE;
document.title = `${T.topo_titulo} — Marpex`;
document.querySelectorAll('[data-i18n]').forEach(el => { const v = T[el.dataset.i18n]; if (typeof v === 'string') el.textContent = v; });

function asMostrar(id) {
    ['asCarregando', 'asErro', 'asConcluido', 'asConteudo'].forEach(x => { $(x).hidden = x !== id; });
}

function asErro(titulo, texto) {
    $('asErroTitulo').textContent = titulo;
    $('asErroTexto').textContent = texto;
    asMostrar('asErro');
}

async function asCarregar() {
    if (!asToken) return asErro(T.link_invalido, T.link_incompleto);
    const { data, error } = await supabaseClient.rpc('assinatura_obter', { p_token: asToken });
    if (error || !data) return asErro(T.nao_abriu, T.tente);
    if (data.erro) return asErro(T.link_invalido, T.link_inexistente);
    asDados = data;

    if (data.status === 'assinado') {
        $('asConcluidoTexto').textContent = T.ja_assinada(data.proforma.codigo, data.assinante_nome, asData(data.assinado_em));
        // dados da assinatura (database-assinatura-download.sql): permite baixar de novo
        if (data.assinatura) { asAssinatura = data.assinatura; $('asBaixar').hidden = false; }
        return asMostrar('asConcluido');
    }
    if (data.status === 'expirado') return asErro(T.expirado, T.expirado_txt(asData(data.expira_em)));
    if (data.status !== 'pendente') return asErro(T.cancelado, T.cancelado_txt);

    const p = data.proforma;
    $('asCodigo').textContent = p.codigo || '—';
    $('asCodigoAceite').textContent = p.codigo || '';
    $('asExportador').textContent = p.exportador || '—';
    $('asImportador').textContent = p.importador || '—';
    $('asImportadorDoc').textContent = p.importador_doc || '';
    $('asIncoterm').textContent = [p.incoterm, AS_MODAL[p.modal] || p.modal].filter(Boolean).join(' · ') || '—';
    $('asPagamento').textContent = [AS_PAGAMENTO[p.forma_pagamento] || p.forma_pagamento, AS_PAGAMENTO[p.prazo_pagamento] || (p.prazo_pagamento ? T.dias(p.prazo_pagamento) : '')].filter(Boolean).join(' · ') || '—';

    const itens = Array.isArray(p.itens) ? p.itens : [];
    const somas = {};
    $('asItens').innerHTML = itens.map(it => {
        const tot = (Number(it.qtd) || 0) * (Number(it.preco) || 0);
        somas[it.moeda || p.moeda || ''] = (somas[it.moeda || p.moeda || ''] || 0) + tot;
        return `<tr><td>${asEsc(it.produto)}</td><td class="dir">${asNum(it.qtd, 0)}</td><td>${asEsc(it.unidade || '')}</td><td class="dir">${asNum(it.preco)}</td><td class="dir">${asNum(tot)}</td></tr>`;
    }).join('') || `<tr><td colspan="5" class="vazio">${T.sem_itens}</td></tr>`;
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
    $('asValidade').textContent = T.validade(asData(data.expira_em), data.criado_por);
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
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${T.registrando}`;
    $('asMsg').hidden = true;

    const imagem = $('asCanvas').toDataURL('image/png');
    const hash = await asHashPdf();
    const { data, error } = await supabaseClient.rpc('assinatura_confirmar', {
        p_token: asToken, p_nome: $('asNome').value, p_documento: $('asDocumento').value,
        p_cargo: $('asCargo').value, p_email: $('asEmail').value, p_imagem: imagem,
        p_hash: hash, p_user_agent: navigator.userAgent,
    });

    const motivos = T.motivos;
    if (error || !data || data.erro) {
        $('asMsg').textContent = motivos[data?.erro] || T.erro_registrar;
        $('asMsg').hidden = false;
        btn.innerHTML = `<i class="fa-solid fa-signature"></i> ${T.assinar}`;
        asValidar();
        return;
    }
    asAssinatura = { nome: $('asNome').value.trim(), documento: $('asDocumento').value.trim(), cargo: $('asCargo').value.trim(),
        email: $('asEmail').value.trim(), imagem, hash, assinado_em: data.assinado_em };
    $('asConcluidoTexto').textContent = T.obrigado(asAssinatura.nome, asDados.proforma.codigo, asData(data.assinado_em));
    $('asBaixar').hidden = false;
    asMostrar('asConcluido');
    asBaixarAssinada();
}

// ── Via assinada: PDF da Proforma + página de comprovante no fim (pdf-lib) ──
let _asPdfLib = null;
function asCarregarPdfLib() {
    if (window.PDFLib) return Promise.resolve();
    return _asPdfLib ||= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        s.integrity = 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';   // SRI
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { _asPdfLib = null; reject(new Error('Falha ao carregar o gerador de PDF.')); };
        document.head.appendChild(s);
    });
}

// A fonte padrão do PDF só tem os caracteres latinos (WinAnsi): o resto vira "?"
const asTextoPdf = v => String(v ?? '').replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');

async function asBaixarAssinada() {
    const a = asAssinatura;
    if (!a) return;
    const btn = $('asBaixar'), html = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> ${T.preparando}`;
    try {
        await asCarregarPdfLib();
        const { PDFDocument, StandardFonts, rgb } = PDFLib;
        let doc = null;
        // PDF original da Proforma (link temporário do mesmo prazo do link de assinatura)
        const r = await supabaseClient.rpc('assinatura_arquivo_url', { p_token: asToken });
        if (!r.error && typeof r.data === 'string' && /^https:\/\//.test(r.data)) {
            try { doc = await PDFDocument.load(await (await fetch(r.data)).arrayBuffer(), { ignoreEncryption: true }); } catch (_) { doc = null; }
        }
        if (!doc) doc = await PDFDocument.create();

        const pag = doc.addPage([595.28, 841.89]);   // A4 em pé
        const f = await doc.embedFont(StandardFonts.Helvetica), fb = await doc.embedFont(StandardFonts.HelveticaBold);
        const navy = rgb(10 / 255, 40 / 255, 90 / 255), cinza = rgb(100 / 255, 116 / 255, 139 / 255), preto = rgb(15 / 255, 23 / 255, 42 / 255);
        const M = 50, L = 595.28 - 2 * M;
        let y = 790;
        const txt = (t, x, yy, tam = 10, fonte = f, cor = preto) => pag.drawText(asTextoPdf(t), { x, y: yy, size: tam, font: fonte, color: cor });
        const quebrar = (t, tam, larg, fonte = f) => {
            const linhas = []; let atual = '';
            asTextoPdf(t).split(/\s+/).forEach(p => {
                const tenta = atual ? atual + ' ' + p : p;
                if (fonte.widthOfTextAtSize(tenta, tam) > larg && atual) { linhas.push(atual); atual = p; } else atual = tenta;
            });
            if (atual) linhas.push(atual);
            return linhas;
        };
        pag.drawRectangle({ x: 0, y: 812, width: 595.28, height: 30, color: navy });
        txt(T.comp_titulo, M, 822, 13, fb, rgb(1, 1, 1));
        txt(`Proforma ${asDados?.proforma?.codigo || ''}`, M, y - 20, 16, fb, navy);
        y -= 50;
        const linha = (rot, val) => {
            txt(rot, M, y, 9, fb, cinza);
            quebrar(val || '-', 10, L - 150).forEach((l, i) => txt(l, M + 150, y - i * 13, 10));
            y -= Math.max(1, quebrar(val || '-', 10, L - 150).length) * 13 + 6;
        };
        const p = asDados?.proforma || {};
        linha(T.exportador, p.exportador);
        linha(T.importador, [p.importador, p.importador_doc].filter(Boolean).join(' - '));
        linha(T.assinado_por, a.nome);
        linha(T.documento, a.documento);
        if (a.cargo) linha(T.cargo, a.cargo);
        if (a.email) linha('E-mail', a.email);
        linha(T.assinado_em, asData(a.assinado_em));
        linha(T.hash, a.hash || '-');
        y -= 10;
        txt(T.assinatura, M, y, 9, fb, cinza);
        y -= 8;
        pag.drawRectangle({ x: M, y: y - 130, width: L, height: 130, borderColor: rgb(0.82, 0.86, 0.92), borderWidth: 1 });
        if (a.imagem && /^data:image\/png;base64,/.test(a.imagem)) {
            try {
                const img = await doc.embedPng(a.imagem);
                const esc = Math.min((L - 20) / img.width, 120 / img.height);
                pag.drawImage(img, { x: M + (L - img.width * esc) / 2, y: y - 125, width: img.width * esc, height: img.height * esc });
            } catch (_) { /* imagem inválida: o quadro fica em branco */ }
        }
        y -= 150;
        quebrar(T.comp_texto, 8.5, L).forEach(l => { txt(l, M, y, 8.5, f, cinza); y -= 12; });

        const blob = new Blob([await doc.save()], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Proforma_${String(asDados?.proforma?.codigo || 'assinada').replace(/[^a-zA-Z0-9_-]/g, '_')}_assinada.pdf`;
        document.body.appendChild(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
        $('asConcluidoTexto').textContent += T.pdf_falhou;
    } finally {
        btn.disabled = false;
        btn.innerHTML = html;
    }
}

['asNome', 'asDocumento', 'asAceite'].forEach(id => $(id).addEventListener('input', asValidar));
$('asAceite').addEventListener('change', asValidar);
$('asAssinar').addEventListener('click', asAssinar);
$('asBaixar').addEventListener('click', asBaixarAssinada);
asCarregar();
