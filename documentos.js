// ========================================
// DOCUMENTOS — status de documentos por Proforma
// ========================================
// Não existe assinatura digital real nessa aplicação: o status de cada
// documento é marcado manualmente pelo usuário. A lista de documentos de
// uma Proforma é: um conjunto fixo (universal) + o conjunto específico
// do(s) modal(is) de transporte dos Processos gerados a partir dela (uma
// Proforma pode gerar N) + quaisquer tipos customizados que o usuário
// tenha adicionado.
// Taxonomia (DOC_TIPOS_UNIVERSAIS/DOC_TIPOS_MODAL/DOC_MODAL_LABEL) e os
// helpers docTiposDaProforma()/docFeitoAutomatico() vêm de doc-tipos.js,
// compartilhado com a seção "Pendências do Sistema" em inicio.js.

const DOC_LABELS_PROFORMA = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
const DOC_LABELS_PROCESSO = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };

let _docProformas    = [];
let _docSalvos       = {};   // proforma_id -> { tipo_documento -> registro }
let _docFiltroAtual  = 'todos';
let _docNovoEmProforma = null;   // 'proformaId|processoId' do bloco com a linha de "novo documento" aberta
let _docExpandidos   = new Set(); // ids de proforma expandidos manualmente
let _docRecolhidos   = new Set(); // ids de proforma recolhidos manualmente (vence a expansão forçada por filtro/busca)

let _docProformaUnica = null;     // id da proforma quando a tela roda dentro da janela do card (proforma.html)
let _docProcessoUnico = null;     // id do processo quando a janela foi aberta pelo card de Processo

// A lista completa só carrega sozinha na página que já tem o container;
// na tela de Proformas ele é criado ao abrir a janela de documentos do card.
document.addEventListener('DOMContentLoaded', async () => {
    if (document.getElementById('documentosContainer')) await docCarregar();
});

function _docEmissorNome(p) {
    if (p.emissor_tipo === 'terceiro') {
        return p.parceiro?.nome_fantasia || p.parceiro?.razao_social || p.parceiro_razao_social || '—';
    }
    return 'Própria empresa';
}

function _docDestinatarioNome(p) {
    if (p.destinatario_emp?.razao_social) {
        return p.destinatario_emp.nome_fantasia || p.destinatario_emp.razao_social;
    }
    return p.destinatario_razao_social || '—';
}

// opcoes.proformaId: carrega só essa proforma e mostra direto a tabela de
// documentos dela (janela "Documentos" do card da Proforma).
async function docCarregar(opcoes = {}) {
    const container = document.getElementById('documentosContainer');
    container.innerHTML = '<div class="doc-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';
    _docProformaUnica = opcoes.proformaId ? String(opcoes.proformaId) : null;
    _docProcessoUnico = opcoes.processoId ? String(opcoes.processoId) : null;
    _docNovoEmProforma = null;

    const usuario = obterUsuarioLogado();
    let query = supabaseClient.from('proformas').select('*').neq('status', 'excluido').order('created_at', { ascending: false });
    if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
    if (_docProformaUnica) query = query.eq('id', _docProformaUnica);
    const { data, error } = await query;
    if (error) {
        container.innerHTML = '<div class="doc-vazio">Erro ao carregar proformas.</div>';
        return;
    }
    _docProformas = data || [];

    // parceiro_id/destinatario_id são BIGINT — referenciam "parceiros".
    const empresaIds = [...new Set([
        ..._docProformas.map(p => p.parceiro_id).filter(Boolean),
        ..._docProformas.map(p => p.destinatario_id).filter(Boolean),
    ])];
    let empresaMap = {};
    if (empresaIds.length > 0) {
        const { data: parc } = await supabaseClient
            .from('parceiros').select('id, razao_social, nome_fantasia').in('id', empresaIds);
        (parc || []).forEach(e => { empresaMap[e.id] = e; });
    }

    const proformaIds = _docProformas.map(p => p.id).filter(Boolean);
    let processosMap = {};
    if (proformaIds.length > 0) {
        const { data: procs } = await supabaseClient
            .from('processos').select('id, numero_processo, status, proforma_id, modal, tipo, documentos, criado_em, criado_por').in('proforma_id', proformaIds).neq('status', 'excluido')
            .order('criado_em', { ascending: true }).order('numero_processo', { ascending: true });   // blocos na ordem dos embarques
        (procs || []).forEach(pr => { (processosMap[pr.proforma_id] ||= []).push(pr); });
    }
    _docProformas.forEach(p => {
        p.parceiro         = empresaMap[p.parceiro_id]     || null;
        p.destinatario_emp = empresaMap[p.destinatario_id] || null;
        p._processos       = processosMap[p.id] || [];
    });

    const resDocs = await window.supabaseAPI.buscarDocumentosProformas(proformaIds);
    _docSalvos = {};
    (resDocs.data || []).forEach(d => {
        (_docSalvos[d.proforma_id] ||= {})[docChaveRegistro(d)] = d;
    });

    // Pedidos de assinatura por link (assinar.html) — o mais recente de cada proforma
    _docAssinaturasLink = {};
    const resAss = await window.supabaseAPI.buscarAssinaturasProformas(proformaIds);
    // (se alguma já foi assinada, fica ela — é a que tem comprovante)
    (resAss.data || []).forEach(a => {
        const atual = _docAssinaturasLink[a.proforma_id];
        if (!atual || (atual.status !== 'assinado' && a.status === 'assinado')) _docAssinaturasLink[a.proforma_id] = a;
    });

    // Nomes de quem criou proformas/processos (coluna Status: "Criado ... por ...")
    _docNomes = await window.supabaseAPI.buscarNomesUsuarios([
        ..._docProformas.map(p => p.criado_por),
        ..._docProformas.flatMap(p => p._processos.map(pr => pr.criado_por)),
    ]);

    // Vindo do aviso "Proforma não assinada" (link "Assinar Proposta"):
    // já abre com a proforma expandida e rola até ela.
    const alvo = _docProformaUnica ? null : new URLSearchParams(window.location.search).get('proforma_id');
    if (alvo && _docProformas.some(p => String(p.id) === alvo)) {
        _docExpandidos.add(alvo);
        _docRecolhidos.delete(alvo);
    }

    docRenderizar();
    _docAnexarProformasPendentes();

    if (alvo) {
        const linha = document.getElementById('doc-linha-' + alvo);
        if (linha) {
            linha.scrollIntoView({ behavior: 'smooth', block: 'start' });
            linha.classList.add('doc-linha-destaque');
            setTimeout(() => linha.classList.remove('doc-linha-destaque'), 2500);
        }
    }
}

// ── Janela "Documentos" (cards de Proforma e de Processo) ───────────────
// Substituiu a antiga tela/menu Documentos. Monta a janela e o modal de
// assinatura sob demanda, então a página só precisa carregar os scripts.
let _docJanelaAoFechar = null;

function _docGarantirModalAssinatura() {
    if (document.getElementById('docModalAssinatura')) return;
    const div = document.createElement('div');
    div.className = 'doc-modal-overlay';
    div.id = 'docModalAssinatura';
    div.style.display = 'none';
    div.innerHTML = `
        <div class="doc-modal-box">
            <div class="doc-modal-icon"><i class="fa-solid fa-file-signature"></i></div>
            <h3 class="doc-modal-title">Assinar Documento</h3>
            <p class="doc-modal-msg" id="docModalAssinaturaLabel">Documento</p>
            <div class="doc-modal-campo">
                <label for="docModalAssinadoPor">Assinado por</label>
                <input type="text" id="docModalAssinadoPor" placeholder="Nome de quem assinou...">
            </div>
            <div class="doc-modal-campo">
                <label for="docModalArquivo">Documento assinado (PDF ou imagem)</label>
                <div id="docModalArquivoExistente" class="doc-modal-arquivo-existente" style="display:none;"></div>
                <input type="file" id="docModalArquivo" accept=".pdf,.jpg,.jpeg,.png">
            </div>
            <div class="doc-modal-acoes">
                <button class="doc-modal-btn doc-modal-btn-cancelar" onclick="docFecharModalAssinatura()"><i class="fa-solid fa-xmark"></i> Cancelar</button>
                <button class="doc-modal-btn doc-modal-btn-confirmar" onclick="docConfirmarAssinaturaModal()"><i class="fa-solid fa-check"></i> Confirmar</button>
            </div>
        </div>`;
    document.body.appendChild(div);
}

function _docJanela() {
    let ov = document.getElementById('docJanelaOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'docJanelaOverlay';
    ov.className = 'hist-overlay';
    ov.innerHTML = `
        <div class="hist-modal doc-janela" role="dialog" aria-modal="true">
            <div class="hist-cab">
                <div><i class="fa-solid fa-folder-open" style="color:#4776ec;margin-right:6px;"></i> <span id="docJanelaTitulo">Documentos</span></div>
                <button type="button" class="hist-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="hist-corpo"><div id="documentosContainer" class="doc-lista"></div></div>
        </div>`;
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) docFecharJanela(); });
    ov.querySelector('.hist-fechar').addEventListener('click', docFecharJanela);
    document.addEventListener('keydown', e => {
        // Esc com o modal de assinatura aberto fecha só ele
        if (e.key !== 'Escape' || !ov.classList.contains('aberto')) return;
        if (document.getElementById('docModalAssinatura')?.style.display === 'flex') return;
        docFecharJanela();
    });
    return ov;
}

// opcoes: { proformaId, processoId?, titulo, aoFechar? }
async function docAbrirJanela({ proformaId, processoId = null, titulo = 'Documentos', aoFechar = null }) {
    _docGarantirModalAssinatura();
    const ov = _docJanela();
    document.getElementById('docJanelaTitulo').textContent = titulo;
    _docJanelaAoFechar = aoFechar;
    ov.classList.add('aberto');
    await docCarregar({ proformaId, processoId });
}

function docFecharJanela() {
    const ov = document.getElementById('docJanelaOverlay');
    if (!ov?.classList.contains('aberto')) return;
    ov.classList.remove('aberto');
    const cb = _docJanelaAoFechar;
    _docJanelaAoFechar = null;
    if (typeof cb === 'function') cb();
}

function _docColunaProcesso(p) {
    const lista = p._processos || [];
    if (!lista.length) return { texto: '—', statusTexto: '—' };
    return {
        texto:       lista.map(pr => pr.numero_processo || '—').join(', '),
        statusTexto: lista.map(pr => DOC_LABELS_PROCESSO[pr.status] || pr.status || '—').join(', '),
    };
}

// Contador simples de documentos assinados em %, visível na linha resumo
// sem precisar expandir — pedido pedido pelo usuário depois de ver o
// layout atual (cada linha só mostrava status de Pedido/Proforma/Processo,
// nada sobre os documentos em si).
function _docRenderProgresso(total, assinados) {
    if (!total) return '<span class="doc-progresso-vazio">—</span>';
    const pct = Math.round((assinados / total) * 100);
    const nivel = pct === 100 ? 'completo' : pct === 0 ? 'vazio' : 'parcial';
    return `
        <div class="doc-progresso" title="${assinados} de ${total} documentos assinados">
            <div class="doc-progresso-barra"><div class="doc-progresso-fill doc-progresso-${nivel}" style="width:${pct}%"></div></div>
            <span class="doc-progresso-texto doc-progresso-texto-${nivel}">${pct}%</span>
        </div>`;
}

// ── Hiperlinks: cada documento/proforma/processo abre o registro real ──
const _docEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _docUrlProforma = id => `formularios.html?tab=proposta&id=${encodeURIComponent(id)}&modo=visualizar`;
const _docUrlProcesso = id => `formularios.html?tab=processo&id=${encodeURIComponent(id)}&modo=visualizar`;

// Bucket privado: o link temporário é preenchido depois de montar a tela
// (hidratarArquivosPrivados, supabase-api.js); clicar antes disso gera na hora.
function _docAttrsArquivo(path) {
    return `href="#" target="_blank" rel="noopener" data-arquivo-bucket="${BUCKET_DOC_ASSINATURA}" data-arquivo="${_docEsc(path)}" `
         + `onclick="if(!this.dataset.arquivoPronto){abrirArquivoPrivado(event,this.dataset.arquivoBucket,this.dataset.arquivo)}"`;
}

// Telas do próprio sistema (formularios.html) abrem com rel="opener": a sessão
// de login fica no sessionStorage, que só é copiado pra aba nova quando ela
// mantém o vínculo com a aba que abriu (o Chrome trata target=_blank como
// noopener por padrão, e aí a aba nova caía no login). Arquivos (Storage,
// outro domínio) continuam com noopener.
function _docLink(href, texto, titulo, icone) {
    const interno = /^formularios\.html/i.test(href || '');
    return `<a class="doc-link" href="${_docEsc(href)}" target="_blank" rel="${interno ? 'opener' : 'noopener'}" title="${_docEsc(titulo)}" onclick="event.stopPropagation()">${icone ? `<i class="fa-solid ${icone}"></i> ` : ''}${_docEsc(texto)}</a>`;
}

// Nome do documento (texto) + links pro registro criado no sistema (Proforma /
// Processo onde o Nº foi preenchido) e ações de PDF.
function _docNomeComLink(proforma, r) {
    const { tipo } = r;
    // no bloco do Processo, número/modal/link do processo já estão no cabeçalho
    const tag = tipo.modal && !tipo.processoId ? `<span class="doc-tipo-tag">${_docEsc(DOC_MODAL_LABEL[tipo.modal])}</span>` : '';

    let sistema = null;
    let numero = '';
    if (!tipo.custom) {
        if (tipo.id === 'proforma') {
            sistema = { href: _docUrlProforma(proforma.id), texto: `Proforma ${proforma.codigo || ''}`.trim(), titulo: `Abrir a Proforma ${proforma.codigo || ''}`, icone: 'fa-file-lines' };
        }
        const pr = (proforma._processos || [])
            .filter(x => !tipo.processoId || x.id === tipo.processoId)
            .find(x => String(x.documentos?.[tipo.id] ?? '').trim() !== '');
        if (pr) {
            numero = String(pr.documentos[tipo.id]).trim();
            if (!sistema && !tipo.processoId) sistema = { href: _docUrlProcesso(pr.id), texto: `Processo ${pr.numero_processo || ''}`.trim(), titulo: `Nº ${numero} — abrir o Processo ${pr.numero_processo || ''}`, icone: 'fa-ship' };
        }
    }

    // Título do documento é só texto — o arquivo abre pela coluna Anexo e o
    // registro do sistema pelos links abaixo do título.
    const principal = `<span class="doc-nome">${_docEsc(tipo.label)}</span>`;
    // Documento por Processo: mostra de qual embarque é
    const tagProc = tipo.semProcesso ? `<span class="doc-tipo-tag">Por processo</span>` : '';

    const extra = [];
    if (sistema) extra.push(_docLink(sistema.href, sistema.texto, sistema.titulo, sistema.icone));
    // Commercial Invoice / Packing List: o sistema gera o PDF do embarque e já anexa
    if (tipo.processoId && typeof DOC_PDF_CFG !== 'undefined' && DOC_PDF_CFG[tipo.id]) {
        extra.push(`<a href="#" class="doc-link doc-gerar-pdf" onclick="docGerarPdfLinha(event,'${proforma.id}','${tipo.chave}')" title="Gerar o PDF com os dados do Processo ${_docEsc(tipo.processoNumero || '')} e anexar"><i class="fa-solid fa-file-pdf"></i> Gerar PDF</a>`);
    }
    return `${principal}${tag}${tagProc}${extra.length ? `<div class="doc-sub">${extra.join(' · ')}</div>` : ''}`;
}

// ── Coluna Anexo: anexar o documento (ainda não assinado), ver, substituir, remover ──
const DOC_ANEXO_ACEITA = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';
const DOC_ANEXO_MAX_MB = 15;

function _docAnexoCelula(proforma, r) {
    const { tipo, arquivoPath, arquivoNome } = r;
    if (tipo.semProcesso) return `<span class="doc-status-na" title="Este documento é de cada embarque">Gere um Processo primeiro</span>`;
    const input = `<input type="file" hidden accept="${DOC_ANEXO_ACEITA}" onchange="docAnexarArquivo('${proforma.id}','${tipo.chave}',this)">`;
    if (!arquivoPath) {
        return `<label class="doc-anexo-btn" title="Anexar o documento (mesmo que ainda não esteja assinado)"><i class="fa-solid fa-upload"></i> Anexar${input}</label>`;
    }
    const nome = _docEsc(arquivoNome || 'documento');
    const ver = `<a class="doc-anexo-ver" ${_docAttrsArquivo(arquivoPath)} title="Abrir ${nome}"><i class="fa-solid fa-paperclip"></i> ${nome}</a>`;
    return `<div class="doc-anexo-cell">${ver}
        <div class="doc-anexo-acoes">
            <label class="doc-anexo-acao" title="Substituir o arquivo"><i class="fa-solid fa-arrow-up-from-bracket"></i> Substituir${input}</label>
            <button class="doc-anexo-acao doc-anexo-acao--excluir" title="Remover anexo" onclick="docExcluirAnexo('${proforma.id}','${tipo.chave}')"><i class="fa-solid fa-trash"></i> Excluir</button>
        </div>
    </div>`;
}

async function docGerarPdfLinha(ev, proformaId, chave) {
    ev?.preventDefault();
    ev?.stopPropagation();
    const { tipoId, processoId } = _docParseChave(chave);
    const link = ev?.currentTarget;
    const html = link?.innerHTML;
    if (link) link.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...';
    try {
        const r = await gerarEAnexarDocumentoProcesso(tipoId, processoId);
        if (!r) { if (link) link.innerHTML = html; return; }   // usuário escolheu não substituir
        // o número gerado (CI-/PL-…) foi gravado no Processo
        const pr = _docProformas.find(p => String(p.id) === String(proformaId))?._processos?.find(x => x.id === processoId);
        if (pr) pr.documentos = { ...(pr.documentos || {}), [tipoId]: r.numero };
        if (r.anexado) _docGuardar(proformaId, chave, r.registro);
        docRenderizar();
        mostrarNotificacao(r.anexado ? (r.substituiu ? 'Novo PDF gerado — arquivo anterior substituído.' : 'PDF gerado e anexado.') : `PDF gerado. Não foi anexado: ${r.motivo}.`, r.anexado ? 'sucesso' : 'warning');
    } catch (e) {
        if (link) link.innerHTML = html;
        mostrarNotificacao('Erro ao gerar o PDF: ' + e.message, 'erro');
    }
}

async function docAnexarArquivo(proformaId, chave, input) {
    const { tipoId, processoId } = _docParseChave(chave);
    const file = input.files[0];
    if (!file) return;
    if (!exigirEmpresaVinculada()) { input.value = ''; return; }
    if (file.size > DOC_ANEXO_MAX_MB * 1024 * 1024) { mostrarNotificacao(`Arquivo maior que ${DOC_ANEXO_MAX_MB} MB.`, 'erro'); input.value = ''; return; }

    const reg = _docReg(proformaId, chave);
    // Já tem arquivo: avisa que o anterior será trocado pelo novo (e, na Proforma
    // Invoice de uma Proforma com Processo(s), que isso pode influenciar no Processo)
    if (reg?.arquivo_path) {
        const procs = (tipoId === 'proforma' && !processoId)
            ? (_docProformas.find(p => String(p.id) === String(proformaId))?._processos || []) : [];
        const origem = docArquivoDoSistema(reg.arquivo_path) ? 'gerado pelo sistema' : 'enviado por upload';
        let msg = `O documento atual (${reg.arquivo_nome || 'arquivo'}), ${origem}, será substituído pelo novo arquivo "${file.name}" e não poderá ser recuperado.`;
        if (procs.length) {
            const nums = procs.map(pr => pr.numero_processo || 'Processo').join(', ');
            msg += ` Esta Proforma já tem ${procs.length > 1 ? 'os Processos' : 'o Processo'} ${nums}, criado${procs.length > 1 ? 's' : ''} a partir dela:`
                + ' trocar o arquivo da Proforma Invoice pode influenciar no Processo — os dados dele não são atualizados sozinhos e podem ficar diferentes do novo documento.';
        }
        if (reg.assinado) msg += ' A assinatura registrada é mantida.';
        const ok = await confirmarAcao(msg + ' Deseja substituir?', {
            titulo: procs.length ? 'Atenção: Proforma com Processo' : 'Substituir documento?',
            confirmar: 'Sim, substituir', cancelar: 'Não', perigo: true
        });
        if (!ok) { input.value = ''; return; }
    }

    const label = input.closest('label');
    label.classList.add('carregando');
    label.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${proformaId}/${tipoId}_${Date.now()}_${safeName}`;
    const { error: erroUp } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
    if (erroUp) { mostrarNotificacao('Erro ao enviar o arquivo: ' + erroUp.message, 'erro'); docRenderizar(); return; }

    const rotulo = tipoId.startsWith('custom_') ? (reg?.tipo_label || null) : null;
    const res = await window.supabaseAPI.anexarDocumentoProforma(proformaId, tipoId, rotulo, path, file.name, processoId);
    if (!res.sucesso) {
        await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([path]);
        mostrarNotificacao('Erro ao registrar o anexo: ' + res.mensagem, 'erro');
        docRenderizar();
        return;
    }
    if (reg?.arquivo_path) supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]).catch(() => {}); // arquivo antigo substituído
    _docGuardar(proformaId, chave, res.data);
    docRenderizar();
    mostrarNotificacao('Documento anexado.', 'sucesso');
}

function _docLinksProcessos(p) {
    const l = p._processos || [];
    return l.length ? l.map(pr => _docLink(_docUrlProcesso(pr.id), pr.numero_processo || '—', 'Abrir Processo')).join(', ') : '—';
}

let _docNomes = {};
let _docAssinaturasLink = {};

// Cada linha de documento é identificada por uma chave: 'tipo' ou, nos
// documentos por Processo (Commercial Invoice / Packing List / DUE), 'tipo@processoId'.
function _docParseChave(chave) {
    const [tipoId, processoId] = String(chave).split('@');
    return { tipoId, processoId: processoId || null };
}
function _docReg(proformaId, chave) {
    const { tipoId, processoId } = _docParseChave(chave);
    const p = _docProformas.find(x => String(x.id) === String(proformaId));
    return docRegistroDaLinha(_docSalvos[proformaId], { id: tipoId, processoId }, p?._processos);
}
// Guarda o registro devolvido pela API. Sem a migração por processo, o
// registro volta sem processo_id e fica na chave antiga ('tipo').
function _docGuardar(proformaId, chave, reg) {
    if (!reg) return;
    (_docSalvos[proformaId] ||= {})[docChaveRegistro(reg)] = reg;
}

// O PDF da Proforma é gerado pelo sistema, então o documento "Nº Proforma
// Invoice" deve ter o arquivo anexado sozinho. Proformas antigas (de antes do
// anexo automático) ganham o anexo aqui, em segundo plano, uma por vez.
const DOC_ANEXO_AUTO_MAX_POR_VISITA = 15;
let _docAnexandoAuto = false;

async function _docAnexarProformasPendentes() {
    if (_docAnexandoAuto || typeof anexarPDFProformaAutomatico !== 'function') return;
    _docAnexandoAuto = true;
    try {
        const pendentes = _docProformas
            .filter(p => { const r = _docSalvos[p.id]?.proforma; return !r?.arquivo_path && !r?.assinado; })
            .slice(0, DOC_ANEXO_AUTO_MAX_POR_VISITA);
        for (const p of pendentes) {
            const reg = await anexarPDFProformaAutomatico(p, _docSalvos[p.id]?.proforma || null);
            if (reg) { (_docSalvos[p.id] ||= {}).proforma = reg; docRenderizar(); }
        }
    } finally { _docAnexandoAuto = false; }
}

function _docFmtData(iso, comHora) {
    if (!iso) return '—';
    const o = { day: '2-digit', month: '2-digit', year: 'numeric' };
    if (comHora) Object.assign(o, { hour: '2-digit', minute: '2-digit' });
    return new Date(iso).toLocaleString('pt-BR', o);
}

// Quem criou o documento e quando — seja anexado (pelo usuário ou pelo
// sistema), seja a Proforma Invoice gerada pelo sistema, seja o Nº preenchido
// no Processo. null = documento ainda não feito.
// PDFs gerados pelo sistema sobem como "<proforma>/<tipo>_sistema_..." —
// pdf-proforma.js (Proforma Invoice) e pdf-documentos.js (CI / Packing List).
function docArquivoDoSistema(path) {
    return /^[^/]+\/[a-z]+_sistema_/.test(path || '');
}

const DOC_FONTES = {
    sistema:  { icone: 'fa-gears',          texto: 'Gerado pelo sistema' },
    upload:   { icone: 'fa-upload',         texto: 'Upload do usuário' },
    processo: { icone: 'fa-pen-to-square',  texto: 'Nº informado no Processo' },
};

function _docOrigem(proforma, tipo, reg) {
    if (reg?.arquivo_path) {
        return { em: reg.enviado_em || reg.atualizado_em, por: reg.enviado_por, fonte: docArquivoDoSistema(reg.arquivo_path) ? 'sistema' : 'upload' };
    }
    if (tipo.id === 'proforma') {
        return { em: proforma.created_at, por: _docNomes[proforma.criado_por], fonte: 'sistema' };
    }
    const pr = (proforma._processos || []).filter(x => !tipo.processoId || x.id === tipo.processoId).find(x => {
        const v = x.documentos?.[tipo.id];
        return v !== undefined && v !== null && String(v).trim() !== '';
    });
    if (pr) return { em: pr.criado_em, por: _docNomes[pr.criado_por], fonte: 'processo' };
    if (reg?.assinado) return { em: reg.assinado_em, por: reg.assinado_por };
    return null;
}

function docRenderizar() {
    const container = document.getElementById('documentosContainer');
    const termo = (document.getElementById('buscaDoc')?.value || '').toLowerCase().trim();

    const linhas = _docProformas.map(p => {
        const remetente    = _docEmissorNome(p);
        const destinatario = _docDestinatarioNome(p);
        const tipos   = docTiposDaProforma(p._processos, _docSalvos[p.id]);
        const salvos  = _docSalvos[p.id] || {};

        const docRows = tipos.map(tipo => {
            const reg = docRegistroDaLinha(salvos, tipo, p._processos);
            const assinado = !!reg?.assinado;
            // Documento assinado OU já anexado (pelo Processo ou avulso)
            // conta como feito automaticamente, mesmo que o campo Nº
            // correspondente não tenha sido preenchido no Processo.
            const feito = tipo.custom ? null : (assinado || !!reg?.arquivo_path || docFeitoAutomatico(p._processos, tipo.id, tipo.processoId));
            return {
                tipo, feito, assinado,
                assinadoPor: reg?.assinado_por,
                assinadoEm:  reg?.assinado_em,
                enviadoPor:  reg?.enviado_por,
                arquivoPath: reg?.arquivo_path,
                arquivoNome: reg?.arquivo_nome,
                reg,
            };
        });

        let docRowsFiltradas = docRows;
        // Janela do card de Processo: só os documentos daquele embarque (os da
        // Proforma, os do Processo e os do modal dele — sem os de outros Processos)
        if (_docProcessoUnico) {
            docRowsFiltradas = docRowsFiltradas.filter(({ tipo }) =>
                tipo.grupo === 'proforma' || tipo.grupo === 'orfao' || String(tipo.grupo) === _docProcessoUnico);
        }
        if (_docFiltroAtual === 'pendentes') docRowsFiltradas = docRows.filter(r => !r.assinado);
        if (_docFiltroAtual === 'assinados') docRowsFiltradas = docRows.filter(r => r.assinado);

        // Progresso sempre calculado em cima de TODOS os documentos da
        // proforma (não só os filtrados) — senão o % mudaria sozinho ao
        // trocar de aba de filtro, o que ia confundir mais que ajudar.
        const totalDocs     = docRows.length;
        const assinadosDocs = docRows.filter(r => r.assinado).length;

        return { proforma: p, remetente, destinatario, docRowsFiltradas, totalDocs, assinadosDocs };
    }).filter(({ proforma, remetente, destinatario, docRowsFiltradas }) => {
        if (docRowsFiltradas.length === 0) return false;
        if (!termo) return true;
        const alvo = `${proforma.codigo || ''} ${remetente} ${destinatario}`.toLowerCase();
        return alvo.includes(termo);
    });

    if (_docProformaUnica) {
        const l = linhas[0];
        container.innerHTML = l ? _docRenderDetalhe(l.proforma, l.docRowsFiltradas) : '<div class="doc-vazio">Proforma não encontrada.</div>';
        hidratarArquivosPrivados(container);
        return;
    }

    if (linhas.length === 0) {
        container.innerHTML = '<div class="doc-vazio"><i class="fa-solid fa-folder-open"></i> Nenhum documento encontrado.</div>';
        return;
    }

    const forcarExpandir = _docFiltroAtual !== 'todos' || !!termo;

    container.innerHTML = `
        <table class="doc-tabela">
            <thead>
                <tr>
                    <th class="doc-col-seta"></th>
                    <th>Proforma</th>
                    <th class="doc-col-status">Status da Proforma</th>
                    <th class="doc-col-progresso">Documentos</th>
                    <th>Processo</th>
                    <th class="doc-col-status">Status do Processo</th>
                </tr>
            </thead>
            <tbody>
                ${linhas.map(l => _docRenderLinhaProforma(l, forcarExpandir)).join('')}
            </tbody>
        </table>`;
    hidratarArquivosPrivados(container);
}

function _docRenderLinhaProforma({ proforma, remetente, destinatario, docRowsFiltradas, totalDocs, assinadosDocs }, forcarExpandir) {
    const expandido = _docExpandidos.has(proforma.id) || (forcarExpandir && !_docRecolhidos.has(proforma.id));
    const proc = _docColunaProcesso(proforma);

    const linhaResumo = `
        <tr class="doc-linha-pedido" id="doc-linha-${proforma.id}">
            <td class="doc-col-seta">
                <button class="doc-toggle" onclick="docToggleLinha('${proforma.id}', ${expandido})" title="${expandido ? 'Recolher' : 'Expandir'}">
                    <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
                </button>
            </td>
            <td>
                <div class="doc-pedido-numero">${_docLink(_docUrlProforma(proforma.id), proforma.codigo || '—', 'Abrir a Proforma')}</div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Exportador:</span> <span class="doc-parceiro-valor">${_docEsc(remetente)}</span></div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Importador:</span> <span class="doc-parceiro-valor">${_docEsc(destinatario)}</span></div>
            </td>
            <td class="doc-col-status"><span class="doc-badge doc-badge-neutro">${escHtml(DOC_LABELS_PROFORMA[proforma.status] || proforma.status || '—')}</span></td>
            <td class="doc-col-progresso">${_docRenderProgresso(totalDocs, assinadosDocs)}</td>
            <td class="doc-referencia">${_docLinksProcessos(proforma)}</td>
            <td class="doc-col-status">${proc.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${_docEsc(proc.statusTexto)}</span>` : '—'}</td>
        </tr>`;

    if (!expandido) return linhaResumo;

    const linhaDetalhe = `
        <tr class="doc-linha-detalhe">
            <td colspan="6">${_docRenderDetalhe(proforma, docRowsFiltradas)}</td>
        </tr>`;

    return linhaResumo + linhaDetalhe;
}

// Documentos de uma proforma separados em blocos: a Proforma, cada Processo
// (embarque) e, se houver, "Sem processo definido" (anexos antigos de quando
// esses documentos eram da Proforma toda).
function _docRenderDetalhe(proforma, docRowsFiltradas) {
    const procs = proforma._processos || [];
    const grupos = new Map();
    docRowsFiltradas.forEach(r => {
        const g = String(r.tipo.grupo || 'proforma');
        if (!grupos.has(g)) grupos.set(g, []);
        grupos.get(g).push(r);
    });
    const ordem = ['proforma', 'sem-processo', ...procs.map(pr => String(pr.id)), 'orfao'].filter(g => grupos.has(g));
    return `<div class="doc-detalhe-wrap doc-blocos">${ordem.map(g => _docRenderBloco(proforma, g, grupos.get(g))).join('')}</div>`;
}

function _docRenderBloco(proforma, grupo, linhas) {
    const pr = (proforma._processos || []).find(x => String(x.id) === grupo);
    let icone, titulo, sub = '', extra = '', processoId = null, podeAdicionar = false;
    if (grupo === 'proforma') {
        icone = 'fa-file-lines'; titulo = `Proforma ${_docEsc(proforma.codigo || '')}`;
        sub = 'Documentos da Proforma toda'; podeAdicionar = true;
    } else if (grupo === 'sem-processo') {
        icone = 'fa-ship'; titulo = 'Documentos dos embarques';
        sub = 'Aparecem por Processo depois que a Proforma gerar o primeiro Processo.';
    } else if (grupo === 'orfao') {
        icone = 'fa-circle-question'; titulo = 'Sem processo definido';
        sub = 'Anexados antes da divisão por processo. Escolha a qual embarque cada um pertence.';
    } else if (pr) {
        icone = 'fa-ship'; titulo = _docLink(_docUrlProcesso(pr.id), pr.numero_processo || 'Processo', 'Abrir o Processo');
        sub = 'Documentos deste embarque'; processoId = pr.id; podeAdicionar = true;
        extra = `${pr.modal ? `<span class="doc-tipo-tag">${_docEsc(DOC_MODAL_LABEL[pr.modal] || pr.modal)}</span>` : ''}`
              + `<span class="doc-badge doc-badge-neutro">${_docEsc(DOC_LABELS_PROCESSO[pr.status] || pr.status || '—')}</span>`;
    }
    const chaveNovo = `${proforma.id}|${processoId || ''}`;
    const total = linhas.filter(r => !r.tipo.semProcesso).length;
    const feitos = linhas.filter(r => r.feito || r.assinado).length;
    return `
        <section class="doc-bloco doc-bloco--${grupo === 'proforma' || grupo === 'orfao' || grupo === 'sem-processo' ? grupo : 'processo'}">
            <div class="doc-bloco-cab">
                <div class="doc-bloco-tit">
                    <i class="fa-solid ${icone}"></i> <strong>${titulo}</strong> ${extra}
                    ${total ? `<span class="doc-bloco-cont">${feitos}/${total} feitos</span>` : ''}
                    <div class="doc-bloco-sub">${sub}</div>
                </div>
                ${podeAdicionar ? `<button class="doc-pedido-add" onclick="docAbrirNovoPersonalizado('${proforma.id}', ${processoId ? `'${processoId}'` : 'null'})"><i class="fa-solid fa-plus"></i> Documento</button>` : ''}
            </div>
            <table class="doc-pedido-tabela">
                <thead><tr><th>Documento</th><th>Status</th><th>Anexo</th><th>Assinatura</th><th></th></tr></thead>
                <tbody>
                    ${linhas.map(r => _docRenderLinha(proforma, r)).join('')}
                    ${_docNovoEmProforma === chaveNovo ? _docRenderLinhaNova(proforma.id, processoId) : ''}
                </tbody>
            </table>
        </section>`;
}

// Anexo antigo (sem processo) numa Proforma com 2+ Processos: escolher o embarque
async function docDefinirProcesso(proformaId, tipoId, processoId) {
    if (!processoId) return;
    const salvos = _docSalvos[proformaId] || {};
    const reg = salvos[tipoId];
    if (!reg?.id) return;
    const destino = docChave(tipoId, processoId);
    if (salvos[destino]?.arquivo_path || salvos[destino]?.assinado) {
        await confirmarAcao('Esse Processo já tem um arquivo para este documento. Remova o anexo dele antes de mover este para lá.',
            { titulo: 'Documento já existe no Processo', confirmar: 'Entendi', cancelar: null });
        docRenderizar();
        return;
    }
    if (salvos[destino]?.id) await window.supabaseAPI.excluirDocumentoProforma(salvos[destino].id);   // registro vazio (sem arquivo)
    const { data, error } = await supabaseClient.from('proforma_documentos').update({ processo_id: processoId }).eq('id', reg.id).select().single();
    if (error) { mostrarNotificacao('Não foi possível mover o documento: ' + error.message, 'erro'); docRenderizar(); return; }
    delete salvos[tipoId];
    salvos[destino] = data;
    docRenderizar();
    const pr = _docProformas.find(p => String(p.id) === String(proformaId))?._processos?.find(x => String(x.id) === String(processoId));
    mostrarNotificacao(`Documento movido para o Processo ${pr?.numero_processo || ''}.`, 'sucesso');
}

function _docRenderLinhaNova(proformaId, processoId = null) {
    const sufixo = `${proformaId}_${processoId || 'p'}`;
    const procArg = processoId ? `'${processoId}'` : 'null';
    return `
        <tr>
            <td colspan="2">
                <input type="text" id="docNovoNome_${sufixo}" placeholder="Nome do documento..."
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;"
                    onkeydown="if(event.key==='Enter') docSalvarPersonalizado('${proformaId}', ${procArg}); if(event.key==='Escape') docCancelarPersonalizado();">
            </td>
            <td colspan="3" style="white-space:nowrap;">
                <button class="doc-pedido-add" onclick="docSalvarPersonalizado('${proformaId}', ${procArg})">Salvar</button>
                <button class="doc-row-excluir" onclick="docCancelarPersonalizado()" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
            </td>
        </tr>`;
}

function _docRenderLinha(proforma, r) {
    const { tipo, feito, assinado, assinadoPor, assinadoEm, enviadoPor, arquivoPath, arquivoNome, reg } = r;
    // dentro do bloco do Processo o modal já está no cabeçalho
    const tag = tipo.modal && !tipo.processoId ? `<span class="doc-tipo-tag">${DOC_MODAL_LABEL[tipo.modal]}</span>` : '';
    const excluir = tipo.custom
        ? `<button class="doc-row-excluir" onclick="docExcluirPersonalizado('${proforma.id}','${tipo.chave}', ${reg?.id ? `'${reg.id}'` : 'null'})" title="Remover"><i class="fa-solid fa-trash"></i></button>`
        : tipo.orfao
            ? `<select class="doc-orfao-select" onchange="docDefinirProcesso('${proforma.id}','${tipo.id}', this.value)" title="De qual embarque é este documento?">
                   <option value="">Mover para o processo…</option>
                   ${(proforma._processos || []).map(pr => `<option value="${pr.id}">${_docEsc(pr.numero_processo || 'Processo')}${pr.modal ? ' · ' + _docEsc(DOC_MODAL_LABEL[pr.modal] || pr.modal) : ''}</option>`).join('')}
               </select>`
            : '';

    // Status: "Criado em <data> por <usuário>" (+ "Assinado por <usuário> em <data>")
    const origem = _docOrigem(proforma, tipo, reg);
    const statusHtml = (tipo.custom && !origem && !assinado)
        ? `<span class="doc-status-na">—</span>`
        : (origem || feito)
            // a assinatura aparece só na coluna Assinatura (sem repetir aqui)
            ? `<div class="doc-status-info">
                   ${DOC_FONTES[origem?.fonte]
                       ? `<span class="doc-fonte doc-fonte--${origem.fonte}"><i class="fa-solid ${DOC_FONTES[origem.fonte].icone}"></i> ${DOC_FONTES[origem.fonte].texto}</span>`
                       : `<span class="doc-fonte doc-fonte--processo"><i class="fa-solid fa-circle-check"></i> Feito</span>`}
                   <div class="doc-status-linha">Criado em <strong>${_docFmtData(origem?.em)}</strong></div>
                   <div class="doc-status-linha">por <strong>${_docEsc(origem?.por || '—')}</strong></div>
               </div>`
            : `<span class="doc-badge doc-badge-naofeito">Não Feito</span>`;

    let assinaturaHtml;
    if (assinado) {
        const dataFmt = assinadoEm
            ? new Date(assinadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
        assinaturaHtml = `
            <div class="doc-assinatura-feita">
                <div class="doc-assinatura-topo">
                    <span class="doc-assinatura-titulo"><i class="fa-solid fa-circle-check"></i> Assinado</span>
                    <button class="doc-assinatura-desfazer" title="Desmarcar assinatura" onclick="docDesmarcarAssinatura('${proforma.id}','${tipo.chave}')"><i class="fa-solid fa-rotate-left"></i></button>
                </div>
                <div class="doc-assinatura-por"><i class="fa-solid fa-signature"></i> ${_docEsc(assinadoPor || '—')}</div>
                <div class="doc-assinatura-data">${dataFmt}</div>
                ${enviadoPor ? `<div class="doc-assinatura-enviado">Registrado por ${_docEsc(enviadoPor)}</div>` : ''}
                ${_docAssinaturaAcoes(proforma, tipo, arquivoPath)}
            </div>`;
    } else if (arquivoPath) {
        // Arquivo já anexado (coluna Anexo) e ainda não assinado: só falta assinar
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" data-label="${_docEsc(tipo.label || '')}" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.chave}',this.dataset.label)">
                <i class="fa-regular fa-circle"></i> Assinar
            </button>`;
    } else {
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" data-label="${_docEsc(tipo.label || '')}" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.chave}',this.dataset.label)">
                <i class="fa-regular fa-circle"></i> Não Assinado
            </button>`;
    }

    // Proforma Invoice: assinatura digital pelo próprio Importador, por link (WhatsApp)
    if (tipo.id === 'proforma') assinaturaHtml += _docAssinaturaLinkHtml(proforma, assinado);

    return `
        <tr>
            <td>${_docNomeComLink(proforma, r)}</td>
            <td>${statusHtml}</td>
            <td>${_docAnexoCelula(proforma, r)}</td>
            <td>${assinaturaHtml}</td>
            <td>${excluir}</td>
        </tr>`;
}

// Cartão "Assinado": abrir o arquivo assinado e, se foi pelo link (assinatura
// digital do Importador), baixar o comprovante com as evidências.
function _docAssinaturaAcoes(proforma, tipo, arquivoPath) {
    const acoes = [];
    if (arquivoPath) acoes.push(`<a class="doc-assinatura-acao" ${_docAttrsArquivo(arquivoPath)} title="Abrir o documento assinado"><i class="fa-solid fa-paperclip"></i> Ver arquivo</a>`);
    if (tipo.id === 'proforma' && _docAssinaturasLink[proforma.id]?.status === 'assinado') {
        acoes.push(`<button class="doc-assinatura-acao" onclick="docComprovanteAssinatura(event,'${proforma.id}')" title="Comprovante da assinatura digital (dados do assinante, data/hora, IP, hash)"><i class="fa-solid fa-certificate"></i> Comprovante</button>`);
    }
    return acoes.length ? `<div class="doc-assinatura-acoes">${acoes.join('')}</div>` : '';
}

// Comprovante da assinatura digital (assinar.html): PDF com o assinante, as
// evidências registradas e a imagem da assinatura.
async function docComprovanteAssinatura(ev, proformaId) {
    ev?.preventDefault();
    const btn = ev?.currentTarget;
    const html = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Gerando...'; }
    try {
        const id = _docAssinaturasLink[proformaId]?.id;
        const { data: a, error } = await supabaseClient.from('assinaturas_proforma').select('*').eq('id', id).maybeSingle();
        if (error || !a) throw new Error(error?.message || 'assinatura não encontrada');
        const p = _docProformas.find(x => String(x.id) === String(proformaId));
        const reg = _docSalvos[proformaId]?.proforma;
        await carregarJsPDFSobDemanda();
        const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const ML = 14, W = doc.internal.pageSize.getWidth();
        const fmt = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
        let y = pdfCabecalho(doc, {
            titulo: 'COMPROVANTE DE ASSINATURA', numero: `Proforma ${p?.codigo || ''}`,
            criadoPor: a.criado_por_nome, dataGeracao: fmt(new Date().toISOString()), ML,
        }) + 6;

        const secao = (titulo, linhas, x, largura) => {
            doc.setFillColor(...PDF_CORES.AZUL_CLARO); doc.rect(x, y, largura, 7, 'F');
            _pdfTexto(doc, 'bold', 9, PDF_CORES.NAVY, titulo, x + 3, y + 4.8);
            let yy = y + 12;
            linhas.forEach(([rotulo, valor]) => {
                _pdfTexto(doc, 'bold', 8, PDF_CORES.CINZA, rotulo, x + 3, yy);
                const txt = doc.setFont('helvetica', 'normal').setFontSize(9).splitTextToSize(String(valor || '—'), largura - 48);
                _pdfTexto(doc, 'normal', 9, PDF_CORES.PRETO, txt, x + 45, yy);
                yy += Math.max(1, txt.length) * 4.3 + 1.5;
            });
            return yy;
        };
        const larg = 165;
        let yEsq = secao('Documento', [
            ['Documento', `Proforma Invoice ${p?.codigo || ''}`],
            ['Exportador', p ? _docEmissorNome(p) : '—'],
            ['Importador', p ? _docDestinatarioNome(p) : '—'],
            ['Arquivo assinado', reg?.arquivo_nome || '—'],
            ['Hash SHA-256 do PDF', a.hash_pdf || '—'],
        ], ML, larg);
        y = yEsq + 3;
        yEsq = secao('Assinante', [
            ['Nome', a.assinante_nome], ['CPF / CNPJ / Passaporte', a.assinante_documento],
            ['Cargo', a.assinante_cargo], ['E-mail', a.assinante_email],
        ], ML, larg);
        y = yEsq + 3;
        secao('Registro', [
            ['Assinado em', fmt(a.assinado_em)], ['Endereço IP', a.ip],
            ['Navegador', a.user_agent],
            ['Link gerado por', `${a.criado_por_nome || '—'} em ${fmt(a.criado_em)}`],
        ], ML, larg);

        // assinatura desenhada
        const xA = ML + larg + 8, wA = W - ML - xA, yA = 29;
        doc.setFillColor(...PDF_CORES.AZUL_CLARO); doc.rect(xA, yA, wA, 7, 'F');
        _pdfTexto(doc, 'bold', 9, PDF_CORES.NAVY, 'Assinatura', xA + 3, yA + 4.8);
        doc.setDrawColor(...PDF_CORES.BORDA); doc.rect(xA, yA + 9, wA, 50);
        if (a.assinatura_imagem) {
            try { doc.addImage(a.assinatura_imagem, 'PNG', xA + 4, yA + 12, wA - 8, 44, undefined, 'FAST'); } catch (_) { /* imagem inválida: fica só a moldura */ }
        }
        _pdfTexto(doc, 'normal', 8, PDF_CORES.CINZA, a.assinante_nome || '', xA + wA / 2, yA + 64, { align: 'center' });
        const legal = doc.setFont('helvetica', 'normal').setFontSize(7.5).splitTextToSize(
            'Assinatura eletrônica realizada pelo link enviado ao assinante, com aceite expresso dos termos da Proforma. '
            + 'Data/hora, endereço IP, navegador e hash do documento foram registrados no momento da assinatura '
            + '(MP 2.200-2/2001, art. 10, §2º · Lei 14.063/2020).', wA);
        _pdfTexto(doc, 'normal', 7.5, PDF_CORES.CINZA, legal, xA, yA + 74);

        pdfRodape(doc, { textoDireita: `Comprovante de assinatura · Proforma ${p?.codigo || ''}`, ML });
        doc.save(`Comprovante_Assinatura_${(p?.codigo || 'proforma').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
    } catch (e) {
        mostrarNotificacao('Não foi possível gerar o comprovante: ' + e.message, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = html; }
    }
}

// ── Assinatura digital por link (WhatsApp) ─────────────────────────────
function _docAssinaturaLinkHtml(proforma, assinado) {
    const a = _docAssinaturasLink[proforma.id];
    const fmt = iso => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    if (assinado) {
        return a?.status === 'assinado'
            ? `<div class="doc-link-assinatura doc-link-assinatura--ok"><i class="fa-solid fa-shield-halved"></i> Assinatura digital · ${_docEsc(a.assinante_documento || '')}${a.ip ? ` · IP ${_docEsc(a.ip)}` : ''}</div>`
            : '';
    }
    const pendente = a?.status === 'pendente' && new Date(a.expira_em) > new Date();
    return `
        <div class="doc-link-assinatura">
            <button class="doc-btn-whats" onclick="docEnviarLinkAssinatura('${proforma.id}')" title="Gerar link de assinatura e enviar ao Importador pelo WhatsApp">
                <i class="fa-brands fa-whatsapp"></i> ${pendente ? 'Reenviar link' : 'Enviar link p/ assinar'}
            </button>
            ${pendente ? `<span class="doc-link-pendente">Aguardando · enviado ${fmt(a.criado_em)} <a href="#" onclick="docCopiarLinkAssinatura(event,'${a.token}')" title="Copiar o link">copiar link</a></span>` : ''}
        </div>`;
}

function docCopiarLinkAssinatura(ev, token) {
    ev?.preventDefault(); ev?.stopPropagation();
    const url = urlAssinaturaProforma(token);
    navigator.clipboard?.writeText(url).then(() => mostrarNotificacao('Link de assinatura copiado.', 'sucesso'))
        .catch(() => window.prompt('Copie o link de assinatura:', url));
}

function _docTelefoneWhatsapp(tel) {
    const d = String(tel || '').replace(/\D/g, '');
    if (!d) return '';
    return (d.length === 10 || d.length === 11) ? '55' + d : d;
}

async function docEnviarLinkAssinatura(proformaId) {
    const p = _docProformas.find(x => String(x.id) === String(proformaId));
    if (!p) return;
    // abre a aba já no clique (depois de "await" o navegador bloquearia como popup)
    const aba = window.open('', '_blank');
    try {
        // garante o PDF anexado (o Importador confere antes de assinar)
        let reg = _docSalvos[proformaId]?.proforma;
        if (!reg?.arquivo_path && typeof anexarPDFProformaAutomatico === 'function') {
            const novo = await anexarPDFProformaAutomatico(p, reg || null);
            if (novo) { (_docSalvos[proformaId] ||= {}).proforma = novo; reg = novo; }
        }
        let telefone = '';
        if (p.destinatario_id) {
            const { data: c } = await supabaseClient.from('parceiro_contatos').select('telefone')
                .eq('parceiro_id', p.destinatario_id).not('telefone', 'is', null)
                .order('ordem', { ascending: true }).limit(1).maybeSingle();
            telefone = _docTelefoneWhatsapp(c?.telefone);
        }
        const res = await window.supabaseAPI.criarAssinaturaProforma(proformaId, reg?.arquivo_path, telefone);
        if (!res.sucesso) { aba?.close(); mostrarNotificacao('Não foi possível gerar o link: ' + res.mensagem, 'erro'); return; }

        const url = urlAssinaturaProforma(res.data.token);
        const nome = _docDestinatarioNome(p);
        const msg = [
            `Olá${nome && nome !== '—' ? ', ' + nome : ''}!`,
            `Segue o link para conferir e assinar a Proforma ${p.codigo || ''}:`,
            url,
            `O link é válido até ${new Date(res.data.expira_em).toLocaleDateString('pt-BR')}.`,
        ].join('\n');
        const wa = `https://wa.me/${telefone}?text=${encodeURIComponent(msg)}`;
        if (aba) aba.location.href = wa; else window.open(wa, '_blank');

        _docAssinaturasLink[proformaId] = { ...res.data, proforma_id: proformaId };
        docRenderizar();
        mostrarNotificacao(telefone ? 'Link gerado — confira a mensagem no WhatsApp e envie.' : 'Link gerado. O Importador não tem telefone cadastrado: escolha o contato no WhatsApp.', telefone ? 'sucesso' : 'warning');
    } catch (e) {
        aba?.close();
        mostrarNotificacao('Erro ao gerar o link: ' + e.message, 'erro');
    }
}

function docToggleLinha(proformaId, estavaExpandido) {
    if (estavaExpandido) {
        _docExpandidos.delete(proformaId);
        _docRecolhidos.add(proformaId);
    } else {
        _docExpandidos.add(proformaId);
        _docRecolhidos.delete(proformaId);
    }
    docRenderizar();
}

// ── Assinatura digital (anexo do documento assinado) ────────────────────
const BUCKET_DOC_ASSINATURA = 'proforma-documentos-assinados';
let _docAssinaturaAlvo = null; // { proformaId, tipoId, tipoLabel }

function docAbrirModalAssinatura(proformaId, chave, tipoLabel) {
    const { tipoId, processoId } = _docParseChave(chave);
    _docAssinaturaAlvo = { proformaId, tipoId, processoId, chave, tipoLabel };
    document.getElementById('docModalAssinaturaLabel').textContent = tipoLabel;
    document.getElementById('docModalAssinadoPor').value = '';
    document.getElementById('docModalAssinadoPor').style.borderColor = '';
    document.getElementById('docModalArquivo').value = '';

    // Se já existe um arquivo anexado (Processo ou anexo avulso), a
    // assinatura reaproveita ele — não obriga a subir de novo.
    const reg = _docReg(proformaId, chave);
    const existenteEl = document.getElementById('docModalArquivoExistente');
    if (reg?.arquivo_path && existenteEl) {
        existenteEl.innerHTML = `<i class="fa-solid fa-paperclip"></i> Já anexado: <strong>${escHtml(reg.arquivo_nome || 'documento')}</strong> — deixe em branco pra manter, ou escolha outro pra substituir.`;
        existenteEl.style.display = 'block';
    } else if (existenteEl) {
        existenteEl.style.display = 'none';
    }

    document.getElementById('docModalAssinatura').style.display = 'flex';
}

function docFecharModalAssinatura() {
    document.getElementById('docModalAssinatura').style.display = 'none';
    _docAssinaturaAlvo = null;
}

async function docConfirmarAssinaturaModal() {
    if (!exigirEmpresaVinculada()) return;
    if (!_docAssinaturaAlvo) return;
    const { proformaId, tipoId, processoId, chave, tipoLabel } = _docAssinaturaAlvo;

    const nomeInput = document.getElementById('docModalAssinadoPor');
    const fileInput = document.getElementById('docModalArquivo');
    const nome = nomeInput.value.trim();
    const file = fileInput.files[0];
    const jaTemArquivo = !!_docReg(proformaId, chave)?.arquivo_path;

    if (!nome) { nomeInput.style.borderColor = '#dc2626'; return; }
    if (!file && !jaTemArquivo) { mostrarNotificacao('Anexe o documento assinado.', 'erro'); return; }

    const btn = document.querySelector('#docModalAssinatura .doc-modal-btn-confirmar');
    const btnHtmlOriginal = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

    // Só sobe um arquivo novo se o usuário escolheu um — senão a
    // assinatura reaproveita o que já estava anexado (mantido pelo
    // supabase-api quando arquivoPath vem null).
    let path = null, nomeArquivo = null;
    if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        path = `${proformaId}/${tipoId}_${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
        if (uploadError) {
            mostrarNotificacao('Erro ao enviar arquivo: ' + uploadError.message, 'erro');
            if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
            return;
        }
        nomeArquivo = file.name;
    }

    const isCustom = tipoId.startsWith('custom_');
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, true, nome, isCustom ? tipoLabel : null, path, nomeArquivo, processoId);
    if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao registrar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    _docGuardar(proformaId, chave, res.data);
    docFecharModalAssinatura();
    docRenderizar();
    mostrarNotificacao('Assinatura registrada.', 'sucesso');
}

async function docDesmarcarAssinatura(proformaId, chave) {
    const { tipoId, processoId } = _docParseChave(chave);
    const tipoLabelAtual = _docReg(proformaId, chave)?.tipo_label || null;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, false, null, tipoLabelAtual, null, null, processoId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao desmarcar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    _docGuardar(proformaId, chave, res.data);
    docRenderizar();
}

// Remove só o arquivo anexado (mantém a linha do documento) — some tanto o
// anexo quanto a assinatura, já que uma assinatura não faz sentido sem o
// arquivo por trás.
async function docExcluirAnexo(proformaId, chave) {
    const { tipoId, processoId } = _docParseChave(chave);
    const reg = _docReg(proformaId, chave);
    if (!reg?.arquivo_path) return;
    if (!(await confirmarAcao('Remover o arquivo anexado deste documento?', { titulo: 'Remover anexo', confirmar: 'Remover', perigo: true }))) return;

    await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]);
    const res = await window.supabaseAPI.limparAnexoDocumentoProforma(proformaId, tipoId, processoId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover anexo: ' + res.mensagem, 'erro');
        return;
    }
    _docGuardar(proformaId, chave, res.data || { ...reg, arquivo_path: null, arquivo_nome: null, enviado_por: null, enviado_em: null, assinado: false, assinado_por: null, assinado_em: null });
    docRenderizar();
    mostrarNotificacao('Anexo removido.', 'sucesso');
}

function docAbrirNovoPersonalizado(proformaId, processoId = null) {
    _docNovoEmProforma = `${proformaId}|${processoId || ''}`;
    _docExpandidos.add(proformaId);
    docRenderizar();
    setTimeout(() => document.getElementById(`docNovoNome_${proformaId}_${processoId || 'p'}`)?.focus(), 50);
}

function docCancelarPersonalizado() {
    _docNovoEmProforma = null;
    docRenderizar();
}

async function docSalvarPersonalizado(proformaId, processoId = null) {
    if (!exigirEmpresaVinculada()) return;
    const input = document.getElementById(`docNovoNome_${proformaId}_${processoId || 'p'}`);
    const nome = input?.value.trim();
    if (!nome) {
        input?.style.setProperty('border-color', '#dc2626');
        return;
    }
    const tipoId = `custom_${Date.now()}`;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, false, null, nome, null, null, processoId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao adicionar documento: ' + res.mensagem, 'erro');
        return;
    }
    _docGuardar(proformaId, docChave(tipoId, processoId), res.data);
    _docNovoEmProforma = null;
    docRenderizar();
    mostrarNotificacao('Documento adicionado.', 'sucesso');
}

async function docExcluirPersonalizado(proformaId, chave, registroId) {
    if (!registroId) return;
    const res = await window.supabaseAPI.excluirDocumentoProforma(registroId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover documento: ' + res.mensagem, 'erro');
        return;
    }
    if (_docSalvos[proformaId]) delete _docSalvos[proformaId][chave];
    docRenderizar();
    mostrarNotificacao('Documento removido.', 'sucesso');
}

