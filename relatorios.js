// ========================================
// RELATÓRIOS — EMPRESA
// ========================================

let periodoAtual = 'mensal';

let todasEmpresas = [];
const HISTORICO_KEY = 'relatoriosHistorico';

document.addEventListener('DOMContentLoaded', async function () {
    verificarPermissoes();

    const resultado = await buscarEmpresasCadastradas();
    todasEmpresas = resultado.sucesso ? resultado.data : [];

    carregarStats(todasEmpresas);
    renderPreviewPeriodo(todasEmpresas);
    renderPreviewTipo(todasEmpresas);
    renderPreviewPais(todasEmpresas);
    renderHistorico();
});

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
    const total       = empresas.length;
    const clientes    = empresas.filter(e => e.tipos && e.tipos.includes('cliente')).length;
    const fornecedores= empresas.filter(e => e.tipos && e.tipos.includes('fornecedor')).length;
    const paises      = new Set(empresas.map(e => e.pais).filter(Boolean)).size;

    document.getElementById('totalEmpresas').textContent    = total;
    document.getElementById('totalClientes').textContent    = clientes;
    document.getElementById('totalFornecedores').textContent= fornecedores;
    document.getElementById('totalPaises').textContent      = paises;
}

// ========================================
// PREVIEWS DOS CARDS
// ========================================

function renderPreviewPeriodo(empresas) {
    const el = document.getElementById('previewPeriodo');
    if (!el) return;

    const agora = new Date();
    const limites = { mensal: 30, trimestral: 90, anual: 365 };
    const dias = limites[periodoAtual] || 30;
    const corte = new Date();
    corte.setDate(corte.getDate() - dias);

    const doPeriodo = empresas.filter(e => e.criado_em && new Date(e.criado_em) >= corte);
    const clientes   = doPeriodo.filter(e => e.tipos && e.tipos.includes('cliente')).length;
    const fornecedores = doPeriodo.filter(e => e.tipos && e.tipos.includes('fornecedor')).length;

    el.innerHTML = `
        <div class="preview-stat-row">
            <span class="preview-num" style="color:#4776ec;">${doPeriodo.length}</span>
            <span class="preview-label">empresas no período</span>
        </div>
        <div class="preview-sub-row">
            <span class="preview-chip" style="background:#eff6ff;color:#3b82f6;">${clientes} cliente${clientes !== 1 ? 's' : ''}</span>
            <span class="preview-chip" style="background:#fefce8;color:#ca8a04;">${fornecedores} fornecedor${fornecedores !== 1 ? 'es' : ''}</span>
        </div>
    `;
}

function renderPreviewTipo(empresas) {
    const el = document.getElementById('previewTipo');
    if (!el) return;

    const total = empresas.length || 1;
    const clientes    = empresas.filter(e => e.tipos && e.tipos.includes('cliente') && !(e.tipos.includes('fornecedor'))).length;
    const fornecedores= empresas.filter(e => e.tipos && e.tipos.includes('fornecedor') && !(e.tipos.includes('cliente'))).length;
    const ambos       = empresas.filter(e => e.tipos && e.tipos.includes('cliente') && e.tipos.includes('fornecedor')).length;

    const pct = n => Math.round((n / total) * 100);

    el.innerHTML = `
        <div class="preview-bar-item">
            <span class="preview-bar-label"><span style="color:#22c55e;">●</span> Clientes</span>
            <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct(clientes)}%;background:#22c55e;"></div></div>
            <span class="preview-bar-val">${clientes}</span>
        </div>
        <div class="preview-bar-item">
            <span class="preview-bar-label"><span style="color:#f59e0b;">●</span> Fornecedores</span>
            <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct(fornecedores)}%;background:#f59e0b;"></div></div>
            <span class="preview-bar-val">${fornecedores}</span>
        </div>
        <div class="preview-bar-item">
            <span class="preview-bar-label"><span style="color:#6366f1;">●</span> Ambos</span>
            <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct(ambos)}%;background:#6366f1;"></div></div>
            <span class="preview-bar-val">${ambos}</span>
        </div>
    `;
}

function renderPreviewPais(empresas) {
    const el = document.getElementById('previewPais');
    if (!el) return;

    const contagem = {};
    empresas.forEach(e => {
        const p = e.pais || 'Não informado';
        contagem[p] = (contagem[p] || 0) + 1;
    });

    const ranking = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    const max = ranking[0]?.[1] || 1;

    if (ranking.length === 0) {
        el.innerHTML = `<div class="preview-vazio">Nenhuma empresa cadastrada</div>`;
        return;
    }

    el.innerHTML = ranking.map(([pais, qtd], i) => `
        <div class="preview-bar-item">
            <span class="preview-bar-label preview-rank"><span class="rank-num">${i + 1}</span>${pais}</span>
            <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${Math.round((qtd/max)*100)}%;background:#22c55e;"></div></div>
            <span class="preview-bar-val">${qtd}</span>
        </div>
    `).join('');
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
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Tipo de Empresa</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="cliente" checked> Clientes</label>
                    <label class="rel-check"><input type="checkbox" value="fornecedor" checked> Fornecedores</label>
                    <label class="rel-check"><input type="checkbox" value="ambos" checked> Ambos</label>
                </div>
            </div>`
    },
    tipo: {
        nome:  'Relatório por Tipo',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-chart-bar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Incluir tipos</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="cliente" checked> Clientes</label>
                    <label class="rel-check"><input type="checkbox" value="fornecedor" checked> Fornecedores</label>
                    <label class="rel-check"><input type="checkbox" value="ambos" checked> Ambos (Cliente + Fornecedor)</label>
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

    // Datas padrão (início do mês até hoje)
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    document.getElementById('relDataInicio').value = inicioMes.toISOString().split('T')[0];
    document.getElementById('relDataFim').value    = hoje.toISOString().split('T')[0];

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
        if (!e.criado_em) return true;
        const d = new Date(e.criado_em);
        return d >= inicio && d <= fim;
    });
}

function atualizarPreviewModal() {
    const el = document.getElementById('relPreviewConteudo');
    if (!el || !tipoRelatorioAtual) return;

    const empresas = filtrarEmpresasPorDatas();

    if (tipoRelatorioAtual === 'periodo') {
        const tipos = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtradas = empresas.filter(e => {
            if (!e.tipos) return false;
            if (tipos.includes('ambos') && e.tipos.includes('cliente') && e.tipos.includes('fornecedor')) return true;
            if (tipos.includes('cliente') && e.tipos.includes('cliente') && !e.tipos.includes('fornecedor')) return true;
            if (tipos.includes('fornecedor') && e.tipos.includes('fornecedor') && !e.tipos.includes('cliente')) return true;
            return false;
        });
        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${filtradas.length} empresa${filtradas.length !== 1 ? 's' : ''}</strong></div>
            <div class="prev-linha"><span>Países distintos</span><strong>${new Set(filtradas.map(e => e.pais).filter(Boolean)).size}</strong></div>
        `;

    } else if (tipoRelatorioAtual === 'tipo') {
        const total = empresas.length;
        const c = empresas.filter(e => e.tipos?.includes('cliente') && !e.tipos?.includes('fornecedor')).length;
        const f = empresas.filter(e => e.tipos?.includes('fornecedor') && !e.tipos?.includes('cliente')).length;
        const a = empresas.filter(e => e.tipos?.includes('cliente') && e.tipos?.includes('fornecedor')).length;
        el.innerHTML = `
            <div class="prev-linha"><span>Total</span><strong>${total}</strong></div>
            <div class="prev-linha"><span>Clientes</span><strong>${c}</strong></div>
            <div class="prev-linha"><span>Fornecedores</span><strong>${f}</strong></div>
            <div class="prev-linha"><span>Ambos</span><strong>${a}</strong></div>
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

    if (tipoRelatorioAtual === 'periodo' || tipoRelatorioAtual === 'tipo') {
        conteudoTabela = `
            <table>
                <thead><tr><th>Empresa</th><th>Tipo</th><th>País</th><th>Documento</th></tr></thead>
                <tbody>
                    ${empresas.map(e => `
                        <tr>
                            <td>${e.nome_empresa || '—'}</td>
                            <td>${(e.tipos || []).join(', ') || '—'}</td>
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
            <div class="pdf-meta-item"><strong>Total de registros</strong>${empresas.length}</div>
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
