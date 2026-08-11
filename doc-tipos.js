// ========================================
// TAXONOMIA DE TIPOS DE DOCUMENTO POR PEDIDO
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

// Monta a lista de tipos aplicáveis a um pedido: universal + específico do(s)
// modal(is) de transporte da(s) proforma(s) + customizados já salvos.
function docTiposDoPedido(proformasDoPedido, docsSalvos) {
    const tipos = [...DOC_TIPOS_UNIVERSAIS];
    const modais = [...new Set((proformasDoPedido || []).map(pf => pf.modal).filter(Boolean))];
    modais.forEach(modal => {
        (DOC_TIPOS_MODAL[modal] || []).forEach(t => tipos.push({ ...t, modal }));
    });
    Object.values(docsSalvos || {}).forEach(reg => {
        const jaExiste = tipos.some(t => t.id === reg.tipo_documento);
        if (!jaExiste && String(reg.tipo_documento).startsWith('custom_')) {
            tipos.push({ id: reg.tipo_documento, label: reg.tipo_label || 'Documento', custom: true });
        }
    });
    return tipos;
}

// "Feito" pros tipos fixos/por-modal é calculado a partir do campo Nº
// correspondente já preenchido em processos.documentos (JSONB).
function docFeitoAutomatico(processosDoPedido, tipoId) {
    return (processosDoPedido || []).some(pr => {
        const valor = pr.documentos?.[tipoId];
        return valor !== undefined && valor !== null && String(valor).trim() !== '';
    });
}
