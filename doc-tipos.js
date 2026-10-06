// ========================================
// TAXONOMIA DE TIPOS DE DOCUMENTO POR PROFORMA
// ========================================
// Compartilhada entre documentos.js (tela Documentos) e inicio.js (seção
// "Pendências do Sistema") — mesma fonte de verdade dos campos "Nº ..." da
// seção Documentos do formulário de Processo (formularios.html).

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

// Documentos de cada embarque: guardados por Processo (proforma_documentos.processo_id),
// uma linha por Processo da Proforma. Os demais são da Proforma toda.
const DOC_TIPOS_POR_PROCESSO = ['commercial', 'packing', 'due'];

// Chave do documento no mapa de salvos: 'tipo' ou 'tipo@<processoId>'
function docChave(tipoId, processoId) {
    return (processoId && DOC_TIPOS_POR_PROCESSO.includes(tipoId)) ? `${tipoId}@${processoId}` : tipoId;
}
function docChaveRegistro(reg) {
    return docChave(reg.tipo_documento, reg.processo_id);
}

// Registro salvo de uma linha. Antes da migração por processo, o registro não
// tem processo_id — se a Proforma tiver 1 Processo só, ele vale pra esse Processo.
function docRegistroDaLinha(docsSalvos, tipo, processosDaProforma) {
    const salvos = docsSalvos || {};
    if (!tipo.processoId) return salvos[tipo.id];
    return salvos[docChave(tipo.id, tipo.processoId)]
        || ((processosDaProforma || []).length === 1 ? salvos[tipo.id] : undefined);
}

// Monta a lista de tipos aplicáveis a uma proforma: universal + específico
// do(s) modal(is) realmente usados nos Processos gerados a partir dela (uma
// Proforma pode gerar N Processos, cada um com seu próprio modal de
// transporte — pode divergir do modal só cotado na Proforma) + customizados
// já salvos.
function docTiposDaProforma(processosDaProforma, docsSalvos) {
    // Tipos por processo: uma entrada por Processo (ou uma "sem processo" se a
    // Proforma ainda não gerou nenhum). Cada entrada tem `chave` única.
    const procs = processosDaProforma || [];
    const tipos = DOC_TIPOS_UNIVERSAIS.flatMap(t => {
        if (!DOC_TIPOS_POR_PROCESSO.includes(t.id)) return [{ ...t, chave: t.id }];
        if (!procs.length) return [{ ...t, chave: t.id, semProcesso: true }];
        return procs.map(pr => ({ ...t, chave: docChave(t.id, pr.id), processoId: pr.id, processoNumero: pr.numero_processo || '' }));
    });
    const modais = [...new Set((processosDaProforma || []).map(pr => pr.modal).filter(Boolean))];
    modais.forEach(modal => {
        (DOC_TIPOS_MODAL[modal] || []).forEach(t => tipos.push({ ...t, modal, chave: t.id }));
    });
    Object.values(docsSalvos || {}).forEach(reg => {
        const jaExiste = tipos.some(t => t.id === reg.tipo_documento);
        if (!jaExiste && String(reg.tipo_documento).startsWith('custom_')) {
            tipos.push({ id: reg.tipo_documento, chave: reg.tipo_documento, label: reg.tipo_label || 'Documento', custom: true });
        }
    });
    return tipos;
}

// "Feito" pros tipos fixos/por-modal é calculado a partir do campo Nº
// correspondente já preenchido em processos.documentos (JSONB).
function docFeitoAutomatico(processosDaProforma, tipoId, processoId = null) {
    return (processosDaProforma || []).filter(pr => !processoId || pr.id === processoId).some(pr => {
        const valor = pr.documentos?.[tipoId];
        return valor !== undefined && valor !== null && String(valor).trim() !== '';
    });
}
