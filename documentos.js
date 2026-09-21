// ========================================
// DOCUMENTOS — status de documentos por Pedido
// ========================================
// Não existe assinatura digital real nessa aplicação: o status de cada
// documento é marcado manualmente pelo usuário. A lista de documentos de
// um pedido é: um conjunto fixo (universal) + o conjunto específico do
// modal de transporte da(s) proforma(s) geradas a partir dele + quaisquer
// tipos customizados que o usuário tenha adicionado.
// Taxonomia (DOC_TIPOS_UNIVERSAIS/DOC_TIPOS_MODAL/DOC_MODAL_LABEL) e os
// helpers docTiposDoPedido()/docFeitoAutomatico() vêm de doc-tipos.js,
// compartilhado com a seção "Pendências do Sistema" em inicio.js.

const DOC_LABELS_PEDIDO   = { aguardando: 'Aguardando', confirmado: 'Confirmado', em_producao: 'Em Produção', embarcado: 'Embarcado', entregue: 'Entregue', cancelado: 'Cancelado' };
const DOC_LABELS_PROFORMA = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
const DOC_LABELS_PROCESSO = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };

let _docPedidos      = [];
let _docSalvos       = {};   // pedido_id -> { tipo_documento -> registro }
let _docFiltroAtual  = 'todos';
let _docNovoEmPedido = null;   // id do pedido com a linha de "novo documento" aberta
let _docExpandidos   = new Set(); // ids de pedido expandidos manualmente
let _docRecolhidos   = new Set(); // ids de pedido recolhidos manualmente (vence a expansão forçada por filtro/busca)

document.addEventListener('DOMContentLoaded', async () => {
    await docCarregar();
});

async function docCarregar() {
    const container = document.getElementById('documentosContainer');
    container.innerHTML = '<div class="doc-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    const resPedidos = await buscarPedidos();
    if (!resPedidos.sucesso) {
        container.innerHTML = '<div class="doc-vazio">Erro ao carregar pedidos.</div>';
        return;
    }
    _docPedidos = resPedidos.data || [];

    const pedidoIds = _docPedidos.map(p => p.id).filter(Boolean);
    if (pedidoIds.length > 0) {
        const { data: proformas } = await supabaseClient
            .from('proformas').select('id, codigo, modal, status, pedido_id').in('pedido_id', pedidoIds);
        const proformasMap = {};
        (proformas || []).forEach(pf => { (proformasMap[pf.pedido_id] ||= []).push(pf); });

        const proformaIds = (proformas || []).map(pf => pf.id);
        let processosMap = {};
        if (proformaIds.length > 0) {
            const { data: procs } = await supabaseClient
                .from('processos').select('id, numero_processo, status, proforma_id, documentos').in('proforma_id', proformaIds);
            (procs || []).forEach(pr => { (processosMap[pr.proforma_id] ||= []).push(pr); });
        }
        _docPedidos.forEach(p => {
            p._proformas = proformasMap[p.id] || [];
            p._processos = p._proformas.flatMap(pf => processosMap[pf.id] || []);
        });
    } else {
        _docPedidos.forEach(p => { p._proformas = []; p._processos = []; });
    }

    const resDocs = await window.supabaseAPI.buscarDocumentosPedidos(pedidoIds);
    _docSalvos = {};
    (resDocs.data || []).forEach(d => {
        (_docSalvos[d.pedido_id] ||= {})[d.tipo_documento] = d;
    });

    docRenderizar();
}

function _docColunaProforma(p) {
    const lista = p._proformas || [];
    if (!lista.length) return { texto: '—', statusTexto: '—' };
    return {
        texto:       lista.map(pf => pf.codigo || '—').join(', '),
        statusTexto: lista.map(pf => DOC_LABELS_PROFORMA[pf.status] || pf.status || '—').join(', '),
    };
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

// ── Hiperlinks: cada documento/pedido/proforma/processo abre o registro real ──
const _docEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const _docUrlPedido   = id => `pedidos.html?editar=${encodeURIComponent(id)}&modo=visualizar`;
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
function _docNomeComLink(pedido, r) {
    const { tipo, arquivoPath, arquivoNome } = r;
    const tag = tipo.modal ? `<span class="doc-tipo-tag">${_docEsc(DOC_MODAL_LABEL[tipo.modal])}</span>` : '';

    const arquivoUrl = arquivoPath ? _docUrlArquivo(arquivoPath) : null;
    let sistema = null;
    let numero = '';
    let prDoc = null;
    if (!tipo.custom) {
        if (tipo.id === 'proforma' && pedido._proformas?.length) {
            const pf = pedido._proformas[0];
            sistema = { href: _docUrlProforma(pf.id), texto: `Proforma ${pf.codigo || ''}`.trim(), titulo: `Abrir a Proforma ${pf.codigo || ''} criada no sistema`, icone: 'fa-file-lines' };
        }
        const pr = (pedido._processos || []).find(x => String(x.documentos?.[tipo.id] ?? '').trim() !== '');
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

function _docAnexoCelula(pedido, r) {
    const { tipo, arquivoPath, arquivoNome } = r;
    const input = `<input type="file" hidden accept="${DOC_ANEXO_ACEITA}" onchange="docAnexarArquivo('${pedido.id}','${tipo.id}',this)">`;
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
        <button class="doc-row-excluir" title="Remover anexo" onclick="docExcluirAnexo('${pedido.id}','${tipo.id}')"><i class="fa-solid fa-trash"></i></button>
    </div>`;
}

async function docAnexarArquivo(pedidoId, tipoId, input) {
    const file = input.files[0];
    if (!file) return;
    if (!exigirEmpresaVinculada()) { input.value = ''; return; }
    if (file.size > DOC_ANEXO_MAX_MB * 1024 * 1024) { mostrarNotificacao(`Arquivo maior que ${DOC_ANEXO_MAX_MB} MB.`, 'erro'); input.value = ''; return; }

    const reg = _docSalvos[pedidoId]?.[tipoId];
    if (reg?.assinado && !(await confirmarAcao('Este documento já está assinado. Substituir o arquivo mantém a assinatura registrada. Continuar?', { titulo: 'Substituir arquivo', confirmar: 'Substituir' }))) { input.value = ''; return; }

    const label = input.closest('label');
    label.classList.add('carregando');
    label.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${pedidoId}/${tipoId}_${Date.now()}_${safeName}`;
    const { error: erroUp } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
    if (erroUp) { mostrarNotificacao('Erro ao enviar o arquivo: ' + erroUp.message, 'erro'); docRenderizar(); return; }

    const rotulo = tipoId.startsWith('custom_') ? (reg?.tipo_label || null) : null;
    const res = await window.supabaseAPI.anexarDocumentoPedido(pedidoId, tipoId, rotulo, path, file.name);
    if (!res.sucesso) {
        await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([path]);
        mostrarNotificacao('Erro ao registrar o anexo: ' + res.mensagem, 'erro');
        docRenderizar();
        return;
    }
    if (reg?.arquivo_path) supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]).catch(() => {}); // arquivo antigo substituído
    (_docSalvos[pedidoId] ||= {})[tipoId] = res.data;
    docRenderizar();
    mostrarNotificacao('Documento anexado.', 'sucesso');
}

function _docLinksProformas(p) {
    const l = p._proformas || [];
    return l.length ? l.map(pf => _docLink(_docUrlProforma(pf.id), pf.codigo || '—', 'Abrir Proforma')).join(', ') : '—';
}
function _docLinksProcessos(p) {
    const l = p._processos || [];
    return l.length ? l.map(pr => _docLink(_docUrlProcesso(pr.id), pr.numero_processo || '—', 'Abrir Processo')).join(', ') : '—';
}

function docRenderizar() {
    const container = document.getElementById('documentosContainer');
    const termo = (document.getElementById('buscaDoc')?.value || '').toLowerCase().trim();

    const linhas = _docPedidos.map(p => {
        const remetente    = p.remetente?.nome_fantasia || p.remetente?.razao_social || 'Própria empresa';
        const destinatario = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
        const tipos   = docTiposDoPedido(p._proformas, _docSalvos[p.id]);
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

        // Progresso sempre calculado em cima de TODOS os documentos do
        // pedido (não só os filtrados) — senão o % mudaria sozinho ao
        // trocar de aba de filtro, o que ia confundir mais que ajudar.
        const totalDocs     = docRows.length;
        const assinadosDocs = docRows.filter(r => r.assinado).length;

        return { pedido: p, remetente, destinatario, docRowsFiltradas, totalDocs, assinadosDocs };
    }).filter(({ pedido, remetente, destinatario, docRowsFiltradas }) => {
        if (docRowsFiltradas.length === 0) return false;
        if (!termo) return true;
        const alvo = `${pedido.numero || ''} ${remetente} ${destinatario}`.toLowerCase();
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
                    <th>Pedido</th>
                    <th class="doc-col-status">Status do Pedido</th>
                    <th class="doc-col-progresso">Documentos</th>
                    <th>Proforma</th>
                    <th class="doc-col-status">Status da Proforma</th>
                    <th>Processo</th>
                    <th class="doc-col-status">Status do Processo</th>
                    <th>Criado por</th>
                </tr>
            </thead>
            <tbody>
                ${linhas.map(l => _docRenderLinhaPedido(l, forcarExpandir)).join('')}
            </tbody>
        </table>`;
}

function _docRenderLinhaPedido({ pedido, remetente, destinatario, docRowsFiltradas, totalDocs, assinadosDocs }, forcarExpandir) {
    const expandido = _docExpandidos.has(pedido.id) || (forcarExpandir && !_docRecolhidos.has(pedido.id));
    const prof = _docColunaProforma(pedido);
    const proc = _docColunaProcesso(pedido);

    const linhaResumo = `
        <tr class="doc-linha-pedido">
            <td class="doc-col-seta">
                <button class="doc-toggle" onclick="docToggleLinha('${pedido.id}', ${expandido})" title="${expandido ? 'Recolher' : 'Expandir'}">
                    <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
                </button>
            </td>
            <td>
                <div class="doc-pedido-numero">${pedido.numero ? _docLink(_docUrlPedido(pedido.id), pedido.numero, 'Abrir o Pedido') : '—'}</div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Remetente:</span> <span class="doc-parceiro-valor">${remetente}</span></div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Destinatário:</span> <span class="doc-parceiro-valor">${destinatario}</span></div>
            </td>
            <td class="doc-col-status"><span class="doc-badge doc-badge-ped-${pedido.status || ''}">${DOC_LABELS_PEDIDO[pedido.status] || pedido.status || '—'}</span></td>
            <td class="doc-col-progresso">${_docRenderProgresso(totalDocs, assinadosDocs)}</td>
            <td class="doc-referencia">${_docLinksProformas(pedido)}</td>
            <td class="doc-col-status">${prof.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${prof.statusTexto}</span>` : '—'}</td>
            <td class="doc-referencia">${_docLinksProcessos(pedido)}</td>
            <td class="doc-col-status">${proc.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${proc.statusTexto}</span>` : '—'}</td>
            <td class="doc-criado-por">${pedido.criado_por || '—'}</td>
        </tr>`;

    if (!expandido) return linhaResumo;

    const linhaDetalhe = `
        <tr class="doc-linha-detalhe">
            <td colspan="9">
                <div class="doc-detalhe-wrap">
                    <div class="doc-detalhe-header">
                        <button class="doc-pedido-add" onclick="docAbrirNovoPersonalizado('${pedido.id}')">
                            <i class="fa-solid fa-plus"></i> Documento
                        </button>
                    </div>
                    <table class="doc-pedido-tabela">
                        <thead><tr><th>Documento</th><th>Status</th><th>Anexo</th><th>Assinatura</th><th></th></tr></thead>
                        <tbody>
                            ${docRowsFiltradas.map(r => _docRenderLinha(pedido, r)).join('')}
                            ${_docNovoEmPedido === pedido.id ? _docRenderLinhaNova(pedido.id) : ''}
                        </tbody>
                    </table>
                </div>
            </td>
        </tr>`;

    return linhaResumo + linhaDetalhe;
}

function _docRenderLinhaNova(pedidoId) {
    return `
        <tr>
            <td colspan="2">
                <input type="text" id="docNovoNome_${pedidoId}" placeholder="Nome do documento..."
                    style="width:100%; padding:6px 10px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;"
                    onkeydown="if(event.key==='Enter') docSalvarPersonalizado('${pedidoId}'); if(event.key==='Escape') docCancelarPersonalizado();">
            </td>
            <td colspan="3" style="white-space:nowrap;">
                <button class="doc-pedido-add" onclick="docSalvarPersonalizado('${pedidoId}')">Salvar</button>
                <button class="doc-row-excluir" onclick="docCancelarPersonalizado()" title="Cancelar"><i class="fa-solid fa-xmark"></i></button>
            </td>
        </tr>`;
}

function _docRenderLinha(pedido, r) {
    const { tipo, feito, assinado, assinadoPor, assinadoEm, enviadoPor, arquivoPath, arquivoNome, reg } = r;
    const tag = tipo.modal ? `<span class="doc-tipo-tag">${DOC_MODAL_LABEL[tipo.modal]}</span>` : '';
    const labelEsc = (tipo.label || '').replace(/'/g, "\\'");
    const excluir = tipo.custom
        ? `<button class="doc-row-excluir" onclick="docExcluirPersonalizado('${pedido.id}','${tipo.id}', ${reg?.id ? `'${reg.id}'` : 'null'})" title="Remover"><i class="fa-solid fa-trash"></i></button>`
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
                <button class="doc-row-excluir" title="Desmarcar assinatura" onclick="docDesmarcarAssinatura('${pedido.id}','${tipo.id}')"><i class="fa-solid fa-rotate-left"></i></button>
            </div>`;
    } else if (arquivoPath) {
        // Arquivo já anexado (coluna Anexo) e ainda não assinado: só falta assinar
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${pedido.id}','${tipo.id}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Assinar
            </button>`;
    } else {
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${pedido.id}','${tipo.id}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Não Assinado
            </button>`;
    }

    return `
        <tr>
            <td>${_docNomeComLink(pedido, r)}</td>
            <td>${statusHtml}</td>
            <td>${_docAnexoCelula(pedido, r)}</td>
            <td>${assinaturaHtml}</td>
            <td>${excluir}</td>
        </tr>`;
}

function docToggleLinha(pedidoId, estavaExpandido) {
    if (estavaExpandido) {
        _docExpandidos.delete(pedidoId);
        _docRecolhidos.add(pedidoId);
    } else {
        _docExpandidos.add(pedidoId);
        _docRecolhidos.delete(pedidoId);
    }
    docRenderizar();
}

// ── Assinatura digital (anexo do documento assinado) ────────────────────
const BUCKET_DOC_ASSINATURA = 'pedido-documentos-assinados';
let _docAssinaturaAlvo = null; // { pedidoId, tipoId, tipoLabel }

function docAbrirModalAssinatura(pedidoId, tipoId, tipoLabel) {
    _docAssinaturaAlvo = { pedidoId, tipoId, tipoLabel };
    document.getElementById('docModalAssinaturaLabel').textContent = tipoLabel;
    document.getElementById('docModalAssinadoPor').value = '';
    document.getElementById('docModalAssinadoPor').style.borderColor = '';
    document.getElementById('docModalArquivo').value = '';

    // Se já existe um arquivo anexado (Processo ou anexo avulso), a
    // assinatura reaproveita ele — não obriga a subir de novo.
    const reg = _docSalvos[pedidoId]?.[tipoId];
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
    const { pedidoId, tipoId, tipoLabel } = _docAssinaturaAlvo;

    const nomeInput = document.getElementById('docModalAssinadoPor');
    const fileInput = document.getElementById('docModalArquivo');
    const nome = nomeInput.value.trim();
    const file = fileInput.files[0];
    const jaTemArquivo = !!_docSalvos[pedidoId]?.[tipoId]?.arquivo_path;

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
        path = `${pedidoId}/${tipoId}_${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
        if (uploadError) {
            mostrarNotificacao('Erro ao enviar arquivo: ' + uploadError.message, 'erro');
            if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
            return;
        }
        nomeArquivo = file.name;
    }

    const isCustom = tipoId.startsWith('custom_');
    const res = await window.supabaseAPI.marcarDocumentoAssinado(pedidoId, tipoId, true, nome, isCustom ? tipoLabel : null, path, nomeArquivo);
    if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao registrar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[pedidoId] ||= {})[tipoId] = res.data;
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

async function docDesmarcarAssinatura(pedidoId, tipoId) {
    const tipoLabelAtual = _docSalvos[pedidoId]?.[tipoId]?.tipo_label || null;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(pedidoId, tipoId, false, null, tipoLabelAtual);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao desmarcar assinatura: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[pedidoId] ||= {})[tipoId] = res.data;
    docRenderizar();
}

// Remove só o arquivo anexado (mantém a linha do documento) — some tanto o
// anexo quanto a assinatura, já que uma assinatura não faz sentido sem o
// arquivo por trás.
async function docExcluirAnexo(pedidoId, tipoId) {
    const reg = _docSalvos[pedidoId]?.[tipoId];
    if (!reg?.arquivo_path) return;
    if (!(await confirmarAcao('Remover o arquivo anexado deste documento?', { titulo: 'Remover anexo', confirmar: 'Remover', perigo: true }))) return;

    await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).remove([reg.arquivo_path]);
    const res = await window.supabaseAPI.limparAnexoDocumentoPedido(pedidoId, tipoId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover anexo: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[pedidoId] ||= {})[tipoId] = res.data || { ...reg, arquivo_path: null, arquivo_nome: null, enviado_por: null, enviado_em: null, assinado: false, assinado_por: null, assinado_em: null };
    docRenderizar();
    mostrarNotificacao('Anexo removido.', 'sucesso');
}

function docAbrirNovoPersonalizado(pedidoId) {
    _docNovoEmPedido = pedidoId;
    _docExpandidos.add(pedidoId);
    docRenderizar();
    setTimeout(() => document.getElementById(`docNovoNome_${pedidoId}`)?.focus(), 50);
}

function docCancelarPersonalizado() {
    _docNovoEmPedido = null;
    docRenderizar();
}

async function docSalvarPersonalizado(pedidoId) {
    if (!exigirEmpresaVinculada()) return;
    const input = document.getElementById(`docNovoNome_${pedidoId}`);
    const nome = input?.value.trim();
    if (!nome) {
        input?.style.setProperty('border-color', '#dc2626');
        return;
    }
    const tipoId = `custom_${Date.now()}`;
    const res = await window.supabaseAPI.marcarDocumentoAssinado(pedidoId, tipoId, false, null, nome);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao adicionar documento: ' + res.mensagem, 'erro');
        return;
    }
    (_docSalvos[pedidoId] ||= {})[tipoId] = res.data;
    _docNovoEmPedido = null;
    docRenderizar();
    mostrarNotificacao('Documento adicionado.', 'sucesso');
}

async function docExcluirPersonalizado(pedidoId, tipoId, registroId) {
    if (!registroId) return;
    const res = await window.supabaseAPI.excluirDocumentoPedido(registroId);
    if (!res.sucesso) {
        mostrarNotificacao('Erro ao remover documento: ' + res.mensagem, 'erro');
        return;
    }
    if (_docSalvos[pedidoId]) delete _docSalvos[pedidoId][tipoId];
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
