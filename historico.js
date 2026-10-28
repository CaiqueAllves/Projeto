// ========================================
// HISTÓRICO DE ALTERAÇÕES (Proformas, Processos e Documentos)
// ========================================
// Lê historico_alteracoes (gravado por triggers no banco —
// database-historico-alteracoes.sql) e mostra uma linha do tempo:
// quem, quando, o que fez e cada campo com o valor de antes → depois.
// Uso: abrirHistorico('proforma', id, 'PRO2026000012')
//      abrirHistorico('processo', id, 'PROC2026000007')

const HIST_CAMPOS = {
    status: 'Status', tipo: 'Tipo', proposito: 'Propósito', modal: 'Modal', incoterm: 'Incoterm',
    emissor_tipo: 'Emissor', parceiro_id: 'Exportador', parceiro_razao_social: 'Exportador (nome)',
    remetente_parceiro_id: 'Exportador', destinatario_id: 'Importador', empresa_parceira_id: 'Importador',
    destinatario_razao_social: 'Importador (nome)', destinatario_doc: 'Documento do Importador',
    documento: 'Nº de Identificação', documento_tipo: 'Identificação da Empresa',
    itens: 'Produtos', valor_total: 'Valor total', moeda_principal: 'Moeda', moeda: 'Moeda',
    forma_pagamento: 'Forma de pagamento', prazo_pagamento: 'Prazo de pagamento',
    validade_dias: 'Validade', data_validade: 'Data de validade', data_emissao: 'Data de emissão',
    origem_pais: 'País de origem', destino_pais: 'País de destino', pais_origem: 'País de origem', pais_destino: 'País de destino',
    porto_origem: 'Porto de origem', porto_destino: 'Porto de destino',
    aeroporto_origem: 'Aeroporto de origem', aeroporto_destino: 'Aeroporto de destino',
    fronteira_saida: 'Fronteira de saída', fronteira_entrada: 'Fronteira de entrada',
    observacoes: 'Observações', condicoes_obs: 'Obs. das condições', obs_status: 'Obs. de status', obs_prazos: 'Obs. de prazos',
    idioma: 'Idioma', codigo: 'Código', numero_processo: 'Nº do processo', proforma_id: 'Proforma',
    documentos: 'Numeração de documentos', transporte: 'Transporte', etapas: 'Etapas',
    origem_endereco: 'Endereço de origem', destino_endereco: 'Endereço de destino', origem_coleta: 'Endereço de coleta',
    destino_responsavel: 'Responsável no destino', rota_intermediarios: 'Intermediários de rota',
    data_abertura: 'Data de abertura', data_previsao: 'Previsão de embarque', data_embarque: 'Data de embarque',
    trading_id: 'Trading', importador_final_id: 'Importador final', nf_remessa_data: 'Data da NF de remessa',
    data_chegada: 'Data de chegada', data_cancelamento: 'Data de cancelamento',
    container_tipo: 'Container', container_numero: 'Nº do container', navio: 'Navio', aeronave: 'Aeronave',
    sem_assinatura: 'Iniciado sem Proforma assinada',
    assinado: 'Assinado', assinado_por: 'Assinado por', assinado_em: 'Assinado em',
    arquivo_nome: 'Arquivo', enviado_por: 'Enviado por', documento_criado: 'Documento',
};
// Campos técnicos que não aparecem
const HIST_OCULTOS = new Set(['id', 'empresa_id', 'empresa_proprietaria_id', 'criado_por', 'excluido_em', 'excluido_por',
    'arquivo_path', 'enviado_em', 'tipo_label', 'processo_id', 'pedido_id', 'processo_gerado_id', 'origem_pais_codigo',
    'destino_pais_codigo', 'sem_assinatura_confirmado_por', 'sem_assinatura_confirmado_em', 'idioma_outro', 'documento']);
const HIST_PARCEIROS = new Set(['parceiro_id', 'remetente_parceiro_id', 'destinatario_id', 'empresa_parceira_id', 'trading_id', 'importador_final_id']);
const HIST_STATUS = { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', encerrado: 'Encerrado', excluido: 'Excluído',
    aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_documentos: 'Aguard. documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
const HIST_VALORES = {
    modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
    tipo: { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' },
    emissor_tipo: { usuario: 'Usuário (própria empresa)', terceiro: 'Terceiro' },
};
const HIST_DOCS = { proforma: 'Proforma Invoice', commercial: 'Commercial Invoice', packing: 'Packing List', due: 'DUE',
    le: 'Licença de Exportação', certorigem: 'Certificado de Origem', ctn: 'Conhecimento de Transporte', nfe: 'Nota Fiscal',
    nfremessa: 'NF de Remessa (fim específico)', memorando: 'Memorando de Exportação' };
const HIST_ACOES = {
    criado:     ['fa-plus',          '#16a34a', 'Criou'],
    alterado:   ['fa-pen',           '#4776ec', 'Alterou'],
    excluido:   ['fa-trash',         '#dc2626', 'Excluiu (foi para Excluídos)'],
    restaurado: ['fa-rotate-left',   '#0891b2', 'Restaurou'],
    removido:   ['fa-ban',           '#64748b', 'Removido definitivamente'],
    documento:  ['fa-file-signature','#9333ea', 'Documento'],
};

function _histEsc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _histValor(campo, v, nomes) {
    if (v === null || v === undefined || v === '') return '<em>vazio</em>';
    if (v === '(alterado)') return '<em>conteúdo atualizado</em>';
    if (HIST_PARCEIROS.has(campo)) return _histEsc(nomes[v] || `#${v}`);
    if (campo === 'status') return _histEsc(HIST_STATUS[v] || v);
    if (HIST_VALORES[campo]) return _histEsc(HIST_VALORES[campo][v] || v);
    if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
    if (campo === 'itens' && Array.isArray(v)) return `${v.length} produto${v.length !== 1 ? 's' : ''}`;
    if (Array.isArray(v)) return `${v.length} item(ns)`;
    if (typeof v === 'object') return '<em>conteúdo atualizado</em>';
    if (/_em$|^data_/.test(campo) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) {
        const d = new Date(String(v).length === 10 ? v + 'T00:00:00' : v);
        return isNaN(d) ? _histEsc(v) : d.toLocaleString('pt-BR', String(v).length === 10 ? { day: '2-digit', month: '2-digit', year: 'numeric' } : undefined);
    }
    if (typeof v === 'number' && /valor/.test(campo)) return v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const s = String(v);
    return _histEsc(s.length > 120 ? s.slice(0, 120) + '…' : s);
}

// ── Documentos: em vez de "campo: antes → depois", uma frase por fato ──
// (assinado por X, assinatura desfeita, arquivo anexado/substituído/removido,
// e se o arquivo foi gerado pelo sistema ou enviado por upload).
const _HIST_DOC_TIPOS = {
    assinado:    ['fa-signature',          '#16a34a', 'Assinado'],
    desfeito:    ['fa-rotate-left',        '#ea580c', 'Assinatura desfeita'],
    anexado:     ['fa-paperclip',          '#4776ec', 'Arquivo anexado'],
    substituido: ['fa-arrow-right-arrow-left', '#4776ec', 'Arquivo substituído'],
    arqRemovido: ['fa-trash',              '#64748b', 'Arquivo removido'],
    criado:      ['fa-file-circle-plus',   '#9333ea', 'Documento registrado'],
    removido:    ['fa-ban',                '#64748b', 'Documento removido'],
    alterado:    ['fa-pen',                '#9333ea', 'Documento atualizado'],
};

function _histFonteArquivo(path) {
    if (!path) return '';
    return /^[^/]+\/[a-z]+_sistema_/.test(path)
        ? '<span class="hist-fonte hist-fonte--sistema"><i class="fa-solid fa-gears"></i> gerado pelo sistema</span>'
        : '<span class="hist-fonte hist-fonte--upload"><i class="fa-solid fa-upload"></i> upload</span>';
}

function _histDataHora(v) {
    if (!v) return '';
    const d = new Date(v);
    return isNaN(d) ? '' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Devolve { tipo, frases[] } de um evento de proforma_documentos
function _histDocEvento(h) {
    const a = h.alteracoes || {};
    const de = c => a[c]?.de, para = c => a[c]?.para, mudou = c => c in a;
    const arq = n => `<strong>${_histEsc(n || 'arquivo')}</strong>`;
    const frases = [];
    let tipo = 'alterado';

    if (h.acao === 'removido') return { tipo: 'removido', frases: [] };
    if (a.documento?.para === 'criado') { tipo = 'criado'; }

    const arquivoMudou = mudou('arquivo_path') || mudou('arquivo_nome');
    const pathNovo = mudou('arquivo_path') ? para('arquivo_path') : null;
    const nomeNovo = mudou('arquivo_nome') ? para('arquivo_nome') : null;
    const nomeAnt  = mudou('arquivo_nome') ? de('arquivo_nome') : null;

    if (mudou('assinado') && para('assinado') === true) {
        tipo = 'assinado';
        const em = _histDataHora(para('assinado_em'));
        frases.push(`Assinado por <strong>${_histEsc(para('assinado_por') || '—')}</strong>${em ? ` em ${em}` : ''}`);
        if (arquivoMudou && (pathNovo || nomeNovo)) frases.push(`Arquivo assinado: ${arq(nomeNovo)} ${_histFonteArquivo(pathNovo)}`);
        else frases.push('Assinou o arquivo que já estava anexado');
        return { tipo, frases };
    }
    if (mudou('assinado') && para('assinado') === false) {
        tipo = 'desfeito';
        const em = _histDataHora(de('assinado_em'));
        frases.push(`Assinatura de <strong>${_histEsc(de('assinado_por') || '—')}</strong>${em ? ` (feita em ${em})` : ''} foi desfeita`);
        if (arquivoMudou && !pathNovo && !nomeNovo && nomeAnt) frases.push(`Arquivo ${arq(nomeAnt)} removido`);
        else frases.push('O arquivo continua anexado, agora sem assinatura');
        return { tipo, frases };
    }
    if (arquivoMudou) {
        if (!nomeAnt && !de('arquivo_path') && (nomeNovo || pathNovo)) {
            tipo = 'anexado';
            frases.push(`Arquivo anexado: ${arq(nomeNovo)} ${_histFonteArquivo(pathNovo)}`);
        } else if (nomeNovo || pathNovo) {
            tipo = 'substituido';
            frases.push(`${arq(nomeAnt)} <i class="fa-solid fa-arrow-right-long"></i> ${arq(nomeNovo)} ${_histFonteArquivo(pathNovo)}`);
        } else {
            tipo = 'arqRemovido';
            frases.push(`Arquivo ${arq(nomeAnt)} removido`);
        }
    }
    // registros antigos (antes de database-historico-documentos-detalhes.sql) não guardavam o arquivo
    if (!frases.length && tipo === 'criado') frases.push('Documento criado nesta Proforma');
    return { tipo, frases };
}

// Rótulo de um documento ("Nº Commercial Invoice"), da taxonomia de doc-tipos.js quando carregado
function _histRotuloDoc(id) {
    if (typeof DOC_TIPOS_UNIVERSAIS !== 'undefined') {
        const t = [...DOC_TIPOS_UNIVERSAIS, ...Object.values(DOC_TIPOS_MODAL || {}).flat()].find(x => x.id === id);
        if (t) return t.label;
    }
    return HIST_DOCS[id] ? 'Nº ' + HIST_DOCS[id] : id;
}

// Objeto JSON (ex.: numeração de documentos do Processo): uma linha por chave alterada
function _histDiffObjeto(campo, de, para) {
    const a = (de && typeof de === 'object') ? de : {}, b = (para && typeof para === 'object') ? para : {};
    const vazio = v => v === null || v === undefined || String(v).trim() === '';
    return [...new Set([...Object.keys(a), ...Object.keys(b)])]
        .filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null) && !(vazio(a[k]) && vazio(b[k])))
        .map(k => {
            const rot = campo === 'documentos' ? _histRotuloDoc(k) : `${HIST_CAMPOS[campo] || campo} › ${k.replace(/_/g, ' ')}`;
            const v = x => vazio(x) ? '<em>vazio</em>' : (typeof x === 'object' ? '<em>conteúdo atualizado</em>' : _histEsc(x));
            return `<li><strong>${_histEsc(rot)}:</strong> ${v(a[k])} <i class="fa-solid fa-arrow-right-long"></i> ${v(b[k])}</li>`;
        });
}

// Etapas do Processo (lista JSON): uma frase por fato — concluída (por quem ou
// automaticamente), reaberta, adicionada, removida, renomeada, prazo/data/
// responsável alterados. Campos técnicos (auto, em, data_auto...) não aparecem;
// prazos recalculados pela previsão viram uma linha só.
function _histDiffEtapas(de, para) {
    // registro antigo: lista grande gravada como "(alterado)" (antes de database-historico-etapas.sql)
    const semDetalhe = v => v !== null && v !== undefined && !Array.isArray(v);
    if (semDetalhe(de) || semDetalhe(para)) return ['<li><i class="fa-solid fa-list-check"></i> Etapas atualizadas <em>(detalhe não registrado)</em></li>'];
    const a = Array.isArray(de) ? de.filter(Boolean) : [], b = Array.isArray(para) ? para.filter(Boolean) : [];
    const chave = e => e.id || e.nome;
    const mapA = new Map(a.map(e => [chave(e), e])), mapB = new Map(b.map(e => [chave(e), e]));
    const nome = e => `<strong>${_histEsc(e.nome || 'Etapa sem nome')}</strong>`;
    const dt = v => v ? _histEsc(new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR')) : '<em>vazio</em>';
    const comuns = b.filter(e => mapA.has(chave(e)));
    // lista inteira trocada (ex.: mudou o modal ou o tipo)
    if (a.length && b.length && !comuns.length) {
        return [`<li><i class="fa-solid fa-list-check"></i> Lista de etapas trocada pela padrão (${a.length} → ${b.length} etapas)</li>`];
    }
    const l = [];
    let recalculados = 0;
    b.forEach(nova => {
        const velha = mapA.get(chave(nova));
        if (!velha) { l.push(`<li><i class="fa-solid fa-plus"></i> Etapa adicionada: ${nome(nova)}</li>`); return; }
        if ((velha.nome || '') !== (nova.nome || '')) l.push(`<li>Etapa renomeada: ${_histEsc(velha.nome || '—')} <i class="fa-solid fa-arrow-right-long"></i> ${nome(nova)}</li>`);
        if (!velha.concluida && nova.concluida) {
            const como = nova.auto ? ` automaticamente <em>(${_histEsc(nova.auto)})</em>` : (nova.por ? ` por <strong>${_histEsc(nova.por)}</strong>` : '');
            l.push(`<li><i class="fa-solid fa-circle-check" style="color:#16a34a"></i> ${nome(nova)} concluída${como}${nova.data ? ` em ${dt(nova.data)}` : ''}</li>`);
        } else if (velha.concluida && !nova.concluida) {
            l.push(`<li><i class="fa-solid fa-rotate-left" style="color:#ea580c"></i> ${nome(nova)} reaberta${velha.auto && !nova.manual ? ' <em>(a informação que a concluía foi removida)</em>' : ''}</li>`);
        } else if ((velha.data || '') !== (nova.data || '') && nova.concluida && !nova.data_auto) {
            l.push(`<li>Data de conclusão de ${nome(nova)}: ${dt(velha.data)} <i class="fa-solid fa-arrow-right-long"></i> ${dt(nova.data)}</li>`);
        }
        if ((velha.prazo || '') !== (nova.prazo || '')) {
            if (nova.prazo_manual) l.push(`<li>Prazo de ${nome(nova)}: ${dt(velha.prazo)} <i class="fa-solid fa-arrow-right-long"></i> ${dt(nova.prazo)}</li>`);
            else if (velha.prazo_manual) l.push(`<li>Prazo de ${nome(nova)} voltou ao cálculo automático (${dt(nova.prazo)})</li>`);
            else recalculados++;
        }
        if ((velha.responsavel || '') !== (nova.responsavel || '')) {
            l.push(`<li>Responsável de ${nome(nova)}: ${velha.responsavel ? _histEsc(velha.responsavel) : '<em>vazio</em>'} <i class="fa-solid fa-arrow-right-long"></i> ${nova.responsavel ? _histEsc(nova.responsavel) : '<em>vazio</em>'}</li>`);
        }
    });
    a.filter(e => !mapB.has(chave(e))).forEach(e => l.push(`<li><i class="fa-solid fa-minus"></i> Etapa removida: ${nome(e)}</li>`));
    if (recalculados) l.push(`<li><i class="fa-regular fa-calendar"></i> Prazos recalculados pela previsão de embarque (${recalculados} etapa${recalculados > 1 ? 's' : ''})</li>`);
    return l;
}

// Aviso "iniciado sem a Proforma assinada" (aceite registrado no Processo)
function _histSemAssinatura(pr) {
    if (!pr?.sem_assinatura) return '';
    const em = _histDataHora(pr.sem_assinatura_confirmado_em);
    return `<li class="hist-alerta"><i class="fa-solid fa-triangle-exclamation"></i> Iniciado <strong>sem a Proforma assinada</strong>`
        + `${pr.sem_assinatura_confirmado_por ? ` — aceite de <strong>${_histEsc(pr.sem_assinatura_confirmado_por)}</strong>` : ''}${em ? ` em ${em}` : ''}</li>`;
}

function _histModal() {
    let ov = document.getElementById('histOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'histOverlay';
    ov.className = 'hist-overlay';
    ov.innerHTML = `
        <div class="hist-modal" role="dialog" aria-modal="true">
            <div class="hist-cab">
                <div><i class="fa-solid fa-clock-rotate-left"></i> <span id="histTitulo">Histórico</span></div>
                <button type="button" class="hist-fechar" aria-label="Fechar"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="hist-corpo" id="histCorpo"></div>
        </div>`;
    document.body.appendChild(ov);
    const fechar = () => ov.classList.remove('aberto');
    ov.addEventListener('click', e => { if (e.target === ov) fechar(); });
    ov.querySelector('.hist-fechar').addEventListener('click', fechar);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') fechar(); });
    return ov;
}

async function abrirHistorico(tipo, registroId, codigo) {
    const ov = _histModal();
    document.getElementById('histTitulo').textContent = `Histórico — ${tipo === 'proforma' ? 'Proforma' : 'Processo'} ${codigo || ''}`;
    const corpo = document.getElementById('histCorpo');
    corpo.innerHTML = '<div class="hist-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';
    ov.classList.add('aberto');

    const tabelas = tipo === 'proforma' ? ['proformas', 'proforma_documentos'] : ['processos'];
    const { data, error } = await supabaseClient.from('historico_alteracoes')
        .select('*').eq('registro_id', registroId).in('tabela', tabelas)
        .order('criado_em', { ascending: false }).limit(300);
    if (error) {
        corpo.innerHTML = `<div class="hist-vazio">${/historico_alteracoes/.test(error.message)
            ? 'O histórico ainda não foi ativado no banco (database-historico-alteracoes.sql).'
            : 'Não foi possível carregar o histórico: ' + _histEsc(error.message)}</div>`;
        return;
    }
    // Origem do Processo (Proforma) / Processos gerados a partir da Proforma —
    // não mudam depois de criados, então vêm do próprio registro.
    let procAtual = null, proformaOrigem = null;
    const eventos = [...(data || [])];
    if (tipo === 'processo') {
        procAtual = (await supabaseClient.from('processos').select('*').eq('id', registroId).maybeSingle()).data;
        if (procAtual?.proforma_id) {
            proformaOrigem = (await supabaseClient.from('proformas').select('id, codigo').eq('id', procAtual.proforma_id).maybeSingle()).data;
        }
    } else {
        const { data: procs } = await supabaseClient.from('processos').select('*').eq('proforma_id', registroId);
        const nomesUsu = procs?.length && window.supabaseAPI?.buscarNomesUsuarios
            ? await window.supabaseAPI.buscarNomesUsuarios(procs.map(p => p.criado_por)) : {};
        (procs || []).forEach(pr => eventos.push({
            acao: 'processo_criado', tabela: 'processos', criado_em: pr.criado_em || pr.created_at,
            usuario_nome: nomesUsu[pr.criado_por] || null, _proc: pr,
        }));
        eventos.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
    }
    if (!eventos.length) { corpo.innerHTML = '<div class="hist-vazio">Nenhuma alteração registrada ainda.</div>'; return; }

    // nomes das empresas (Exportador/Importador) citadas nas alterações
    const ids = new Set();
    data.forEach(h => Object.entries(h.alteracoes || {}).forEach(([c, d]) => {
        if (HIST_PARCEIROS.has(c)) { if (d?.de) ids.add(d.de); if (d?.para) ids.add(d.para); }
    }));
    const nomes = {};
    // números dos Processos dos documentos por embarque (CI / PL / DUE)
    const procIds = [...new Set(data.map(h => h.alteracoes?.processo_id?.para).filter(Boolean))];
    const procNum = {};
    if (procIds.length) {
        const { data: procs } = await supabaseClient.from('processos').select('id, numero_processo').in('id', procIds);
        (procs || []).forEach(p => { procNum[p.id] = p.numero_processo; });
    }
    if (ids.size) {
        const { data: parcs } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').in('id', [...ids]);
        (parcs || []).forEach(p => { nomes[p.id] = p.nome_fantasia || p.razao_social; });
    }

    corpo.innerHTML = eventos.map(h => {
        const quando = new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        if (h.acao === 'processo_criado') {
            const pr = h._proc;
            return `
            <div class="hist-item">
                <div class="hist-ponto" style="background:${pr.sem_assinatura ? '#ea580c' : '#0891b2'}"><i class="fa-solid fa-ship"></i></div>
                <div class="hist-conteudo">
                    <div class="hist-linha1"><strong>Processo criado <span class="hist-tag">${_histEsc(pr.numero_processo || '—')}</span></strong><span>${quando}</span></div>
                    <ul class="hist-campos hist-frases">
                        <li>Processo <strong>${_histEsc(pr.numero_processo || '—')}</strong> gerado a partir desta Proforma${pr.status === 'excluido' ? ' <em>(hoje nos Excluídos)</em>' : ''}</li>
                        ${_histSemAssinatura(pr)}
                    </ul>
                    <div class="hist-quem"><i class="fa-solid fa-user"></i> ${_histEsc(h.usuario_nome || '—')}</div>
                </div>
            </div>`;
        }
        if (h.tabela === 'proforma_documentos') {
            const ev = _histDocEvento(h);
            const [icone, cor, rotuloEv] = _HIST_DOC_TIPOS[ev.tipo];
            const nomeDoc = HIST_DOCS[h.codigo] || (String(h.codigo || '').startsWith('custom_') ? 'Documento personalizado' : (h.codigo || 'Documento'));
            const proc = h.alteracoes?.processo_id?.para;
            return `
            <div class="hist-item">
                <div class="hist-ponto" style="background:${cor}"><i class="fa-solid ${icone}"></i></div>
                <div class="hist-conteudo">
                    <div class="hist-linha1"><strong>${_histEsc(nomeDoc)}${proc ? ` <span class="hist-tag">${_histEsc(procNum[proc] || 'Processo')}</span>` : ''}</strong><span>${quando}</span></div>
                    <div class="hist-evento" style="color:${cor}">${rotuloEv}</div>
                    ${ev.frases.length ? `<ul class="hist-campos hist-frases">${ev.frases.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
                    <div class="hist-quem"><i class="fa-solid fa-user"></i> Registrado por ${_histEsc(h.usuario_nome || '—')}</div>
                </div>
            </div>`;
        }
        const [icone, cor, rotulo] = HIST_ACOES[h.acao] || ['fa-circle', '#64748b', h.acao];
        let titulo = h.tabela === 'proforma_documentos'
            ? `${rotulo}: ${_histEsc(HIST_DOCS[h.codigo] || h.codigo || '')}`
            : (h.acao === 'criado' ? (tipo === 'processo' ? 'Processo criado' : 'Proforma criada') : rotulo);
        let linhas = Object.entries(h.alteracoes || {})
            .filter(([c]) => !HIST_OCULTOS.has(c))
            .flatMap(([c, d]) => {
                const rot = HIST_CAMPOS[c] || c.replace(/_/g, ' ');
                if (c === 'documento' && d?.para === 'criado') return ['<li>Documento registrado</li>'];
                const obj = x => x && typeof x === 'object' && !Array.isArray(x);
                if ((obj(d?.de) || obj(d?.para)) && d?.de !== '(alterado)' && d?.para !== '(alterado)') {
                    const l = _histDiffObjeto(c, d?.de, d?.para);
                    if (l.length) return l;
                }
                if (c === 'etapas') return _histDiffEtapas(d?.de, d?.para);
                if (c === 'sem_assinatura' && d?.para === true) return [_histSemAssinatura(procAtual || { sem_assinatura: true })];
                return [`<li><strong>${_histEsc(rot)}:</strong> ${_histValor(c, d?.de, nomes)} <i class="fa-solid fa-arrow-right-long"></i> ${_histValor(c, d?.para, nomes)}</li>`];
            }).join('');
        // alteração sem nada visível (só campos técnicos): não polui a linha do tempo
        if (h.acao === 'alterado' && !linhas) return '';
        const camposVisiveis = Object.keys(h.alteracoes || {}).filter(c => !HIST_OCULTOS.has(c));
        if (h.acao === 'alterado' && h.tabela === 'processos' && camposVisiveis.length === 1 && camposVisiveis[0] === 'etapas') titulo = 'Atualizou as etapas';
        if (tipo === 'processo' && h.acao === 'criado') {
            linhas = `<li>Origem: <strong>Proforma ${_histEsc(proformaOrigem?.codigo || '—')}</strong></li>`
                + (procAtual?.sem_assinatura ? _histSemAssinatura(procAtual) : (procAtual?.proforma_id ? '<li>Iniciado com a Proforma assinada</li>' : ''))
                + linhas;
        }
        return `
            <div class="hist-item">
                <div class="hist-ponto" style="background:${cor}"><i class="fa-solid ${icone}"></i></div>
                <div class="hist-conteudo">
                    <div class="hist-linha1"><strong>${titulo}</strong><span>${quando}</span></div>
                    <div class="hist-quem"><i class="fa-solid fa-user"></i> ${_histEsc(h.usuario_nome || '—')}</div>
                    ${linhas ? `<ul class="hist-campos">${linhas}</ul>` : ''}
                </div>
            </div>`;
    }).join('');
}

// ========================================
// HISTÓRICO DAS CONTAS A PAGAR / RECEBER (database-historico-contas.sql)
// ========================================
// tipo = 'pagar' | 'receber'. Uma frase por fato (pagamento registrado,
// comprovante anexado/trocado/removido, valor/data alterados...), sempre com
// quem fez e quando. Só quem tem o Financeiro consegue ler (RLS).
const _HIST_CONTA_CAMPOS = {
    descricao: 'Descrição', parceiro_id: 'Empresa', proforma_id: 'Proforma', processo_id: 'Processo', commercial_invoice: 'Commercial Invoice',
    plano_conta_id: 'Plano de Contas', data_vencimento: 'Previsão de pagamento',
    valor_previsto: 'Valor previsto', moeda_previsto: 'Moeda prevista', cambio_previsto: 'Câmbio previsto',
    valor: 'Valor', moeda: 'Moeda', cambio: 'Câmbio', data_pagamento: 'Data de pagamento', data_recebimento: 'Data de recebimento',
    meio_pagamento: 'Meio de pagamento', numero_documento: 'Nº da nota fiscal / fatura', observacoes: 'Observações', status: 'Status',
};
const _HIST_CONTA_STATUS = { pendente: 'A Vencer', vencido: 'Em Atraso', pago: 'Pago', recebido: 'Recebido', cancelado: 'Cancelado' };
const _HIST_CONTA_MEIOS = { deposito: 'Depósito bancário', transferencia: 'Transferência / PIX', boleto: 'Boleto', dinheiro: 'Dinheiro',
    'cartao-credito': 'Cartão de crédito', 'cartao-debito': 'Cartão de débito', swift: 'Remessa internacional (SWIFT)',
    'carta-credito': 'Carta de crédito', cheque: 'Cheque', outro: 'Outro' };

function _histContaValor(campo, v, ref) {
    if (v === null || v === undefined || v === '') return '<em>vazio</em>';
    if (/^data_/.test(campo)) return _histEsc(new Date(String(v).slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR'));
    if (/^valor/.test(campo)) {
        const moeda = (campo === 'valor_previsto' ? ref.moeda_previsto : ref.moeda) || 'BRL';
        return _histEsc(typeof finFormatarValor === 'function' ? finFormatarValor(v, moeda) : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));
    }
    if (/^cambio/.test(campo)) return _histEsc(Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 4, maximumFractionDigits: 6 }));
    if (campo === 'status') return _histEsc(_HIST_CONTA_STATUS[v] || v);
    if (campo === 'meio_pagamento') {
        const s = String(v);
        return _histEsc(/^outro:/i.test(s) ? 'Outro — ' + s.replace(/^outro:\s*/i, '') : (_HIST_CONTA_MEIOS[s] || s));
    }
    if (ref._nomes?.[campo]?.[v]) return _histEsc(ref._nomes[campo][v]);
    return _histEsc(String(v).length > 120 ? String(v).slice(0, 120) + '…' : v);
}

async function abrirHistoricoConta(tipo, registroId, descricao) {
    const ov = _histModal();
    const tabela = tipo === 'pagar' ? 'contas_pagar' : 'contas_receber';
    const campoData = tipo === 'pagar' ? 'data_pagamento' : 'data_recebimento';
    const palavra = tipo === 'pagar' ? 'Pagamento' : 'Recebimento';
    document.getElementById('histTitulo').textContent = `Histórico — Conta a ${tipo === 'pagar' ? 'Pagar' : 'Receber'} ${descricao || ''}`;
    const corpo = document.getElementById('histCorpo');
    corpo.innerHTML = '<div class="hist-vazio"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';
    ov.classList.add('aberto');

    const [{ data, error }, { data: atual }] = await Promise.all([
        supabaseClient.from('historico_alteracoes').select('*').eq('registro_id', registroId).eq('tabela', tabela)
            .order('criado_em', { ascending: false }).limit(300),
        supabaseClient.from(tabela).select('*').eq('id', registroId).maybeSingle(),
    ]);
    if (error) { corpo.innerHTML = `<div class="hist-vazio">Não foi possível carregar o histórico: ${_histEsc(error.message)}</div>`; return; }
    if (!data?.length) {
        corpo.innerHTML = '<div class="hist-vazio">Nenhuma alteração registrada ainda. O histórico das contas começa a valer a partir da ativação (database-historico-contas.sql).</div>';
        return;
    }

    // nomes: empresa, plano de contas, proforma, processo citados nas alterações
    const ids = { parceiro_id: new Set(), plano_conta_id: new Set(), proforma_id: new Set(), processo_id: new Set() };
    data.forEach(h => Object.entries(h.alteracoes || {}).forEach(([c, d]) => {
        if (ids[c]) [d?.de, d?.para].filter(Boolean).forEach(v => ids[c].add(v));
    }));
    const nomes = { parceiro_id: {}, plano_conta_id: {}, proforma_id: {}, processo_id: {} };
    const buscar = async (campo, t, sel, rotulo) => {
        if (!ids[campo].size) return;
        const { data: rs } = await supabaseClient.from(t).select(sel).in('id', [...ids[campo]]);
        (rs || []).forEach(r => { nomes[campo][r.id] = rotulo(r); });
    };
    await Promise.all([
        buscar('parceiro_id', 'parceiros', 'id, razao_social, nome_fantasia', r => r.nome_fantasia || r.razao_social),
        buscar('plano_conta_id', 'plano_contas', 'id, codigo, subfator_nome', r => `${r.codigo} — ${r.subfator_nome}`),
        buscar('proforma_id', 'proformas', 'id, codigo', r => r.codigo),
        buscar('processo_id', 'processos', 'id, numero_processo', r => r.numero_processo),
    ]);

    const OCULTOS = new Set(['id', 'empresa_id', 'criado_por', 'criado_em', 'atualizado_em', 'comprovante_path', 'categoria', 'previsto_em',
        'valor_revisado', 'cambio_revisado', 'revisado_em', 'pedido_id']);
    const realizados = ['pago', 'recebido'];

    corpo.innerHTML = data.map(h => {
        const alt = h.alteracoes || {};
        const para = (c) => alt[c]?.para !== undefined ? alt[c].para : atual?.[c];
        const ref = { moeda: para('moeda'), moeda_previsto: para('moeda_previsto'), _nomes: nomes };
        const frases = [];
        let icone = 'fa-pen', cor = '#9333ea', titulo = 'Alterou';
        const usados = new Set();

        if (h.acao === 'criado') {
            icone = 'fa-plus'; cor = '#16a34a'; titulo = 'Conta criada';
        } else if (h.acao === 'removido') {
            icone = 'fa-trash'; cor = '#64748b'; titulo = 'Conta excluída';
        } else {
            const de = alt.status?.de, ate = alt.status?.para;
            if (ate && realizados.includes(ate) && !realizados.includes(de)) {
                icone = 'fa-circle-check'; cor = '#16a34a'; titulo = `${palavra} registrado`;
                const meio = para('meio_pagamento');
                frases.push(`<strong>${palavra} em ${_histContaValor(campoData, para(campoData), ref)}</strong> — ${_histContaValor('valor', para('valor'), ref)}`
                    + (meio ? ` · ${_histContaValor('meio_pagamento', meio, ref)}` : '') + (para('numero_documento') ? ` · NF ${_histEsc(para('numero_documento'))}` : ''));
                ['status', campoData, 'valor', 'moeda', 'cambio', 'meio_pagamento', 'numero_documento'].forEach(c => usados.add(c));
            } else if (de && realizados.includes(de) && ate && !realizados.includes(ate)) {
                icone = 'fa-rotate-left'; cor = '#ea580c'; titulo = `${palavra} desfeito`;
                usados.add('status'); usados.add(campoData);
            }
            if (alt.comprovante_nome) {
                const a = alt.comprovante_nome.de, b = alt.comprovante_nome.para;
                frases.push(!a ? `<i class="fa-solid fa-paperclip"></i> Comprovante anexado: <strong>${_histEsc(b)}</strong>`
                    : !b ? `<i class="fa-solid fa-trash"></i> Comprovante removido: ${_histEsc(a)}`
                    : `<i class="fa-solid fa-arrow-right-arrow-left"></i> Comprovante trocado: ${_histEsc(a)} <i class="fa-solid fa-arrow-right-long"></i> <strong>${_histEsc(b)}</strong>`);
                usados.add('comprovante_nome');
            }
            Object.entries(alt).forEach(([c, d]) => {
                if (OCULTOS.has(c) || usados.has(c) || !_HIST_CONTA_CAMPOS[c]) return;
                frases.push(`<strong>${_histEsc(_HIST_CONTA_CAMPOS[c])}:</strong> ${_histContaValor(c, d?.de, ref)} <i class="fa-solid fa-arrow-right-long"></i> ${_histContaValor(c, d?.para, ref)}`);
            });
            if (!frases.length) return '';   // só campos técnicos
        }
        return `
            <div class="hist-item">
                <div class="hist-ponto" style="background:${cor}"><i class="fa-solid ${icone}"></i></div>
                <div class="hist-conteudo">
                    <div class="hist-linha1"><strong>${_histEsc(titulo)}</strong><span>${_histDataHora(h.criado_em)}</span></div>
                    <div class="hist-quem"><i class="fa-solid fa-user"></i> ${_histEsc(h.usuario_nome || '—')}</div>
                    ${frases.length ? `<ul class="hist-campos">${frases.map(f => `<li>${f}</li>`).join('')}</ul>` : ''}
                </div>
            </div>`;
    }).join('') || '<div class="hist-vazio">Nenhuma alteração registrada ainda.</div>';
}
