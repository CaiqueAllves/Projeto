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
    _relIniciarMostrarMais();

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
            .select('*')
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
// GERAR RELATÓRIO — "Mostrar mais"
// ========================================
// Cada aba mostra só os 5 primeiros cards; o botão no canto direito do título
// "Gerar Relatório" expande/recolhe o resto (só aparece se houver mais de 5).

const REL_CARDS_VISIVEIS = 5;

function _relIniciarMostrarMais() {
    document.querySelectorAll('.report-grid').forEach(grid => {
        if (grid.querySelectorAll('.report-card').length <= REL_CARDS_VISIVEIS) return;
        const header = grid.previousElementSibling;
        if (!header?.classList.contains('section-header')) return;
        grid.classList.add('rel-recolhido');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rel-mostrar-mais';
        btn.innerHTML = 'Mostrar mais <i class="fa-solid fa-chevron-down"></i>';
        btn.addEventListener('click', () => {
            const recolher = !grid.classList.contains('rel-recolhido');
            grid.classList.toggle('rel-recolhido', recolher);
            btn.innerHTML = recolher
                ? 'Mostrar mais <i class="fa-solid fa-chevron-down"></i>'
                : 'Mostrar menos <i class="fa-solid fa-chevron-up"></i>';
        });
        header.appendChild(btn);
    });
}

// ========================================
// SELETOR DE MÓDULO
// ========================================

function relSwitchModulo(modulo, btn) {
    document.querySelectorAll('.rel-secao').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.rel-modulo-tab').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const sec = document.getElementById('rel-sec-' + modulo);
    if (sec) sec.style.display = 'block';
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
        nome:  'Relatório Completo de Produtos',
        semPeriodo: true,
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
    document.getElementById('relParamsEspecificos').innerHTML =
        EXT_REL[tipo] ? _extParams(tipo) : cfg.params;

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

    // Relatórios "Completo" pegam tudo: sem período (datas vazias = sem filtro).
    const semPeriodo = !!cfg.semPeriodo;
    document.querySelectorAll('#modalRelatorio .rel-bloco-periodo').forEach(b => b.style.display = semPeriodo ? 'none' : '');
    if (semPeriodo) {
        document.getElementById('relDataInicio').value = '';
        document.getElementById('relDataFim').value    = '';
    }

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

    if (EXT_REL[tipoRelatorioAtual]) { el.innerHTML = _extPreview(tipoRelatorioAtual); return; }

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
            <div class="prev-linha"><span>Total de produtos</span><strong>${lista.length}</strong></div>
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

    if (EXT_REL[tipoRelatorioAtual]) {
        const r = _extConteudoPDF(tipoRelatorioAtual);
        conteudoTabela = r.html;
        totalRegistros = r.total;
    } else if (tipoRelatorioAtual === 'periodo') {
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
                <thead><tr><th>Código</th><th>Importador</th><th>Status</th><th>Valor</th><th>Data</th></tr></thead>
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
            h2.pdf-grupo { font-size:14px; color:#1e293b; margin:26px 0 8px; padding:8px 12px; background:#f1f5f9; border-left:4px solid #4776ec; border-radius:4px; display:flex; justify-content:space-between; }
            h2.pdf-grupo span { font-weight:500; color:#64748b; font-size:12px; }
            .pdf-resumo { margin-bottom:8px; }
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
            <div class="pdf-meta-item"><strong>Período</strong>${di === '—' && df === '—' ? 'Todos os registros' : `${di} até ${df}`}</div>
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

// ========================================
// RELATÓRIOS EXTRAS (cards novos por aba)
// ========================================
// Empresas:  Completo / Comprador / Exportador / Importador / Status / Fornecedor
// Produtos:  Período / Status
// Proformas e Processos: Comprador / Exportador / Importador / Fornecedor
//
// Quem é quem numa operação (Proforma ou Processo):
//   - Exportador: parceiro escolhido como Exportador (emissor "Terceiro") ou
//     a própria empresa (emissor "Usuário");
//   - Importador: destinatário da Proforma / do Processo;
//   - Comprador: Exportador/Importador marcado como "Comprador" no cadastro;
//   - Fornecedor: empresa dona de cada produto dos itens (produtos.empresa_parceira_id).

const REL_STATUS_PROF = { pendente: 'Pendente', enviado: 'Enviado', aprovado: 'Aprovado', encerrado: 'Encerrado' };
const REL_STATUS_PROC = { aberto: 'Aberto', em_andamento: 'Em Andamento', aguardando_documentos: 'Aguard. Documentos', concluido: 'Concluído', cancelado: 'Cancelado' };
const REL_STATUS_EMP  = { ativo: 'Ativo', inativo: 'Inativo' };
const REL_STATUS_PROD = { ativo: 'Ativo', pendente: 'Pendente', pausado: 'Pausado', inativo: 'Inativo' };
const REL_MODAL       = { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };
const REL_PAPEL       = { comprador: 'Comprador', exportador: 'Exportador', importador: 'Importador', fornecedor: 'Fornecedor', status: 'Status' };

const EXT_REL = {
    'emp-completo':    { base: 'emp',  modo: 'completo',   nome: 'Relatório Completo de Empresas',   icone: 'fa-solid fa-layer-group',     cor: 'linear-gradient(135deg,#334155,#0f172a)', semPeriodo: true },
    'emp-comprador':   { base: 'emp',  modo: 'comprador',  nome: 'Empresas — Compradores',           icone: 'fa-solid fa-cart-shopping',   cor: 'linear-gradient(135deg,#0891b2,#0e7490)' },
    'emp-exportador':  { base: 'emp',  modo: 'exportador', nome: 'Empresas — Exportadores',          icone: 'fa-solid fa-plane-departure', cor: 'linear-gradient(135deg,#4776ec,#6366f1)' },
    'emp-importador':  { base: 'emp',  modo: 'importador', nome: 'Empresas — Importadores',          icone: 'fa-solid fa-plane-arrival',   cor: 'linear-gradient(135deg,#22c55e,#16a34a)' },
    'emp-status':      { base: 'emp',  modo: 'status',     nome: 'Empresas por Status',              icone: 'fa-solid fa-signal',          cor: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', semPeriodo: true },
    'emp-fornecedor':  { base: 'emp',  modo: 'fornecedor', nome: 'Empresas — Fornecedores',          icone: 'fa-solid fa-industry',        cor: 'linear-gradient(135deg,#d97706,#b45309)' },
    'produtos-periodo':{ base: 'prod', modo: 'periodo',    nome: 'Produtos por Período',             icone: 'fa-solid fa-calendar',        cor: 'linear-gradient(135deg,#4776ec,#6366f1)' },
    'produtos-status': { base: 'prod', modo: 'status',     nome: 'Produtos por Status',              icone: 'fa-solid fa-signal',          cor: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', semPeriodo: true },
    'prof-comprador':  { base: 'prof', modo: 'comprador',  nome: 'Proformas por Comprador',          icone: 'fa-solid fa-cart-shopping',   cor: 'linear-gradient(135deg,#0891b2,#0e7490)' },
    'prof-exportador': { base: 'prof', modo: 'exportador', nome: 'Proformas por Exportador',         icone: 'fa-solid fa-plane-departure', cor: 'linear-gradient(135deg,#4776ec,#6366f1)' },
    'prof-importador': { base: 'prof', modo: 'importador', nome: 'Proformas por Importador',         icone: 'fa-solid fa-plane-arrival',   cor: 'linear-gradient(135deg,#22c55e,#16a34a)' },
    'prof-fornecedor': { base: 'prof', modo: 'fornecedor', nome: 'Proformas por Fornecedor',         icone: 'fa-solid fa-industry',        cor: 'linear-gradient(135deg,#d97706,#b45309)' },
    'proc-comprador':  { base: 'proc', modo: 'comprador',  nome: 'Processos por Comprador',          icone: 'fa-solid fa-cart-shopping',   cor: 'linear-gradient(135deg,#0891b2,#0e7490)' },
    'proc-exportador': { base: 'proc', modo: 'exportador', nome: 'Processos por Exportador',         icone: 'fa-solid fa-plane-departure', cor: 'linear-gradient(135deg,#9333ea,#6366f1)' },
    'proc-importador': { base: 'proc', modo: 'importador', nome: 'Processos por Importador',         icone: 'fa-solid fa-plane-arrival',   cor: 'linear-gradient(135deg,#22c55e,#16a34a)' },
    'proc-fornecedor': { base: 'proc', modo: 'fornecedor', nome: 'Processos por Fornecedor',         icone: 'fa-solid fa-industry',        cor: 'linear-gradient(135deg,#d97706,#b45309)' },
};
Object.entries(EXT_REL).forEach(([k, c]) => {
    CONFIG_REL[k] = { nome: c.nome, cor: c.cor, icone: c.icone, params: '', semPeriodo: !!c.semPeriodo };
});

// ── Utilitários ─────────────────────────────────

let _extPropriaEmpresa = 'Própria empresa';
(async () => {
    try {
        const usuario = obterUsuarioLogado();
        const { data } = await supabaseClient.from('empresas').select('razao_social, nome_fantasia').eq('id', usuario.empresa_id).maybeSingle();
        if (data) _extPropriaEmpresa = data.nome_fantasia || data.razao_social || _extPropriaEmpresa;
    } catch {}
})();

function _extEsc(v) {
    return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _extNome(e) { return e ? (e.nome_fantasia || e.razao_social || '—') : null; }
function _extEmp(id) { return id ? todasEmpresas.find(x => String(x.id) === String(id)) : null; }
function _extData(iso) { return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'; }
function _extValores(v) {
    const ks = Object.keys(v || {}).filter(m => v[m]);
    return ks.length ? ks.map(m => `${m} ${v[m].toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`).join(' + ') : '—';
}
function _extSomar(linhas) {
    const v = {};
    linhas.forEach(l => { v[l.moeda] = (v[l.moeda] || 0) + l.valor; });
    return v;
}
function _extMarcados(nome) {
    const cbs = [...document.querySelectorAll(`#relParamsEspecificos input[name="${nome}"]`)];
    return cbs.length ? cbs.filter(c => c.checked).map(c => c.value) : null;
}
function _extChecks(nome, labels) {
    return `<div class="rel-check-row">${Object.entries(labels).map(([v, l]) =>
        `<label class="rel-check"><input type="checkbox" name="${nome}" value="${v}" checked> ${l}</label>`).join('')}</div>`;
}
function _extSemDatas(fn) {
    const di = document.getElementById('relDataInicio'), df = document.getElementById('relDataFim');
    const salvo = [di?.value, df?.value];
    if (di) di.value = ''; if (df) df.value = '';
    try { return fn(); } finally { if (di) di.value = salvo[0]; if (df) df.value = salvo[1]; }
}

// ── Operações (Proformas / Processos) ───────────

function _extLinhasOps(base) {
    const prodPorId = {};
    todasProdutos.forEach(p => { prodPorId[String(p.id)] = p; });
    const fornecedoresDe = itens => [...new Set((Array.isArray(itens) ? itens : [])
        .map(it => prodPorId[String(it.produto_id)]?.empresa_parceira_id)
        .filter(Boolean).map(String))];
    const compradoresDe = ids => ids.filter(id => id && _extEmp(id)?.is_comprador).map(String);

    if (base === 'prof') {
        const procPorProf = {};
        todasProcessos.forEach(pr => { if (pr.proforma_id) (procPorProf[pr.proforma_id] ||= []).push(pr); });
        return filtrarProformasPorDatas().map(p => {
            const expId = p.emissor_tipo === 'terceiro' ? p.parceiro_id : null;
            return {
                codigo: p.codigo || '—', data: p.created_at,
                status: p.status || 'enviado', statusLabel: REL_STATUS_PROF[p.status] || p.status || '—',
                expId: expId ? String(expId) : 'propria',
                exportador: expId ? (_extNome(_extEmp(expId)) || p.parceiro_razao_social || 'Não informado') : _extPropriaEmpresa,
                impId: p.destinatario_id ? String(p.destinatario_id) : null,
                importador: _extNome(_extEmp(p.destinatario_id)) || p.destinatario_razao_social || 'Não informado',
                compradores: compradoresDe([expId, p.destinatario_id]),
                fornecedores: fornecedoresDe(p.itens),
                moeda: p.moeda_principal || 'USD', valor: Number(p.valor_total) || 0,
                extra: (procPorProf[p.id] || []).map(pr => pr.numero_processo || '—').join(', ') || '—',
            };
        });
    }
    const codProf = {};
    todasProformas.forEach(p => { codProf[p.id] = p.codigo; });
    return filtrarProcessosPorDatas().map(pr => {
        const expId = pr.emissor_tipo === 'terceiro' ? pr.remetente_parceiro_id : null;
        return {
            codigo: pr.numero_processo || '—', data: pr.criado_em,
            status: pr.status || 'aberto', statusLabel: REL_STATUS_PROC[pr.status] || pr.status || '—',
            expId: expId ? String(expId) : 'propria',
            exportador: expId ? (_extNome(_extEmp(expId)) || 'Não informado') : _extPropriaEmpresa,
            impId: pr.empresa_parceira_id ? String(pr.empresa_parceira_id) : null,
            importador: _extNome(_extEmp(pr.empresa_parceira_id)) || 'Não informado',
            compradores: compradoresDe([expId, pr.empresa_parceira_id]),
            fornecedores: fornecedoresDe(pr.itens),
            moeda: pr.moeda || 'USD', valor: Number(pr.valor_total) || 0,
            extra: codProf[pr.proforma_id] || '—',
            modal: REL_MODAL[pr.modal] || pr.modal || '—',
        };
    });
}

// Chaves (ids) do agrupamento de uma linha; nomes resolvidos em _extNomeChave
function _extChaves(modo, l) {
    switch (modo) {
        case 'comprador':  return l.compradores.length ? l.compradores : ['__sem'];
        case 'exportador': return [l.expId];
        case 'importador': return [l.impId || '__sem'];
        case 'fornecedor': return l.fornecedores.length ? l.fornecedores : ['__sem'];
    }
    return [];
}
function _extNomeChave(modo, chave, l) {
    if (chave === '__sem') return { comprador: 'Sem comprador identificado', importador: 'Sem importador', fornecedor: 'Sem fornecedor (itens sem produto cadastrado)' }[modo];
    if (chave === 'propria') return _extPropriaEmpresa;
    if (modo === 'exportador' && l) return l.exportador;
    if (modo === 'importador' && l) return l.importador;
    return _extNome(_extEmp(chave)) || 'Não informado';
}

function _extAgruparOps(modo, linhas) {
    const g = {};
    linhas.forEach(l => _extChaves(modo, l).forEach(k => {
        (g[k] ||= { chave: k, nome: _extNomeChave(modo, k, l), linhas: [] }).linhas.push(l);
    }));
    return Object.values(g).map(x => ({ ...x, valores: _extSomar(x.linhas) }))
        .sort((a, b) => (a.chave === '__sem') - (b.chave === '__sem') || b.linhas.length - a.linhas.length || a.nome.localeCompare(b.nome));
}

// ── Empresas ────────────────────────────────────

// Empresa entra no relatório do papel se estiver marcada no cadastro OU (para
// Exportador/Importador) já tiver aparecido nesse papel em alguma operação.
function _extEmpresasDoPapel(modo) {
    const ops = _extSemDatas(() => [..._extLinhasOps('prof'), ..._extLinhasOps('proc')]);
    const usadosExp = new Set(ops.map(l => l.expId));
    const usadosImp = new Set(ops.map(l => l.impId).filter(Boolean));
    return todasEmpresas.filter(e => {
        const id = String(e.id);
        switch (modo) {
            case 'comprador':  return !!e.is_comprador;
            case 'exportador': return !!e.is_remetente || usadosExp.has(id);
            case 'importador': return !!e.is_importador || usadosImp.has(id);
            case 'fornecedor': return !!e.is_fornecedor || !!e.is_fabricante;
            default:           return true;
        }
    });
}

// Operações (Proformas, no período) em que a empresa aparece naquele papel
function _extOpsDaEmpresa(modo, e, linhasProf) {
    const id = String(e.id);
    return linhasProf.filter(l => {
        if (modo === 'exportador') return l.expId === id;
        if (modo === 'importador') return l.impId === id;
        if (modo === 'comprador')  return l.compradores.includes(id);
        if (modo === 'fornecedor') return l.fornecedores.includes(id);
        return l.expId === id || l.impId === id;
    });
}

function _extLinhasEmp(modo) {
    const statusSel = _extMarcados('rel-ext-emp-status');
    const alvo      = document.getElementById('relExtAlvo')?.value || '';
    const linhasProf = _extLinhasOps('prof');
    const nProdutos = {};
    todasProdutos.forEach(p => { if (p.empresa_parceira_id) nProdutos[p.empresa_parceira_id] = (nProdutos[p.empresa_parceira_id] || 0) + 1; });
    return _extEmpresasDoPapel(modo)
        .filter(e => !statusSel || statusSel.includes(e.status || 'ativo'))
        .filter(e => !alvo || String(e.id) === alvo)
        .map(e => {
            const ops = _extOpsDaEmpresa(modo, e, linhasProf);
            return { e, nome: _extNome(e), ops, valores: _extSomar(ops), produtos: nProdutos[e.id] || 0 };
        })
        .sort((a, b) => b.ops.length - a.ops.length || a.nome.localeCompare(b.nome));
}

// ── Parâmetros do modal ─────────────────────────

function _extParams(tipo) {
    const c = EXT_REL[tipo];
    const grupo = (rotulo, icone, corpo) => `
        <div class="rel-param-group">
            <label class="rel-param-label"><i class="${icone}"></i> ${rotulo}</label>
            ${corpo}
        </div>`;
    const selectAlvo = (rotulo, icone, opcoes) => grupo(rotulo, icone, `
        <select id="relExtAlvo" class="rel-select" onchange="atualizarPreviewModal()">
            <option value="">Todos</option>
            ${opcoes.map(([v, n]) => `<option value="${_extEsc(v)}">${_extEsc(n)}</option>`).join('')}
        </select>`);

    if (c.base === 'emp') {
        let html = c.modo === 'status' ? '' : grupo('Status do cadastro', 'fa-solid fa-filter', _extChecks('rel-ext-emp-status', REL_STATUS_EMP));
        if (!['completo', 'status'].includes(c.modo)) {
            const lista = _extEmpresasDoPapel(c.modo).map(e => [String(e.id), _extNome(e)]).sort((a, b) => a[1].localeCompare(b[1]));
            html += selectAlvo(REL_PAPEL[c.modo], 'fa-solid fa-building', lista);
        }
        return html;
    }
    if (c.base === 'prod') {
        return c.modo === 'periodo' ? grupo('Status', 'fa-solid fa-filter', _extChecks('rel-ext-prod-status', REL_STATUS_PROD)) : '';
    }
    // prof / proc
    const labels = c.base === 'prof' ? REL_STATUS_PROF : REL_STATUS_PROC;
    const grupos = _extSemDatas(() => _extAgruparOps(c.modo, _extLinhasOps(c.base)));
    return grupo(c.base === 'prof' ? 'Status da Proforma' : 'Status do Processo', 'fa-solid fa-filter', _extChecks('rel-ext-status', labels))
         + selectAlvo(REL_PAPEL[c.modo], 'fa-solid fa-building', grupos.map(g => [g.chave, g.nome]));
}

// ── Dados filtrados pelo modal ──────────────────

function _extOpsFiltradas(tipo) {
    const c = EXT_REL[tipo];
    let linhas = _extLinhasOps(c.base);
    const st = _extMarcados('rel-ext-status');
    if (st) linhas = linhas.filter(l => st.includes(l.status));
    let grupos = _extAgruparOps(c.modo, linhas);
    const alvo = document.getElementById('relExtAlvo')?.value;
    if (alvo) grupos = grupos.filter(g => g.chave === alvo);
    return grupos;
}

function _extProdutos(tipo) {
    const c = EXT_REL[tipo];
    let lista = filtrarProdutosPorDatas();
    const st = _extMarcados('rel-ext-prod-status');
    if (st) lista = lista.filter(p => st.includes(p.status || 'ativo'));
    return lista;
}

// ── Prévia ──────────────────────────────────────

function _extPreview(tipo) {
    const c = EXT_REL[tipo];
    const vazio = `<div class="prev-vazio">Nenhum resultado encontrado</div>`;
    const linha = (a, b) => `<div class="prev-linha"><span>${a}</span><strong>${b}</strong></div>`;

    if (c.base === 'emp') {
        const lista = _extLinhasEmp(c.modo);
        if (!lista.length) return vazio;
        if (c.modo === 'status') {
            const total = lista.length || 1;
            return Object.entries(REL_STATUS_EMP).map(([v, l]) => {
                const n = lista.filter(x => (x.e.status || 'ativo') === v).length;
                return linha(l, `${n} (${Math.round(n / total * 100)}%)`);
            }).join('');
        }
        if (c.modo === 'completo') {
            return linha('Empresas', lista.length)
                + Object.entries(REL_STATUS_EMP).map(([v, l]) => linha(l, lista.filter(x => (x.e.status || 'ativo') === v).length)).join('')
                + linha('Países distintos', new Set(lista.map(x => x.e.pais).filter(Boolean)).size);
        }
        return linha(REL_PAPEL[c.modo] + (c.modo.endsWith('r') ? 'es' : 's'), lista.length)
            + lista.slice(0, 8).map((x, i) => linha(`<b>${i + 1}.</b> ${_extEsc(x.nome)}`, `${x.ops.length} prof.`)).join('');
    }

    if (c.base === 'prod') {
        const lista = _extProdutos(tipo);
        if (!lista.length) return vazio;
        const total = lista.length || 1;
        return (c.modo === 'periodo' ? linha('Total no período', lista.length) : '')
            + Object.entries(REL_STATUS_PROD).map(([v, l]) => {
                const n = lista.filter(p => (p.status || 'ativo') === v).length;
                return linha(l, c.modo === 'status' ? `${n} (${Math.round(n / total * 100)}%)` : n);
            }).join('');
    }

    const grupos = _extOpsFiltradas(tipo);
    if (!grupos.length) return vazio;
    const un = c.base === 'prof' ? 'prof.' : 'proc.';
    return grupos.slice(0, 10).map((g, i) => linha(`<b>${i + 1}.</b> ${_extEsc(g.nome)}`, `${g.linhas.length} ${un}`)).join('')
        + (grupos.length > 10 ? linha(`… e mais ${grupos.length - 10}`, '') : '');
}

// ── PDF ─────────────────────────────────────────

const _EXT_PDF_PAISAGEM = `
    <style>
        @page { size: A4 landscape; }
        table { font-size: 11px; }
        thead th, tbody td { padding: 7px 8px; }
    </style>`;

function _extTabelaOps(base, linhas) {
    const procs = base === 'prof';
    return `
        <table>
            <thead><tr>
                <th>${procs ? 'Proforma' : 'Processo'}</th><th>Data</th><th>Exportador</th><th>Importador</th><th>Status</th>
                ${procs ? '<th>Processos</th>' : '<th>Proforma</th><th>Modal</th>'}<th>Valor</th>
            </tr></thead>
            <tbody>
                ${linhas.map(l => `
                    <tr>
                        <td>${_extEsc(l.codigo)}</td>
                        <td style="white-space:nowrap;">${_extData(l.data)}</td>
                        <td>${_extEsc(l.exportador)}</td>
                        <td>${_extEsc(l.importador)}</td>
                        <td style="white-space:nowrap;">${_extEsc(l.statusLabel)}</td>
                        <td>${_extEsc(l.extra)}</td>
                        ${procs ? '' : `<td>${_extEsc(l.modal)}</td>`}
                        <td style="white-space:nowrap;">${l.moeda} ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    </tr>`).join('')}
            </tbody>
        </table>`;
}

function _extConteudoPDF(tipo) {
    const c = EXT_REL[tipo];
    const nada = msg => ({ total: 0, html: `<p style="color:#64748b;">${msg}</p>` });

    // ── Empresas ──
    if (c.base === 'emp') {
        const lista = _extLinhasEmp(c.modo);
        if (!lista.length) return nada('Nenhuma empresa encontrada para os filtros escolhidos.');
        const status = e => REL_STATUS_EMP[e.status || 'ativo'] || e.status;
        const local  = e => [e.cidade, e.estado, e.pais].filter(Boolean).join(' / ') || '—';

        if (c.modo === 'completo' || c.modo === 'status') {
            const tabela = itens => `
                <table>
                    <thead><tr><th>Empresa</th><th>Documento</th><th>Tipos</th><th>Localização</th><th>E-mail</th><th>Telefone</th><th>Status</th><th>Proformas</th></tr></thead>
                    <tbody>${itens.map(x => `
                        <tr><td>${_extEsc(x.e.razao_social || x.nome)}</td><td>${_extEsc(x.e.documento || '—')}</td><td>${_extEsc(_tiposStr(x.e))}</td>
                        <td>${_extEsc(local(x.e))}</td><td>${_extEsc(x.e.email || '—')}</td><td>${_extEsc(x.e.telefone || '—')}</td>
                        <td>${status(x.e)}</td><td>${x.ops.length}</td></tr>`).join('')}
                    </tbody>
                </table>`;
            if (c.modo === 'completo') return { total: lista.length, html: _EXT_PDF_PAISAGEM + tabela(lista) };
            return { total: lista.length, html: _EXT_PDF_PAISAGEM + Object.entries(REL_STATUS_EMP).map(([v, l]) => {
                const itens = lista.filter(x => (x.e.status || 'ativo') === v);
                return itens.length ? `<h2 class="pdf-grupo">${l} <span>${itens.length} empresa${itens.length !== 1 ? 's' : ''}</span></h2>${tabela(itens)}` : '';
            }).join('') };
        }

        const fornecedor = c.modo === 'fornecedor';
        const resumo = `
            <table class="pdf-resumo">
                <thead><tr><th>#</th><th>Empresa</th><th>Documento</th><th>País</th><th>Status</th>${fornecedor ? '<th>Produtos</th>' : ''}<th>Proformas</th><th>Valor</th></tr></thead>
                <tbody>${lista.map((x, i) => `
                    <tr><td>${i + 1}</td><td>${_extEsc(x.nome)}</td><td>${_extEsc(x.e.documento || '—')}</td><td>${_extEsc(x.e.pais || '—')}</td>
                    <td>${status(x.e)}</td>${fornecedor ? `<td>${x.produtos}</td>` : ''}<td>${x.ops.length}</td><td>${_extValores(x.valores)}</td></tr>`).join('')}
                </tbody>
            </table>`;
        const detalhes = lista.filter(x => x.ops.length).map(x => `
            <h2 class="pdf-grupo">${_extEsc(x.nome)} <span>${x.ops.length} proforma${x.ops.length !== 1 ? 's' : ''} · ${_extValores(x.valores)}</span></h2>
            ${_extTabelaOps('prof', x.ops)}`).join('');
        return { total: lista.length, html: resumo + detalhes };
    }

    // ── Produtos ──
    if (c.base === 'prod') {
        const lista = _extProdutos(tipo);
        if (!lista.length) return nada('Nenhum produto encontrado para os filtros escolhidos.');
        const tabela = itens => `
            <table>
                <thead><tr><th>SKU</th><th>Nome</th><th>NCM</th><th>Unidade</th><th>Fornecedor</th><th>Status</th><th>Cadastro</th></tr></thead>
                <tbody>${itens.map(p => `
                    <tr><td>${_extEsc(p.sku || '—')}</td><td>${_extEsc(p.nome || '—')}</td><td>${_extEsc(p.ncm || '—')}</td><td>${_extEsc(p.unidade_medida || '—')}</td>
                    <td>${_extEsc(_extNome(_extEmp(p.empresa_parceira_id)) || '—')}</td><td>${REL_STATUS_PROD[p.status || 'ativo'] || _extEsc(p.status)}</td><td>${_extData(p.criado_em)}</td></tr>`).join('')}
                </tbody>
            </table>`;
        if (c.modo === 'periodo') return { total: lista.length, html: tabela(lista) };
        return { total: lista.length, html: Object.entries(REL_STATUS_PROD).map(([v, l]) => {
            const itens = lista.filter(p => (p.status || 'ativo') === v);
            return itens.length ? `<h2 class="pdf-grupo">${l} <span>${itens.length} produto${itens.length !== 1 ? 's' : ''}</span></h2>${tabela(itens)}` : '';
        }).join('') };
    }

    // ── Proformas / Processos ──
    const grupos = _extOpsFiltradas(tipo);
    if (!grupos.length) return nada(`Nenhum${c.base === 'prof' ? 'a proforma encontrada' : ' processo encontrado'} para os filtros escolhidos.`);
    const unid  = c.base === 'prof' ? ['proforma', 'proformas'] : ['processo', 'processos'];
    const total = new Set(grupos.flatMap(g => g.linhas)).size;
    const resumo = `
        <table class="pdf-resumo">
            <thead><tr><th>#</th><th>${REL_PAPEL[c.modo]}</th><th>${unid[1][0].toUpperCase() + unid[1].slice(1)}</th><th>Valor</th></tr></thead>
            <tbody>${grupos.map((g, i) => `<tr><td>${i + 1}</td><td>${_extEsc(g.nome)}</td><td>${g.linhas.length}</td><td>${_extValores(g.valores)}</td></tr>`).join('')}</tbody>
        </table>`;
    const detalhes = grupos.map(g => `
        <h2 class="pdf-grupo">${_extEsc(g.nome)} <span>${g.linhas.length} ${unid[g.linhas.length !== 1 ? 1 : 0]} · ${_extValores(g.valores)}</span></h2>
        ${_extTabelaOps(c.base, g.linhas)}`).join('');
    return { total, html: resumo + detalhes };
}
