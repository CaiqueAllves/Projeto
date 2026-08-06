// ========================================
// DOCUMENTOS — status de documentos por Pedido
// ========================================
// Não existe assinatura digital real nessa aplicação: o status de cada
// documento é marcado manualmente pelo usuário. A lista de documentos de
// um pedido é: um conjunto fixo (universal) + o conjunto específico do
// modal de transporte da(s) proforma(s) geradas a partir dele + quaisquer
// tipos customizados que o usuário tenha adicionado.

const DOC_TIPOS_UNIVERSAIS = [
    { id: 'proforma',   label: 'Nº Proforma Invoice' },
    { id: 'commercial', label: 'Nº Commercial Invoice' },
    { id: 'packing',    label: 'Nº Packing List' },
    { id: 'due',        label: 'Nº DUE' },
    { id: 'le',         label: 'Nº Licença de Exportação (LE)' },
    { id: 'certorigem', label: 'Nº Certificado de Origem' },
    { id: 'ctn',        label: 'Nº Conhecimento de Transporte Nacional' },
    { id: 'nfe',        label: 'Nº Nota Fiscal de Exportação' },
];

const DOC_TIPOS_MODAL = {
    aereo: [
        { id: 'awb',       label: 'Nº AWB' },
        { id: 'manifesto', label: 'Nº Manifesto de Carga' },
    ],
    maritimo: [
        { id: 'fcl',     label: 'Nº FCL — Full Container Load' },
        { id: 'lcl',     label: 'Nº LCL — Less than Container Load' },
        { id: 'bl',      label: 'Nº BL — Bill of Lading' },
        { id: 'apolice', label: 'Nº Apólice de Seguro' },
    ],
    terrestre: [
        { id: 'crt',    label: 'Nº CRT — Conhecimento de Transporte Internacional' },
        { id: 'micdta', label: 'Nº MIC/DTA' },
    ],
};

const DOC_MODAL_LABEL = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' };

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

function _docTiposDoPedido(p) {
    const tipos = [...DOC_TIPOS_UNIVERSAIS];
    const modais = [...new Set((p._proformas || []).map(pf => pf.modal).filter(Boolean))];
    modais.forEach(modal => {
        (DOC_TIPOS_MODAL[modal] || []).forEach(t => tipos.push({ ...t, modal }));
    });
    const salvos = _docSalvos[p.id] || {};
    Object.values(salvos).forEach(reg => {
        const jaExiste = tipos.some(t => t.id === reg.tipo_documento);
        if (!jaExiste && String(reg.tipo_documento).startsWith('custom_')) {
            tipos.push({ id: reg.tipo_documento, label: reg.tipo_label || 'Documento', custom: true });
        }
    });
    return tipos;
}

// "Feito" não é mais marcado manualmente: pros tipos fixos/por modal, o
// sistema verifica se o campo Nº correspondente já foi preenchido na seção
// "Documentos" do formulário de Processo (processos.documentos, JSONB com
// as mesmas chaves de DOC_TIPOS_UNIVERSAIS/DOC_TIPOS_MODAL).
function _docFeitoAutomatico(p, tipoId) {
    return (p._processos || []).some(pr => {
        const valor = pr.documentos?.[tipoId];
        return valor !== undefined && valor !== null && String(valor).trim() !== '';
    });
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

function docRenderizar() {
    const container = document.getElementById('documentosContainer');
    const termo = (document.getElementById('buscaDoc')?.value || '').toLowerCase().trim();

    const linhas = _docPedidos.map(p => {
        const remetente    = p.remetente?.nome_fantasia || p.remetente?.razao_social || 'Própria empresa';
        const destinatario = p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—';
        const tipos   = _docTiposDoPedido(p);
        const salvos  = _docSalvos[p.id] || {};

        const docRows = tipos.map(tipo => {
            const reg = salvos[tipo.id];
            const assinado = !!reg?.assinado;
            // Documento assinado conta como feito automaticamente, mesmo que
            // o campo Nº correspondente não tenha sido preenchido no Processo.
            const feito = tipo.custom ? null : (assinado || _docFeitoAutomatico(p, tipo.id));
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

        return { pedido: p, remetente, destinatario, docRowsFiltradas };
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

function _docRenderLinhaPedido({ pedido, remetente, destinatario, docRowsFiltradas }, forcarExpandir) {
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
                <div class="doc-pedido-numero">${pedido.numero || '—'}</div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Remetente:</span> <span class="doc-parceiro-valor">${remetente}</span></div>
                <div class="doc-pedido-parceiro"><span class="doc-parceiro-label">Destinatário:</span> <span class="doc-parceiro-valor">${destinatario}</span></div>
            </td>
            <td class="doc-col-status"><span class="doc-badge doc-badge-ped-${pedido.status || ''}">${DOC_LABELS_PEDIDO[pedido.status] || pedido.status || '—'}</span></td>
            <td class="doc-referencia">${prof.texto}</td>
            <td class="doc-col-status">${prof.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${prof.statusTexto}</span>` : '—'}</td>
            <td class="doc-referencia">${proc.texto}</td>
            <td class="doc-col-status">${proc.statusTexto !== '—' ? `<span class="doc-badge doc-badge-neutro">${proc.statusTexto}</span>` : '—'}</td>
            <td class="doc-criado-por">${pedido.criado_por || '—'}</td>
        </tr>`;

    if (!expandido) return linhaResumo;

    const linhaDetalhe = `
        <tr class="doc-linha-detalhe">
            <td colspan="8">
                <div class="doc-detalhe-wrap">
                    <div class="doc-detalhe-header">
                        <button class="doc-pedido-add" onclick="docAbrirNovoPersonalizado('${pedido.id}')">
                            <i class="fa-solid fa-plus"></i> Documento
                        </button>
                    </div>
                    <table class="doc-pedido-tabela">
                        <thead><tr><th>Documento</th><th>Status</th><th>Assinatura</th><th></th></tr></thead>
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
            <td colspan="2" style="white-space:nowrap;">
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
                    <div class="doc-assinatura-por"><i class="fa-solid fa-signature"></i> ${assinadoPor || '—'}</div>
                    ${enviadoPor ? `<div class="doc-assinatura-enviado">Enviado por <strong>${enviadoPor}</strong></div>` : ''}
                    <div class="doc-assinatura-data">${dataFmt}</div>
                </div>
                ${arquivoPath ? `<button class="doc-row-excluir" title="Baixar documento assinado" onclick="docBaixarAssinatura('${arquivoPath.replace(/'/g, "\\'")}','${(arquivoNome || 'documento').replace(/'/g, "\\'")}')"><i class="fa-solid fa-download"></i></button>` : ''}
                <button class="doc-row-excluir" title="Desmarcar assinatura" onclick="docDesmarcarAssinatura('${pedido.id}','${tipo.id}')"><i class="fa-solid fa-rotate-left"></i></button>
            </div>`;
    } else {
        assinaturaHtml = `
            <button class="doc-assinatura-marcar" onclick="docAbrirModalAssinatura('${pedido.id}','${tipo.id}','${labelEsc}')">
                <i class="fa-regular fa-circle"></i> Não Assinado
            </button>`;
    }

    return `
        <tr>
            <td>${tipo.label}${tag}</td>
            <td>${statusHtml}</td>
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
    document.getElementById('docModalAssinatura').style.display = 'flex';
}

function docFecharModalAssinatura() {
    document.getElementById('docModalAssinatura').style.display = 'none';
    _docAssinaturaAlvo = null;
}

async function docConfirmarAssinaturaModal() {
    if (!_docAssinaturaAlvo) return;
    const { pedidoId, tipoId, tipoLabel } = _docAssinaturaAlvo;

    const nomeInput = document.getElementById('docModalAssinadoPor');
    const fileInput = document.getElementById('docModalArquivo');
    const nome = nomeInput.value.trim();
    const file = fileInput.files[0];

    if (!nome) { nomeInput.style.borderColor = '#dc2626'; return; }
    if (!file) { mostrarNotificacao('Anexe o documento assinado.', 'erro'); return; }

    const btn = document.querySelector('#docModalAssinatura .doc-modal-btn-confirmar');
    const btnHtmlOriginal = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...'; }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${pedidoId}/${tipoId}_${Date.now()}_${safeName}`;

    const { error: uploadError } = await supabaseClient.storage.from(BUCKET_DOC_ASSINATURA).upload(path, file);
    if (uploadError) {
        mostrarNotificacao('Erro ao enviar arquivo: ' + uploadError.message, 'erro');
        if (btn) { btn.disabled = false; btn.innerHTML = btnHtmlOriginal; }
        return;
    }

    const isCustom = tipoId.startsWith('custom_');
    const res = await window.supabaseAPI.marcarDocumentoAssinado(pedidoId, tipoId, true, nome, isCustom ? tipoLabel : null, path, file.name);
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
