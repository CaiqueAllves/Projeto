// ========================================
// FORMULÁRIOS — Aba Processo (salvar/editar, etapas, emissor, rota, origem/destino, documentos, transporte, saldo da Proforma)
// ========================================
// Parte do antigo formularios.js (dividido por aba em 2026-10). Tudo continua
// global: funções de uma aba podem chamar as das outras e as de formularios.js.

// ========================================
// SALVAR — PROCESSO
// ========================================

async function salvarProcesso(e) {
    e.preventDefault();
    if (!exigirEmpresaVinculada()) return;

    const tipo = document.getElementById('proc-tipo')?.value;
    if (!tipo) {
        mostrarNotificacao('Selecione o Tipo do processo antes de salvar.', 'warning');
        document.getElementById('proc-tipo')?.focus();
        return;
    }

    const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;
    if (!emissorTipo) {
        mostrarNotificacao('Selecione o Emissor (Usuário ou Terceiro) antes de salvar.', 'warning');
        document.getElementById('proc-emissor-usuario')?.closest('.emissor-toggle')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    if (emissorTipo === 'terceiro' && !document.getElementById('proc-cliente-id')?.value) {
        mostrarNotificacao('Selecione o Exportador antes de salvar.', 'warning');
        document.getElementById('proc-cliente')?.focus();
        return;
    }
    if (tipo === 'exportacao_indireta' && !document.getElementById('proc-trading-id')?.value) {
        mostrarNotificacao('Exportação indireta: selecione a Trading / Comercial Exportadora antes de salvar.', 'warning');
        document.getElementById('proc-trading-busca')?.focus();
        return;
    }
    const procModal    = document.getElementById('proc-modal')?.value;
    const procIncoterm = document.getElementById('proc-incoterm')?.value;
    if (procModal && procModal !== 'maritimo' && INCOTERMS_MARITIMOS.includes(procIncoterm)) {
        mostrarNotificacao(`O Incoterm ${procIncoterm} é exclusivo do modal Marítimo — escolha outro Incoterm ou mude o modal.`, 'warning');
        document.getElementById('proc-incoterm')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    if (document.getElementById('transp-tipo')?.value === 'propria') window._transpAplicarPropriaCliente?.();
    // Transporte: campos obrigatórios (Documento Fiscal vem da transportadora escolhida)
    const transpObrig = [
        ['transp-tipo',               'Selecione a Transportadora (Solicitada / Própria do Cliente).'],
        ['transp-razao',              'Informe a Razão Social da transportadora.'],
        ['transp-cnpj',               document.getElementById('transp-tipo')?.value === 'propria'
            ? 'Coleta pelo próprio Importador: escolha o Importador do processo (com documento cadastrado).'
            : 'Escolha a transportadora na lista para preencher o Documento Fiscal (cadastre-a em Empresas › Modelo Transportadora).'],
        ['transp-tipo-veiculo',       'Selecione o Tipo de Veículo.'],
        ['transp-data-coleta',        'Informe a Data de Coleta.'],
        ['transp-data-entrega',       'Informe a Entrega Prevista.'],
        ['transp-frete-moeda',        'Escolha a Moeda do frete na lista.', 'transp-frete-moeda-display'],
        ['transp-frete-valor',        'Informe o Valor do Frete.'],
    ];
    const faltando = transpObrig.filter(([id]) => !(document.getElementById(id)?.value || '').trim());
    if (faltando.length) {
        const secTransp = document.getElementById('transp-tipo')?.closest('.form-section');
        if (secTransp && !secTransp.classList.contains('active')) secTransp.querySelector('.section-title')?.click();
        faltando.forEach(([id, , visivel]) => {
            const el = document.getElementById(visivel || id);
            if (!el) return;
            el.style.borderColor = '#dc2626';
            const limpar = () => { el.style.borderColor = ''; };
            el.addEventListener('input', limpar, { once: true });
            el.addEventListener('change', limpar, { once: true });
        });
        const primeiro = document.getElementById(faltando[0][2] || faltando[0][0]);
        mostrarNotificacao(faltando[0][1] + (faltando.length > 1 ? ` (+${faltando.length - 1} campo(s) obrigatório(s) do Transporte)` : ''), 'warning');
        setTimeout(() => primeiro?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 150);
        return;
    }
    const dColeta = document.getElementById('transp-data-coleta').value, dEntrega = document.getElementById('transp-data-entrega').value;
    if (dEntrega < dColeta) {
        mostrarNotificacao('A Entrega Prevista não pode ser antes da Data de Coleta.', 'warning');
        document.getElementById('transp-data-entrega')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    // Embarque parcial: nenhum produto pode passar do saldo da Proforma. Recalcula
    // na hora (outro processo pode ter sido salvo enquanto este estava aberto).
    // Bloqueia sem fechar a tela — o usuário ajusta as quantidades e salva de novo.
    const proformaId = document.getElementById('proc-proposta-id')?.value;
    if (proformaId) {
        _procSaldo = await window.supabaseAPI.buscarSaldoProforma(proformaId, document.getElementById('proc-id')?.value || null);
        itensRecalcular('proc');
        const excedidos = _procExcedentes();
        if (excedidos.length) {
            const e1 = excedidos[0];
            const fmt = n => Number(n).toLocaleString('pt-BR');
            await confirmarAcao(
                `"${e1.produto}" está com ${fmt(e1.pedido)} ${e1.unidade} neste processo, mas o saldo da Proforma ${_procSaldo.proforma?.codigo || ''} é de ${fmt(e1.saldo)} ${e1.unidade}`
                + (e1.usado ? ` (${fmt(e1.usado)} de ${fmt(e1.total)} já estão em outros processos)` : '')
                + `.${excedidos.length > 1 ? ` Outros ${excedidos.length - 1} produto(s) também passam do saldo.` : ''} Ajuste as quantidades para salvar.`,
                { titulo: 'Quantidade acima do saldo', confirmar: 'Ajustar quantidades', cancelar: null, perigo: true }
            );
            document.getElementById(`proc-item-card-${e1.idx[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }
    }

    const modal = document.getElementById('modal-confirmar-salvar');
    modal.dataset.origem = 'processo';
    modal.style.display = 'flex';
}

// Aceite de início sem a Proforma assinada: preenche os campos ocultos
// (enviados no salvamento) e mostra a faixa de aviso no topo do formulário.
function _procAplicarSemAssinatura(p, codigoProforma) {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
    const faixa = document.getElementById('proc-sem-assinatura-faixa');
    if (!p?.sem_assinatura) {
        set('proc-sem-assinatura', ''); set('proc-sem-assinatura-por', ''); set('proc-sem-assinatura-em', '');
        if (faixa) faixa.style.display = 'none';
        return;
    }
    set('proc-sem-assinatura',     '1');
    set('proc-sem-assinatura-por', p.sem_assinatura_confirmado_por);
    set('proc-sem-assinatura-em',  p.sem_assinatura_confirmado_em);
    const quando = p.sem_assinatura_confirmado_em
        ? new Date(p.sem_assinatura_confirmado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        : '—';
    const texto = document.getElementById('proc-sem-assinatura-texto');
    if (texto) {
        texto.innerHTML = '';
        const b = document.createElement('strong');
        b.textContent = `Processo iniciado sem a Proforma ${codigoProforma || ''} assinada.`.replace('  ', ' ');
        texto.append(b, ` Aceite confirmado por ${p.sem_assinatura_confirmado_por || '—'} em ${quando}.`);
    }
    if (faixa) faixa.style.display = '';
}

async function procCarregarEdicao(id) {
    const res = await window.supabaseAPI.buscarProcessoPorId(id);
    if (!res.sucesso || !res.data) {
        mostrarNotificacao('Processo não encontrado.', 'erro');
        return;
    }
    const p = res.data;

    // Preenche campos do formulário
    const set = (sel, val) => { const el = document.getElementById(sel); if (el && val != null) el.value = val; };
    const fire = (sel, evt) => document.getElementById(sel)?.dispatchEvent(new Event(evt));

    // Dados do Processo
    set('proc-tipo',            p.tipo);
    set('proc-proposito',       p.proposito);
    set('proc-documento-tipo',  p.documento_tipo);
    set('proc-documento',       p.documento);
    if (!p.documento_tipo) _procSincronizarTipoDoc();
    set('proc-modal',           p.modal);
    fire('proc-modal', 'change');
    set('proc-incoterm',        p.incoterm);
    fire('proc-incoterm', 'change');
    set('proc-observacoes',     p.observacoes);

    if (p.emissor_tipo !== 'terceiro') {
        const radioU = document.getElementById('proc-emissor-usuario');
        if (radioU) { radioU.checked = true; fire('proc-emissor-usuario', 'change'); }
    }
    if (p.emissor_tipo === 'terceiro') {
        const radio = document.getElementById('proc-emissor-terceiro');
        if (radio) { radio.checked = true; fire('proc-emissor-terceiro', 'change'); }
        if (p.remetente_parceiro_id) {
            const { data: remetente } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').eq('id', p.remetente_parceiro_id).single();
            if (remetente) {
                set('proc-cliente',    remetente.nome_fantasia || remetente.razao_social);
                set('proc-cliente-id', remetente.id);
            }
        }
    }

    // Status / prazos / container
    set('proc-status',            p.status);
    fire('proc-status', 'change');
    set('proc-data-abertura',     p.data_abertura);
    set('proc-data-previsao',     p.data_previsao);
    set('proc-data-embarque',     p.data_embarque);
    set('proc-data-chegada',      p.data_chegada);
    set('proc-data-cancelamento', p.data_cancelamento);
    set('proc-obs-prazos',        p.obs_prazos);
    set('proc-container-tipo',    p.container_tipo);
    set('proc-container-num',    p.container_numero);

    // Origem
    set('proc-origem-pais',        p.pais_origem);
    set('proc-origem-pais-codigo', p.origem_pais_codigo);
    set('proc-navio',              p.navio);
    set('proc-aeronave',           p.aeronave);
    set('proc-porto-origem',       p.porto_origem);
    set('proc-aeroporto-origem',   p.aeroporto_origem);
    set('proc-fronteira-saida',    p.fronteira_saida);
    const oe = p.origem_endereco || {};
    set('proc-origem-cep',         oe.cep);
    set('proc-origem-estado',      oe.estado);
    set('proc-origem-cidade',      oe.cidade);
    set('proc-origem-bairro',      oe.bairro);
    set('proc-origem-endereco',    oe.endereco);
    set('proc-origem-numero',      oe.numero);
    set('proc-origem-complemento', oe.complemento);
    const oc = p.origem_coleta || {};
    const coletaMesmoEl = document.getElementById('proc-origem-coleta-mesmo');
    if (coletaMesmoEl) coletaMesmoEl.checked = !!oc.mesmo;
    set('proc-origem-coleta-cep',         oc.cep);
    set('proc-origem-coleta-estado',      oc.estado);
    set('proc-origem-coleta-cidade',      oc.cidade);
    set('proc-origem-coleta-bairro',      oc.bairro);
    set('proc-origem-coleta-endereco',    oc.endereco);
    set('proc-origem-coleta-numero',      oc.numero);
    set('proc-origem-coleta-complemento', oc.complemento);
    set('proc-origem-coleta-horario',     oc.horario);
    set('proc-origem-coleta-intervalo',   oc.intervalo);

    // Exportação indireta: trading e NF de remessa
    set('proc-nf-remessa-data', p.nf_remessa_data);
    if (p.trading_id) await _procPreencherTrading(p.trading_id);
    procAtualizarModoIndireta();

    // Destino
    if (p.empresa_parceira_id) {
        const { data: dest } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia, documento, codigo').eq('id', p.empresa_parceira_id).single();
        if (dest) {
            set('proc-emp-dest-busca',    dest.nome_fantasia || dest.razao_social);
            set('proc-emp-dest-id',       dest.id);
            set('proc-emp-dest-auto-doc', dest.documento);
            set('proc-emp-dest-auto-id',  dest.codigo);
        }
    }
    set('proc-destino-pais',        p.pais_destino);
    set('proc-destino-pais-codigo', p.destino_pais_codigo);
    set('proc-porto-destino',       p.porto_destino);
    set('proc-aeroporto-destino',   p.aeroporto_destino);
    set('proc-fronteira-entrada',   p.fronteira_entrada);
    const de = p.destino_endereco || {};
    set('proc-destino-cep',         de.cep);
    set('proc-destino-estado',      de.estado);
    set('proc-destino-cidade',      de.cidade);
    set('proc-destino-bairro',      de.bairro);
    set('proc-destino-endereco',    de.endereco);
    set('proc-destino-numero',      de.numero);
    set('proc-destino-complemento', de.complemento);
    const dr = p.destino_responsavel || {};
    set('proc-destino-responsavel',         dr.nome);
    set('proc-destino-responsavel-contato', dr.contato);
    set('proc-destino-responsavel-email',   dr.email);

    if (typeof restaurarIntermediarios === 'function') restaurarIntermediarios(p.rota_intermediarios || []);

    // Etapas
    if (Array.isArray(p.etapas) && p.etapas.length && typeof renderEtapas === 'function') {
        _etapas = p.etapas;
        renderEtapas();
    }

    // Documentos
    const docs = p.documentos || {};
    Object.entries(docs).forEach(([chave, valor]) => set(`doc-num-${chave}`, valor));

    // Sem previsão de embarque salva no Processo: usa a da Proforma (base dos prazos)
    if (!p.data_previsao && p.proforma_id) {
        const { data: pf } = await supabaseClient.from('proformas').select('previsao_embarque').eq('id', p.proforma_id).maybeSingle();
        if (pf?.previsao_embarque) set('proc-data-previsao', pf.previsao_embarque);
    }
    // com Proforma, recalcula depois de saber se a Proforma Invoice está assinada
    // (_docCarregarAnexosProcesso) — antes disso a etapa "Pedido Confirmado" cairia
    if (!p.proforma_id) procReaplicarEtapas();

    // Transporte
    const t = p.transporte || {};
    set('transp-tipo',              t.tipo);
    setTimeout(() => { if (t.tipo === 'propria') window._transpAplicarPropriaCliente?.(); }, 0);
    set('transp-nome',              t.nome);
    set('transp-razao',             t.razao);
    set('transp-cnpj',              t.cnpj);
    set('transp-num-coleta',        t.num_coleta);
    set('transp-tipo-veiculo',      t.tipo_veiculo);
    set('transp-placa',             t.placa);
    set('transp-motorista',         t.motorista);
    set('transp-motorista-cnh',     t.motorista_cnh);
    set('transp-motorista-contato', t.motorista_contato);
    set('transp-data-coleta',       t.data_coleta);
    set('transp-data-entrega',      t.data_entrega);
    set('transp-frete-moeda',       t.frete_moeda);
    set('transp-frete-moeda-display', t.frete_moeda);
    set('transp-frete-valor',       t.frete_valor);
    set('transp-frete-incoterm',    t.frete_incoterm);
    set('transp-seguro',            t.seguro);
    set('transp-obs',               t.obs);

    // Proforma de origem
    set('proc-proposta-id', p.proforma_id);

    // "Código da Proforma" mostra o código da proforma de origem (antes mostrava,
    // por engano, o número do próprio processo).
    let codigoProf = '';
    if (p.proforma_id) {
        const { data: pf } = await supabaseClient.from('proformas').select('codigo').eq('id', p.proforma_id).maybeSingle();
        codigoProf = pf?.codigo || '';
    }
    set('proc-codigo', codigoProf);

    // Faixa "iniciado sem a Proforma assinada" (se foi o caso)
    if (p.sem_assinatura) _procAplicarSemAssinatura(p, codigoProf);

    // Número do processo (cabeçalho do PDF — o campo "Código" mostra o da Proforma)
    window._procNumero = p.numero_processo || null;

    // NCM dos produtos (tabela de produtos do PDF do Processo)
    const idsProd = (Array.isArray(p.itens) ? p.itens : []).map(it => it.produto_id).filter(Boolean);
    window._procProdutosInfo = {};
    if (idsProd.length) {
        const { data: prods } = await supabaseClient.from('produtos').select('id, ncm, hscode').in('id', idsProd);
        (prods || []).forEach(pr => { window._procProdutosInfo[pr.id] = pr; });
    }

    // "Criado por" do PDF do Processo
    window._procCriadoPorNome = p.criado_por
        ? (await window.supabaseAPI.buscarNomesUsuarios([p.criado_por]))[p.criado_por]
        : null;

    // Produtos do Processo (+ saldo da proforma, sem contar este processo)
    _procSaldo = p.proforma_id ? await window.supabaseAPI.buscarSaldoProforma(p.proforma_id, p.id) : null;
    _procExcluirDaProforma = new Set();
    if (Array.isArray(p.itens) && p.itens.length > 0) {
        await Promise.all([_carregarMoedas(), _carregarUnidades()]);
        _procItens = _itensNormalizar(p.itens);
    }
    itensRenderizar('proc');

    // Documentos: anexos reais já existentes pra proforma (pode ter vindo
    // deste processo ou de outro processo da mesma proforma).
    if (p.proforma_id) await _docCarregarAnexosProcesso(p.proforma_id, p.id);

    // Guarda ID para atualização
    const idEl = document.getElementById('proc-id');
    if (idEl) idEl.value = p.id;

    // Exibe número do processo no título
    const titulo = document.querySelector('#tab-processo .section-title span');
    if (titulo && p.numero_processo) titulo.textContent = `Editar Processo — ${p.numero_processo}`;
}

function procAplicarModoVisualizacao() {
    const form = document.getElementById('form-processo');
    if (!form) return;

    form.querySelectorAll('input, select, textarea, button[type="submit"], button[type="button"]').forEach(el => {
        el.disabled = true;
    });

    const actions = form.querySelector('.form-actions');
    if (actions) actions.style.display = 'none';

    const banner = document.createElement('div');
    banner.style.cssText = 'position:sticky;top:0;z-index:100;background:#1e40af;color:#fff;text-align:center;padding:10px 16px;font-size:13px;font-weight:600;letter-spacing:0.3px;border-radius:8px;margin-bottom:12px;';
    banner.innerHTML = '<i class="fa-solid fa-eye" style="margin-right:6px;"></i>Modo Visualização — somente leitura';
    form.insertBefore(banner, form.firstChild);
}

// Número do documento (não o nome do arquivo que o campo mostra com anexo)
function _docNumero(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return (el.dataset.anexo ? (el.dataset.numero || '') : (el.value || '')).trim() || null;
}

function _coletarDadosProcesso() {
    const v = id => document.getElementById(id)?.value?.trim() || null;
    const destinatarioId = document.getElementById('proc-emp-dest-id')?.value || null;
    const remetenteId    = document.getElementById('proc-cliente-id')?.value || null;

    return {
        // Dados do Processo
        proforma_id:            document.getElementById('proc-proposta-id')?.value || null,
        sem_assinatura:                document.getElementById('proc-sem-assinatura')?.value === '1',
        sem_assinatura_confirmado_por: document.getElementById('proc-sem-assinatura-por')?.value || null,
        sem_assinatura_confirmado_em:  document.getElementById('proc-sem-assinatura-em')?.value  || null,
        tipo:                   v('proc-tipo'),
        proposito:              v('proc-proposito'),
        emissor_tipo:            document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value || 'usuario',
        documento_tipo:          v('proc-documento-tipo'),
        documento:               v('proc-documento'),
        remetente_parceiro_id:   remetenteId,
        trading_id:              document.getElementById('proc-trading-id')?.value || null,
        nf_remessa_data:         document.getElementById('proc-nf-remessa-data')?.value || null,
        incoterm:                v('proc-incoterm'),
        modal:                   v('proc-modal'),
        observacoes:             v('proc-observacoes'),

        // Status / prazos / container
        status:                  document.getElementById('proc-status')?.value || 'aberto',
        data_abertura:           document.getElementById('proc-data-abertura')?.value || null,
        data_previsao:           document.getElementById('proc-data-previsao')?.value || null,
        data_embarque:           document.getElementById('proc-data-embarque')?.value || null,
        data_chegada:            document.getElementById('proc-data-chegada')?.value || null,
        data_cancelamento:       document.getElementById('proc-data-cancelamento')?.value || null,
        obs_prazos:              v('proc-obs-prazos'),
        container_tipo:          v('proc-container-tipo'),
        container_numero:        v('proc-container-num'),

        // Origem
        pais_origem:             v('proc-origem-pais'),
        origem_pais_codigo:      v('proc-origem-pais-codigo'),
        navio:                   v('proc-navio'),
        aeronave:                v('proc-aeronave'),
        porto_origem:            v('proc-porto-origem'),
        aeroporto_origem:        v('proc-aeroporto-origem'),
        fronteira_saida:         v('proc-fronteira-saida'),
        origem_endereco: {
            cep:         v('proc-origem-cep'),
            estado:      v('proc-origem-estado'),
            cidade:      v('proc-origem-cidade'),
            bairro:      v('proc-origem-bairro'),
            endereco:    v('proc-origem-endereco'),
            numero:      v('proc-origem-numero'),
            complemento: v('proc-origem-complemento'),
        },
        origem_coleta: {
            mesmo:       !!document.getElementById('proc-origem-coleta-mesmo')?.checked,
            cep:         v('proc-origem-coleta-cep'),
            estado:      v('proc-origem-coleta-estado'),
            cidade:      v('proc-origem-coleta-cidade'),
            bairro:      v('proc-origem-coleta-bairro'),
            endereco:    v('proc-origem-coleta-endereco'),
            numero:      v('proc-origem-coleta-numero'),
            complemento: v('proc-origem-coleta-complemento'),
            horario:     v('proc-origem-coleta-horario'),
            intervalo:   v('proc-origem-coleta-intervalo'),
        },

        // Destino
        empresa_parceira_id:     destinatarioId,
        pais_destino:            v('proc-destino-pais'),
        destino_pais_codigo:     v('proc-destino-pais-codigo'),
        porto_destino:           v('proc-porto-destino'),
        aeroporto_destino:       v('proc-aeroporto-destino'),
        fronteira_entrada:       v('proc-fronteira-entrada'),
        destino_endereco: {
            cep:         v('proc-destino-cep'),
            estado:      v('proc-destino-estado'),
            cidade:      v('proc-destino-cidade'),
            bairro:      v('proc-destino-bairro'),
            endereco:    v('proc-destino-endereco'),
            numero:      v('proc-destino-numero'),
            complemento: v('proc-destino-complemento'),
        },
        destino_responsavel: {
            nome:    v('proc-destino-responsavel'),
            contato: v('proc-destino-responsavel-contato'),
            email:   v('proc-destino-responsavel-email'),
        },

        rota_intermediarios: (typeof coletarIntermediarios === 'function') ? coletarIntermediarios() : [],

        // Etapas
        etapas: (typeof _etapas !== 'undefined') ? _etapas : [],
        // Produtos do Processo (exige database-processos-itens.sql; ver supabase-api.js)
        itens:       _itensComSigla(_procItens.filter(it => (it.produto || '').trim())),
        valor_total: _procItens.reduce((t, it) => t + (it.qtd * it.preco || 0), 0) || null,
        moeda:       (() => {
            const desc = _procItens.find(it => it.moeda)?.moeda;
            const m = _acMoedas.find(x => x.descricao === desc);
            return m?.sigla || 'USD';
        })(),

        // Documentos (numeração — sem arquivos anexados)
        documentos: {
            proforma:   _docNumero('doc-num-proforma'),
            commercial: _docNumero('doc-num-commercial'),
            packing:    _docNumero('doc-num-packing'),
            due:        _docNumero('doc-num-due'),
            le:         _docNumero('doc-num-le'),
            certorigem: _docNumero('doc-num-certorigem'),
            ctn:        _docNumero('doc-num-ctn'),
            nfe:        _docNumero('doc-num-nfe'),
            awb:        _docNumero('doc-num-awb'),
            manifesto:  _docNumero('doc-num-manifesto'),
            fcl:        _docNumero('doc-num-fcl'),
            lcl:        _docNumero('doc-num-lcl'),
            bl:         _docNumero('doc-num-bl'),
            apolice:    _docNumero('doc-num-apolice'),
            crt:        _docNumero('doc-num-crt'),
            micdta:     _docNumero('doc-num-micdta'),
            nfremessa:  _docNumero('doc-num-nfremessa'),
            memorando:  _docNumero('doc-num-memorando'),
        },

        // Transporte
        transporte: {
            tipo:               v('transp-tipo'),
            nome:               v('transp-nome'),
            razao:              v('transp-razao'),
            cnpj:               v('transp-cnpj'),
            num_coleta:         v('transp-num-coleta'),
            tipo_veiculo:       v('transp-tipo-veiculo'),
            placa:              v('transp-placa'),
            motorista:          v('transp-motorista'),
            motorista_cnh:      v('transp-motorista-cnh'),
            motorista_contato:  v('transp-motorista-contato'),
            data_coleta:        document.getElementById('transp-data-coleta')?.value || null,
            data_entrega:       document.getElementById('transp-data-entrega')?.value || null,
            frete_moeda:        v('transp-frete-moeda'),
            frete_valor:        v('transp-frete-valor'),
            frete_incoterm:     v('proc-incoterm'),
            seguro:             v('transp-seguro'),
            obs:                v('transp-obs'),
        },
    };
}

// Alias mantido para compatibilidade com HTML existente
function confirmarSalvarProcesso() { confirmarSalvar(); }

// ========================================
// AUTOCOMPLETE — PAÍS DE ORIGEM (PROCESSO)
// ========================================

function iniciarAutocompletePaisOrigem() {
    const input  = document.getElementById('proc-origem-pais');
    const lista  = document.getElementById('proc-origem-pais-lista');
    const codigo = document.getElementById('proc-origem-pais-codigo');
    if (!input || !lista || !codigo) return;

    async function mostrarPaises() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${escHtml(p.codigo)}" data-nome="${escHtml(p.descricao || '')}">
                <span class="ac-nome">${escHtml(p.descricao)}</span>
                <span class="ac-fantasia">${escHtml(p.codigo)}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrarPaises);
    input.addEventListener('input', () => { codigo.value = ''; mostrarPaises(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — PAÍS DE DESTINO (PROCESSO)
// ========================================

function iniciarAutocompletePaisDestino() {
    const input  = document.getElementById('proc-destino-pais');
    const lista  = document.getElementById('proc-destino-pais-lista');
    const codigo = document.getElementById('proc-destino-pais-codigo');
    if (!input || !lista || !codigo) return;

    async function mostrar() {
        await _acCarregarPaises();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q) || p.codigo.toLowerCase().includes(q))
            : _acPaises;
        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item" data-codigo="${escHtml(p.codigo)}" data-nome="${escHtml(p.descricao || '')}">
                <span class="ac-nome">${escHtml(p.descricao)}</span>
                <span class="ac-fantasia">${escHtml(p.codigo)}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { codigo.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        codigo.value = item.getAttribute('data-codigo');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — AEROPORTOS
// ========================================

function _iniciarAcAeroporto(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
    if (!input || !lista) return;

    async function mostrar() {
        await _acCarregarAeroportos();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acAeroportos.filter(a =>
                (a.nome   || '').toLowerCase().includes(q) ||
                (a.codigo || '').toLowerCase().includes(q) ||
                (a.pais   || '').toLowerCase().includes(q))
            : _acAeroportos;

        lista.innerHTML = filtrados.slice(0, 50).map(a => `
            <div class="autocomplete-item"
                 data-nome="${escHtml(a.nome || '')}"
                 data-codigo="${escHtml(a.codigo || '')}">
                <span class="ac-nome">${escHtml(a.nome)}</span>
                <span class="ac-fantasia">${escHtml(a.codigo)}${escHtml(a.pais ? ' · ' + a.pais : '')}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', mostrar);

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = `${item.getAttribute('data-nome')} (${item.getAttribute('data-codigo')})`;
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

function iniciarAutocompleteAeroportos() {
    _iniciarAcAeroporto('proc-aeroporto-origem',  'proc-aeroporto-origem-lista');
    _iniciarAcAeroporto('proc-aeroporto-destino', 'proc-aeroporto-destino-lista');
    _iniciarAcAeroporto('prop-aeroporto-origem',  'prop-aeroporto-origem-lista');
    _iniciarAcAeroporto('prop-aeroporto-destino', 'prop-aeroporto-destino-lista');
}

// ========================================
// AUTOCOMPLETE — PORTOS
// ========================================

function _iniciarAcPorto(inputId, listaId) {
    const input = document.getElementById(inputId);
    const lista = document.getElementById(listaId);
    if (!input || !lista) return;

    async function mostrar() {
        await _acCarregarPortos();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acPortos.filter(p =>
                (p.nome   || '').toLowerCase().includes(q) ||
                (p.sigla  || '').toLowerCase().includes(q) ||
                (p.cidade || '').toLowerCase().includes(q) ||
                (p.pais   || '').toLowerCase().includes(q))
            : _acPortos;

        lista.innerHTML = filtrados.slice(0, 50).map(p => `
            <div class="autocomplete-item"
                 data-nome="${escHtml(p.nome  || '')}"
                 data-sigla="${escHtml(p.sigla || '')}">
                <span class="ac-nome">${escHtml(p.nome)}</span>
                <span class="ac-fantasia">${escHtml(p.sigla ? p.sigla + ' · ' : '')}${escHtml(p.cidade ? p.cidade + ' · ' : '')}${escHtml(p.pais || '')}</span>
            </div>`).join('');
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', mostrar);

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        const sigla = item.getAttribute('data-sigla');
        input.value = sigla
            ? `${item.getAttribute('data-nome')} (${sigla})`
            : item.getAttribute('data-nome');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

function iniciarAutocompletePortos() {
    _iniciarAcPorto('proc-porto-origem',  'proc-porto-origem-lista');
    _iniciarAcPorto('proc-porto-destino', 'proc-porto-destino-lista');
    _iniciarAcPorto('prop-porto-origem',  'prop-porto-origem-lista');
    _iniciarAcPorto('prop-porto-destino', 'prop-porto-destino-lista');
}

// ========================================
// MÁSCARA CPF / CNPJ — FORMULÁRIO PROCESSO
// ========================================

function aplicarMascaraDocumentoProcesso() {
    const tipoSelect = document.getElementById('proc-documento-tipo');
    const docInput   = document.getElementById('proc-documento');
    if (!tipoSelect || !docInput) return;

    function mascarar(valor, tipo) {
        valor = valor.replace(/\D/g, '');
        if (tipo === 'cpf') {
            valor = valor.slice(0, 11);
            valor = valor.replace(/^(\d{3})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1-$2');
        } else {
            valor = valor.slice(0, 14);
            valor = valor.replace(/^(\d{2})(\d)/, '$1.$2');
            valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
            valor = valor.replace(/\.(\d{3})(\d)/, '.$1/$2');
            valor = valor.replace(/(\d{4})(\d)/, '$1-$2');
        }
        return valor;
    }

    function atualizarPlaceholder() {
        const tipo = tipoSelect.value;
        docInput.placeholder = tipo === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00';
        docInput.maxLength   = tipo === 'cpf' ? 14 : 18;
        docInput.value       = '';
    }

    tipoSelect.addEventListener('change', atualizarPlaceholder);

    docInput.addEventListener('input', () => {
        if (docInput.readOnly) return;
        docInput.value = mascarar(docInput.value, tipoSelect.value);
    });

    atualizarPlaceholder();
}

// ========================================
// AUTOCOMPLETE — CONTAINER
// ========================================

function iniciarAutocompleteContainer() {
    const input  = document.getElementById('proc-container-tipo');
    const lista  = document.getElementById('proc-container-tipo-lista');
    const idOcul = document.getElementById('proc-container-tipo-id');
    if (!input || !lista || !idOcul) return;

    async function mostrar() {
        await _acCarregarContainers();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acContainers.filter(c =>
                (c.identificacao || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q) ||
                (c.descricao || '').toLowerCase().includes(q))
            : _acContainers;

        lista.innerHTML = filtrados.length
            ? filtrados.slice(0, 40).map(c => `
                <div class="autocomplete-item" data-id="${c.id}" data-nome="${escHtml(c.identificacao || '')}">
                    <span class="ac-nome">${escHtml(c.identificacao || '')}</span>
                    <span class="ac-fantasia">${escHtml(c.tipo || '')} ${escHtml(c.descricao ? '— ' + c.descricao : '')}</span>
                </div>`).join('')
            : '<div class="autocomplete-vazio">Nenhum resultado encontrado</div>';
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { idOcul.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        idOcul.value = item.getAttribute('data-id');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — ACONDICIONAMENTO
// ========================================

function iniciarAutocompleteAcondicionamento() {
    const input  = document.getElementById('proc-acondicionamento');
    const lista  = document.getElementById('proc-acondicionamento-lista');
    const idOcul = document.getElementById('proc-acondicionamento-id');
    if (!input || !lista || !idOcul) return;

    async function mostrar() {
        await _acCarregarContainers();
        const q = input.value.trim().toLowerCase();
        const filtrados = q
            ? _acContainers.filter(c =>
                (c.identificacao || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q) ||
                (c.descricao || '').toLowerCase().includes(q))
            : _acContainers;

        lista.innerHTML = filtrados.length
            ? filtrados.slice(0, 40).map(c => `
                <div class="autocomplete-item" data-id="${c.id}" data-nome="${escHtml(c.identificacao || '')}">
                    <span class="ac-nome">${escHtml(c.identificacao || '')}</span>
                    <span class="ac-fantasia">${escHtml(c.tipo || '')} ${escHtml(c.descricao ? '— ' + c.descricao : '')}</span>
                </div>`).join('')
            : '<div class="autocomplete-vazio">Nenhum resultado encontrado</div>';
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('focus', mostrar);
    input.addEventListener('input', () => { idOcul.value = ''; mostrar(); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value  = item.getAttribute('data-nome');
        idOcul.value = item.getAttribute('data-id');
        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// ETAPAS DO PROCESSO
// ========================================

// Listas padrão (tipo + modal), prazos e conclusão automática: etapas.js

let _etapas = [];

function _etapaId() {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function renderEtapas() {
    const lista = document.getElementById('etapas-lista');
    const info  = document.getElementById('etapas-info');
    if (!lista) return;

    if (info) info.textContent = `${_etapas.length} etapa${_etapas.length !== 1 ? 's' : ''}`;

    lista.innerHTML = _etapas.map(e => `
        <div class="etapa-row ${e.concluida ? 'concluida' : ''}" data-id="${e.id}">
            <div class="etapa-col-check">
                <input type="checkbox" class="etapa-check" ${e.concluida ? 'checked' : ''}>
            </div>
            <div class="etapa-col-nome">
                <input type="text" class="etapa-nome" value="${escHtml(e.nome || '')}" placeholder="Nome da etapa">
                ${_etapaOrigemHtml(e)}
            </div>
            <label class="etapa-campo etapa-campo-data"><span>Concluída em</span>
                <input type="date" class="etapa-data" value="${escHtml(e.data || '')}" title="Data em que foi concluída"></label>
            <label class="etapa-campo etapa-campo-prazo"><span>Prazo</span>
                <input type="date" class="etapa-prazo${etapaSituacao(e)?.atrasada ? ' atrasada' : ''}" value="${escHtml(e.prazo || '')}"
                       title="${e.prazo_manual ? 'Prazo digitado (apague para voltar ao cálculo pela previsão de embarque)' : 'Prazo calculado pela previsão de embarque — pode alterar'}"></label>
            <input type="text" class="etapa-resp" value="${escHtml(e.responsavel || '')}" placeholder="Responsável">
            <button type="button" class="btn-remover-etapa" title="Remover">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`).join('');

    lista.querySelectorAll('.etapa-check').forEach(chk => {
        chk.addEventListener('change', () => {
            const row = chk.closest('.etapa-row');
            const id  = row.getAttribute('data-id');
            const et  = _etapas.find(e => e.id === id);
            if (!et) return;
            _etapas = _etapas.map(x => x.id === id ? etapaMarcar(x, chk.checked) : x);
            renderEtapas();
        });
    });
    lista.querySelectorAll('.etapa-nome').forEach(inp => {
        inp.addEventListener('input', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.nome = inp.value;
        });
    });
    lista.querySelectorAll('.etapa-data').forEach(inp => {
        inp.addEventListener('change', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.data = inp.value;
        });
    });
    lista.querySelectorAll('.etapa-prazo').forEach(inp => {
        inp.addEventListener('change', () => {
            const id = inp.closest('.etapa-row').getAttribute('data-id');
            // prazo apagado volta para o cálculo automático
            _etapas = _etapas.map(x => x.id === id ? { ...x, prazo: inp.value, prazo_manual: !!inp.value } : x);
            procReaplicarEtapas();
            renderEtapas();
        });
    });
    lista.querySelectorAll('.etapa-resp').forEach(inp => {
        inp.addEventListener('input', () => {
            const et = _etapas.find(e => e.id === inp.closest('.etapa-row').getAttribute('data-id'));
            if (et) et.responsavel = inp.value;
        });
    });
    lista.querySelectorAll('.btn-remover-etapa').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.closest('.etapa-row').getAttribute('data-id');
            _etapas = _etapas.filter(e => e.id !== id);
            renderEtapas();
        });
    });
}

// "automática — Nº DUE …" ou "por Fulano em 21/10" embaixo do nome (etapas.js)
function _etapaOrigemHtml(e) {
    const sit = etapaSituacao(e);
    if (sit && (sit.atrasada || sit.vence)) {
        return `<small class="etapa-origem ${sit.atrasada ? 'etapa-origem--atrasada' : 'etapa-origem--vence'}"><i class="fa-solid ${sit.atrasada ? 'fa-triangle-exclamation' : 'fa-hourglass-half'}"></i> ${escHtml(etapaSituacaoTexto(e))}</small>`;
    }
    if (!e.concluida || (!e.auto && !e.por)) return '';
    const quando = e.em ? new Date(e.em).toLocaleDateString('pt-BR') : '';
    return e.auto
        ? `<small class="etapa-origem etapa-origem--auto" title="Concluída automaticamente"><i class="fa-solid fa-bolt"></i> automática — ${escHtml(e.auto)}</small>`
        : `<small class="etapa-origem"><i class="fa-solid fa-user-check"></i> por ${escHtml(e.por)}${quando ? ' em ' + quando : ''}</small>`;
}

// Conclusão automática pelo que já está no formulário: Nº de documentos,
// datas de embarque/chegada, Proforma Invoice assinada, DUE anexada.
let _procProformaAssinada = false;
function procReaplicarEtapas() {
    if (typeof etapasAplicarAutomaticas !== 'function' || !_etapas.length) return;
    const documentos = {};
    ['le', 'due', 'nfe', 'bl', 'awb', 'crt', 'micdta', 'nfremessa', 'memorando'].forEach(k => { documentos[k] = _docNumero('doc-num-' + k); });
    const nf_remessa_data = document.getElementById('proc-nf-remessa-data')?.value || null;
    const data_embarque = document.getElementById('proc-data-embarque')?.value || null;
    const data_chegada  = document.getElementById('proc-data-chegada')?.value || null;
    const r = etapasAplicarAutomaticas(_etapas, etapasContexto({
        documentos, data_embarque, data_chegada,
        proformaAssinada: _procProformaAssinada,
        dueAnexada: !!_docAnexosProcesso.due,
        memorandoAnexado: !!_docAnexosProcesso.memorando,
    }));
    // prazos pela previsão de embarque (ou embarque/chegada já realizados)
    const comPrazo = etapasCalcularPrazos(r.etapas, {
        previsao: document.getElementById('proc-data-previsao')?.value || null,
        data_embarque, data_chegada, nf_remessa_data, modal: document.getElementById('proc-modal')?.value || '',
    });
    if (r.mudou || comPrazo.some((e, i) => e !== r.etapas[i])) { _etapas = comPrazo; renderEtapas(); }
}

// ========================================
// EXPORTAÇÃO INDIRETA — trading e documentos próprios
// ========================================
function procAtualizarModoIndireta() {
    const indireta = document.getElementById('proc-tipo')?.value === 'exportacao_indireta';
    const grupo = document.getElementById('proc-trading-group');
    if (grupo) grupo.style.display = indireta ? '' : 'none';
    document.querySelectorAll('.doc-indireta-field').forEach(el => { el.style.display = indireta ? '' : 'none'; });
}

async function _procPreencherTrading(id) {
    const { data: t } = await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia, documento').eq('id', id).maybeSingle();
    const set = (sel, val) => { const el = document.getElementById(sel); if (el) el.value = val || ''; };
    set('proc-trading-id', t?.id || id);
    set('proc-trading-busca', t ? (t.razao_social || t.nome_fantasia) : '');
    set('proc-trading-doc', t?.documento ? _mascaraDocBR(t.documento) : '');
}

function iniciarAutocompleteTrading() {
    const input = document.getElementById('proc-trading-busca');
    const lista = document.getElementById('proc-trading-lista');
    if (!input || !lista) return;
    async function renderLista(termo) {
        await _acCarregarEmpresas();
        const q = (termo || '').trim().toLowerCase();
        const tradings = _acEmpresas.filter(e => e.modelo === 'trading');
        const opcoes = tradings.filter(e => !q || (e.razao_social || '').toLowerCase().includes(q)
            || (e.nome_fantasia || '').toLowerCase().includes(q) || (e.documento || '').includes(q));
        lista.innerHTML = opcoes.length
            ? opcoes.slice(0, 30).map(e => `<div class="autocomplete-item" data-id="${e.id}" data-razao="${escHtml(e.razao_social || '')}" data-doc="${escHtml(e.documento || '')}">
                    <span class="ac-nome">${escHtml(e.razao_social || '')}</span>
                    ${e.nome_fantasia ? `<span class="ac-fantasia">${escHtml(e.nome_fantasia)}</span>` : ''}</div>`).join('')
            : `<div class="autocomplete-vazio">${tradings.length ? 'Nenhuma trading encontrada' : 'Nenhuma trading cadastrada — cadastre a empresa com o modelo "Trading"'}</div>`;
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }
    input.addEventListener('input', () => {
        document.getElementById('proc-trading-id').value = '';
        document.getElementById('proc-trading-doc').value = '';
        renderLista(input.value);
    });
    input.addEventListener('focus', () => renderLista(input.value));
    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.razao;
        document.getElementById('proc-trading-id').value = item.dataset.id || '';
        document.getElementById('proc-trading-doc').value = item.dataset.doc ? _mascaraDocBR(item.dataset.doc) : '';
        lista.classList.remove('aberta');
    });
    input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('aberta'), 150));
}

function carregarEtapasPadrao(tipo, modal = document.getElementById('proc-modal')?.value || '') {
    const padrao = etapasPadrao(tipo, modal);
    if (!padrao.length) return false;
    _etapas = padrao.map(nome => ({ id: _etapaId(), nome, data: '', responsavel: '', concluida: false }));
    renderEtapas();
    procReaplicarEtapas();
    return true;
}

// Tipo ou modal mudou: lista sem andamento troca sozinha; com andamento, só
// quando o próprio usuário mudou o campo e confirmou (mudança feita pelo
// sistema ao carregar/preencher o formulário não mexe em etapas com andamento).
async function procTrocarEtapasPadrao(ev) {
    const tipo = document.getElementById('proc-tipo')?.value;
    if (!tipo) return;
    const modalEl = document.getElementById('proc-modal');
    const modalNome = modalEl?.value ? modalEl.options[modalEl.selectedIndex]?.text : '';
    const tinha = _etapas.length > 0;
    if (tinha && !etapasIntocadas(_etapas)) {
        if (!ev?.isTrusted) return;
        const ok = await confirmarAcao(
            `Trocar as etapas pela lista padrão${modalNome ? ' do modal ' + modalNome : ''}? As etapas atuais (datas, responsáveis e prazos digitados) serão substituídas — as concluídas automaticamente voltam sozinhas.`,
            { titulo: 'Trocar etapas', confirmar: 'Trocar etapas', cancelar: 'Manter as atuais' });
        if (!ok) return;
    }
    if (carregarEtapasPadrao(tipo) && tinha && ev?.isTrusted) {
        mostrarNotificacao(`Etapas atualizadas${modalNome ? ' para o modal ' + modalNome : ''}.`, 'info');
    }
}

function atualizarResumoEtapas() {
    const empresa   = document.getElementById('proc-cliente')?.value.trim()         || '—';
    const tipoEl    = document.getElementById('proc-tipo');
    const tipo      = tipoEl?.options[tipoEl.selectedIndex]?.text                   || '—';
    const origem    = document.getElementById('proc-origem-pais')?.value.trim()     || '—';
    const destino   = document.getElementById('proc-destino-pais')?.value.trim()    || '—';
    const statusEl  = document.getElementById('proc-status');
    const status    = statusEl?.options[statusEl.selectedIndex]?.text               || '—';
    const abertura  = document.getElementById('proc-data-abertura')?.value          || '';
    const container = document.getElementById('proc-container-tipo')?.value.trim()  || '—';
    const numCont   = document.getElementById('proc-container-num')?.value.trim()   || '';

    const aberturaFmt  = abertura ? new Date(abertura + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const containerFmt = container !== '—' ? container + (numCont ? ` Nº ${numCont}` : '') : '—';

    document.getElementById('resumo-et-empresa')?.   setAttribute('data-txt', empresa);
    document.getElementById('resumo-et-tipo')?.      setAttribute('data-txt', tipo === 'Selecione...' ? '—' : tipo);
    document.getElementById('resumo-et-origem')?.    setAttribute('data-txt', origem);
    document.getElementById('resumo-et-destino')?.   setAttribute('data-txt', destino);
    document.getElementById('resumo-et-status')?.    setAttribute('data-txt', status === 'Selecione...' ? '—' : status);
    document.getElementById('resumo-et-abertura')?.  setAttribute('data-txt', aberturaFmt);
    document.getElementById('resumo-et-container')?.setAttribute('data-txt', containerFmt);

    ['resumo-et-empresa','resumo-et-tipo','resumo-et-origem','resumo-et-destino',
     'resumo-et-status','resumo-et-abertura','resumo-et-container'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = el.getAttribute('data-txt') || '—';
    });
}

function iniciarEtapas() {
    ['proc-cliente','proc-origem-pais','proc-destino-pais','proc-container-tipo','proc-container-num'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', atualizarResumoEtapas);
    });
    ['proc-tipo','proc-status','proc-data-abertura'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', atualizarResumoEtapas);
    });
    document.getElementById('proc-cliente-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    document.getElementById('proc-origem-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    document.getElementById('proc-destino-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizarResumoEtapas, 50));
    atualizarResumoEtapas();

    // Nº de documento / datas mudaram: etapas automáticas acompanham
    document.addEventListener('change', ev => {
        if (ev.target?.matches?.('input[id^="doc-num-"], #proc-data-embarque, #proc-data-chegada, #proc-data-previsao, #proc-nf-remessa-data')) procReaplicarEtapas();
    });

    document.getElementById('btn-add-etapa')?.addEventListener('click', () => {
        _etapas.push({ id: _etapaId(), nome: '', data: '', responsavel: '', concluida: false });
        renderEtapas();
        const rows = document.querySelectorAll('.etapa-row');
        rows[rows.length - 1]?.querySelector('.etapa-nome')?.focus();
    });

    document.getElementById('proc-tipo')?.addEventListener('change', procTrocarEtapasPadrao);
    document.getElementById('proc-tipo')?.addEventListener('change', procAtualizarModoIndireta);
    iniciarAutocompleteTrading();
    document.getElementById('proc-modal')?.addEventListener('change', procTrocarEtapasPadrao);

    renderEtapas();
}

// ========================================
// CAMPOS DE STATUS
// ========================================

function iniciarCamposStatus() {
    const select = document.getElementById('proc-status');
    if (!select) return;

    function atualizar() {
        const status = select.value;
        document.querySelectorAll('#tab-processo [data-show-for]').forEach(el => {
            const permitidos = el.getAttribute('data-show-for').split(',');
            el.style.display = (status && permitidos.includes(status)) ? '' : 'none';
        });
    }

    select.addEventListener('change', atualizar);
    atualizar();
}

// ========================================
// EMISSOR
// ========================================

// Cache local (não depende do timing/sucesso do fetch feito lá no
// DOMContentLoaded pra window._dadosEmpresaTenant) — se aquele tiver
// falhado silenciosamente, essa função tenta buscar de novo na hora.
let _procEmpresaPropria = null;

// Nome do remetente da Proforma de origem — mostrado no campo "Remetente" quando Emissor =
// Usuário, no lugar do dropdown Identificação da Empresa. Preenchido por
// _procPreencherDaProforma().
let _procPedidoRemetenteNome = null;
async function _procCarregarEmpresaPropria() {
    if (_procEmpresaPropria) return _procEmpresaPropria;
    if (window._dadosEmpresaTenant) return (_procEmpresaPropria = window._dadosEmpresaTenant);
    try {
        const res = await window.supabaseAPI.buscarTenantEmpresa();
        if (res.sucesso) {
            _procEmpresaPropria = res.data;
        } else {
            console.warn('[Processo] buscarTenantEmpresa() não retornou sucesso:', res);
            mostrarNotificacao('Falha ao buscar dados da empresa: ' + (res.mensagem || 'erro desconhecido') + (res.empresaIdUsada ? ' (empresa_id: ' + res.empresaIdUsada + ')' : ''), 'erro');
        }
    } catch (e) {
        console.error('[Processo] erro ao buscar dados da própria empresa:', e);
        mostrarNotificacao('Erro ao buscar dados da empresa: ' + e.message, 'erro');
    }
    return _procEmpresaPropria;
}

// Endereço (Origem/Destino) do Processo a partir da empresa escolhida —
// sempre sobrescreve: trocar de empresa implica trocar de endereço.
function _procPreencherEndereco(lado, emp) {
    if (!emp) return;
    const cepDig = String(emp.cep || '').replace(/\D/g, '');
    const valores = {
        cep:         cepDig.length === 8 ? cepDig.replace(/^(\d{5})(\d{3})$/, '$1-$2') : (emp.cep || ''),
        estado:      emp.estado      || '',
        cidade:      emp.cidade      || '',
        bairro:      emp.bairro      || '',
        endereco:    emp.endereco    || '',
        numero:      emp.numero      || '',
        complemento: emp.complemento || '',
    };
    Object.entries(valores).forEach(([campo, v]) => {
        const el = document.getElementById(`proc-${lado}-${campo}`);
        if (el) el.value = v;
    });
}

function iniciarEmissor() {
    const radios      = document.querySelectorAll('input[name="proc-emissor-tipo"]');
    const grupoEmp    = document.getElementById('proc-emissor-empresa-group');
    const docInput    = document.getElementById('proc-documento');
    const origemPais  = document.getElementById('proc-origem-pais');

    // e.isTrusted = troca feita pelo usuário (clique). Na carga/edição a troca é
    // programática e não pode apagar o endereço já salvo.
    async function atualizar(e) {
        const trocaManual = !!e?.isTrusted;
        const val = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;

        document.querySelectorAll('.emissor-opcao').forEach(l => l.classList.remove('ativo'));
        document.querySelector('input[name="proc-emissor-tipo"]:checked')
            ?.closest('.emissor-opcao')?.classList.add('ativo');

        const grupoTipoDoc     = document.getElementById('proc-documento-tipo-group');
        const grupoPedidoRem   = document.getElementById('proc-emissor-pedido-remetente-group');

        // Formulário abre sem emissor escolhido: nada é preenchido até o usuário escolher
        if (!val) {
            if (grupoEmp)       grupoEmp.style.display       = 'none';
            if (grupoTipoDoc)   grupoTipoDoc.style.display   = '';
            if (grupoPedidoRem) grupoPedidoRem.style.display = '';
            const remEl = document.getElementById('proc-emissor-pedido-remetente');
            if (remEl) { remEl.value = ''; remEl.placeholder = 'Selecione o emissor'; }
            if (docInput) { docInput.readOnly = true; docInput.placeholder = 'Selecione o emissor'; }
            atualizarResumoProcesso();
            return;
        }
        document.getElementById('proc-emissor-pedido-remetente')?.setAttribute('placeholder', 'Exportador');

        if (val === 'usuario') {
            if (grupoEmp)      grupoEmp.style.display      = 'none';
            if (grupoTipoDoc)  grupoTipoDoc.style.display  = '';
            if (grupoPedidoRem) grupoPedidoRem.style.display = '';
            const remetentePedidoEl = document.getElementById('proc-emissor-pedido-remetente');
            if (remetentePedidoEl) remetentePedidoEl.value = _procPedidoRemetenteNome || '';
            const emp = await _procCarregarEmpresaPropria();
            if (docInput) {
                docInput.readOnly    = false;
                docInput.placeholder = 'Informe o CNPJ / CPF';
                if (!docInput.value) docInput.value = emp?.cnpj || '';
            }
            if (origemPais) {
                origemPais.readOnly    = false;
                origemPais.placeholder = 'Selecione o país de origem';
                if (!origemPais.value) await _preencherPaisPorPrefixo('proc-origem', 'Brasil');
            }
            // Endereço de Origem = endereço registrado da própria empresa
            const _setSeVazio = (id, val) => { const el = document.getElementById(id); if (el && (trocaManual || !el.value)) el.value = val || ''; };
            _setSeVazio('proc-origem-cep',         emp?.cep);
            _setSeVazio('proc-origem-estado',      emp?.estado);
            _setSeVazio('proc-origem-cidade',      emp?.cidade);
            _setSeVazio('proc-origem-endereco',    emp?.endereco);
            _setSeVazio('proc-origem-numero',      emp?.numero);
            _setSeVazio('proc-origem-complemento', emp?.complemento);
        } else {
            if (grupoEmp)      grupoEmp.style.display      = '';
            if (grupoTipoDoc)  grupoTipoDoc.style.display  = '';
            if (grupoPedidoRem) grupoPedidoRem.style.display = 'none';
            if (docInput) {
                docInput.readOnly    = true;
                docInput.placeholder = 'Preenchido automaticamente';
                docInput.value       = '';
            }
            if (origemPais) {
                origemPais.readOnly    = true;
                origemPais.placeholder = 'Preenchido automaticamente';
            }
        }

        _procSincronizarTipoDoc();
        atualizarResumoProcesso();
    }

    radios.forEach(r => r.addEventListener('change', atualizar));
    docInput?.addEventListener('input', _procSincronizarTipoDoc);
    atualizar();
}

// Identificação da Empresa (CNPJ/CPF) do Processo: automática e só leitura —
// sempre deduzida do Número de Identificação preenchido (mesma regra da Proforma).
function _procSincronizarTipoDoc() {
    const tipoEl = document.getElementById('proc-documento-tipo');
    const digitos = (document.getElementById('proc-documento')?.value || '').replace(/\D/g, '');
    if (tipoEl && digitos) tipoEl.value = _tipoDocBR(digitos);
}

// ========================================
// CAMPOS EXTRAS POR MODAL
// ========================================

function iniciarCamposModal() {
    const select = document.getElementById('proc-modal');
    if (!select) return;

    const grupos = {
        maritimo:  ['proc-navio-group', 'proc-porto-origem-group', 'proc-porto-destino-group'],
        aereo:     ['proc-aeronave-group', 'proc-aeroporto-origem-group', 'proc-aeroporto-destino-group'],
        terrestre: ['proc-fronteira-saida-group', 'proc-fronteira-entrada-group'],
    };

    const todosGrupos = [
        'proc-navio-group', 'proc-porto-origem-group', 'proc-porto-destino-group',
        'proc-aeronave-group', 'proc-aeroporto-origem-group', 'proc-aeroporto-destino-group',
        'proc-fronteira-saida-group', 'proc-fronteira-entrada-group',
    ];

    function atualizar() {
        todosGrupos.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        const ids = grupos[select.value] || [];
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = '';
        });

        // Campos de documentos por modal
        document.querySelectorAll('.doc-modal-field').forEach(el => {
            el.style.display = el.dataset.docModal === select.value ? '' : 'none';
        });

        // Limpa intermediários ao trocar modal
        limparIntermediarios();
    }

    select.addEventListener('change', atualizar);
    atualizar();
}

// ========================================
// ROTA INTERMEDIÁRIA
// ========================================

let _intermediarios = [];

const _INTERMEDIARIO_CONFIG = {
    porto:      { label: 'Porto Intermediário',              placeholder: 'Ex: Algeciras, Singapura...' },
    aeroporto:  { label: 'Aeroporto Intermediário',          placeholder: 'Ex: LIS, DXB...' },
    fronteira:  { label: 'Aduana / Fronteira Intermediária', placeholder: 'Ex: Encarnación...' },
};

function adicionarIntermediario(tipo) {
    const cfg     = _INTERMEDIARIO_CONFIG[tipo];
    if (!cfg) return;
    const id      = 'inter-' + tipo + '-' + Date.now();
    _intermediarios.push({ id, tipo, valor: '' });
    _renderIntermediarios();
}

function _renderIntermediarios() {
    const wrapper = document.getElementById('rota-intermediarios');
    const lista   = document.getElementById('rota-intermediarios-lista');
    if (!wrapper || !lista) return;

    if (_intermediarios.length === 0) {
        wrapper.style.display = 'none';
        lista.innerHTML = '';
        return;
    }

    wrapper.style.display = '';
    lista.innerHTML = _intermediarios.map((item, idx) => {
        const cfg = _INTERMEDIARIO_CONFIG[item.tipo];
        return `
        <div class="rota-intermediario-item" data-id="${item.id}">
            <div class="rota-intermediario-header">
                <span class="rota-inter-label"><i class="fa-solid fa-arrow-right-arrow-left"></i> ${cfg.label} ${_intermediarios.filter(i => i.tipo === item.tipo).indexOf(item) + 1}</span>
                <button type="button" class="rota-inter-remove" onclick="removerIntermediario('${item.id}')" title="Remover">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>
            <input type="text" name="${escHtml(item.tipo)}_intermediario_${idx}" placeholder="${cfg.placeholder}" class="rota-inter-input" data-id="${item.id}" value="${escHtml(item.valor || '')}">
        </div>`;
    }).join('');

    lista.querySelectorAll('.rota-inter-input').forEach(inp => {
        inp.addEventListener('input', () => {
            const it = _intermediarios.find(i => i.id === inp.getAttribute('data-id'));
            if (it) it.valor = inp.value;
        });
    });
}

function removerIntermediario(id) {
    _intermediarios = _intermediarios.filter(i => i.id !== id);
    _renderIntermediarios();
}

function limparIntermediarios() {
    _intermediarios = [];
    _renderIntermediarios();
}

function coletarIntermediarios() {
    return _intermediarios.map(i => ({ id: i.id, tipo: i.tipo, valor: i.valor || '' }));
}

function restaurarIntermediarios(lista) {
    _intermediarios = (lista || []).map(i => ({ id: i.id || ('inter-' + i.tipo + '-' + Date.now() + Math.random()), tipo: i.tipo, valor: i.valor || '' }));
    _renderIntermediarios();
}

function atualizarResumoProcesso() {
    const fn = window._atualizarResumoProcessoFn;
    if (fn) fn();
}

// ========================================
// RESUMO DO PROCESSO (linha superior)
// ========================================

function iniciarResumoProcesso() {
    function atualizar() {
        const emissorTipo = document.querySelector('input[name="proc-emissor-tipo"]:checked')?.value;
        let empresa;
        if (emissorTipo === 'usuario') {
            empresa = window._usuarioLogado?.nome || 'Usuário';
        } else {
            empresa = document.getElementById('proc-cliente')?.value.trim() || '—';
        }

        const tipoEl      = document.getElementById('proc-tipo');
        const tipo        = tipoEl?.options[tipoEl.selectedIndex]?.text                || '—';
        const origem      = document.getElementById('proc-origem-pais')?.value.trim()  || '—';
        const destino     = document.getElementById('proc-destino-pais')?.value.trim() || '—';
        const incoterm    = document.getElementById('proc-incoterm')?.value            || '—';
        const modalEl     = document.getElementById('proc-modal');
        const modal       = modalEl?.options[modalEl.selectedIndex]?.text              || '—';
        const statusEl    = document.getElementById('proc-status');
        const status      = statusEl?.options[statusEl.selectedIndex]?.text            || '—';
        const empDestBusca= document.getElementById('proc-emp-dest-busca')?.value.trim();
        const empDestRazao= document.getElementById('proc-emp-dest-razao')?.value.trim();
        const empDestino  = empDestBusca || empDestRazao || '—';

        document.getElementById('resumo-empresa')     && (document.getElementById('resumo-empresa').textContent     = empresa);
        document.getElementById('resumo-tipo')        && (document.getElementById('resumo-tipo').textContent        = tipo === 'Selecione...' ? '—' : tipo);
        document.getElementById('resumo-emp-destino') && (document.getElementById('resumo-emp-destino').textContent = empDestino);
        document.getElementById('resumo-origem')      && (document.getElementById('resumo-origem').textContent      = origem);
        document.getElementById('resumo-destino')     && (document.getElementById('resumo-destino').textContent     = destino);
        document.getElementById('resumo-incoterm')    && (document.getElementById('resumo-incoterm').textContent    = incoterm === '' ? '—' : incoterm);
        document.getElementById('resumo-modal')       && (document.getElementById('resumo-modal').textContent       = modal === 'Selecione...' ? '—' : modal);
        document.getElementById('resumo-status')      && (document.getElementById('resumo-status').textContent      = status === 'Selecione...' ? '—' : status);
    }

    window._atualizarResumoProcessoFn = atualizar;

    document.querySelectorAll('input[name="proc-emissor-tipo"]').forEach(r => r.addEventListener('change', atualizar));
    document.getElementById('proc-cliente')?.addEventListener('input', atualizar);
    document.getElementById('proc-tipo')?.addEventListener('change', atualizar);
    document.getElementById('proc-origem-pais')?.addEventListener('input', atualizar);
    document.getElementById('proc-destino-pais')?.addEventListener('input', atualizar);
    document.getElementById('proc-incoterm')?.addEventListener('change', atualizar);
    document.getElementById('proc-modal')?.addEventListener('change', atualizar);
    document.getElementById('proc-status')?.addEventListener('change', atualizar);
    document.getElementById('proc-emp-dest-busca')?.addEventListener('input', atualizar);
    document.getElementById('proc-emp-dest-razao')?.addEventListener('input', atualizar);
    document.getElementById('proc-emp-dest-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-cliente-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-origem-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
    document.getElementById('proc-destino-pais-lista')?.addEventListener('mousedown', () => setTimeout(atualizar, 50));
}

// ========================================
// AUTOCOMPLETE — CLIENTE/EMPRESA (PROCESSO)
// ========================================

function iniciarAutocompleteProcCliente() {
    const input    = document.getElementById('proc-cliente');
    const lista    = document.getElementById('proc-cliente-lista');
    const idOculto = document.getElementById('proc-cliente-id');
    if (!input || !lista || !idOculto) return;

    input.addEventListener('focus', async () => {
        await _acCarregarEmpresas();
        _acMostrar(input, lista, input.value);
    });

    input.addEventListener('input', () => {
        idOculto.value = '';
        _acMostrar(input, lista, input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        const empresa = _acEmpresas.find(x => String(x.id) === String(item.getAttribute('data-id')));
        input.value    = item.getAttribute('data-nome');
        idOculto.value = item.getAttribute('data-id');

        if (empresa) {
            const origemPais = document.getElementById('proc-origem-pais');
            const documento  = document.getElementById('proc-documento');
            const chkPais    = document.getElementById('proc-origem-pais-editar');

            if (origemPais) { origemPais.value = empresa.pais || ''; origemPais.readOnly = true; }
            if (documento)    documento.value   = empresa.documento || '';
            _procSincronizarTipoDoc();
            _procPreencherEndereco('origem', empresa);
            if (chkPais)      chkPais.checked   = false;
        }

        _acFechar(lista);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// AUTOCOMPLETE — CÓDIGO DA PROFORMA (PROCESSO)
// ========================================

let _acPropostas = [];

async function _acCarregarPropostas() {
    if (_acPropostas.length > 0) return;
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient.from('proformas').select('id, codigo').neq('status', 'excluido').order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data } = await query;
        _acPropostas = (data || []).map(p => ({ id: p.id, nome: p.codigo, label: p.codigo }));
    } catch { _acPropostas = []; }
}

async function _procPreencherDaProforma(id) {
    if (!id) return;
    try {
        const { data, error } = await supabaseClient.from('proformas').select('*').eq('id', id).single();
        if (error || !data) return;

        // Remetente da Proforma de origem (mostrado no campo "Remetente"
        // quando Emissor = Usuário — ver iniciarEmissor()). Se a proforma não
        // tem remetente terceiro, o remetente é a própria empresa do tenant.
        _procPedidoRemetenteNome = data.emissor_tipo === 'terceiro'
            ? (data.parceiro_razao_social || null)
            : 'Própria empresa';
        const remetentePedidoEl = document.getElementById('proc-emissor-pedido-remetente');
        if (remetentePedidoEl) remetentePedidoEl.value = _procPedidoRemetenteNome || '';

        // Carrega anexos já existentes pra proforma (podem vir de outro
        // processo dela, ou de uma assinatura feita direto na tela Documentos).
        _docLimparAnexosVisuais();
        await _docCarregarAnexosProcesso(id, document.getElementById('proc-id')?.value || null);

        // Produtos do Processo começam com o SALDO da Proforma (o que ainda não
        // foi para outros processos dela — embarque parcial). Editáveis, mas
        // não podem passar do saldo (validado ao salvar).
        const procIdAtual = document.getElementById('proc-id')?.value || null;
        _procSaldo = await window.supabaseAPI.buscarSaldoProforma(id, procIdAtual);
        _procExcluirDaProforma = new Set();
        if (Array.isArray(data.itens) && data.itens.length > 0) {
            await Promise.all([_carregarMoedas(), _carregarUnidades()]);
            // O saldo é por produto; divide entre as linhas da Proforma na ordem
            // (antes cada linha recebia o saldo inteiro do produto — com 2 linhas
            // do mesmo produto, uma só já levava tudo).
            const resta = {};
            Object.values(_procSaldo.itens).forEach(s => { resta[s.chave] = s.saldo; });
            _procItens = _itensNormalizar(data.itens)
                .map(it => {
                    const k = chaveItemProforma(it);
                    if (!(k in resta)) return it;
                    const qtd = Math.min(Number(it.qtd) || 0, resta[k]);
                    resta[k] -= qtd;
                    return { ...it, qtd };
                })
                .filter(it => it.qtd > 0);
            itensRenderizar('proc');
            if (!_procItens.length) mostrarNotificacao('Todos os produtos desta proforma já estão em outros processos.', 'warning');
        }

        // Tipo
        const tipoEl = document.getElementById('proc-tipo');
        if (tipoEl && data.tipo) { tipoEl.value = data.tipo; tipoEl.dispatchEvent(new Event('change')); }

        // Propósito
        const propositoEl = document.getElementById('proc-proposito');
        if (propositoEl && data.proposito) propositoEl.value = data.proposito;

        // Modal primeiro (libera o Incoterm), depois o Incoterm — mesma ordem da tela
        const modalEl = document.getElementById('proc-modal');
        if (modalEl && data.modal) {
            modalEl.value = data.modal;
            modalEl.dispatchEvent(new Event('change'));
        }
        const incotermEl = document.getElementById('proc-incoterm');
        if (incotermEl && data.incoterm) {
            incotermEl.value = data.incoterm;
            incotermEl.dispatchEvent(new Event('change'));
        }

        // Previsão de embarque da Proforma (base dos prazos das etapas)
        const previsaoEl = document.getElementById('proc-data-previsao');
        if (previsaoEl && !previsaoEl.value && data.previsao_embarque) { previsaoEl.value = data.previsao_embarque; procReaplicarEtapas(); }

        // País de Origem / Destino
        const origemEl = document.getElementById('proc-origem-pais');
        if (origemEl && data.origem_pais) origemEl.value = data.origem_pais;
        const destinoEl = document.getElementById('proc-destino-pais');
        if (destinoEl && data.destino_pais) destinoEl.value = data.destino_pais;

        // Campos específicos por modal (porto, aeroporto, fronteira)
        const _set = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
        _set('proc-porto-origem',     data.porto_origem);
        _set('proc-porto-destino',    data.porto_destino);
        _set('proc-aeroporto-origem', data.aeroporto_origem);
        _set('proc-aeroporto-destino',data.aeroporto_destino);
        _set('proc-fronteira-saida',  data.fronteira_saida);
        _set('proc-fronteira-entrada',data.fronteira_entrada);

        // Emissor / parceiro (terceiro) — parceiro_id referencia "parceiros" (bigint),
        // não uma tabela "empresas_cadastradas" (que nem existe ao vivo).
        if (data.emissor_tipo !== 'terceiro') {
            const radioUsuario = document.getElementById('proc-emissor-usuario');
            if (radioUsuario && !radioUsuario.checked) {
                radioUsuario.checked = true;
                radioUsuario.dispatchEvent(new Event('change'));
            }
            const docEl = document.getElementById('proc-documento');
            if (docEl && data.documento) { docEl.value = data.documento; _procSincronizarTipoDoc(); }
        }
        if (data.emissor_tipo === 'terceiro' && data.parceiro_id) {
            const radioTerceiro = document.getElementById('proc-emissor-terceiro');
            if (radioTerceiro) {
                radioTerceiro.checked = true;
                radioTerceiro.dispatchEvent(new Event('change'));
            }
            const { data: emp } = await supabaseClient.from('parceiros')
                .select('id, razao_social, nome_fantasia, documento, cep, estado, cidade, bairro, endereco, numero, complemento')
                .eq('id', data.parceiro_id).single();
            if (emp) {
                const clienteEl = document.getElementById('proc-cliente');
                const clienteIdEl = document.getElementById('proc-cliente-id');
                if (clienteEl) clienteEl.value = emp.nome_fantasia || emp.razao_social;
                if (clienteIdEl) clienteIdEl.value = emp.id;
                const docEl = document.getElementById('proc-documento');
                if (docEl) docEl.value = emp.documento || data.documento || '';
                _procSincronizarTipoDoc();
                _procPreencherEndereco('origem', emp);
            }
        }

        // Destinatário — endereço registrado do parceiro de destino da proforma
        // (destinatario_id também referencia "parceiros"). Preenche o mesmo
        // endereço completo já cadastrado, em vez de deixar em branco.
        // Exportação indireta: a destinatária da Proforma é a trading (exportadora);
        // o importador do Processo é o importador final da Proforma.
        const indireta = data.tipo === 'exportacao_indireta';
        if (indireta && data.destinatario_id) await _procPreencherTrading(data.destinatario_id);
        const destinoId = indireta ? data.importador_final_id : data.destinatario_id;
        if (destinoId) {
            const { data: destParceiro } = await supabaseClient
                .from('parceiros')
                .select('id, razao_social, nome_fantasia, documento, codigo, cep, estado, cidade, bairro, endereco, numero, complemento')
                .eq('id', destinoId).single();
            if (destParceiro) {
                const buscaEl = document.getElementById('proc-emp-dest-busca');
                const idEl    = document.getElementById('proc-emp-dest-id');
                if (buscaEl) buscaEl.value = destParceiro.nome_fantasia || destParceiro.razao_social || '';
                if (idEl)    idEl.value    = destParceiro.id;
                const autoDoc = document.getElementById('proc-emp-dest-auto-doc');
                const autoId  = document.getElementById('proc-emp-dest-auto-id');
                if (autoDoc) autoDoc.value = destParceiro.documento || '';
                if (autoId)  autoId.value  = destParceiro.codigo || '';

                _procPreencherEndereco('destino', destParceiro);
            }
        } else if (!indireta && data.destinatario_razao_social) {
            // Proforma nasceu de um Pedido em modo texto-livre (sem destinatario_id) — só o nome
            const buscaEl = document.getElementById('proc-emp-dest-busca');
            if (buscaEl) buscaEl.value = data.destinatario_razao_social;
        }
    } catch { /* silêncio */ }
}

async function procBuscarCep(input, prefixo) {
    _cepMascara(input);
    const cep = input.value.replace(/\D/g, '');
    if (cep.length !== 8) return;

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    try {
        const res  = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await res.json();
        if (data.erro) return;

        set(`proc-${prefixo}-estado`,   data.uf);
        set(`proc-${prefixo}-cidade`,   data.localidade);
        set(`proc-${prefixo}-bairro`,   data.bairro);
        set(`proc-${prefixo}-endereco`, data.logradouro);
        document.getElementById(`proc-${prefixo}-numero`)?.focus();
    } catch { /* CEP inválido ou sem conexão */ }
}

// ========================================
// ENDEREÇO DE COLETA — ORIGEM
// ========================================

function procToggleColetaOrigem(mesmo) {
    const campos  = document.getElementById('proc-origem-coleta-campos');
    const resumo  = document.getElementById('proc-origem-coleta-resumo');
    if (!campos || !resumo) return;

    if (mesmo) {
        const end  = document.getElementById('proc-origem-endereco')?.value   || '';
        const num  = document.getElementById('proc-origem-numero')?.value      || '';
        const comp = document.getElementById('proc-origem-complemento')?.value || '';
        const bai  = document.getElementById('proc-origem-bairro')?.value      || '';
        const cid  = document.getElementById('proc-origem-cidade')?.value      || '';
        resumo.value = [end, num, comp, bai, cid].filter(Boolean).join(', ');
        campos.style.display  = 'none';
        resumo.style.display  = '';
    } else {
        campos.style.display = '';
        resumo.style.display = 'none';
        resumo.value = '';
    }
}


function iniciarAutocompleteProcCodProposta() {
    const input    = document.getElementById('proc-codigo');
    const lista    = document.getElementById('proc-codigo-lista');
    const idOculto = document.getElementById('proc-proposta-id');
    if (!input || !lista) return;

    input.addEventListener('focus', async () => {
        await _acCarregarPropostas();
        _acMostrarProformas(input, lista, input.value);
    });

    input.addEventListener('input', () => {
        if (idOculto) idOculto.value = '';
        _acMostrarProformas(input, lista, input.value);
    });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.getAttribute('data-nome');
        const selId = item.getAttribute('data-id');
        if (idOculto) idOculto.value = selId;
        _acFechar(lista);
        _procPreencherDaProforma(selId);
    });

    document.addEventListener('click', e => {
        if (!e.target.closest('.autocomplete-wrapper')) _acFechar(lista);
    });
}

// ========================================
// DOCUMENTOS DO PROCESSO
// ========================================

const DOCS_POR_MODAL = {
    maritimo: [
        'BL (Bill of Lading)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'Certificado Fitossanitário',
        'Apólice de Seguro',
    ],
    aereo: [
        'AWB (Air Waybill)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'Certificado Fitossanitário',
        'Apólice de Seguro',
    ],
    terrestre: [
        'CTR (Conhecimento de Transporte Rodoviário)',
        'Fatura Comercial (Commercial Invoice)',
        'Packing List',
        'Certificado de Origem',
        'DUE (Declaração Única de Exportação)',
        'CIOT',
    ],
};

let _docs = [];

function iniciarDocs() {
    // Atualiza resumo incoterm|modal na seção de documentos
    function atualizarResumo() {
        const incoterm = document.getElementById('proc-incoterm')?.value || '—';
        const modalEl  = document.getElementById('proc-modal');
        const modal    = modalEl?.options[modalEl.selectedIndex]?.text || '—';
        const el = document.getElementById('resumo-docs');
        if (el) el.textContent = `${incoterm === '' ? '—' : incoterm}  |  ${modal === 'Selecione...' ? '—' : modal}`;
    }

    document.getElementById('proc-incoterm')?.addEventListener('change', atualizarResumo);
    document.getElementById('proc-modal')?.addEventListener('change', atualizarResumo);
    atualizarResumo();
}

// ========================================
// EMPRESA DE DESTINO
// ========================================

function iniciarAutocompleteEmpresaDestino() {
    const input  = document.getElementById('proc-emp-dest-busca');
    const lista  = document.getElementById('proc-emp-dest-lista');
    const idInput= document.getElementById('proc-emp-dest-id');
    if (!input || !lista) return;

    async function renderLista(termo) {
        await _acCarregarEmpresas();
        const q = (termo || '').trim().toLowerCase();
        const filtradas = q
            ? _acEmpresas.filter(e =>
                (e.razao_social  || '').toLowerCase().includes(q) ||
                (e.nome_fantasia || '').toLowerCase().includes(q) ||
                (e.documento     || '').includes(q))
            : _acEmpresas;

        if (filtradas.length === 0) {
            lista.innerHTML = '<div class="autocomplete-vazio">Nenhuma empresa encontrada</div>';
        } else {
            lista.innerHTML = filtradas.slice(0, 30).map(e => `
                <div class="autocomplete-item"
                     data-id="${e.id}"
                     data-razao="${escHtml(e.razao_social  || '')}"
                     data-fantasia="${escHtml(e.nome_fantasia || '')}"
                     data-doc="${escHtml(e.documento || '')}"
                     data-idint="${escHtml(e.codigo || '')}">
                    <span class="ac-nome">${escHtml(e.razao_social || '')}</span>
                    ${e.nome_fantasia ? `<span class="ac-fantasia">${escHtml(e.nome_fantasia)}</span>` : ''}
                </div>`).join('');
        }
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    function validarDocDestino(docDestino) {
        const docOrigem = (document.getElementById('proc-documento')?.value || '').replace(/\D/g, '');
        const docDest   = (docDestino || '').replace(/\D/g, '');
        const avisoEl   = document.getElementById('emp-dest-aviso-mesmo-cnpj');
        if (!avisoEl) return false;
        const igual = docDest && docOrigem && docDest === docOrigem;
        avisoEl.style.display = igual ? '' : 'none';
        return igual;
    }

    function preencherCamposAuto(item) {
        const doc   = item.dataset.doc   || '';
        const idInt = item.dataset.idint || '';

        const docEl   = document.getElementById('proc-emp-dest-auto-doc');
        const idEl    = document.getElementById('proc-emp-dest-auto-id');
        const docGrp  = document.getElementById('emp-dest-auto-doc-group');
        const idGrp   = document.getElementById('emp-dest-auto-id-group');

        if (docEl) docEl.value = doc;
        if (idEl) idEl.value = idInt;
        // Transporte "Própria do Cliente": a coleta é do Importador escolhido
        if (document.getElementById('transp-tipo')?.value === 'propria') setTimeout(() => window._transpAplicarPropriaCliente?.(), 0);

        if (validarDocDestino(doc)) {
            input.value = '';
            if (idInput) idInput.value = '';
            if (docEl) docEl.value = '';
            if (idEl) idEl.value = '';
        }
    }

    function limparCamposAuto() {
        ['proc-emp-dest-auto-doc', 'proc-emp-dest-auto-id'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    }

    input.addEventListener('input', () => { renderLista(input.value); limparCamposAuto(); });
    input.addEventListener('focus', () => renderLista(input.value));

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.razao;
        if (idInput) idInput.value = item.dataset.id || '';
        lista.classList.remove('aberta');
        preencherCamposAuto(item);
        _procPreencherEndereco('destino', _acEmpresas.find(x => String(x.id) === String(item.dataset.id)));
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });

    input.addEventListener('blur', () => setTimeout(() => lista.classList.remove('aberta'), 150));

    // Máscara no campo manual
    const docInput  = document.getElementById('proc-emp-dest-doc');
    const docTipo   = document.getElementById('proc-emp-dest-doc-tipo');
    if (docInput && docTipo) {
        function mascararEmpDest(valor, tipo) {
            valor = valor.replace(/\D/g, '');
            if (tipo === 'cpf') {
                valor = valor.slice(0,11);
                valor = valor.replace(/^(\d{3})(\d)/,'$1.$2');
                valor = valor.replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3');
                valor = valor.replace(/\.(\d{3})(\d)/,'.$1-$2');
            } else {
                valor = valor.slice(0,14);
                valor = valor.replace(/^(\d{2})(\d)/,'$1.$2');
                valor = valor.replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3');
                valor = valor.replace(/\.(\d{3})(\d)/,'.$1/$2');
                valor = valor.replace(/(\d{4})(\d)/,'$1-$2');
            }
            return valor;
        }
        docTipo.addEventListener('change', () => {
            docInput.value = '';
            docInput.placeholder = docTipo.value === 'cpf' ? '000.000.000-00' : '00.000.000/0001-00';
            docInput.maxLength   = docTipo.value === 'cpf' ? 14 : 18;
        });
        docInput.addEventListener('input', () => {
            docInput.value = mascararEmpDest(docInput.value, docTipo.value);
            validarDocDestino(docInput.value);
        });
    }
}

// ========================================
// DESTINO — PAÍS + CEP AUTOMÁTICO
// ========================================

function iniciarAutocompleteDestinoPais() {
    const input  = document.getElementById('proc-destino-pais');
    const lista  = document.getElementById('proc-destino-pais-lista');
    const codigo = document.getElementById('proc-destino-pais-codigo');
    if (!input || !lista) return;

    const BRASIL_VALS = ['brasil', 'brazil', 'br'];

    function isBrasil() {
        return BRASIL_VALS.includes(input.value.trim().toLowerCase());
    }

    function atualizarCEP() {
        if (!isBrasil()) {
            const cepEl = document.getElementById('proc-destino-cep');
            if (cepEl) { cepEl.value = ''; cepEl.style.borderColor = ''; }
            _destinoCepMsg('');
        }
    }

    async function renderLista(termo) {
        await _acCarregarPaises();
        const q = (termo || '').trim().toLowerCase();
        const filtradas = q
            ? _acPaises.filter(p => p.descricao.toLowerCase().includes(q))
            : _acPaises;
        if (filtradas.length === 0) {
            lista.innerHTML = '<div class="autocomplete-vazio">Nenhum país encontrado</div>';
        } else {
            lista.innerHTML = filtradas.slice(0, 30).map(p => `
                <div class="autocomplete-item" data-nome="${escHtml(p.descricao)}" data-codigo="${escHtml(p.codigo || '')}">
                    <span class="ac-nome">${escHtml(p.descricao)}</span>
                </div>`).join('');
        }
        _acPosicionar(input, lista);
        lista.classList.add('aberta');
    }

    input.addEventListener('input', () => renderLista(input.value));
    input.addEventListener('focus', () => { if (input.value.length >= 0) renderLista(input.value); });

    lista.addEventListener('mousedown', e => {
        const item = e.target.closest('.autocomplete-item');
        if (!item) return;
        input.value = item.dataset.nome;
        if (codigo) codigo.value = item.dataset.codigo || '';
        lista.classList.remove('aberta');
        atualizarCEP();
    });

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) lista.classList.remove('aberta');
    });

    input.addEventListener('change', atualizarCEP);
    input.addEventListener('blur', () => {
        setTimeout(() => lista.classList.remove('aberta'), 150);
        atualizarCEP();
    });
}

function _destinoCepMsg(msg, cor) {
    let small = document.getElementById('destino-cep-msg');
    if (!small) {
        small = document.createElement('small');
        small.id = 'destino-cep-msg';
        small.style.cssText = 'display:block; margin-top:4px; font-size:12px;';
        document.getElementById('proc-destino-cep')?.parentElement?.appendChild(small);
    }
    small.innerHTML   = msg;
    small.style.color = cor || '#64748b';
}

function iniciarCEPDestino() {
    const cepInput = document.getElementById('proc-destino-cep');
    if (!cepInput) return;

    cepInput.maxLength   = 9;
    cepInput.placeholder = '00000-000';

    cepInput.addEventListener('input', () => {
        let v = cepInput.value.replace(/\D/g, '').slice(0, 8);
        if (v.length > 5) v = v.slice(0, 5) + '-' + v.slice(5);
        cepInput.value = v;
        _destinoCepMsg('');
        cepInput.style.borderColor = '';
    });

    cepInput.addEventListener('blur', async () => {
        const cep = cepInput.value.replace(/\D/g, '');
        if (cep.length !== 8) {
            if (cep.length > 0) _destinoCepMsg('<i class="fa-solid fa-triangle-exclamation"></i> CEP deve conter 8 dígitos.', '#f59e0b');
            return;
        }

        _destinoCepMsg('<i class="fa-solid fa-spinner fa-spin"></i> Buscando endereço...', '#4776ec');
        cepInput.style.borderColor = '#4776ec';
        cepInput.disabled = true;

        try {
            const res   = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const dados = await res.json();

            if (dados.erro) {
                _destinoCepMsg('<i class="fa-solid fa-circle-xmark"></i> CEP não encontrado.', '#dc2626');
                cepInput.style.borderColor = '#dc2626';
            } else {
                const map = {
                    'proc-destino-estado':      dados.uf          || '',
                    'proc-destino-cidade':      dados.localidade  || '',
                    'proc-destino-bairro':      dados.bairro      || '',
                    'proc-destino-endereco':    dados.logradouro  || '',
                    'proc-destino-complemento': dados.complemento || '',
                };
                Object.entries(map).forEach(([id, val]) => {
                    const el = document.getElementById(id);
                    if (el && !el.value) el.value = val;
                });
                cepInput.style.borderColor = '#22C55E';
                _destinoCepMsg('<i class="fa-solid fa-circle-check"></i> Endereço preenchido automaticamente.', '#16a34a');
            }
        } catch {
            _destinoCepMsg('<i class="fa-solid fa-circle-xmark"></i> Erro ao buscar CEP. Verifique sua conexão.', '#dc2626');
            cepInput.style.borderColor = '#dc2626';
        } finally {
            cepInput.disabled = false;
        }
    });
}

// ========================================
// DOCUMENTOS — UPLOAD / VER / EXCLUIR
// ========================================
// Anexo real (Supabase Storage), gravado na mesma tabela proforma_documentos
// que a tela Documentos usa pra assinatura — anexar aqui já deixa o
// documento pronto pra ser assinado lá, sem precisar subir o arquivo de
// novo. Ver [[project_documentos_processo_anexo_unificado]] na memória.
const BUCKET_DOC_PROFORMA = 'proforma-documentos-assinados';
let _docAnexosProcesso = {}; // tipoId -> { path, nome }

function _docProformaIdAtual() {
    return document.getElementById('proc-proposta-id')?.value || null;
}

// Com arquivo anexado (upload ou gerado pelo sistema), o campo "Nº ..." mostra
// o nome do arquivo (somente leitura). O número digitado continua guardado em
// data-numero e é ele que vai pro banco (_docNumero) — removendo o anexo, o
// campo volta a mostrar o número e fica editável.
function _docAtualizarCampoVisual(id, nomeArquivo) {
    const span = document.getElementById('doc-filename-' + id);
    if (span) { span.innerHTML = ''; span.classList.remove('doc-filename-ativo'); }
    const input = document.getElementById('doc-num-' + id);
    if (input) {
        if (nomeArquivo) {
            if (!input.dataset.anexo) input.dataset.numero = input.value.trim();
            input.dataset.anexo = '1';
            input.value    = nomeArquivo;
            input.readOnly = true;
            input.title    = `Arquivo anexado: ${nomeArquivo}${input.dataset.numero ? ` — Nº ${input.dataset.numero}` : ''}`;
            input.classList.add('doc-input-anexo');
        } else if (input.dataset.anexo) {
            input.value    = input.dataset.numero || '';
            input.readOnly = false;
            input.title    = '';
            delete input.dataset.anexo;
            delete input.dataset.numero;
            input.classList.remove('doc-input-anexo');
        }
    }
    const campo = document.getElementById('doc-file-' + id)?.closest('.doc-campo');
    campo?.querySelector('.doc-btn-ver')?.classList.toggle('ativo', !!nomeArquivo);
    campo?.querySelector('.doc-btn-del')?.classList.toggle('ativo', !!nomeArquivo);
}

// Carrega os anexos já existentes pra proforma (podem ter vindo de outro
// processo dela, ou de uma assinatura feita direto na tela Documentos) —
// chamado ao editar um processo e ao selecionar a Proforma de origem num
// processo novo.
// Os documentos de embarque são deste Processo (processo_id);
// só a Proforma Invoice é da Proforma toda (doc-tipos.js → DOC_TIPOS_POR_PROCESSO).
function _docProcessoAtual() { return document.getElementById('proc-id')?.value || null; }

async function _docCarregarAnexosProcesso(proformaId, processoId = null) {
    _docAnexosProcesso = {};
    _procProformaAssinada = false;
    if (!proformaId) return;
    const [res, { count }] = await Promise.all([
        window.supabaseAPI.buscarDocumentosProformas([proformaId]),
        supabaseClient.from('processos').select('id', { count: 'exact', head: true }).eq('proforma_id', proformaId).neq('status', 'excluido'),
    ]);
    // Documento de embarque: só o deste Processo. Anexo antigo sem processo
    // vale só se a Proforma tem um único Processo (e ele é este).
    const unico = processoId && count === 1;
    (res.data || []).sort((a, b) => (a.processo_id ? 1 : 0) - (b.processo_id ? 1 : 0)).forEach(reg => {
        if (!reg.arquivo_path) return;
        if (DOC_TIPOS_POR_PROCESSO.includes(reg.tipo_documento)) {
            if (reg.processo_id ? String(reg.processo_id) !== String(processoId) : !unico) return;
        }
        _docAnexosProcesso[reg.tipo_documento] = { path: reg.arquivo_path, nome: reg.arquivo_nome };
        _docAtualizarCampoVisual(reg.tipo_documento, reg.arquivo_nome);
    });
    _procProformaAssinada = (res.data || []).some(reg => reg.tipo_documento === 'proforma' && reg.assinado);
    procReaplicarEtapas();
}

function _docLimparAnexosVisuais() {
    _docAnexosProcesso = {};
    document.querySelectorAll('.doc-campo').forEach(campo => {
        const fileInput = campo.querySelector('.doc-file-input');
        if (fileInput) fileInput.value = '';
        const span = campo.querySelector('.doc-filename');
        if (span) { span.innerHTML = ''; span.classList.remove('doc-filename-ativo'); }
        const num = campo.querySelector('input[id^="doc-num-"]');
        if (num?.dataset.anexo) _docAtualizarCampoVisual(num.id.replace('doc-num-', ''), null);
        campo.querySelector('.doc-btn-ver')?.classList.remove('ativo');
        campo.querySelector('.doc-btn-del')?.classList.remove('ativo');
    });
}

function docUpload(id) {
    const proformaId = _docProformaIdAtual();
    if (!proformaId) {
        mostrarNotificacao('Selecione a Proforma de origem antes de anexar documentos.', 'erro');
        return;
    }
    const porProcesso = DOC_TIPOS_POR_PROCESSO.includes(id);
    if (porProcesso && !_docProcessoAtual()) {
        mostrarNotificacao('Este documento é deste embarque — salve o Processo antes de anexá-lo.', 'warning');
        return;
    }
    const fileInput = document.getElementById('doc-file-' + id);
    if (!fileInput) return;
    fileInput.click();
    fileInput.onchange = async () => {
        const file = fileInput.files[0];
        if (!file) return;

        const btnUp = fileInput.closest('.doc-campo')?.querySelector('.doc-btn-upload');
        const iconeOriginal = btnUp?.innerHTML;
        if (btnUp) { btnUp.disabled = true; btnUp.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }

        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${proformaId}/${id}_${Date.now()}_${safeName}`;
        const { error: uploadError } = await supabaseClient.storage.from(BUCKET_DOC_PROFORMA).upload(path, file);
        if (uploadError) {
            mostrarNotificacao('Erro ao enviar arquivo: ' + uploadError.message, 'erro');
            if (btnUp) { btnUp.disabled = false; btnUp.innerHTML = iconeOriginal; }
            fileInput.value = '';
            return;
        }

        const res = await window.supabaseAPI.anexarDocumentoProforma(proformaId, id, null, path, file.name, porProcesso ? _docProcessoAtual() : null);
        if (btnUp) { btnUp.disabled = false; btnUp.innerHTML = iconeOriginal; }
        if (!res.sucesso) {
            mostrarNotificacao('Erro ao registrar anexo: ' + res.mensagem, 'erro');
            fileInput.value = '';
            return;
        }

        _docAnexosProcesso[id] = { path, nome: file.name };
        _docAtualizarCampoVisual(id, file.name);
        procReaplicarEtapas();
        mostrarNotificacao('Documento anexado.', 'sucesso');
    };
}

// Commercial Invoice / Packing List gerados pelo sistema (pdf-documentos.js)
// a partir dos dados SALVOS do Processo — baixa e já anexa ao documento.
async function docGerarPdfProcesso(tipo) {
    const processoId = _docProcessoAtual();
    if (!processoId) {
        mostrarNotificacao('Salve o Processo antes de gerar este documento.', 'warning');
        return;
    }
    const btn = document.querySelector(`.doc-btn-gerar[onclick*="'${tipo}'"]`);
    const html = btn?.innerHTML;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const r = await gerarEAnexarDocumentoProcesso(tipo, processoId);
        if (!r) return;
        const numEl = document.getElementById('doc-num-' + tipo);
        if (numEl?.dataset.anexo) { if (!numEl.dataset.numero) numEl.dataset.numero = r.numero; }
        else if (numEl && !numEl.value.trim()) numEl.value = r.numero;
        if (r.anexado) {
            _docAnexosProcesso[tipo] = { path: r.path, nome: r.nomeArquivo };
            _docAtualizarCampoVisual(tipo, r.nomeArquivo);
            mostrarNotificacao(r.substituiu ? 'Novo PDF gerado — arquivo anterior substituído.' : `${r.nomeArquivo.replace(/_/g, ' ').replace(/\.pdf$/, '')} gerado e anexado.`, 'sucesso');
        } else {
            mostrarNotificacao(`PDF gerado. Não foi anexado: ${r.motivo}.`, 'warning');
        }
    } catch (e) {
        mostrarNotificacao('Erro ao gerar o PDF: ' + e.message, 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = html; }
    }
}

function docVer(id) {
    const anexo = _docAnexosProcesso[id];
    if (!anexo) return;
    // Bucket privado: link temporário. abrirArquivoPrivado abre a aba já no
    // clique (senão o navegador bloqueia como popup) e preenche depois.
    abrirArquivoPrivado(null, BUCKET_DOC_PROFORMA, anexo.path);
}

async function docExcluir(id) {
    const proformaId = _docProformaIdAtual();
    const anexo = _docAnexosProcesso[id];
    if (!proformaId || !anexo) return;
    if (!(await confirmarAcao('Remover o arquivo anexado a este documento? Isso também desfaz a assinatura, se houver.', { titulo: 'Remover anexo', confirmar: 'Remover', perigo: true }))) return;

    await supabaseClient.storage.from(BUCKET_DOC_PROFORMA).remove([anexo.path]);
    const res = await window.supabaseAPI.limparAnexoDocumentoProforma(proformaId, id, DOC_TIPOS_POR_PROCESSO.includes(id) ? _docProcessoAtual() : null);
    if (!res.sucesso) { mostrarNotificacao('Erro ao remover anexo: ' + res.mensagem, 'erro'); return; }

    delete _docAnexosProcesso[id];
    const fileInput = document.getElementById('doc-file-' + id);
    if (fileInput) fileInput.value = '';
    _docAtualizarCampoVisual(id, null);
    procReaplicarEtapas();
    mostrarNotificacao('Anexo removido.', 'sucesso');
}

// ========================================
// INCOTERM → MODAL AUTOMÁTICO
// ========================================

const INCOTERMS_MARITIMOS = ['FAS', 'FOB', 'CFR', 'CIF'];

// Incoterm exclusivo Marítimo escolhido com outro modal: avisa e RECUSA (o
// select volta pro valor anterior). Com Modal = Marítimo, só pede confirmação.
// Retorna o valor que deve ficar no select.
async function _incotermValidarEscolha(val, modal, anterior) {
    if (!INCOTERMS_MARITIMOS.includes(val)) return val;
    if (modal !== 'maritimo') {
        const nomeModal = { aereo: 'Aéreo', terrestre: 'Terrestre' }[modal] || 'escolhido';
        await confirmarAcao(
            `O Incoterm ${val} é exclusivo do modal Marítimo e não pode ser usado com o modal ${nomeModal}. Escolha outro Incoterm ou mude o modal para Marítimo.`,
            { titulo: 'Incoterm não permitido', confirmar: 'Escolher outro', cancelar: null, perigo: true }
        );
        return INCOTERMS_MARITIMOS.includes(anterior) ? '' : (anterior || '');
    }
    const ok = await confirmarAcao(
        `O Incoterm ${val} é exclusivo do modal Marítimo. Deseja confirmar essa escolha?`,
        { titulo: 'Incoterm exclusivo Marítimo', confirmar: 'Confirmar', cancelar: 'Cancelar' }
    );
    return ok ? val : (anterior || '');
}

// Processo: mesma regra da Proforma — escolhe o Modal primeiro, aí o Incoterm é
// liberado; os Incoterms exclusivos do Marítimo (FAS/FOB/CFR/CIF) só ficam
// disponíveis com Modal = Marítimo e pedem confirmação ao serem escolhidos.
function iniciarIncotermModal() {
    const incotermSelect  = document.getElementById('proc-incoterm');
    const modalSelect     = document.getElementById('proc-modal');
    if (!incotermSelect || !modalSelect) return;

    // Explicação do incoterm num ícone dentro do campo (mesmo padrão da Proforma)
    const balao = document.getElementById('proc-incoterm-info');
    let incotermAnterior = incotermSelect.value;
    const opcaoIncoterm = code => [...incotermSelect.options].find(o => o.value === code);

    function atualizarBalao() {
        if (!balao) return;
        const val = incotermSelect.value;
        if (!val) { balao.style.display = 'none'; balao.removeAttribute('data-tooltip'); return; }
        const descricao = INCOTERMS_INFO[val] || '';
        const sufixo = INCOTERMS_MARITIMOS.includes(val) ? ' — Exclusivo Marítimo' : '';
        balao.setAttribute('data-tooltip', `${val}: ${descricao}${sufixo}`);
        balao.style.display = '';
    }

    function aplicarModal() {
        const modal = modalSelect.value;
        if (!modal) {
            incotermSelect.disabled = true;
            incotermSelect.value    = '';
            incotermSelect.title    = 'Selecione o modal primeiro';
        } else {
            incotermSelect.disabled = false;
            incotermSelect.title    = '';
            const ehMaritimo = modal === 'maritimo';
            INCOTERMS_MARITIMOS.forEach(code => { const o = opcaoIncoterm(code); if (o) o.disabled = !ehMaritimo; });
            if (!ehMaritimo && INCOTERMS_MARITIMOS.includes(incotermSelect.value)) incotermSelect.value = '';
        }
        incotermAnterior = incotermSelect.value;
        atualizarBalao();
    }

    modalSelect.addEventListener('change', aplicarModal);

    incotermSelect.addEventListener('change', async function (e) {
        const val = this.value;
        // Confirmação só em escolha feita pelo usuário — carregar um processo salvo
        // ou vir de uma Proforma (troca programática) não abre o aviso.
        if (e.isTrusted) this.value = await _incotermValidarEscolha(val, modalSelect.value, incotermAnterior);
        incotermAnterior = this.value;
        atualizarBalao();
    });

    aplicarModal();
}

// ========================================
// TRANSPORTADORA PRÓPRIA DO CLIENTE
// ========================================

function iniciarTransportadoraPropria() {
    const tipoSelect = document.getElementById('transp-tipo');
    const nomeInput  = document.getElementById('transp-razao');
    const nomeHidden = document.getElementById('transp-nome');
    const nomeLista  = document.getElementById('transp-nome-lista');
    const cnpjInput  = document.getElementById('transp-cnpj');
    const aviso      = _criarAvisoTransp();
    if (!tipoSelect || !nomeInput) return;

    let _transpCache = null;

    // Transportadoras = empresas cadastradas com Modelo "Transportadora" (ou
    // marcadas como transportadora). Antes lia "empresas_cadastradas", tabela
    // que não existe — a lista vinha sempre vazia.
    async function _carregarTransps() {
        if (_transpCache) return _transpCache;
        try {
            await _acCarregarEmpresas();
            _transpCache = _acEmpresas
                .filter(e => e.modelo === 'transportadora' || e.is_transportadora)
                .map(e => ({ id: e.id, nome_empresa: e.razao_social, nome_fantasia: e.nome_fantasia, documento: e.documento }));
        } catch { _transpCache = []; }
        return _transpCache;
    }

    function _selecionarTransp(item) {
        const nome = item.nome_empresa || item.nome_fantasia || '';
        nomeInput.value = nome;
        if (nomeHidden) nomeHidden.value = nome;
        if (cnpjInput) { cnpjInput.value = item.documento || ''; cnpjInput.style.borderColor = ''; }
        nomeInput.style.borderColor = '';
        if (nomeLista) nomeLista.classList.remove('aberta');
    }

    // Mesma lista de sugestões pra Razão Social (busca por nome) e pro
    // Documento Fiscal (busca pelos números do documento).
    let _campoAtivo = nomeInput;
    async function _mostrarSugestoes(e) {
        if (tipoSelect.value !== 'solicitada') return;
        _campoAtivo = e?.target === cnpjInput ? cnpjInput : nomeInput;
        const lista = await _carregarTransps();
        if (!nomeLista) return;
        if (!lista.length) {
            nomeLista.innerHTML = '<div class="autocomplete-vazio">Nenhuma transportadora cadastrada (Empresas › Modelo Transportadora)</div>';
            _acPosicionar(_campoAtivo, nomeLista);
            nomeLista.classList.add('aberta');
            return;
        }
        let filtradas;
        if (_campoAtivo === cnpjInput) {
            const dig = cnpjInput.value.replace(/\D/g, '');
            filtradas = dig ? lista.filter(t => String(t.documento || '').replace(/\D/g, '').includes(dig)) : lista;
        } else {
            const q = nomeInput.value.trim().toLowerCase();
            filtradas = q
                ? lista.filter(t => (t.nome_empresa || '').toLowerCase().includes(q) || (t.nome_fantasia || '').toLowerCase().includes(q))
                : lista;
        }
        if (!filtradas.length) { nomeLista.classList.remove('aberta'); return; }
        nomeLista.innerHTML = filtradas.slice(0, 20).map(t => `
            <div class="autocomplete-item"
                 data-nome="${escHtml(t.nome_empresa || t.nome_fantasia || '')}"
                 data-doc="${escHtml(t.documento || '')}">
                <span class="ac-nome">${escHtml(t.nome_empresa || t.nome_fantasia || '—')}</span>
                <span class="ac-fantasia">${[t.nome_fantasia && t.nome_empresa ? t.nome_fantasia : '', t.documento || ''].filter(Boolean).join(' · ')}</span>
            </div>`).join('');
        _acPosicionar(_campoAtivo, nomeLista);
        nomeLista.classList.add('aberta');
    }

    if (nomeLista) {
        nomeInput.addEventListener('focus', _mostrarSugestoes);
        nomeInput.addEventListener('input', _mostrarSugestoes);
        // Documento Fiscal é preenchido só pelo sistema (ao escolher da lista):
        // digitar/alterar a Razão Social desfaz a escolha anterior.
        nomeInput.addEventListener('input', () => { if (cnpjInput) cnpjInput.value = ''; });
        nomeLista.addEventListener('mousedown', e => {
            const item = e.target.closest('.autocomplete-item');
            if (!item) return;
            _selecionarTransp({ nome_empresa: item.dataset.nome, documento: item.dataset.doc });
        });
        document.addEventListener('click', e => {
            if (!nomeInput.contains(e.target) && !cnpjInput?.contains(e.target) && !nomeLista.contains(e.target))
                nomeLista.classList.remove('aberta');
        });
    }

    // "Própria do Cliente" = o próprio Importador coleta a carga: Razão Social
    // e Documento Fiscal vêm do Importador do Processo (somente leitura) —
    // não é uma transportadora cadastrada.
    function _aplicarPropriaCliente() {
        const propria = tipoSelect.value === 'propria';
        nomeInput.readOnly = propria;
        nomeInput.placeholder = propria ? 'Importador do processo' : 'Nome da transportadora';
        nomeInput.classList.toggle('transp-campo-auto', propria);
        if (!propria) return;
        if (nomeLista) nomeLista.classList.remove('aberta');
        const imp    = document.getElementById('proc-emp-dest-busca')?.value.trim() || '';
        const impDoc = document.getElementById('proc-emp-dest-auto-doc')?.value.trim() || '';
        nomeInput.value = imp;
        if (nomeHidden) nomeHidden.value = imp;
        if (cnpjInput) cnpjInput.value = impDoc;
        [nomeInput, cnpjInput].forEach(el => { if (el && el.value) el.style.borderColor = ''; });
        aviso.className = 'transp-aviso' + (imp ? ' transp-aviso-ok' : '');
        aviso.textContent = imp
            ? 'Coleta pelo próprio Importador — dados preenchidos a partir do Importador do processo.'
            : 'Escolha o Importador do processo (Origem / Destino) — a coleta será feita por ele.';
        aviso.style.display = 'block';
    }
    window._transpAplicarPropriaCliente = _aplicarPropriaCliente;

    tipoSelect.addEventListener('change', function () {
        aviso.style.display = 'none';
        if (nomeLista) nomeLista.classList.remove('aberta');
        nomeInput.value = '';
        if (nomeHidden) nomeHidden.value = '';
        if (cnpjInput) cnpjInput.value = '';
        _aplicarPropriaCliente();
    });

    // Importador trocado depois: atualiza a coleta própria
    ['proc-emp-dest-busca', 'proc-emp-dest-auto-doc'].forEach(id => {
        const el = document.getElementById(id);
        el?.addEventListener('change', () => { if (tipoSelect.value === 'propria') _aplicarPropriaCliente(); });
        el?.addEventListener('input',  () => { if (tipoSelect.value === 'propria') _aplicarPropriaCliente(); });
    });
}

function _criarAvisoTransp() {
    let el = document.getElementById('transp-aviso-propria');
    if (!el) {
        el = document.createElement('div');
        el.id        = 'transp-aviso-propria';
        el.className = 'transp-aviso';
        el.style.display = 'none';
        // logo abaixo da 1ª linha (Transportadora | Razão Social | Documento | Nº de Coleta)
        document.getElementById('transp-tipo')?.closest('.form-group.full-width')?.after(el);
    }
    return el;
}
let _procItens = [];

// ── Embarque parcial: saldo da Proforma no Processo ─────────────
// _procSaldo = resultado de supabaseAPI → buscarSaldoProforma (itens por chave,
// já descontando os OUTROS processos da proforma). null = processo sem proforma.
let _procSaldo = null;
// Produtos (chave da proforma) que o usuário mandou "Excluir da Proforma" ao
// remover do processo — o saldo pendente deles sai da Proforma ao salvar.
let _procExcluirDaProforma = new Set();

// Remover um produto do Processo que veio da Proforma: sai só deste processo
// (stand-by — continua como saldo pendente) ou sai da Proforma também?
// Devolve true para remover a linha, false para cancelar.
async function _procPerguntarRemocao(idx) {
    const it = _procItens[idx];
    const k = it ? chaveItemProforma(it) : null;
    const s = k && _procSaldo?.itens[k];
    if (!s) return true;   // produto que não é da Proforma: remove direto, como antes
    const fmt = n => Number(n).toLocaleString('pt-BR');
    const codigo = _procSaldo.proforma?.codigo || '';
    const assinada = ['aprovado', 'encerrado'].includes(_procSaldo.proforma?.status);
    const escolha = await escolherAcao(
        `"${it.produto}" (${fmt(it.qtd)} ${it.unidade || s.unidade || ''}) veio da Proforma ${codigo}. Ele não vai neste processo, ou deve sair da Proforma também?`,
        {
            titulo: 'Remover produto do processo',
            opcoes: [
                { valor: 'standby', texto: 'Só não vai neste processo (stand-by)',
                  descricao: `Continua na Proforma como saldo pendente, para um próximo processo. A Proforma não fica 100% embarcada.` },
                { valor: 'excluir', texto: 'Excluir da Proforma', perigo: true,
                  descricao: `Ao salvar, o saldo deste produto sai da Proforma ${codigo} e ela pode ficar 100% embarcada.`
                    + (assinada ? ' Atenção: a Proforma já está assinada — os itens dela vão mudar.' : '') },
            ],
        });
    if (!escolha) return false;
    if (escolha === 'excluir') _procExcluirDaProforma.add(k);
    else _procExcluirDaProforma.delete(k);
    return true;
}

// Stand-by → volta para este processo com o que ainda resta do produto
function procIncluirStandby(chave) {
    const s = _procSaldo?.itens[chave];
    if (!s) return;
    const noProc = _procItens.filter(it => chaveItemProforma(it) === chave).reduce((t, it) => t + (Number(it.qtd) || 0), 0);
    const resta = s.saldo - noProc;
    if (resta <= 0) return;
    _procExcluirDaProforma.delete(chave);
    _procItens.push({ ..._itensNormalizar([s.item])[0], qtd: resta });
    itensRenderizar('proc');
}

function procDesfazerExclusao(chave) {
    _procExcluirDaProforma.delete(chave);
    _procAtualizarSaldoVisual();
}

// Depois de salvar o processo: tira da Proforma o saldo pendente dos produtos
// marcados "Excluir da Proforma" (o que já está em processos fica).
async function _procAplicarExclusoesNaProforma(proformaId) {
    if (!_procExcluirDaProforma.size) return;
    const saldo = await window.supabaseAPI.buscarSaldoProforma(proformaId);
    const itens = Array.isArray(saldo.proforma?.itens) ? saldo.proforma.itens.map(it => ({ ...it })) : [];
    const removidos = [];
    _procExcluirDaProforma.forEach(k => {
        let tirar = saldo.itens[k]?.saldo || 0;
        if (tirar <= 0) return;
        removidos.push(saldo.itens[k].produto);
        for (let i = itens.length - 1; i >= 0 && tirar > 0; i--) {
            if (chaveItemProforma(itens[i]) !== k) continue;
            const q = Number(itens[i].qtd ?? itens[i].quantidade) || 0;
            const novo = Math.max(0, q - tirar);
            tirar -= q - novo;
            if ('qtd' in itens[i] || !('quantidade' in itens[i])) itens[i].qtd = novo; else itens[i].quantidade = novo;
        }
    });
    _procExcluirDaProforma = new Set();
    if (!removidos.length) return;
    const restantes = itens.filter(it => (Number(it.qtd ?? it.quantidade) || 0) > 0);
    const valor_total = restantes.reduce((t, it) => t + (Number(it.qtd ?? it.quantidade) || 0) * (Number(it.preco ?? it.preco_unit) || 0), 0);
    const { error } = await supabaseClient.from('proformas').update({ itens: restantes, valor_total }).eq('id', proformaId);
    if (error) mostrarNotificacao('O processo foi salvo, mas não foi possível tirar o item da Proforma: ' + error.message, 'erro');
    else mostrarNotificacao(`Removido da Proforma ${saldo.proforma?.codigo || ''}: ${removidos.join(', ')}.`, 'sucesso');
}

function _procExcedentes() {
    if (!_procSaldo) return [];
    const usado = {};
    _procItens.forEach((it, i) => {
        const k = chaveItemProforma(it);
        if (!_procSaldo.itens[k]) return;
        (usado[k] ||= { qtd: 0, idx: [] });
        usado[k].qtd += Number(it.qtd) || 0;
        usado[k].idx.push(i);
    });
    return Object.entries(usado)
        .filter(([k, u]) => u.qtd > _procSaldo.itens[k].saldo)
        .map(([k, u]) => ({ ..._procSaldo.itens[k], pedido: u.qtd, idx: u.idx }));
}

// Avisos SÓ de tela (o PDF lê apenas as quantidades): saldo de cada produto,
// quantidade acima do saldo (bloqueia ao salvar) e embarque parcial — quando
// o processo leva menos do que ainda resta da Proforma.
function _procAtualizarSaldoVisual() {
    const excedidos = new Set(_procExcedentes().flatMap(e => e.idx));
    const fmt = n => Number(n).toLocaleString('pt-BR');

    // quantidade deste processo por produto da proforma
    const noProcesso = {};
    _procItens.forEach(it => {
        const k = chaveItemProforma(it);
        if (_procSaldo?.itens[k]) noProcesso[k] = (noProcesso[k] || 0) + (Number(it.qtd) || 0);
    });

    _procItens.forEach((it, i) => {
        const el   = document.getElementById(`proc-item-saldo-${i}`);
        const card = document.getElementById(`proc-item-card-${i}`);
        const k    = chaveItemProforma(it);
        const s    = _procSaldo?.itens[k];
        const resta = s ? s.saldo - (noProcesso[k] || 0) : 0;
        const parcial = !!s && !excedidos.has(i) && resta > 0 && (noProcesso[k] || 0) > 0;
        if (card) {
            card.classList.toggle('item-saldo-excedido', excedidos.has(i));
            card.classList.toggle('item-saldo-parcial', parcial);
        }
        if (!el) return;
        if (!s) { el.innerHTML = ''; return; }
        const un = _itemEsc(s.unidade);
        if (excedidos.has(i)) {
            el.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Acima do saldo da proforma: disponível <strong>${fmt(s.saldo)}</strong> de ${fmt(s.total)} ${un}`;
        } else if (parcial) {
            el.innerHTML = `<i class="fa-solid fa-scissors"></i> Embarque parcial: este processo leva <strong>${fmt(noProcesso[k])}</strong> de ${fmt(s.saldo)} ${un} disponíveis — ficam <strong>${fmt(resta)} ${un}</strong> para outro processo`
                + (s.usado ? ` · ${fmt(s.usado)} já em outros processos` : '');
        } else {
            el.innerHTML = `<i class="fa-solid fa-boxes-packing"></i> Saldo da proforma: <strong>${fmt(s.saldo)}</strong> de ${fmt(s.total)} ${un}${s.usado ? ` (${fmt(s.usado)} já em outros processos)` : ''}`;
        }
    });

    // Faixa no topo da seção: o processo não leva tudo o que resta da Proforma
    // (quantidade menor ou produto da proforma que ficou de fora)
    const body = document.getElementById('proc-itens-body');
    if (!body) return;
    let faixa = document.getElementById('proc-itens-aviso-parcial');
    const restaDe = s => s.saldo - (noProcesso[s.chave] || 0);
    const pendentes = _procSaldo
        ? Object.values(_procSaldo.itens).filter(s => restaDe(s) > 0 && !_procExcluirDaProforma.has(s.chave))
        : [];
    const excluidos = _procSaldo
        ? Object.values(_procSaldo.itens).filter(s => restaDe(s) > 0 && _procExcluirDaProforma.has(s.chave))
        : [];
    if (!pendentes.length && !excluidos.length) { faixa?.remove(); return; }
    if (!faixa) {
        faixa = document.createElement('div');
        faixa.id = 'proc-itens-aviso-parcial';
        faixa.className = 'proc-aviso-parcial';
        body.before(faixa);
    }
    const chaveJs = k => _itemEsc(JSON.stringify(k));
    faixa.innerHTML = `<i class="fa-solid fa-circle-info"></i>
        <div class="proc-standby">
            ${pendentes.length ? `
            <strong>Em stand-by — saldo pendente da Proforma ${_itemEsc(_procSaldo.proforma?.codigo || '')}</strong>
            <span class="proc-aviso-parcial-nota">Não vão neste processo e continuam na Proforma para um próximo embarque.</span>
            <ul class="proc-standby-lista">
                ${pendentes.map(s => `<li><span><i class="fa-solid fa-pause"></i> ${_itemEsc(s.produto)}: <strong>${fmt(restaDe(s))} ${_itemEsc(s.unidade)}</strong></span>
                    <button type="button" class="proc-standby-btn" onclick="procIncluirStandby(${chaveJs(s.chave)})"><i class="fa-solid fa-plus"></i> Incluir neste processo</button></li>`).join('')}
            </ul>` : ''}
            ${excluidos.length ? `
            <strong class="proc-standby-excluir-tit">Saem da Proforma ao salvar</strong>
            <ul class="proc-standby-lista">
                ${excluidos.map(s => `<li class="proc-standby-excluido"><span><i class="fa-solid fa-trash"></i> ${_itemEsc(s.produto)}: <strong>${fmt(restaDe(s))} ${_itemEsc(s.unidade)}</strong></span>
                    <button type="button" class="proc-standby-btn" onclick="procDesfazerExclusao(${chaveJs(s.chave)})"><i class="fa-solid fa-rotate-left"></i> Desfazer</button></li>`).join('')}
            </ul>` : ''}
            <span class="proc-aviso-parcial-nota">Aviso só desta tela — não aparece nos documentos.</span>
        </div>`;
}

// ========================================
// MÁSCARAS — TRANSPORTE
// ========================================

function iniciarMascarasTransporte() {
    const cnpjInput = document.getElementById('transp-cnpj');
    if (cnpjInput) {
        cnpjInput.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '').slice(0, 14);
            if (v.length > 12) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
            else if (v.length > 8) v = v.replace(/^(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
            else if (v.length > 5) v = v.replace(/^(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
            else if (v.length > 2) v = v.replace(/^(\d{2})(\d+)/, '$1.$2');
            this.value = v;
        });
    }

    const placaInput = document.getElementById('transp-placa');
    if (placaInput) {
        placaInput.addEventListener('input', function () {
            let v = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 7);
            if (v.length > 3) v = v.slice(0, 3) + '-' + v.slice(3);
            this.value = v;
        });
    }

    // Máscara contábil: digita só números, centavos à direita (1234567 → 12.345,67)
    const freteInput = document.getElementById('transp-frete-valor');
    if (freteInput) {
        freteInput.addEventListener('input', function () {
            const raw = this.value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
            this.value = raw ? (parseInt(raw, 10) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
        });
    }

    // Espelha o incoterm selecionado no campo de frete
    const incotermSelect  = document.getElementById('proc-incoterm');
    const incotermTag     = document.getElementById('transp-frete-incoterm');
    if (incotermSelect && incotermTag) {
        const sync = () => { incotermTag.value = incotermSelect.value || ''; };
        incotermSelect.addEventListener('change', sync);
        sync();
    }
}
