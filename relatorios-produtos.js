// ========================================
// RELATÓRIOS — PRODUTOS
// ========================================

const PRODUTOS_REL_KEY      = 'produtosCadastros';
const HISTORICO_PROD_KEY    = 'relatoriosProdutosHistorico';

let todosProdutos       = [];
let periodoAtual        = 'mensal';
let tipoRelatorioAtual  = null;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function () {
    const usuario = obterUsuarioLogado();
    if (!usuario) { window.location.href = 'login.html'; return; }

    const nameEl  = document.getElementById('displayUsername');
    const emailEl = document.getElementById('userEmail');
    const iconEl  = document.getElementById('topbarAvatarIcon');
    const imgEl   = document.getElementById('topbarAvatarImg');
    if (nameEl)  nameEl.textContent  = usuario.nome  || usuario.email || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';
    if (usuario.avatar_url && imgEl && iconEl) {
        imgEl.src = usuario.avatar_url;
        imgEl.style.display  = 'block';
        iconEl.style.display = 'none';
    }

    verificarPermissoes();
    todosProdutos = lerProdutos();
    carregarStats();
    renderPreviewCategoria();
    renderPreviewStatus();
    renderPreviewEstoque();
    renderHistorico();
});

function lerProdutos() {
    try {
        const raw = localStorage.getItem(PRODUTOS_REL_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

// ========================================
// PERMISSÕES
// ========================================

function verificarPermissoes() {
    const usuario = obterUsuarioLogado();
    if (usuario && usuario.perfil === 'admin') {
        document.getElementById('secaoHistorico').style.display = '';
    }
}

// ========================================
// STATS
// ========================================

function carregarStats() {
    const total       = todosProdutos.length;
    const ativos      = todosProdutos.filter(p => (p.statusAtivo || 'ativo') === 'ativo').length;
    const inativos    = todosProdutos.filter(p => p.statusAtivo === 'inativo').length;
    const estoqueBaixo = todosProdutos.filter(p =>
        p.controlaEstoque &&
        Number(p.estoqueAtual || 0) < Number(p.estoqueMinimo || 0)
    ).length;

    document.getElementById('totalProdutos').textContent    = total;
    document.getElementById('totalAtivos').textContent      = ativos;
    document.getElementById('totalInativos').textContent    = inativos;
    document.getElementById('totalEstoqueBaixo').textContent = estoqueBaixo;
}

// ========================================
// PREVIEWS DOS CARDS
// ========================================

function renderPreviewCategoria() {
    const el = document.getElementById('previewCategoria');
    if (!el) return;

    const contagem = {};
    todosProdutos.forEach(p => {
        const c = p.categoria || 'Sem categoria';
        contagem[c] = (contagem[c] || 0) + 1;
    });

    const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const max = ranking[0]?.[1] || 1;

    if (ranking.length === 0) {
        el.innerHTML = `<div class="preview-vazio">Nenhum produto cadastrado</div>`;
        return;
    }

    el.innerHTML = ranking.slice(0, 4).map(([cat, qtd], i) => `
        <div class="preview-bar-item">
            <span class="preview-bar-label preview-rank">
                <span class="rank-num">${i + 1}</span>
                ${cat}
            </span>
            <div class="preview-bar-track">
                <div class="preview-bar-fill" style="width:${Math.round((qtd/max)*100)}%;background:#7c3aed;"></div>
            </div>
            <span class="preview-bar-val">${qtd}</span>
        </div>`).join('');
}

function renderPreviewStatus() {
    const el = document.getElementById('previewStatus');
    if (!el) return;

    const total = todosProdutos.length || 1;
    const statusList = [
        { key: 'ativo',   label: 'Ativo',   cor: '#22c55e' },
        { key: 'inativo', label: 'Inativo', cor: '#94a3b8' },
    ];

    el.innerHTML = statusList.map(s => {
        const qtd = todosProdutos.filter(p => (p.statusAtivo || 'ativo') === s.key).length;
        const pct = Math.round((qtd / total) * 100);
        return `
            <div class="preview-bar-item">
                <span class="preview-bar-label"><span style="color:${s.cor};">●</span> ${s.label}</span>
                <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct}%;background:${s.cor};"></div></div>
                <span class="preview-bar-val">${qtd}</span>
            </div>`;
    }).join('');
}

function renderPreviewEstoque() {
    const el = document.getElementById('previewEstoque');
    if (!el) return;

    const comControle = todosProdutos.filter(p => p.controlaEstoque);
    const baixo       = comControle.filter(p => Number(p.estoqueAtual || 0) < Number(p.estoqueMinimo || 0));
    const ok          = comControle.filter(p => Number(p.estoqueAtual || 0) >= Number(p.estoqueMinimo || 0));

    el.innerHTML = `
        <div class="preview-stat-row">
            <span class="preview-num" style="color:#0891b2;">${comControle.length}</span>
            <span class="preview-label">produtos com controle</span>
        </div>
        <div class="preview-sub-row">
            <span class="preview-chip" style="background:#fef3c7;color:#d97706;">${baixo.length} abaixo do mínimo</span>
            <span class="preview-chip" style="background:#dcfce7;color:#16a34a;">${ok.length} em dia</span>
        </div>`;
}

// ========================================
// MODAL DE PARÂMETROS
// ========================================

const CONFIG_REL = {
    categoria: {
        nome:  'Relatório por Categoria',
        cor:   'linear-gradient(135deg,#7c3aed,#6366f1)',
        icone: 'fa-solid fa-tag',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status dos produtos</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="ativo" checked> Ativos</label>
                    <label class="rel-check"><input type="checkbox" value="inativo" checked> Inativos</label>
                </div>
            </div>`
    },
    status: {
        nome:  'Relatório por Status',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-chart-bar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Incluir status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="ativo" checked> Ativo</label>
                    <label class="rel-check"><input type="checkbox" value="inativo" checked> Inativo</label>
                </div>
            </div>`
    },
    estoque: {
        nome:  'Relatório de Estoque',
        cor:   'linear-gradient(135deg,#0891b2,#06b6d4)',
        icone: 'fa-solid fa-warehouse',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Filtrar por situação</label>
                <select id="relEstoqueFiltro" class="rel-select" onchange="atualizarPreview()">
                    <option value="">Todos com controle de estoque</option>
                    <option value="baixo">Apenas abaixo do mínimo</option>
                    <option value="ok">Apenas em dia</option>
                </select>
            </div>`
    }
};

function gerarRelatorio(tipo) {
    tipoRelatorioAtual = tipo;
    const cfg = CONFIG_REL[tipo];

    document.getElementById('modalRelIcon').innerHTML = `<i class="${cfg.icone}" style="color:white;font-size:18px;"></i>`;
    document.getElementById('modalRelIcon').style.background = cfg.cor;
    document.getElementById('modalRelNome').textContent = cfg.nome;
    document.getElementById('relParamsEspecificos').innerHTML = cfg.params;

    const hoje  = new Date();
    const corte = new Date();
    corte.setDate(corte.getDate() - 30);
    document.getElementById('relDataInicio').value = corte.toISOString().split('T')[0];
    document.getElementById('relDataFim').value    = hoje.toISOString().split('T')[0];

    document.querySelectorAll('.period-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    periodoAtual = 'mensal';

    document.querySelectorAll('#relParamsEspecificos input[type=checkbox]').forEach(cb =>
        cb.addEventListener('change', atualizarPreview)
    );

    atualizarPreview();
    document.getElementById('modalRelatorio').classList.add('active');
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').classList.remove('active');
    tipoRelatorioAtual = null;
}

function atualizarPreview() {
    const el = document.getElementById('relPreviewConteudo');
    if (!el || !tipoRelatorioAtual) return;

    if (tipoRelatorioAtual === 'categoria') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = todosProdutos.filter(p => selecionados.includes(p.statusAtivo || 'ativo'));
        const cats = new Set(filtrados.map(p => p.categoria).filter(Boolean)).size;
        el.innerHTML = `
            <div class="prev-linha"><span>Total de produtos</span><strong>${filtrados.length}</strong></div>
            <div class="prev-linha"><span>Categorias distintas</span><strong>${cats}</strong></div>
            <div class="prev-linha"><span>Sem categoria</span><strong>${filtrados.filter(p => !p.categoria).length}</strong></div>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const labels = { ativo: 'Ativo', inativo: 'Inativo' };
        el.innerHTML = selecionados.map(s => {
            const qtd = todosProdutos.filter(p => (p.statusAtivo || 'ativo') === s).length;
            return `<div class="prev-linha"><span>${labels[s]}</span><strong>${qtd}</strong></div>`;
        }).join('') || `<div class="prev-vazio">Selecione ao menos um status</div>`;

    } else if (tipoRelatorioAtual === 'estoque') {
        const filtro = document.getElementById('relEstoqueFiltro')?.value || '';
        const base   = todosProdutos.filter(p => p.controlaEstoque);
        const lista  = filtro === 'baixo'
            ? base.filter(p => Number(p.estoqueAtual || 0) < Number(p.estoqueMinimo || 0))
            : filtro === 'ok'
            ? base.filter(p => Number(p.estoqueAtual || 0) >= Number(p.estoqueMinimo || 0))
            : base;
        const baixo  = lista.filter(p => Number(p.estoqueAtual || 0) < Number(p.estoqueMinimo || 0)).length;
        el.innerHTML = `
            <div class="prev-linha"><span>Produtos no filtro</span><strong>${lista.length}</strong></div>
            <div class="prev-linha"><span>Abaixo do mínimo</span><strong style="color:#f59e0b;">${baixo}</strong></div>`;
    }
}

// ========================================
// PERÍODO
// ========================================

function setPeriod(btn, periodo) {
    document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    periodoAtual = periodo;

    const dias  = { mensal: 30, trimestral: 90, anual: 365 };
    const hoje  = new Date();
    const corte = new Date();
    corte.setDate(corte.getDate() - (dias[periodo] || 30));

    const diEl = document.getElementById('relDataInicio');
    const dfEl = document.getElementById('relDataFim');
    if (diEl) diEl.value = corte.toISOString().split('T')[0];
    if (dfEl) dfEl.value = hoje.toISOString().split('T')[0];

    atualizarPreview();
}

// ========================================
// BAIXAR PDF
// ========================================

function baixarPDF() {
    const cfg = CONFIG_REL[tipoRelatorioAtual];
    if (!cfg) return;

    const di      = document.getElementById('relDataInicio')?.value || '';
    const df      = document.getElementById('relDataFim')?.value   || '';
    const usuario = obterUsuarioLogado() || {};

    let conteudoTabela = '';

    if (tipoRelatorioAtual === 'categoria') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = todosProdutos.filter(p => selecionados.includes(p.statusAtivo || 'ativo'));
        conteudoTabela = `
            <table>
                <thead><tr><th>SKU</th><th>Nome</th><th>Categoria</th><th>Marca</th><th>NCM</th><th>Status</th></tr></thead>
                <tbody>${filtrados.map(p => `
                    <tr>
                        <td>${p.sku || '—'}</td>
                        <td>${p.nome || '—'}</td>
                        <td>${p.categoria || '—'}</td>
                        <td>${p.marca || '—'}</td>
                        <td>${p.ncm || '—'}</td>
                        <td>${(p.statusAtivo || 'ativo') === 'ativo' ? 'Ativo' : 'Inativo'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const labels = { ativo: 'Ativo', inativo: 'Inativo' };
        const total  = todosProdutos.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>Status</th><th>Quantidade</th><th>%</th></tr></thead>
                <tbody>${selecionados.map(s => {
                    const qtd = todosProdutos.filter(p => (p.statusAtivo || 'ativo') === s).length;
                    const pct = Math.round((qtd / total) * 100);
                    return `<tr><td>${labels[s]}</td><td>${qtd}</td><td>${pct}%</td></tr>`;
                }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'estoque') {
        const filtro = document.getElementById('relEstoqueFiltro')?.value || '';
        const base   = todosProdutos.filter(p => p.controlaEstoque);
        const lista  = filtro === 'baixo'
            ? base.filter(p => Number(p.estoqueAtual || 0) < Number(p.estoqueMinimo || 0))
            : filtro === 'ok'
            ? base.filter(p => Number(p.estoqueAtual || 0) >= Number(p.estoqueMinimo || 0))
            : base;
        conteudoTabela = `
            <table>
                <thead><tr><th>SKU</th><th>Nome</th><th>Categoria</th><th>Estoque Atual</th><th>Mínimo</th><th>Situação</th></tr></thead>
                <tbody>${lista.map(p => {
                    const atual = Number(p.estoqueAtual || 0);
                    const min   = Number(p.estoqueMinimo || 0);
                    const sit   = atual < min ? 'Abaixo do mínimo' : 'Em dia';
                    return `<tr>
                        <td>${p.sku || '—'}</td>
                        <td>${p.nome || '—'}</td>
                        <td>${p.categoria || '—'}</td>
                        <td>${atual}</td>
                        <td>${min}</td>
                        <td>${sit}</td>
                    </tr>`;
                }).join('')}
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
            .pdf-logo { font-size:22px; font-weight:800; color:#7c3aed; }
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
            <div class="pdf-logo">M Marpex</div>
            <div class="pdf-titulo">
                <h1>${cfg.nome}</h1>
                <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
        <div class="pdf-meta">
            <div class="pdf-meta-item"><strong>Período</strong>${formatarData(di)} até ${formatarData(df)}</div>
            <div class="pdf-meta-item"><strong>Total de produtos</strong>${todosProdutos.length}</div>
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
    const usuario = obterUsuarioLogado() || {};
    const di      = document.getElementById('relDataInicio')?.value || '';
    const df      = document.getElementById('relDataFim')?.value   || '';

    const registro = {
        id:      Date.now(),
        tipo:    cfg.nome,
        usuario: usuario.nome || '—',
        dataGer: new Date().toISOString(),
        periodo: di && df ? `${formatarData(di)} – ${formatarData(df)}` : '—',
        formato: 'PDF'
    };

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROD_KEY) || '[]');
    lista.unshift(registro);
    localStorage.setItem(HISTORICO_PROD_KEY, JSON.stringify(lista));
    renderHistorico();
}

function renderHistorico() {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROD_KEY) || '[]');

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
                    <button class="hist-btn hist-btn-del" title="Remover" onclick="removerHistorico(${r.id})">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`).join('');
}

function removerHistorico(id) {
    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROD_KEY) || '[]').filter(r => r.id !== id);
    localStorage.setItem(HISTORICO_PROD_KEY, JSON.stringify(lista));
    renderHistorico();
}

// ========================================
// UTILITÁRIOS
// ========================================

function formatarData(iso) {
    if (!iso) return '—';
    const [a, m, d] = iso.split('-');
    return `${d}/${m}/${a}`;
}
