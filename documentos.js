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
            .from('processos').select('id, numero_processo, status, proforma_id, modal, documentos').in('proforma_id', proformaIds);
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
        (_docSalvos[d.proforma_id] ||= {})[d.tipo_documento] = d;
    });

    docRenderizar();
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

function _docLink(href, texto, titulo, icone) {
    return `<a class="doc-link" href="${_docEsc(href)}" target="_blank" rel="noopener" title="${_docEsc(titulo)}" onclick="event.stopPropagation()">${icone ? `<i class="fa-solid ${icone}"></i> ` : ''}${_docEsc(texto)}</a>`;
}

// Nome do documento: link pro arquivo anexado (upload/assinado) ou, se não houver,
// pro registro criado no sistema (Proforma / Processo onde o Nº foi preenchido).
function _docNomeComLink(proforma, r) {
    const { tipo, arquivoPath, arquivoNome } = r;
    const tag = tipo.modal ? `<span class="doc-tipo-tag">${_docEsc(DOC_MODAL_LABEL[tipo.modal])}</span>` : '';

    const arquivoUrl = arquivoPath ? _docUrlArquivo(arquivoPath) : null;
    let sistema = null;
    let numero = '';
    let prDoc = null;
    if (!tipo.custom) {
        if (tipo.id === 'proforma') {
            sistema = { href: _docUrlProforma(proforma.id), texto: `Proforma ${proforma.codigo || ''}`.trim(), titulo: `Abrir a Proforma ${proforma.codigo || ''}`, icone: 'fa-file-lines' };
        }
        const pr = (proforma._processos || []).find(x => String(x.documentos?.[tipo.id] ?? '').trim() !== '');
        if (pr) {
            prDoc = pr;
            numero = String(pr.documentos[tipo.id]).trim();
            if (!sistema) sistema = { href: _docUrlProcesso(pr.id), texto: `Processo ${pr.numero_processo || ''}`.trim(), titulo: `Nº ${numero} — abrir o Processo ${pr.numero_processo || ''}`, icone: 'fa-ship' };
        }
    }

    let principal;
    if (arquivoUrl) principal = _docLink(arquivoUrl, tipo.label, `Abrir arquivo${arquivoNome ? ': ' + arquivoNome : ''}`, 'fa-paperclip');
    else if (sistema) principal = _docLink(sistema.href, tipo.label, sistema.titulo, sistema.icone);
    else principal = _docEsc(tipo.label);

    const extra = [];
    if (numero) extra.push(`<span class="doc-num-ref">Nº ${_docEsc(numero)}</span>`);
    if (arquivoUrl && sistema) extra.push(_docLink(sistema.href, sistema.texto, sistema.titulo, sistema.icone));
    if (prDoc) extra.push(_docLink(_docUrlProcessoPdf(prDoc.id), 'PDF', `Gerar o PDF do Processo ${prDoc.numero_processo || ''}`.trim(), 'fa-file-pdf'));
    return `${principal}${tag}${extra.length ? `<div class="doc-sub">${extra.join(' · ')}</div>` : ''}`;
}

// ── Coluna Anexo: anexar o documento (ainda não assinado), ver, substituir, remover ──
const DOC_ANEXO_ACEITA = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx';
const DOC_ANEXO_MAX_MB = 15;

function _docAnexoCelula(proforma, r) {
    const { tipo, arquivoPath, arquivoNome } = r;
    const input = `<input type="file" hidden accept="${DOC_ANEXO_ACEITA}" onchange="docAnexarArquivo('${proforma.id}','${tipo.id}',this)">`;
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
        <button class="doc-row-excluir" title="Remover anexo" onclick="docExcluirAnexo('${proforma.id}','${tipo.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

async function docAnexarArquivo(proformaId, tipoId, input) {
    const file = input.files[0];
    if (!file) return;
    if (!exigirEmpresaVinculada()) { input.value = ''; return; }
    if (file.size > DOC_ANEXO_MAX_MB * 1024 * 1024) { mostrarNotificacao(`Arquivo maior que ${DOC_ANEXO_MAX_MB} MB.`, 'erro'); input.value = ''; return; }

    const reg = _docSalvos[proformaId]?.[tipoId];
    if (reg?.assinado && !(await confirmarAcao('Este documento já está assinado. Substituir o arquivo mantém a assinatura registrada. Continuar?', { titulo: 'Substituir arquivo', confirmar: 'Substituir' }))) { input.value = ''; return; }

    const label = input.closest('label');
    label.classList.add('carregando');
    label.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${proformaId}/${tipoId}_${Date.now()}_${safeName}`;
    const { error: erroUp } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
    if (erroUp) { mostrarNotificacao('Erro ao enviar o arquivo: ' + erroUp.message, 'erro'); docRenderizar(); return; }

    const rotulo = tipoId.startsWith('custom_') ? (reg?.tipo_label || null) : null;
    const res = await window.supabaseAPI.anexarDocumentoProforma(proformaId, tipoId, rotulo, path, file.name);
    if (!res.sucesso) {
        await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([path]);
        mostrarNotificacao('Erro ao registrar o anexo: ' + res.mensagem, 'erro');
        docRenderizar();
        return;
    }
    if (reg?.arquivo_path) supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]).catch(() => {}); // arquivo antigo substituído
    (_docSalvos[proformaId] ||= {})[tipoId] = res.data;
    docRenderizar();
    mostrarNotificacao('Documento anexado.', 'sucesso');
}

function _docLinksProcessos(p) {
    const l = p._processos || [];
    return l.length ? l.map(pr => _docLink(_docUrlProcesso(pr.id), pr.numero_processo || '—', 'Abrir Processo')).join(', ') : '—';
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
            const reg = salvos[tipo.id];
            const assinado = !!reg?.assinado;
            // Documento assinado OU já anexado (pelo Processo ou avulso)
            // conta como feito automaticamente, mesmo que o campo Nº
            // correspondente não tenha sido preenchido no Processo.
            const feito = tipo.custom ? null : (assinado || !!reg?.arquivo_path || docFeitoAutomatico(p._processos, tipo.id));
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
        <tr class="doc-linha-pedido">
            <td class="doc-col-seta">
                <button class="doc-toggle" onclick="docToggleLinha('${proforma.id}', ${expandido})" title="${expandido ? 'Recolher' : 'Expandir'}">
                    <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
                </button>
            </td>
            <td>
                <div class="doc-pedido-numero">${_docLink(_docUrlProforma(proforma.id), proforma.codigo || '—', 'Abrir a Proforma')}</div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Remetente:</span> <span class="doc-parceiro-valor">${remetente}</span></div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Destinatário:</span> <span class="doc-parceiro-valor">${destinatario}</span></div>
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

    const statusHtml = tipo.custom
        ? `<span class="doc-status-na">—</span>`
        : `<span class="doc-badge ${feito ? 'doc-badge-feito' : 'doc-badge-naofeito'}">${feito ? 'Feito' : 'Não Feito'}</span>`;

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
                <button class="doc-row-excluir" title="Desmarcar assinatura" onclick="docDesmarcarAssinatura('${proforma.id}','${tipo.id}')"><i class="fa-solid fa-rotate-left"></i></button>
            </div>`;
    } else if (arquivoPath) {
        // Arquivo já anexado (coluna Anexo) e ainda não assinado: só falta assinar
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.id}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Assinar
            </button>`;
    } else {
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${proforma.id}','${tipo.id}','${labelEsc}')">
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

function docAbrirModalAssinatura(proformaId, tipoId, tipoLabel) {
    _docAssinaturaAlvo = { proformaId, tipoId, tipoLabel };
    document.getElementById('docModalAssinaturaLabel').textContent = tipoLabel;
    document.getElementById('docModalAssinadoPor').value = '';
    document.getElementById('docModalAssinadoPor').style.borderColor = '';
    document.getElementById('docModalArquivo').value = '';

    // Se já existe um arquivo anexado (Processo ou anexo avulso), a
    // assinatura reaproveita ele — não obriga a subir de novo.
    const reg = _docSalvos[proformaId]?.[tipoId];
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
    const { proformaId, tipoId, tipoLabel } = _docAssinaturaAlvo;

    const nomeInput = document.getElementById('docModalAssinadoPor');
    const fileInput = document.getElementById('docModalArquivo');
    const nome = nomeInput.value.trim();
    const file = fileInput.files[0];
    const jaTemArquivo = !!_docSalvos[proformaId]?.[tipoId]?.arquivo_path;

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
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, true, nome, isCustom ? tipoLabel : null, path, nomeArquivo);
    if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao registrar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[proformaId] ||= {})[tipoId] = res.data;
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

async function docDesmarcarAssinatura(proformaId, tipoId) {
    const tipoLabelAtual = _docSalvos[proformaId]?.[tipoId]?.tipo_label || null;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(proformaId, tipoId, false, null, tipoLabelAtual);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao desmarcar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[proformaId] ||= {})[tipoId] = res.data;
    docRenderizar();
}

// Remove só o arquivo anexado (mantém a linha do documento) — some tanto o
// anexo quanto a assinatura, já que uma assinatura não faz sentido sem o
// arquivo por trás.
async function docExcluirAnexo(proformaId, tipoId) {
    const reg = _docSalvos[proformaId]?.[tipoId];
    if (!reg?.arquivo_path) return;
    if (!(await confirmarAcao('Remover o arquivo anexado deste documento?', { titulo: 'Remover anexo', confirmar: 'Remover', perigo: true }))) return;

    await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]);
    const res = await window.supabaseAPI.limparAnexoDocumentoProforma(proformaId, tipoId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover anexo: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[proformaId] ||= {})[tipoId] = res.data || { ...reg, arquivo_path: null, arquivo_nome: null, enviado_por: null, enviado_em: null, assinado: false, assinado_por: null, assinado_em: null };
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
