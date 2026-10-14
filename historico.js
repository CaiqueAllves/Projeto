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
    data_abertura: 'Data de abertura', data_previsao: 'Previsão', data_embarque: 'Data de embarque',
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
const HIST_PARCEIROS = new Set(['parceiro_id', 'remetente_parceiro_id', 'destinatario_id', 'empresa_parceira_id']);
const HIST_STATUS = { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', encerrado: 'Encerrado', excluido: 'Excluído',
    aberto: 'Aberto', em_andamento: 'Em andamento', aguardando_documentos: 'Aguard. documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
const HIST_VALORES = {
    modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
    tipo: { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' },
    emissor_tipo: { usuario: 'Usuário (própria empresa)', terceiro: 'Terceiro' },
};
const HIST_DOCS = { proforma: 'Proforma Invoice', commercial: 'Commercial Invoice', packing: 'Packing List', due: 'DUE',
    le: 'Licença de Exportação', certorigem: 'Certificado de Origem', ctn: 'Conhecimento de Transporte', nfe: 'Nota Fiscal' };
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
    if (!data?.length) { corpo.innerHTML = '<div class="hist-vazio">Nenhuma alteração registrada ainda.</div>'; return; }

    // nomes das empresas (Exportador/Importador) citadas nas alterações
    const ids = new Set();
    data.forEach(h => Object.entries(h.alteracoes || {}).forEach(([c, d]) => {
        if (HIST_PARCEIROS.has(c)) { if (d?.de) ids.add(d.de); if (d?.para) ids.add(d.para); }
    }));
    const nomes = {};
    if (ids.size) {
        const { data: parcs } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').in('id', [...ids]);
        (parcs || []).forEach(p => { nomes[p.id] = p.nome_fantasia || p.razao_social; });
    }

    corpo.innerHTML = data.map(h => {
        const [icone, cor, rotulo] = HIST_ACOES[h.acao] || ['fa-circle', '#64748b', h.acao];
        const quando = new Date(h.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        const titulo = h.tabela === 'proforma_documentos'
            ? `${rotulo}: ${_histEsc(HIST_DOCS[h.codigo] || h.codigo || '')}`
            : rotulo;
        const linhas = Object.entries(h.alteracoes || {})
            .filter(([c]) => !HIST_OCULTOS.has(c))
            .map(([c, d]) => {
                const rot = HIST_CAMPOS[c] || c.replace(/_/g, ' ');
                if (c === 'documento' && d?.para === 'criado') return '<li>Documento registrado</li>';
                return `<li><strong>${_histEsc(rot)}:</strong> ${_histValor(c, d?.de, nomes)} <i class="fa-solid fa-arrow-right-long"></i> ${_histValor(c, d?.para, nomes)}</li>`;
            }).join('');
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
