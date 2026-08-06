// ========================================
// RELATÓRIOS — EMPRESA
// ========================================

let periodoAtual = 'anual';

let todasEmpresas  = [];
let todasProformas = [];
let todasProcessos = [];
let todasProdutos  = [];
const HISTORICO_KEY = 'relatoriosHistorico';

// Helpers — campos booleanos da tabela
const _eCliente     = e => !!e.is_cliente;
const _eFornecedor  = e => !!e.is_fornecedor;
const _eFabricante  = e => !!e.is_fabricante;
const _eTransp      = e => !!e.is_transportadora;
const _eRemetente   = e => !!e.is_remetente;
const _tiposStr     = e => {
    const t = [];
    if (e.is_fabricante)     t.push('Fabricante');
    if (e.is_cliente)        t.push('Cliente');
    if (e.is_fornecedor)     t.push('Fornecedor');
    if (e.is_transportadora) t.push('Transportadora');
    if (e.is_remetente)      t.push('Remetente');
    return t.join(', ') || '—';
};

// Usa a coluna modelo salva no cadastro (empresa/company/transportadora/outros);
// cai no heurístico antigo só pra registros de antes dela existir.
const _modeloEmpresa = e => {
    if (e.modelo) return e.modelo;
    if (e.is_transportadora) return 'transportadora';
    const p = (e.pais || '').toLowerCase().trim();
    if (p && p !== 'br' && p !== 'brasil' && p !== 'brazil') return 'company';
    return 'empresa';
};

document.addEventListener('DOMContentLoaded', async function () {
    verificarPermissoes();

    const resultado = await window.supabaseAPI.buscarEmpresas();
    todasEmpresas = resultado.sucesso ? resultado.data : [];

    carregarStats(todasEmpresas);
    renderHistorico();

    carregarStatsProformas();
    carregarStatsProcessos();
    carregarStatsProdutos();
});

// ========================================
// STATS — PROFORMAS
// ========================================

async function carregarStatsProformas() {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('id, codigo, status, created_at, valor_total, moeda_principal, destinatario_id, destinatario_razao_social, processo_gerado_id')
            .neq('status', 'excluido');
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        const proformas  = data || [];
        todasProformas    = proformas;
        // Etapa "finalizado" foi removida do kanban (virou "encerrado"), que
        // agora também é usado pra fechamento sem sucesso — então "concluída"
        // usa o sinal confiável de que gerou processo, não mais o texto do status.
        const concluidas = proformas.filter(p => p.processo_gerado_id).length;
        // "Em Andamento": ainda ativas no funil (enviado/aprovado/pendente).
        // "Encerrado" fica de fora — representa recusada/fechada sem sucesso,
        // não é nem concluída nem está em andamento (mesmo padrão do card de
        // Processos, que também deixa "cancelado" fora das duas contagens).
        const andamento   = proformas.filter(p => ['enviado', 'aprovado', 'pendente'].includes(p.status)).length;

        document.getElementById('totalProformas').textContent           = proformas.length;
        document.getElementById('totalProformasConcluidas').textContent = concluidas;
        document.getElementById('totalProformasAndamento').textContent  = andamento;
    } catch (err) {
        console.error('[Relatórios] Erro ao carregar stats de proformas:', err);
    }
}

// ========================================
// STATS — PROCESSOS
// ========================================

async function carregarStatsProcessos() {
    try {
        const res = await window.supabaseAPI.buscarProcessos();
        const processos = res.sucesso ? (res.data || []) : [];
        todasProcessos  = processos;

        const concluidos   = processos.filter(p => p.status === 'concluido').length;
        const emAndamento  = processos.filter(p => !['concluido', 'cancelado'].includes(p.status)).length;

        document.getElementById('totalProcessos').textContent           = processos.length;
        document.getElementById('totalProcessosConcluidos').textContent = concluidos;
        document.getElementById('totalProcessosAbertos').textContent    = emAndamento;
    } catch (err) {
        console.error('[Relatórios] Erro ao carregar stats de processos:', err);
    }
}

// ========================================
// STATS — PRODUTOS
// ========================================

async function carregarStatsProdutos() {
    try {
        const res = await window.supabaseAPI.buscarProdutos();
        const produtos = res.sucesso ? (res.data || []) : [];
        todasProdutos  = produtos;

        const ativos = produtos.filter(p => (p.status || 'ativo') === 'ativo').length;

        document.getElementById('totalProdutos').textContent       = produtos.length;
        document.getElementById('totalProdutosAtivos').textContent = ativos;
    } catch (err) {
        console.error('[Relatórios] Erro ao carregar stats de produtos:', err);
    }
}

// ========================================
// SELETOR DE MÓDULO
// ========================================

function relSwitchModulo(modulo, btn) {
    document.querySelectorAll('.rel-secao').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.rel-modulo-tab').forEach(b => b.classList.remove('active'));
    const sec = document.getElementById('rel-sec-' + modulo);
    if (sec) sec.style.display = 'block';
    if (btn) btn.classList.add('active');
}

// ========================================
// PERMISSÕES
// ========================================

function verificarPermissoes() {
    const usuario = JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null');
    const isAdmin = usuario && usuario.perfil === 'admin';

    if (isAdmin) {
        document.getElementById('secaoHistorico').style.display = '';
    }
}

// ========================================
// STATS
// ========================================

function carregarStats(empresas) {
    const total          = empresas.length;
    const fabricantes    = empresas.filter(_eFabricante).length;
    const fornecedores   = empresas.filter(_eFornecedor).length;
    const transportadoras= empresas.filter(e => e.modelo === 'transportadora').length;
    const paises         = new Set(empresas.map(e => e.pais).filter(Boolean)).size;

    document.getElementById('totalEmpresas').textContent        = total;
    document.getElementById('totalFabricantes').textContent     = fabricantes;
    document.getElementById('totalFornecedores').textContent    = fornecedores;
    document.getElementById('totalTransportadoras').textContent = transportadoras;
    document.getElementById('totalPaises').textContent          = paises;
}

// ========================================
// PERÍODO
// ========================================

function setPeriod(btn, periodo) {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    periodoAtual = periodo;

    // Ajusta as datas automaticamente
    const hoje = new Date();
    const dias = { mensal: 30, trimestral: 90, anual: 365 };
    const corte = new Date();
    corte.setDate(corte.getDate() - (dias[periodo] || 30));

    const diEl = document.getElementById('relDataInicio');
    const dfEl = document.getElementById('relDataFim');
    if (diEl) diEl.value = corte.toISOString().split('T')[0];
    if (dfEl) dfEl.value = hoje.toISOString().split('T')[0];

    atualizarPreviewModal();
}

// ========================================
// MODAL DE PARÂMETROS
// ========================================

let tipoRelatorioAtual = null;

const CONFIG_REL = {
    periodo: {
        nome:  'Relatório por Período',
        cor:   'linear-gradient(135deg,#4776ec,#6366f1)',
        icone: 'fa-solid fa-calendar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Tipo</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="fabricante" checked> Fabricantes</label>
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="fornecedor" checked> Fornecedores</label>
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="ambos" checked> Ambos (Fab. + Forn.)</label>
                </div>
            </div>
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-building"></i> Modelo</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="empresa" checked> Empresa (Nacional)</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="company" checked> Company (Estrangeira)</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="transportadora" checked> Transportadora</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="outros" checked> Outro</label>
                </div>
            </div>`
    },
    tipo: {
        nome:  'Relatório por Tipo',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-chart-bar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Tipo</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="fabricante" checked> Fabricantes</label>
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="fornecedor" checked> Fornecedores</label>
                    <label class="rel-check"><input type="checkbox" name="rel-tipo" value="ambos" checked> Ambos (Fab. + Forn.)</label>
                </div>
            </div>
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-building"></i> Modelo</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="empresa" checked> Empresa (Nacional)</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="company" checked> Company (Estrangeira)</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="transportadora" checked> Transportadora</label>
                    <label class="rel-check"><input type="checkbox" name="rel-modelo" value="outros" checked> Outro</label>
                </div>
            </div>`
    },
    pais: {
        nome:  'Relatório por País',
        cor:   'linear-gradient(135deg,#22c55e,#16a34a)',
        icone: 'fa-solid fa-globe',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-earth-americas"></i> Países</label>
                <select id="relPaisFiltro" class="rel-select" onchange="atualizarPreviewModal()">
                    <option value="">Todos os países</option>
                </select>
            </div>
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-ranking-star"></i> Exibir no ranking</label>
                <select id="relRankingTop" class="rel-select" onchange="atualizarPreviewModal()">
                    <option value="5">Top 5</option>
                    <option value="10" selected>Top 10</option>
                    <option value="0">Todos</option>
                </select>
            </div>`
    },
    'proformas-periodo': {
        nome:  'Proformas por Período',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-calendar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-prof-status" value="enviado" checked> Enviado</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prof-status" value="aprovado" checked> Aprovado</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prof-status" value="pendente" checked> Pendente</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prof-status" value="encerrado" checked> Encerrado</label>
                </div>
            </div>`
    },
    'proformas-status': {
        nome:  'Proformas por Status',
        cor:   'linear-gradient(135deg,#8b5cf6,#6d28d9)',
        icone: 'fa-solid fa-chart-bar',
        params: ''
    },
    'proformas-cliente': {
        nome:  'Proformas por Cliente',
        cor:   'linear-gradient(135deg,#4776ec,#6366f1)',
        icone: 'fa-solid fa-building',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-ranking-star"></i> Exibir no ranking</label>
                <select id="relRankingTopCliente" class="rel-select" onchange="atualizarPreviewModal()">
                    <option value="5">Top 5</option>
                    <option value="10" selected>Top 10</option>
                    <option value="0">Todos</option>
                </select>
            </div>`
    },
    'processos-periodo': {
        nome:  'Processos por Período',
        cor:   'linear-gradient(135deg,#4776ec,#6366f1)',
        icone: 'fa-solid fa-calendar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-proc-status" value="aberto" checked> Aberto</label>
                    <label class="rel-check"><input type="checkbox" name="rel-proc-status" value="em_andamento" checked> Em Andamento</label>
                    <label class="rel-check"><input type="checkbox" name="rel-proc-status" value="aguardando_documentos" checked> Aguard. Documentos</label>
                    <label class="rel-check"><input type="checkbox" name="rel-proc-status" value="concluido" checked> Concluído</label>
                    <label class="rel-check"><input type="checkbox" name="rel-proc-status" value="cancelado" checked> Cancelado</label>
                </div>
            </div>`
    },
    'processos-status': {
        nome:  'Processos por Status',
        cor:   'linear-gradient(135deg,#22c55e,#16a34a)',
        icone: 'fa-solid fa-chart-bar',
        params: ''
    },
    'processos-modal': {
        nome:  'Processos por Modal',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-globe',
        params: ''
    },
    'produtos-listagem': {
        nome:  'Listagem Geral de Produtos',
        cor:   'linear-gradient(135deg,#9333ea,#6366f1)',
        icone: 'fa-solid fa-list',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" name="rel-prod-status" value="ativo" checked> Ativo</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prod-status" value="pendente" checked> Pendente</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prod-status" value="pausado" checked> Pausado</label>
                    <label class="rel-check"><input type="checkbox" name="rel-prod-status" value="inativo" checked> Inativo</label>
                </div>
            </div>`
    },
    'produtos-ncm': {
        nome:  'Produtos por NCM',
        cor:   'linear-gradient(135deg,#22c55e,#16a34a)',
        icone: 'fa-solid fa-barcode',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-ranking-star"></i> Exibir no ranking</label>
                <select id="relRankingTopNcm" class="rel-select" onchange="atualizarPreviewModal()">
                    <option value="5">Top 5</option>
                    <option value="10" selected>Top 10</option>
                    <option value="0">Todos</option>
                </select>
            </div>`
    }
};

function gerarRelatorio(tipo) {
    tipoRelatorioAtual = tipo;
    const cfg = CONFIG_REL[tipo];
    if (!cfg) return;

    // Header do modal
    document.getElementById('modalRelIcon').innerHTML  = `<i class="${cfg.icone}" style="color:white;font-size:18px;"></i>`;
    document.getElementById('modalRelIcon').style.background = cfg.cor;
    document.getElementById('modalRelNome').textContent = cfg.nome;

    // Parâmetros específicos
    document.getElementById('relParamsEspecificos').innerHTML = cfg.params;

    // Datas padrão: últimos 365 dias (mesmo padrão "Anual" já usado nos cards
    // de estatística — evita a prévia abrir zerada quando não há registros
    // no mês corrente).
    const hoje = new Date();
    const corte365 = new Date();
    corte365.setDate(corte365.getDate() - 365);
    document.getElementById('relDataInicio').value = corte365.toISOString().split('T')[0];
    document.getElementById('relDataFim').value     = hoje.toISOString().split('T')[0];
    document.querySelectorAll('#modalRelatorio .period-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('#modalRelatorio .period-btn[onclick*="anual"]')?.classList.add('active');

    // Popular select de países se for o card de país
    if (tipo === 'pais') {
        const select = document.getElementById('relPaisFiltro');
        if (select) {
            const paises = [...new Set(todasEmpresas.map(e => e.pais).filter(Boolean))].sort();
            paises.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                select.appendChild(opt);
            });
        }
    }

    // Listeners de atualização do preview
    document.getElementById('relDataInicio').addEventListener('change', atualizarPreviewModal);
    document.getElementById('relDataFim').addEventListener('change', atualizarPreviewModal);
    document.querySelectorAll('#relParamsEspecificos input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', atualizarPreviewModal);
    });

    atualizarPreviewModal();
    document.getElementById('modalRelatorio').classList.add('active');
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').classList.remove('active');
    tipoRelatorioAtual = null;
}

function filtrarEmpresasPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todasEmpresas;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todasEmpresas.filter(e => {
        if (!e.created_at) return true;
        const d = new Date(e.created_at);
        return d >= inicio && d <= fim;
    });
}

function filtrarProformasPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todasProformas;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todasProformas.filter(p => {
        if (!p.created_at) return true;
        const d = new Date(p.created_at);
        return d >= inicio && d <= fim;
    });
}

function filtrarProcessosPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todasProcessos;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todasProcessos.filter(p => {
        if (!p.criado_em) return true;
        const d = new Date(p.criado_em);
        return d >= inicio && d <= fim;
    });
}

function filtrarProdutosPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todasProdutos;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todasProdutos.filter(p => {
        if (!p.criado_em) return true;
        const d = new Date(p.criado_em);
        return d >= inicio && d <= fim;
    });
}

function atualizarPreviewModal() {
    const el = document.getElementById('relPreviewConteudo');
    if (!el || !tipoRelatorioAtual) return;

    const empresas = filtrarEmpresasPorDatas();

    if (tipoRelatorioAtual === 'periodo') {
        const tiposSel   = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-tipo"]:checked')].map(c => c.value);
        const modelosSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-modelo"]:checked')].map(c => c.value);

        const porTipo = empresas.filter(e => {
            if (tiposSel.includes('ambos')      && _eFabricante(e) && _eFornecedor(e))  return true;
            if (tiposSel.includes('fabricante') && _eFabricante(e) && !_eFornecedor(e)) return true;
            if (tiposSel.includes('fornecedor') && _eFornecedor(e) && !_eFabricante(e)) return true;
            return false;
        });

        const filtradas = modelosSel.length
            ? porTipo.filter(e => modelosSel.includes(_modeloEmpresa(e)))
            : porTipo;

        const fab  = filtradas.filter(e => _eFabricante(e) && !_eFornecedor(e)).length;
        const forn = filtradas.filter(e => _eFornecedor(e) && !_eFabricante(e)).length;
        const amb  = filtradas.filter(e => _eFabricante(e) && _eFornecedor(e)).length;

        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${filtradas.length} empresa${filtradas.length !== 1 ? 's' : ''}</strong></div>
            <div class="prev-linha"><span>Fabricantes</span><strong>${fab}</strong></div>
            <div class="prev-linha"><span>Fornecedores</span><strong>${forn}</strong></div>
            <div class="prev-linha"><span>Ambos</span><strong>${amb}</strong></div>
            <div class="prev-linha"><span>Países distintos</span><strong>${new Set(filtradas.map(e => e.pais).filter(Boolean)).size}</strong></div>
        `;

    } else if (tipoRelatorioAtual === 'tipo') {
        const tiposSel   = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-tipo"]:checked')].map(c => c.value);
        const modelosSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-modelo"]:checked')].map(c => c.value);

        const porTipo = empresas.filter(e => {
            if (tiposSel.includes('ambos')      && _eFabricante(e) && _eFornecedor(e))  return true;
            if (tiposSel.includes('fabricante') && _eFabricante(e) && !_eFornecedor(e)) return true;
            if (tiposSel.includes('fornecedor') && _eFornecedor(e) && !_eFabricante(e)) return true;
            return false;
        });

        const filtradas = modelosSel.length
            ? porTipo.filter(e => modelosSel.includes(_modeloEmpresa(e)))
            : porTipo;

        const fab  = filtradas.filter(e => _eFabricante(e) && !_eFornecedor(e)).length;
        const forn = filtradas.filter(e => _eFornecedor(e) && !_eFabricante(e)).length;
        const amb  = filtradas.filter(e => _eFabricante(e) && _eFornecedor(e)).length;

        const porModelo = {
            empresa:       filtradas.filter(e => _modeloEmpresa(e) === 'empresa').length,
            company:       filtradas.filter(e => _modeloEmpresa(e) === 'company').length,
            transportadora:filtradas.filter(e => _modeloEmpresa(e) === 'transportadora').length,
            outros:        filtradas.filter(e => _modeloEmpresa(e) === 'outros').length,
        };

        el.innerHTML = `
            <div class="prev-linha"><span>Total filtrado</span><strong>${filtradas.length}</strong></div>
            <div class="prev-linha"><span>Fabricantes</span><strong>${fab}</strong></div>
            <div class="prev-linha"><span>Fornecedores</span><strong>${forn}</strong></div>
            <div class="prev-linha"><span>Ambos</span><strong>${amb}</strong></div>
            <div class="prev-linha" style="border-top:1px solid #f1f5f9;margin-top:6px;padding-top:6px;">
                <span>Nacional (Empresa)</span><strong>${porModelo.empresa}</strong>
            </div>
            <div class="prev-linha"><span>Estrangeira (Company)</span><strong>${porModelo.company}</strong></div>
            <div class="prev-linha"><span>Transportadora</span><strong>${porModelo.transportadora}</strong></div>
            <div class="prev-linha"><span>Outro</span><strong>${porModelo.outros}</strong></div>
        `;

    } else if (tipoRelatorioAtual === 'pais') {
        const paisFiltro = document.getElementById('relPaisFiltro')?.value || '';
        const topN = parseInt(document.getElementById('relRankingTop')?.value || '10');
        let lista = empresas;
        if (paisFiltro) lista = lista.filter(e => e.pais === paisFiltro);

        const contagem = {};
        lista.forEach(e => { const p = e.pais || 'Não informado'; contagem[p] = (contagem[p] || 0) + 1; });
        let ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        if (topN > 0) ranking = ranking.slice(0, topN);

        if (ranking.length === 0) {
            el.innerHTML = `<div class="prev-vazio">Nenhum resultado encontrado</div>`;
            return;
        }
        el.innerHTML = ranking.map(([pais, qtd], i) =>
            `<div class="prev-linha"><span><b>${i + 1}.</b> ${pais}</span><strong>${qtd}</strong></div>`
        ).join('');

    } else if (tipoRelatorioAtual === 'proformas-periodo') {
        const labels    = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
        const statusSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-prof-status"]:checked')].map(c => c.value);
        const lista     = filtrarProformasPorDatas().filter(p => statusSel.includes(p.status || 'enviado'));

        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${lista.length}</strong></div>
            ${statusSel.map(st => `<div class="prev-linha"><span>${labels[st]}</span><strong>${lista.filter(p => (p.status || 'enviado') === st).length}</strong></div>`).join('')}
        `;

    } else if (tipoRelatorioAtual === 'proformas-status') {
        const labels = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
        const lista  = filtrarProformasPorDatas();
        const total  = lista.length || 1;

        el.innerHTML = Object.keys(labels).map(st => {
            const n = lista.filter(p => (p.status || 'enviado') === st).length;
            return `<div class="prev-linha"><span>${labels[st]}</span><strong>${n} (${Math.round((n / total) * 100)}%)</strong></div>`;
        }).join('');

    } else if (tipoRelatorioAtual === 'proformas-cliente') {
        const topN = parseInt(document.getElementById('relRankingTopCliente')?.value || '10');
        const lista = filtrarProformasPorDatas();

        const porCliente = {};
        lista.forEach(p => {
            const nome = p.destinatario_razao_social || 'Não informado';
            if (!porCliente[nome]) porCliente[nome] = { qtd: 0, valor: 0 };
            porCliente[nome].qtd++;
            porCliente[nome].valor += Number(p.valor_total) || 0;
        });
        let ranking = Object.entries(porCliente).sort((a, b) => b[1].qtd - a[1].qtd);
        if (topN > 0) ranking = ranking.slice(0, topN);

        if (!ranking.length) {
            el.innerHTML = `<div class="prev-vazio">Nenhum resultado encontrado</div>`;
            return;
        }
        el.innerHTML = ranking.map(([nome, info], i) =>
            `<div class="prev-linha"><span><b>${i + 1}.</b> ${nome}</span><strong>${info.qtd}</strong></div>`
        ).join('');

    } else if (tipoRelatorioAtual === 'processos-periodo') {
        const labels    = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
        const statusSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-proc-status"]:checked')].map(c => c.value);
        const lista     = filtrarProcessosPorDatas().filter(p => statusSel.includes(p.status || 'aberto'));

        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${lista.length}</strong></div>
            ${statusSel.map(st => `<div class="prev-linha"><span>${labels[st]}</span><strong>${lista.filter(p => (p.status || 'aberto') === st).length}</strong></div>`).join('')}
        `;

    } else if (tipoRelatorioAtual === 'processos-status') {
        const labels = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
        const lista  = filtrarProcessosPorDatas();
        const total  = lista.length || 1;

        el.innerHTML = Object.keys(labels).map(st => {
            const n = lista.filter(p => (p.status || 'aberto') === st).length;
            return `<div class="prev-linha"><span>${labels[st]}</span><strong>${n} (${Math.round((n / total) * 100)}%)</strong></div>`;
        }).join('');

    } else if (tipoRelatorioAtual === 'processos-modal') {
        const labels = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };
        const lista  = filtrarProcessosPorDatas();
        const total  = lista.length || 1;

        el.innerHTML = Object.keys(labels).map(md => {
            const n = lista.filter(p => p.modal === md).length;
            return `<div class="prev-linha"><span>${labels[md]}</span><strong>${n} (${Math.round((n / total) * 100)}%)</strong></div>`;
        }).join('');

    } else if (tipoRelatorioAtual === 'produtos-listagem') {
        const labelsProd = { ativo: 'Ativo', pendente: 'Pendente', pausado: 'Pausado', inativo: 'Inativo' };
        const statusSel  = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-prod-status"]:checked')].map(c => c.value);
        const lista      = filtrarProdutosPorDatas().filter(p => statusSel.includes(p.status || 'ativo'));

        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${lista.length}</strong></div>
            ${statusSel.map(st => `<div class="prev-linha"><span>${labelsProd[st]}</span><strong>${lista.filter(p => (p.status || 'ativo') === st).length}</strong></div>`).join('')}
        `;

    } else if (tipoRelatorioAtual === 'produtos-ncm') {
        const topN  = parseInt(document.getElementById('relRankingTopNcm')?.value || '10');
        const lista = filtrarProdutosPorDatas();

        const contagem = {};
        lista.forEach(p => { const n = p.ncm || 'Não informado'; contagem[n] = (contagem[n] || 0) + 1; });
        let ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        if (topN > 0) ranking = ranking.slice(0, topN);

        if (ranking.length === 0) {
            el.innerHTML = `<div class="prev-vazio">Nenhum resultado encontrado</div>`;
            return;
        }
        el.innerHTML = ranking.map(([ncm, qtd], i) =>
            `<div class="prev-linha"><span><b>${i + 1}.</b> ${ncm}</span><strong>${qtd}</strong></div>`
        ).join('');
    }
}

// ========================================
// BAIXAR PDF
// ========================================

function baixarPDF() {
    const cfg = CONFIG_REL[tipoRelatorioAtual];
    if (!cfg) return;

    const di = document.getElementById('relDataInicio')?.value || '—';
    const df = document.getElementById('relDataFim')?.value || '—';
    const empresas = filtrarEmpresasPorDatas();
    const usuario  = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');

    let conteudoTabela = '';
    let totalRegistros = empresas.length;

    const _modeloLabel = m => ({ empresa: 'Nacional', company: 'Estrangeira', transportadora: 'Transportadora', outros: 'Outro' }[m] || m);

    if (tipoRelatorioAtual === 'periodo') {
        const tiposSel   = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-tipo"]:checked')].map(c => c.value);
        const modelosSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-modelo"]:checked')].map(c => c.value);
        let lista = empresas.filter(e => {
            if (tiposSel.includes('ambos')      && _eFabricante(e) && _eFornecedor(e))  return true;
            if (tiposSel.includes('fabricante') && _eFabricante(e) && !_eFornecedor(e)) return true;
            if (tiposSel.includes('fornecedor') && _eFornecedor(e) && !_eFabricante(e)) return true;
            return false;
        });
        if (modelosSel.length) lista = lista.filter(e => modelosSel.includes(_modeloEmpresa(e)));
        conteudoTabela = `
            <table>
                <thead><tr><th>Empresa</th><th>Tipo</th><th>Modelo</th><th>País</th><th>Documento</th></tr></thead>
                <tbody>
                    ${lista.map(e => `
                        <tr>
                            <td>${e.razao_social || '—'}</td>
                            <td>${_tiposStr(e)}</td>
                            <td>${_modeloLabel(_modeloEmpresa(e))}</td>
                            <td>${e.pais || '—'}</td>
                            <td>${e.documento || '—'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    } else if (tipoRelatorioAtual === 'tipo') {
        const tiposSel   = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-tipo"]:checked')].map(c => c.value);
        const modelosSel = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-modelo"]:checked')].map(c => c.value);
        let lista = empresas.filter(e => {
            if (tiposSel.includes('ambos')      && _eFabricante(e) && _eFornecedor(e))  return true;
            if (tiposSel.includes('fabricante') && _eFabricante(e) && !_eFornecedor(e)) return true;
            if (tiposSel.includes('fornecedor') && _eFornecedor(e) && !_eFabricante(e)) return true;
            return false;
        });
        if (modelosSel.length) lista = lista.filter(e => modelosSel.includes(_modeloEmpresa(e)));
        const _modeloLabel = m => ({ empresa: 'Nacional', company: 'Estrangeira', transportadora: 'Transportadora', outros: 'Outro' }[m] || m);
        conteudoTabela = `
            <table>
                <thead><tr><th>Empresa</th><th>Tipo</th><th>Modelo</th><th>País</th><th>Documento</th></tr></thead>
                <tbody>
                    ${lista.map(e => `
                        <tr>
                            <td>${e.razao_social || '—'}</td>
                            <td>${_tiposStr(e)}</td>
                            <td>${_modeloLabel(_modeloEmpresa(e))}</td>
                            <td>${e.pais || '—'}</td>
                            <td>${e.documento || '—'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;
    } else if (tipoRelatorioAtual === 'pais') {
        const paisFiltro = document.getElementById('relPaisFiltro')?.value || '';
        const topN = parseInt(document.getElementById('relRankingTop')?.value || '10');
        let lista = empresas;
        if (paisFiltro) lista = lista.filter(e => e.pais === paisFiltro);
        const contagem = {};
        lista.forEach(e => { const p = e.pais || 'Não informado'; contagem[p] = (contagem[p] || 0) + 1; });
        let ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        if (topN > 0) ranking = ranking.slice(0, topN);
        conteudoTabela = `
            <table>
                <thead><tr><th>#</th><th>País</th><th>Empresas</th></tr></thead>
                <tbody>
                    ${ranking.map(([pais, qtd], i) => `<tr><td>${i + 1}</td><td>${pais}</td><td>${qtd}</td></tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'proformas-periodo') {
        const labelsProf = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
        const statusSel  = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-prof-status"]:checked')].map(c => c.value);
        const lista      = filtrarProformasPorDatas().filter(p => statusSel.includes(p.status || 'enviado'));
        totalRegistros   = lista.length;
        conteudoTabela = `
            <table>
                <thead><tr><th>Código</th><th>Destinatário</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
                <tbody>
                    ${lista.map(p => `
                        <tr>
                            <td>${p.codigo || '—'}</td>
                            <td>${p.destinatario_razao_social || '—'}</td>
                            <td>${labelsProf[p.status] || p.status || '—'}</td>
                            <td>${p.moeda_principal || 'USD'} ${Number(p.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'proformas-status') {
        const labelsProf = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', encerrado: 'Encerrado' };
        const lista      = filtrarProformasPorDatas();
        totalRegistros   = lista.length;
        const total      = lista.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>Status</th><th>Quantidade</th><th>Percentual</th></tr></thead>
                <tbody>
                    ${Object.keys(labelsProf).map(st => {
                        const n = lista.filter(p => (p.status || 'enviado') === st).length;
                        return `<tr><td>${labelsProf[st]}</td><td>${n}</td><td>${Math.round((n / total) * 100)}%</td></tr>`;
                    }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'proformas-cliente') {
        const topN  = parseInt(document.getElementById('relRankingTopCliente')?.value || '10');
        const lista = filtrarProformasPorDatas();
        totalRegistros = lista.length;
        const porCliente = {};
        lista.forEach(p => {
            const nome = p.destinatario_razao_social || 'Não informado';
            if (!porCliente[nome]) porCliente[nome] = { qtd: 0, valor: 0, moeda: p.moeda_principal || 'USD' };
            porCliente[nome].qtd++;
            porCliente[nome].valor += Number(p.valor_total) || 0;
        });
        let ranking = Object.entries(porCliente).sort((a, b) => b[1].qtd - a[1].qtd);
        if (topN > 0) ranking = ranking.slice(0, topN);
        conteudoTabela = `
            <table>
                <thead><tr><th>#</th><th>Cliente</th><th>Qtd. Proformas</th><th>Valor Total</th></tr></thead>
                <tbody>
                    ${ranking.map(([nome, info], i) => `<tr><td>${i + 1}</td><td>${nome}</td><td>${info.qtd}</td><td>${info.moeda} ${info.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'processos-periodo') {
        const labelsProc = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
        const statusSel  = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-proc-status"]:checked')].map(c => c.value);
        const lista      = filtrarProcessosPorDatas().filter(p => statusSel.includes(p.status || 'aberto'));
        totalRegistros   = lista.length;
        conteudoTabela = `
            <table>
                <thead><tr><th>Processo</th><th>Tipo</th><th>Status</th><th>Origem → Destino</th><th>Modal</th><th>Valor</th></tr></thead>
                <tbody>
                    ${lista.map(p => `
                        <tr>
                            <td>${p.numero_processo || '—'}</td>
                            <td>${p.tipo || '—'}</td>
                            <td>${labelsProc[p.status] || p.status || '—'}</td>
                            <td>${p.pais_origem || '—'} → ${p.pais_destino || '—'}</td>
                            <td>${p.modal || '—'}</td>
                            <td>${p.moeda || 'USD'} ${Number(p.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'processos-status') {
        const labelsProc = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
        const lista      = filtrarProcessosPorDatas();
        totalRegistros   = lista.length;
        const total      = lista.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>Status</th><th>Quantidade</th><th>Percentual</th></tr></thead>
                <tbody>
                    ${Object.keys(labelsProc).map(st => {
                        const n = lista.filter(p => (p.status || 'aberto') === st).length;
                        return `<tr><td>${labelsProc[st]}</td><td>${n}</td><td>${Math.round((n / total) * 100)}%</td></tr>`;
                    }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'processos-modal') {
        const labelsModal = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };
        const lista       = filtrarProcessosPorDatas();
        totalRegistros    = lista.length;
        const total       = lista.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>Modal</th><th>Quantidade</th><th>Percentual</th></tr></thead>
                <tbody>
                    ${Object.keys(labelsModal).map(md => {
                        const n = lista.filter(p => p.modal === md).length;
                        return `<tr><td>${labelsModal[md]}</td><td>${n}</td><td>${Math.round((n / total) * 100)}%</td></tr>`;
                    }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'produtos-listagem') {
        const labelsProd = { ativo: 'Ativo', pendente: 'Pendente', pausado: 'Pausado', inativo: 'Inativo' };
        const statusSel  = [...document.querySelectorAll('#relParamsEspecificos input[name="rel-prod-status"]:checked')].map(c => c.value);
        const lista      = filtrarProdutosPorDatas().filter(p => statusSel.includes(p.status || 'ativo'));
        totalRegistros   = lista.length;
        conteudoTabela = `
            <table>
                <thead><tr><th>SKU</th><th>Nome</th><th>NCM</th><th>Unidade</th><th>Status</th></tr></thead>
                <tbody>
                    ${lista.map(p => `
                        <tr>
                            <td>${p.sku || '—'}</td>
                            <td>${p.nome || '—'}</td>
                            <td>${p.ncm || '—'}</td>
                            <td>${p.unidade_medida || '—'}</td>
                            <td>${labelsProd[p.status] || p.status || '—'}</td>
                        </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'produtos-ncm') {
        const topN  = parseInt(document.getElementById('relRankingTopNcm')?.value || '10');
        const lista = filtrarProdutosPorDatas();
        totalRegistros = lista.length;
        const contagem = {};
        lista.forEach(p => { const n = p.ncm || 'Não informado'; contagem[n] = (contagem[n] || 0) + 1; });
        let ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        if (topN > 0) ranking = ranking.slice(0, topN);
        const totalLista = lista.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>#</th><th>NCM</th><th>Produtos</th><th>Percentual</th></tr></thead>
                <tbody>
                    ${ranking.map(([ncm, qtd], i) => `<tr><td>${i + 1}</td><td>${ncm}</td><td>${qtd}</td><td>${Math.round((qtd / totalLista) * 100)}%</td></tr>`).join('')}
                </tbody>
            </table>`;
    }

    salvarHistorico(tipoRelatorioAtual);
    fecharModalRelatorio();

    const janela = window.open('', '_blank');
    janela.document.write(`<!DOCTYPE html><html lang="pt-BR"><head>
        <meta charset="UTF-8">
        <title>${cfg.nome}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Segoe UI', sans-serif; color: #1e293b; padding: 40px; }
            .pdf-header { display:flex; align-items:center; gap:16px; margin-bottom:32px; padding-bottom:20px; border-bottom:2px solid #e2e8f0; }
            .pdf-logo { font-size:22px; font-weight:800; color:#4776ec; }
            .pdf-titulo h1 { font-size:20px; font-weight:700; color:#1e293b; }
            .pdf-titulo p { font-size:13px; color:#64748b; margin-top:4px; }
            .pdf-meta { margin-bottom:24px; display:flex; gap:32px; }
            .pdf-meta-item { font-size:13px; color:#64748b; }
            .pdf-meta-item strong { color:#1e293b; display:block; font-size:14px; }
            table { width:100%; border-collapse:collapse; font-size:13px; }
            thead th { background:#f8fafc; padding:10px 14px; text-align:left; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.04em; border-bottom:2px solid #e2e8f0; }
            tbody td { padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#374151; }
            tbody tr:last-child td { border-bottom:none; }
            .pdf-footer { margin-top:32px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:11px; color:#94a3b8; display:flex; justify-content:space-between; }
            @media print { body { padding:20px; } }
        </style>
    </head><body>
        <div class="pdf-header">
            <div class="pdf-logo"><i>M</i> Marpex</div>
            <div class="pdf-titulo">
                <h1>${cfg.nome}</h1>
                <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
        <div class="pdf-meta">
            <div class="pdf-meta-item"><strong>Período</strong>${di} até ${df}</div>
            <div class="pdf-meta-item"><strong>Total de registros</strong>${totalRegistros}</div>
            <div class="pdf-meta-item"><strong>Solicitante</strong>${usuario.nome || '—'}</div>
        </div>
        ${conteudoTabela}
        <div class="pdf-footer">
            <span>© 2026 Marpex — Todos os direitos reservados</span>
            <span>${cfg.nome} · ${new Date().toLocaleDateString('pt-BR')}</span>
        </div>
        <script>window.onload = function(){ window.print(); }<\/script>
    </body></html>`);
    janela.document.close();
}


// ========================================
// HISTÓRICO
// ========================================

function salvarHistorico(tipo) {
    const cfg     = CONFIG_REL[tipo];
    const usuario = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
    const di      = document.getElementById('relDataInicio')?.value || '';
    const df      = document.getElementById('relDataFim')?.value || '';

    const registro = {
        id:       Date.now(),
        tipo:     cfg.nome,
        usuario:  usuario.nome || '—',
        dataGer:  new Date().toISOString(),
        periodo:  di && df ? `${formatarData(di)} – ${formatarData(df)}` : '—',
        formato:  'PDF'
    };

    const lista = JSON.parse(localStorage.getItem(HISTORICO_KEY) || '[]');
    lista.unshift(registro);
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(lista));
    renderHistorico();
}

function renderHistorico() {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;

    const lista = JSON.parse(localStorage.getItem(HISTORICO_KEY) || '[]');

    if (lista.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center;padding:28px;color:#94a3b8;font-size:13px;">
                    <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i>
                    Nenhum relatório gerado ainda.
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = lista.map(r => `
        <tr>
            <td>${r.tipo}</td>
            <td><span class="hist-usuario"><i class="fa-solid fa-user"></i> ${r.usuario}</span></td>
            <td>${new Date(r.dataGer).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
            <td><span class="hist-format pdf">PDF</span></td>
            <td>
                <div class="hist-actions">
                    <button class="hist-btn" title="Período: ${r.periodo}"><i class="fa-solid fa-calendar-days"></i></button>
                    <button class="hist-btn hist-btn-del" title="Remover do histórico" onclick="removerHistorico(${r.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function removerHistorico(id) {
    const lista = JSON.parse(localStorage.getItem(HISTORICO_KEY) || '[]').filter(r => r.id !== id);
    localStorage.setItem(HISTORICO_KEY, JSON.stringify(lista));
    renderHistorico();
}

function formatarData(iso) {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}

// ========================================
// NOTIFICAÇÃO
// ========================================

function mostrarNotificacao(mensagem, tipo = 'info') {
    const icones = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const cores  = { success: '#22C55E', error: '#dc2626', warning: '#f59e0b', info: '#4776ec' };

    const n = document.createElement('div');
    n.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;
    n.style.cssText = `position:fixed;top:100px;right:20px;background:white;color:${cores[tipo]};padding:14px 22px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;font-weight:600;z-index:99999;border-left:4px solid ${cores[tipo]};font-size:14px;`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
}
