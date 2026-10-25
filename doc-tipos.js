// ========================================
// TAXONOMIA DE TIPOS DE DOCUMENTO POR PROFORMA
// ========================================
// Compartilhada entre documentos.js (janela Documentos) e inicio.js (seção
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

// Exportação indireta: só aparecem em Processo do tipo exportacao_indireta
const DOC_TIPOS_INDIRETA = [
    { id: 'nfremessa', label: 'Nº NF de Remessa (fim específico)' },
    { id: 'memorando', label: 'Nº Memorando de Exportação' },
];

const DOC_MODAL_LABEL = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' };

// Documentos de cada embarque: guardados por Processo (proforma_documentos.processo_id).
// Só a Proforma Invoice é da Proforma toda — todo o resto (Commercial Invoice,
// Packing List, DUE, LE, Certificado de Origem, CTN, NF-e e os do modal) é de
// cada Processo. Documento personalizado vale onde foi criado (Proforma ou Processo).
const DOC_TIPOS_DA_PROFORMA = ['proforma'];
const DOC_TIPOS_POR_PROCESSO = [
    ...DOC_TIPOS_UNIVERSAIS.map(t => t.id).filter(id => !DOC_TIPOS_DA_PROFORMA.includes(id)),
    ...Object.values(DOC_TIPOS_MODAL).flat().map(t => t.id),
    ...DOC_TIPOS_INDIRETA.map(t => t.id),
];
function docEhPorProcesso(tipoId) {
    return DOC_TIPOS_POR_PROCESSO.includes(tipoId) || String(tipoId).startsWith('custom_');
}

// Chave do documento no mapa de salvos: 'tipo' ou 'tipo@<processoId>'
function docChave(tipoId, processoId) {
    return (processoId && docEhPorProcesso(tipoId)) ? `${tipoId}@${processoId}` : tipoId;
}
function docChaveRegistro(reg) {
    return docChave(reg.tipo_documento, reg.processo_id);
}

// Registro salvo de uma linha. Registro antigo, sem processo_id (de antes da
// divisão por processo): se a Proforma tem 1 Processo só, vale para ele; com
// vários, aparece no bloco "Sem processo definido" (tipo.orfao) até o usuário
// escolher o Processo.
function docRegistroDaLinha(docsSalvos, tipo, processosDaProforma) {
    const salvos = docsSalvos || {};
    if (!tipo.processoId) return salvos[tipo.id];
    return salvos[docChave(tipo.id, tipo.processoId)]
        || ((processosDaProforma || []).length === 1 && !String(tipo.id).startsWith('custom_') ? salvos[tipo.id] : undefined);
}

// Lista de documentos de uma proforma, já separada em grupos:
//   grupo 'proforma'          → Proforma Invoice + personalizados da Proforma
//   grupo <processoId>        → documentos daquele embarque (universais + os do
//                               modal DESSE processo + personalizados dele)
//   grupo 'sem-processo'      → Proforma ainda sem Processo (só mostra o que virá)
//   grupo 'orfao'             → registros antigos sem processo_id numa Proforma
//                               com 2+ Processos (falta escolher o embarque)
// Cada item tem `chave` única ('tipo' ou 'tipo@processoId').
function docTiposDaProforma(processosDaProforma, docsSalvos) {
    const procs = processosDaProforma || [];
    const salvos = Object.values(docsSalvos || {});
    const tipos = [];
    DOC_TIPOS_UNIVERSAIS.filter(t => DOC_TIPOS_DA_PROFORMA.includes(t.id))
        .forEach(t => tipos.push({ ...t, chave: t.id, grupo: 'proforma' }));
    salvos.filter(r => String(r.tipo_documento).startsWith('custom_') && !r.processo_id)
        .forEach(r => tipos.push({ id: r.tipo_documento, chave: r.tipo_documento, label: r.tipo_label || 'Documento', custom: true, grupo: 'proforma' }));

    if (!procs.length) {
        DOC_TIPOS_UNIVERSAIS.filter(t => !DOC_TIPOS_DA_PROFORMA.includes(t.id))
            .forEach(t => tipos.push({ ...t, chave: t.id, semProcesso: true, grupo: 'sem-processo' }));
        return tipos;
    }
    procs.forEach(pr => {
        const base = { processoId: pr.id, processoNumero: pr.numero_processo || '', grupo: pr.id };
        DOC_TIPOS_UNIVERSAIS.filter(t => !DOC_TIPOS_DA_PROFORMA.includes(t.id))
            .forEach(t => tipos.push({ ...t, ...base, chave: docChave(t.id, pr.id) }));
        (DOC_TIPOS_MODAL[pr.modal] || [])
            .forEach(t => tipos.push({ ...t, ...base, modal: pr.modal, chave: docChave(t.id, pr.id) }));
        if (pr.tipo === 'exportacao_indireta') DOC_TIPOS_INDIRETA
            .forEach(t => tipos.push({ ...t, ...base, chave: docChave(t.id, pr.id) }));
        salvos.filter(r => String(r.tipo_documento).startsWith('custom_') && String(r.processo_id) === String(pr.id))
            .forEach(r => tipos.push({ id: r.tipo_documento, label: r.tipo_label || 'Documento', custom: true, ...base, chave: docChave(r.tipo_documento, pr.id) }));
    });
    // antigos sem processo_id, com 2+ Processos: o usuário escolhe de qual embarque são
    if (procs.length > 1) {
        const rotulos = Object.fromEntries([...DOC_TIPOS_UNIVERSAIS, ...Object.values(DOC_TIPOS_MODAL).flat(), ...DOC_TIPOS_INDIRETA].map(t => [t.id, t.label]));
        salvos.filter(r => !r.processo_id && DOC_TIPOS_POR_PROCESSO.includes(r.tipo_documento))
            .forEach(r => tipos.push({ id: r.tipo_documento, chave: r.tipo_documento, label: rotulos[r.tipo_documento] || r.tipo_documento, orfao: true, grupo: 'orfao' }));
    }
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
