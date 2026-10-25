// ========================================
// ETAPAS DO PROCESSO — conclusão automática e marcação rápida
// ========================================
// As etapas ficam em processos.etapas (JSONB): { id, nome, data, responsavel,
// concluida } + os campos desta camada:
//   auto     — de onde veio a conclusão automática ("Nº DUE 26BR…"); null se não veio
//   manual   — o usuário marcou/desmarcou à mão: a regra automática não mexe mais
//   por / em — quem concluiu e quando (ISO)
// A etapa é reconhecida pelo nome (as listas padrão estão em formularios-processo.js);
// etapa sem regra (ou criada pelo usuário) continua só manual.
// Usado por formularios-processo.js, resumo.js (painel "Ver"), processos.js (card)
// e inicio.js (Pendências: etapas atrasadas).
//
// Prazo: cada etapa conhecida tem um prazo relativo ao embarque (ou à chegada),
// calculado pela previsão de embarque do Processo (processos.data_previsao, ou a
// da Proforma). Embarque/chegada já realizados substituem a previsão. Campos:
//   prazo         — data (AAAA-MM-DD) até quando a etapa deve estar concluída
//   prazo_manual  — o usuário digitou o prazo: o cálculo não mexe mais
// Exportação indireta: o Memorando de Exportação vence 180 dias depois da NF de
// remessa com fim específico (processos.nf_remessa_data), com aviso a 30 dias.

// ── Listas padrão: tipo de exportação + modal ──
const ETAPAS_TIPO = {
    exportacao_direta: {
        antes:  ['Pedido Confirmado', 'Licença de Exportação (LE)', 'Registro da DUE'],
        depois: ['Chegada no Destino', 'Desembaraço no Destino', 'Entrega ao Importador'],
    },
    exportacao_indireta: {
        antes:  ['Pedido Confirmado', 'NF de Remessa com Fim Específico', 'Entrega à Trading / Comercial Exportadora',
                 'Licença de Exportação (LE)', 'Registro da DUE'],
        depois: ['Memorando de Exportação Recebido', 'Chegada no Destino', 'Desembaraço no Destino'],
    },
};
const ETAPAS_MODAL = {
    maritimo:  ['Booking / Reserva de Praça', 'Retirada do Container / Ova', 'Entrega no Porto (Deadline)', 'Embarque Confirmado', 'BL Emitido'],
    aereo:     ['Reserva com a Companhia Aérea', 'Entrega no Terminal de Carga', 'Embarque Confirmado', 'AWB Emitido'],
    terrestre: ['Contratação do Transporte', 'Coleta da Carga', 'CRT Emitido', 'MIC/DTA Emitido', 'Embarque Confirmado', 'Cruzamento de Fronteira'],
    '':        ['Booking / Reserva', 'Embarque Confirmado', 'BL / AWB / CTR Emitido'],   // modal ainda não escolhido
};

function etapasPadrao(tipo, modal) {
    const t = ETAPAS_TIPO[tipo];
    if (!t) return [];
    return [...t.antes, ...(ETAPAS_MODAL[modal] || ETAPAS_MODAL['']), ...t.depois];
}

// Lista "intocada": só nomes padrão, nada concluído à mão (automática volta sozinha), sem data/responsável/prazo digitado —
// pode ser trocada sem perguntar quando o tipo ou o modal mudam.
function etapasIntocadas(etapas) {
    const nomes = new Set([...Object.values(ETAPAS_TIPO).flatMap(t => [...t.antes, ...t.depois]), ...Object.values(ETAPAS_MODAL).flat(),
        'Nota Fiscal de Exportação Emitida']);   // nome antigo da lista indireta
    return (etapas || []).every(e => nomes.has(e.nome) && !(e.concluida && !e.auto) && !e.manual && !e.responsavel && !e.prazo_manual && !(e.data && !e.data_auto));
}

const _etapaNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const _etapaDataBR = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR') : '';

// ctx: { documentos, data_embarque, data_chegada, proformaAssinada, dueAnexada, memorandoAnexado }
const ETAPA_REGRAS = [
    { nome: /pedido confirmado/,           fonte: c => c.proformaAssinada ? 'Proforma Invoice assinada' : null },
    { nome: /licenca de exportacao/,       fonte: c => c.doc('le') ? `Nº LE ${c.doc('le')}` : null },
    { nome: /registro da due/,             fonte: c => c.doc('due') ? `Nº DUE ${c.doc('due')}` : (c.dueAnexada ? 'DUE anexada' : null) },
    { nome: /nota fiscal de exportacao/,   fonte: c => c.doc('nfe') ? `Nº NF-e ${c.doc('nfe')}` : null },
    { nome: /embarque confirmado/,         fonte: c => c.data_embarque ? `Embarque em ${_etapaDataBR(c.data_embarque)}` : null, data: c => c.data_embarque },
    { nome: /\b(bl|awb|ctr|crt)\b/,        fonte: c => {
        const [k, rot] = [['bl', 'BL'], ['awb', 'AWB'], ['crt', 'CRT']].find(([k]) => c.doc(k)) || [];
        return k ? `Nº ${rot} ${c.doc(k)}` : null;
    } },
    { nome: /nf de remessa/,               fonte: c => c.doc('nfremessa') ? `Nº NF de remessa ${c.doc('nfremessa')}` : null, data: c => c.nf_remessa_data },
    { nome: /memorando de exportacao/,     fonte: c => c.doc('memorando') ? `Nº Memorando ${c.doc('memorando')}` : (c.memorandoAnexado ? 'Memorando anexado' : null) },
    { nome: /mic\/?dta/,                   fonte: c => c.doc('micdta') ? `Nº MIC/DTA ${c.doc('micdta')}` : null },
    { nome: /chegada no destino/,          fonte: c => c.data_chegada ? `Chegada em ${_etapaDataBR(c.data_chegada)}` : null, data: c => c.data_chegada },
];

// ── Prazos (dias em relação ao embarque ou à chegada) ──
const ETAPA_TRANSITO = { maritimo: 30, aereo: 3, terrestre: 7 };   // dias de viagem até o destino
const ETAPA_PRAZOS = [
    { nome: /pedido confirmado/,              dias: -30 },
    { nome: /licenca de exportacao/,          dias: -20 },
    { nome: /booking/,                        dias: -15 },
    { nome: /nota fiscal de exportacao|nf de remessa/, dias: -10 },
    { nome: /contratacao do transporte/,      dias: -10 },
    { nome: /reserva com a companhia/,        dias: -7 },
    { nome: /entrega a trading/,              dias: -7 },
    { nome: /retirada do container/,          dias: -6 },
    { nome: /registro da due/,                dias: -3 },
    { nome: /entrega no porto|deadline/,      dias: -3 },
    { nome: /coleta da carga/,                dias: -2 },
    { nome: /entrega no terminal/,            dias: -1 },
    { nome: /\bcrt emitido|mic\/?dta/,        dias: -1 },
    { nome: /embarque confirmado/,            dias: 0 },
    { nome: /\b(bl|awb|ctr)\b/,               dias: 2 },
    { nome: /cruzamento de fronteira/,        dias: -1, ref: 'chegada' },
    { nome: /chegada no destino/,             dias: 0,  ref: 'chegada' },
    { nome: /desembaraco no destino/,         dias: 3,  ref: 'chegada' },
    { nome: /entrega ao importador/,          dias: 5,  ref: 'chegada' },
    { nome: /memorando de exportacao/,        dias: 180, ref: 'nfremessa', aviso: 30 },
];
const _etapaPrazoRegra = nome => { const n = _etapaNorm(nome); return ETAPA_PRAZOS.find(r => r.nome.test(n)) || null; };
const _etapaHoje = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const _etapaSomarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

// { previsao, data_embarque, data_chegada, nf_remessa_data, modal }
function etapasCalcularPrazos(etapas, { previsao = null, data_embarque = null, data_chegada = null, nf_remessa_data = null, modal = '' } = {}) {
    const embarque = data_embarque || previsao || null;
    const chegada  = data_chegada || (embarque ? _etapaSomarDias(embarque, ETAPA_TRANSITO[modal] ?? 20) : null);
    return (Array.isArray(etapas) ? etapas : []).map(e => {
        if (!e || e.prazo_manual) return e;
        const regra = _etapaPrazoRegra(e.nome);
        const base = regra ? ({ chegada, nfremessa: nf_remessa_data }[regra.ref] ?? (regra.ref ? null : embarque)) : null;
        const prazo = base ? _etapaSomarDias(base, regra.dias) : '';
        return (e.prazo || '') === prazo ? e : { ...e, prazo };
    });
}

// null = sem prazo ou concluída; senão { atrasada, vence, dias, diff } (diff < 0 = atrasada;
// vence = dentro do aviso: 7 dias, ou o da etapa — Memorando, 30)
function etapaSituacao(e, hoje = _etapaHoje()) {
    if (!e || e.concluida || !e.prazo) return null;
    const diff = Math.round((new Date(e.prazo + 'T12:00:00') - new Date(hoje + 'T12:00:00')) / 86400000);
    const aviso = _etapaPrazoRegra(e.nome)?.aviso ?? 7;
    return { atrasada: diff < 0, vence: diff >= 0 && diff <= aviso, dias: Math.abs(diff), diff };
}

function etapaSituacaoTexto(e) {
    const s = etapaSituacao(e);
    if (!s) return '';
    if (s.atrasada) return `atrasada há ${s.dias} dia${s.dias === 1 ? '' : 's'}`;
    if (s.diff === 0) return 'vence hoje';
    if (s.vence) return `vence em ${s.diff} dia${s.diff === 1 ? '' : 's'}`;
    return `prazo ${_etapaDataBR(e.prazo)}`;
}

// Automáticas + prazos de uma vez (cards, painel, Pendências)
function etapasPreparar(processo, { proformaAssinada = false, dueAnexada = false, memorandoAnexado = false, previsaoProforma = null } = {}) {
    const p = processo || {};
    const auto = etapasAplicarAutomaticas(p.etapas, etapasContexto({
        documentos: p.documentos, data_embarque: p.data_embarque, data_chegada: p.data_chegada, nf_remessa_data: p.nf_remessa_data,
        proformaAssinada, dueAnexada, memorandoAnexado,
    })).etapas;
    return etapasCalcularPrazos(auto, { previsao: p.data_previsao || previsaoProforma, data_embarque: p.data_embarque, data_chegada: p.data_chegada,
        nf_remessa_data: p.nf_remessa_data, modal: p.modal });
}

function etapaRegra(nome) {
    const n = _etapaNorm(nome);
    return ETAPA_REGRAS.find(r => r.nome.test(n)) || null;
}

function etapasContexto({ documentos = {}, data_embarque = null, data_chegada = null, nf_remessa_data = null,
                          proformaAssinada = false, dueAnexada = false, memorandoAnexado = false } = {}) {
    const docs = documentos || {};
    return {
        data_embarque, data_chegada, nf_remessa_data, proformaAssinada, dueAnexada, memorandoAnexado,
        doc: k => { const v = docs[k]; return (v === null || v === undefined || String(v).trim() === '') ? '' : String(v).trim(); },
    };
}

// Aplica as regras automáticas. Devolve { etapas, mudou } — nunca altera o array recebido.
function etapasAplicarAutomaticas(etapas, ctx) {
    let mudou = false;
    const hoje = new Date().toISOString().slice(0, 10);
    const lista = (Array.isArray(etapas) ? etapas : []).map(e => {
        if (!e || e.manual) return e;
        const regra = etapaRegra(e.nome);
        if (!regra) return e;
        const fonte = regra.fonte(ctx);
        if (fonte) {
            if (e.concluida && e.auto === fonte) return e;
            if (e.concluida && !e.auto) return e;          // já concluída antes (marcação antiga, sem origem)
            mudou = true;
            const data = e.data || regra.data?.(ctx) || hoje;
            return { ...e, concluida: true, auto: fonte, data, data_auto: !e.data, por: 'Sistema', em: e.em || new Date().toISOString() };
        }
        // a informação sumiu (ex.: Nº apagado): desfaz o que a regra tinha marcado
        if (e.auto) {
            mudou = true;
            return { ...e, concluida: false, auto: null, data: e.data_auto ? '' : e.data, data_auto: false, por: null, em: null };
        }
        return e;
    });
    return { etapas: lista, mudou };
}

// Marcação pelo usuário (formulário, painel): grava quem/quando e trava a regra automática
function etapaMarcar(e, concluida) {
    const u = (typeof obterUsuarioLogado === 'function' && obterUsuarioLogado()) || {};
    const hoje = new Date().toISOString().slice(0, 10);
    return {
        ...e, concluida, manual: true, auto: null,
        data: concluida ? (e.data || hoje) : (e.data_auto ? '' : e.data), data_auto: false,
        por: concluida ? (u.nome || u.email || null) : null,
        em: concluida ? new Date().toISOString() : null,
    };
}

function etapasResumo(etapas) {
    const lista = (Array.isArray(etapas) ? etapas : []).filter(e => e && String(e.nome || '').trim());
    const feitas = lista.filter(e => e.concluida).length;
    const atrasadas = lista.filter(e => etapaSituacao(e)?.atrasada);
    return { total: lista.length, feitas, proxima: lista.find(e => !e.concluida) || null, atrasadas,
             pct: lista.length ? Math.round(feitas / lista.length * 100) : 0 };
}

// Proforma Invoice assinada / DUE e Memorando anexados de cada Processo, para os cards e o painel.
// Devolve { [processoId]: { proformaAssinada, dueAnexada, memorandoAnexado } }.
async function etapasInfoDocumentos(processos) {
    const procs = (processos || []).filter(p => p?.proforma_id);
    const proformaIds = [...new Set(procs.map(p => p.proforma_id))];
    const info = {};
    if (!proformaIds.length) return info;
    const { data } = await supabaseClient.from('proforma_documentos')
        .select('proforma_id, tipo_documento, processo_id, assinado, arquivo_path')
        .in('proforma_id', proformaIds).in('tipo_documento', ['proforma', 'due', 'memorando']);
    const porProforma = {};
    procs.forEach(p => { (porProforma[p.proforma_id] ||= []).push(p.id); });
    procs.forEach(p => {
        const regs = (data || []).filter(r => r.proforma_id === p.proforma_id);
        const unico = porProforma[p.proforma_id].length === 1;
        const doProcesso = tipo => regs.some(r => r.tipo_documento === tipo && (r.arquivo_path || r.assinado)
            && (r.processo_id ? String(r.processo_id) === String(p.id) : unico));
        info[p.id] = {
            proformaAssinada: regs.some(r => r.tipo_documento === 'proforma' && r.assinado),
            dueAnexada: doProcesso('due'),
            memorandoAnexado: doProcesso('memorando'),
        };
    });
    return info;
}
