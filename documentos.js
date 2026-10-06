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
let _docNovoEmProforma = null;   // id da proforma com a linha de "novo documento" aberta
let _docExpandidos   = new Set(); // ids de proforma expandidos manualmente
let _docRecolhidos   = new Set(); // ids de proforma recolhidos manualmente (vence a expansão forçada por filtro/busca)

document.addEventListener('DOMContentLoaded', async () => {
    await docCarregar();
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

async function docCarregar() {
    const container = document.getElementById('documentosContainer');
    container.innerHTML = '<div class="doc-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    const usuario = obterUsuarioLogado();
    let query = supabaseClient.from('proformas').select('*').neq('status', 'excluido').order('created_at', { ascending: false });
    if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
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
            .from('processos').select('id, numero_processo, status, proforma_id, modal, documentos, criado_em, criado_por').in('proforma_id', proformaIds);
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

    // Nomes de quem criou proformas/processos (coluna Status: "Criado ... por ...")
    _docNomes = await window.supabaseAPI.buscarNomesUsuarios([
        ..._docProformas.map(p => p.criado_por),
        ..._docProformas.flatMap(p => p._processos.map(pr => pr.criado_por)),
    ]);

    // Vindo do aviso "Proforma não assinada" (link "Assinar Proposta"):
    // já abre com a proforma expandida e rola até ela.
    const alvo = new URLSearchParams(window.location.search).get('proforma_id');
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
const _docUrlProcessoPdf = id => `formularios.html?tab=processo&id=${encodeURIComponent(id)}&modo=pdf`;

function _docUrlArquivo(path) {
    try {
        const u = supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).getPublicUrl(path).data?.publicUrl;
        return /^https:\/\//i.test(u || '') ? u : null;
    } catch { return null; }
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
    const tag = tipo.modal ? `<span class="doc-tipo-tag">${_docEsc(DOC_MODAL_LABEL[tipo.modal])}</span>` : '';

    let sistema = null;
    let numero = '';
    let prDoc = null;
    if (!tipo.custom) {
        if (tipo.id === 'proforma') {
            sistema = { href: _docUrlProforma(proforma.id), texto: `Proforma ${proforma.codigo || ''}`.trim(), titulo: `Abrir a Proforma ${proforma.codigo || ''}`, icone: 'fa-file-lines' };
        }
        const pr = (proforma._processos || [])
            .filter(x => !tipo.processoId || x.id === tipo.processoId)
            .find(x => String(x.documentos?.[tipo.id] ?? '').trim() !== '');
        if (pr) {
            prDoc = pr;
            numero = String(pr.documentos[tipo.id]).trim();
            if (!sistema) sistema = { href: _docUrlProcesso(pr.id), texto: `Processo ${pr.numero_processo || ''}`.trim(), titulo: `Nº ${numero} — abrir o Processo ${pr.numero_processo || ''}`, icone: 'fa-ship' };
        }
    }

    // Título do documento é só texto — o arquivo abre pela coluna Anexo e o
    // registro do sistema pelos links abaixo do título.
    const principal = `<span class="doc-nome">${_docEsc(tipo.label)}</span>`;
    // Documento por Processo: mostra de qual embarque é
    const tagProc = tipo.processoId
        ? `<span class="doc-tipo-tag doc-tipo-tag--proc">${_docEsc(tipo.processoNumero || 'Processo')}</span>`
        : (tipo.semProcesso ? `<span class="doc-tipo-tag">Por processo</span>` : '');

    const extra = [];
    if (numero) extra.push(`<span class="doc-num-ref">Nº ${_docEsc(numero)}</span>`);
    if (sistema) extra.push(_docLink(sistema.href, sistema.texto, sistema.titulo, sistema.icone));
    if (prDoc) extra.push(_docLink(_docUrlProcessoPdf(prDoc.id), 'PDF', `Gerar o PDF do Processo ${prDoc.numero_processo || ''}`.trim(), 'fa-file-pdf'));
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
    const url = arquivoPath ? _docUrlArquivo(arquivoPath) : null;
    if (!arquivoPath) {
        return `<label class="doc-anexo-btn" title="Anexar o documento (mesmo que ainda não esteja assinado)"><i class="fa-solid fa-upload"></i> Anexar${input}</label>`;
    }
    const nome = _docEsc(arquivoNome || 'documento');
    const ver = url
        ? `<a class="doc-anexo-ver" href="${_docEsc(url)}" target="_blank" rel="noopener" title="Abrir ${nome}"><i class="fa-solid fa-paperclip"></i> ${nome}</a>`
        : `<span class="doc-anexo-ver"><i class="fa-solid fa-paperclip"></i> ${nome}</span>`;
    return `<div class="doc-anexo-cell">${ver}
        <label class="doc-row-excluir" title="Substituir o arquivo"><i class="fa-solid fa-arrow-up-from-bracket"></i>${input}</label>
        <button class="doc-row-excluir" title="Remover anexo" onclick="docExcluirAnexo('${proforma.id}','${tipo.chave}')"><i class="fa-solid fa-trash"></i></button>
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
    if (reg?.assinado && !(await confirmarAcao('Este documento já está assinado. Substituir o arquivo mantém a assinatura registrada. Continuar?', { titulo: 'Substituir arquivo', confirmar: 'Substituir' }))) { input.value = ''; return; }

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
function _docOrigem(proforma, tipo, reg) {
    if (reg?.arquivo_path) {
        return { em: reg.enviado_em || reg.atualizado_em, por: reg.enviado_por };
    }
    if (tipo.id === 'proforma') {
        return { em: proforma.created_at, por: _docNomes[proforma.criado_por] };
    }
    const pr = (proforma._processos || []).filter(x => !tipo.processoId || x.id === tipo.processoId).find(x => {
        const v = x.documentos?.[tipo.id];
        return v !== undefined && v !== null && String(v).trim() !== '';
    });
    if (pr) return { em: pr.criado_em, por: _docNomes[pr.criado_por] };
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
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Exportador:</span> <span class="doc-parceiro-valor">${remetente}</span></div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Importador:</span> <span class="doc-parceiro-valor">${destinatario}</span></div>
            </td>
            <td class="doc-col-status"><span class="doc-badge doc-badge-neutro">${DOC_LABELS_PROFORMA[proforma.status] || proforma.status || '—'}</span></td>
            <td class="doc-col-progresso">${_docRenderProgresso(totalDocs, assinadosDocs)}</td>
            <td class="doc-referencia">${_docLinksProcessos(proforma)}</td>
            <td class="doc-col-status">${proc.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${proc.statusTexto}</span>` : '—'}</td>
        </tr>`;

    if (!expandido) return linhaResumo;

    const linhaDetalhe = `
        <tr class="doc-linha-detalhe">
            <td colspan="6">
                <div class="doc-detalhe-wrap">
                    <div class="doc-detalhe-header">
                        <button class="doc-pedido-add" onclick="docAbrirNovoPersonalizado('${proforma.id}')">
                            <i class="fa-solid fa-plus"></i> Documento
                        </button>
                    </div>
                    <table class="doc-pedido-tabela">
                        <thead><tr><th>Documento</th><th>Status</th><th>Anexo</th><th>Assinatura</th><th></th></tr></thead>
                        <tbody>
                            ${docRowsFiltradas.map(r => _docRenderLinha(proforma, r)).join('')}
                            ${_docNovoEmProforma === proforma.id ? _docRenderLinhaNova(proforma.id) : ''}
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>`;

    return linhaResumo + linhaDetalhe;
}

function _docRenderLinhaNova(proformaId) {
    return `
        <tr>
            <td colspan="2">
                <input type="text" id="docNovoNome_${proformaId}" placeholder="Nome do documento..."
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;"
                    onkeydown="if(event.key==='Enter') docSalvarPersonalizado('${proformaId}'); if(event.key==='Escape') docCancelarPersonalizado();">
            </td>
            <td colspan="3" style="white-space:nowrap;">
                <button class="doc-pedido-add" onclick="docSalvarPersonalizado('${proformaId}')">Salvar</button>
                <button class="doc-row-excluir" onclick="docCancelarPersonalizado()" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
            </td>
        </tr>`;
}

function _docRenderLinha(proforma, r) {
    const { tipo, feito, assinado, assinadoPor, assinadoEm, enviadoPor, arquivoPath, arquivoNome, reg } = r;
    const tag = tipo.modal ? `<span class="doc-tipo-tag">${DOC_MODAL_LABEL[tipo.modal]}</span>` : '';
    const labelEsc = (tipo.label || '').replace(/'/g, "\\'");
    const excluir = tipo.custom
        ? `<button class="doc-row-excluir" onclick="docExcluirPersonalizado('${proforma.id}','${tipo.id}', ${reg?.id ? `'${reg.id}'` : 'null'})" title="Remover"><i class="fa-solid fa-trash"></i></button>`
        : '';

    // Status: "Criado em <data> por <usuário>" (+ "Assinado por <usuário> em <data>")
    const origem = _docOrigem(proforma, tipo, reg);
    const statusHtml = (tipo.custom && !origem && !assinado)
        ? `<span class="doc-status-na">—</span>`
        : (origem || feito)
            ? `<div class="doc-status-info">
                   <div class="doc-status-linha"><i class="fa-solid fa-circle-check"></i> Criado em <strong>${_docFmtData(origem?.em)}</strong> por <strong>${_docEsc(origem?.por || '—')}</strong></div>
                   ${assinado ? `<div class="doc-status-linha doc-status-linha--assinado"><i class="fa-solid fa-signature"></i> Assinado por <strong>${_docEsc(assinadoPor || '—')}</strong> em <strong>${_docFmtData(assinadoEm, true)}</strong></div>` : ''}
               </div>`
            : `<span class="doc-badge doc-badge-naofeito">Não Feito</span>`;

    let assinaturaHtml;
    if (assinado) {
        const dataFmt = assinadoEm
            ? new Date(assinadoEm).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
        assinaturaHtml = `
            <div class="doc-assinatura-feita">
                <div class="doc-assinatura-info">
                    <div class="doc-assinatura-por"><i class="fa-solid fa-signature"></i> ${_docEsc(assinadoPor || '—')}</div>
                    ${enviadoPor ? `<div class="doc-assinatura-enviado">Enviado por <strong>${_docEsc(enviadoPor)}</strong></div>` : ''}
                    <div class="doc-assinatura-data">${dataFmt}</div>
                </div>
                <button class="doc-row-excluir" title="Desmarcar assinatura" onclick="docDesmarcarAssinatura('${proforma.id}','${tipo.chave}')"><i class="fa-solid fa-rotate-left"></i></button>
            </div>`;
    } else if (arquivoPath) {
        // Arquivo já anexado (coluna Anexo) e ainda não assinado: só falta assinar
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.chave}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Assinar
            </button>`;
    } else {
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.chave}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Não Assinado
            </button>`;
    }

    return `
        <tr>
            <td>${_docNomeComLink(proforma, r)}</td>
            <td>${statusHtml}</td>
            <td>${_docAnexoCelula(proforma, r)}</td>
            <td>${assinaturaHtml}</td>
            <td>${excluir}</td>
        </tr>`;
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
        existenteEl.innerHTML = `<i class="fa-solid fa-paperclip"></i> Já anexado: <strong>${reg.arquivo_nome || 'documento'}</strong> — deixe em branco pra manter, ou escolha outro pra substituir.`;
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

async function docBaixarAssinatura(path, nome) {
    const { data, error } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).download(path);
    if (error) { mostrarNotificacao('Erro ao baixar documento.', 'erro'); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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

function docAbrirNovoPersonalizado(proformaId) {
    _docNovoEmProforma = proformaId;
    _docExpandidos.add(proformaId);
    docRenderizar();
    setTimeout(() => document.getElementById(`docNovoNome_${proformaId}`)?.focus(), 50);
}

function docCancelarPersonalizado() {
    _docNovoEmProforma = null;
    docRenderizar();
}

async function docSalvarPersonalizado(proformaId) {
    if (!exigirEmpresaVinculada()) return;
    const input = document.getElementById(`docNovoNome_${proformaId}`);
    const nome = input?.value.trim();
    if (!nome) {
        input?.style.setProperty('border-color', '#dc2626');
        return;
    }
    const tipoId = `custom_${Date.now()}`;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, false, null, nome);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao adicionar documento: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[proformaId] ||= {})[tipoId] = res.data;
    _docNovoEmProforma = null;
    docRenderizar();
    mostrarNotificacao('Documento adicionado.', 'sucesso');
}

async function docExcluirPersonalizado(proformaId, tipoId, registroId) {
    if (!registroId) return;
    const res = await window.supabaseAPI.excluirDocumentoProforma(registroId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover documento: ' + res.mensagem, 'erro');
        return;
    }
    if (_docSalvos[proformaId]) delete _docSalvos[proformaId][tipoId];
    docRenderizar();
    mostrarNotificacao('Documento removido.', 'sucesso');
}

function docFiltrar(filtro) {
    _docFiltroAtual = filtro;
    ['docFiltroTodos', 'docFiltroPendentes', 'docFiltroAssinados'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });
    const mapa = { todos: 'docFiltroTodos', pendentes: 'docFiltroPendentes', assinados: 'docFiltroAssinados' };
    document.getElementById(mapa[filtro])?.classList.add('active');
    docRenderizar();
}

function docBuscar() {
    docRenderizar();
}
