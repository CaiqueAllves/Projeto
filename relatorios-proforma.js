// ========================================
// RELATÓRIOS — PROFORMAS
// ========================================

const HISTORICO_PROF_KEY = 'relatoriosProformaHistorico';

let todasProformas      = [];
let periodoAtual        = 'mensal';
let tipoRelatorioAtual  = null;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function () {
    const usuario = obterUsuarioLogado();
    if (!usuario) { window.location.href = 'login.html'; return; }

    const nameEl  = document.getElementById('displayUsername');
    const emailEl = document.getElementById('userEmail');
    if (nameEl)  nameEl.textContent  = usuario.nome  || usuario.email || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';

    verificarPermissoes();
    await carregarProformas();
    carregarStats();
    renderPreviewPeriodo();
    renderPreviewStatus();
    renderPreviewEmpresa();
    renderHistorico();
});

async function carregarProformas() {
    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('id, codigo, status, data_emissao, origem_pais, destino_pais, parceiro_id, tipo, modal, valor_total, created_at')
            .neq('status', 'excluido')
            .order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;
        todasProformas = data || [];

        // Busca nomes dos parceiros
        const ids = [...new Set(todasProformas.map(p => p.parceiro_id).filter(Boolean))];
        if (ids.length > 0) {
            const { data: emps } = await supabaseClient
                .from('empresas')
                .select('id, razao_social, nome_fantasia')
                .in('id', ids);
            const map = {};
            (emps || []).forEach(e => { map[e.id] = e.nome_fantasia || e.razao_social; });
            todasProformas = todasProformas.map(p => ({
                ...p,
                parceiro_nome: map[p.parceiro_id] || '—',
            }));
        }
    } catch (err) {
        console.error('Erro ao carregar proformas:', err.message);
        todasProformas = [];
    }
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
    const total    = todasProformas.length;
    const aprovadas = todasProformas.filter(p => p.status === 'aprovado').length;
    const pendentes = todasProformas.filter(p => p.status === 'pendente').length;
    const recusadas = todasProformas.filter(p => p.status === 'recusado').length;

    document.getElementById('totalProformas').textContent  = total;
    document.getElementById('totalAprovadas').textContent  = aprovadas;
    document.getElementById('totalPendentes').textContent  = pendentes;
    document.getElementById('totalRecusadas').textContent  = recusadas;
}

// ========================================
// PREVIEWS DOS CARDS
// ========================================

function renderPreviewPeriodo() {
    const el = document.getElementById('previewPeriodo');
    if (!el) return;

    const dias  = { mensal: 30, trimestral: 90, anual: 365 };
    const corte = new Date();
    corte.setDate(corte.getDate() - (dias[periodoAtual] || 30));

    const filtrados = todasProformas.filter(p => {
        if (!p.data_emissao && !p.created_at) return false;
        const d = new Date(p.data_emissao ? p.data_emissao + 'T00:00:00' : p.created_at);
        return d >= corte;
    });

    const aprovadas = filtrados.filter(p => p.status === 'aprovado').length;
    const pendentes = filtrados.filter(p => p.status === 'pendente').length;

    el.innerHTML = `
        <div class="preview-stat-row">
            <span class="preview-num" style="color:#3b82f6;">${filtrados.length}</span>
            <span class="preview-label">proformas no período</span>
        </div>
        <div class="preview-sub-row">
            <span class="preview-chip" style="background:#dcfce7;color:#16a34a;">${aprovadas} aprovada${aprovadas !== 1 ? 's' : ''}</span>
            <span class="preview-chip" style="background:#fffbeb;color:#d97706;">${pendentes} pendente${pendentes !== 1 ? 's' : ''}</span>
        </div>`;
}

function renderPreviewStatus() {
    const el = document.getElementById('previewStatus');
    if (!el) return;

    const total = todasProformas.length || 1;
    const statusList = [
        { key: 'enviado',  label: 'Enviado',  cor: '#3b82f6' },
        { key: 'aprovado', label: 'Aprovado', cor: '#22c55e' },
        { key: 'pendente', label: 'Pendente', cor: '#f59e0b' },
        { key: 'recusado', label: 'Recusado', cor: '#ef4444' },
    ];

    el.innerHTML = statusList.map(s => {
        const qtd = todasProformas.filter(p => (p.status || 'enviado') === s.key).length;
        const pct = Math.round((qtd / total) * 100);
        return `
            <div class="preview-bar-item">
                <span class="preview-bar-label"><span style="color:${s.cor};">●</span> ${s.label}</span>
                <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct}%;background:${s.cor};"></div></div>
                <span class="preview-bar-val">${qtd}</span>
            </div>`;
    }).join('');
}

function renderPreviewEmpresa() {
    const el = document.getElementById('previewEmpresa');
    if (!el) return;

    const contagem = {};
    todasProformas.forEach(p => {
        const nome = p.parceiro_nome || '—';
        contagem[nome] = (contagem[nome] || 0) + 1;
    });

    const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const max = ranking[0]?.[1] || 1;

    if (ranking.length === 0) {
        el.innerHTML = `<div class="preview-vazio">Nenhuma proforma cadastrada</div>`;
        return;
    }

    el.innerHTML = ranking.slice(0, 4).map(([emp, qtd], i) => `
        <div class="preview-bar-item">
            <span class="preview-bar-label preview-rank">
                <span class="rank-num">${i + 1}</span>
                ${emp}
            </span>
            <div class="preview-bar-track">
                <div class="preview-bar-fill" style="width:${Math.round((qtd/max)*100)}%;background:#22c55e;"></div>
            </div>
            <span class="preview-bar-val">${qtd}</span>
        </div>`).join('');
}

// ========================================
// MODAL DE PARÂMETROS
// ========================================

const CONFIG_REL = {
    periodo: {
        nome:  'Relatório por Período',
        cor:   'linear-gradient(135deg,#4776ec,#6366f1)',
        icone: 'fa-solid fa-calendar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="enviado" checked> Enviado</label>
                    <label class="rel-check"><input type="checkbox" value="aprovado" checked> Aprovado</label>
                    <label class="rel-check"><input type="checkbox" value="pendente" checked> Pendente</label>
                    <label class="rel-check"><input type="checkbox" value="recusado"> Recusado</label>
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
                    <label class="rel-check"><input type="checkbox" value="enviado" checked> Enviado</label>
                    <label class="rel-check"><input type="checkbox" value="aprovado" checked> Aprovado</label>
                    <label class="rel-check"><input type="checkbox" value="pendente" checked> Pendente</label>
                    <label class="rel-check"><input type="checkbox" value="recusado" checked> Recusado</label>
                </div>
            </div>`
    },
    empresa: {
        nome:  'Relatório por Empresa',
        cor:   'linear-gradient(135deg,#22c55e,#16a34a)',
        icone: 'fa-solid fa-building',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status das proformas</label>
                <select id="relStatusFiltro" class="rel-select" onchange="atualizarPreview()">
                    <option value="">Todos os status</option>
                    <option value="enviado">Enviado</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="pendente">Pendente</option>
                    <option value="recusado">Recusado</option>
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

    document.getElementById('relDataInicio').addEventListener('change', atualizarPreview);
    document.getElementById('relDataFim').addEventListener('change', atualizarPreview);
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

function filtrarPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todasProformas;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todasProformas.filter(p => {
        const d = new Date(p.data_emissao ? p.data_emissao + 'T00:00:00' : p.created_at);
        return d >= inicio && d <= fim;
    });
}

function atualizarPreview() {
    const el = document.getElementById('relPreviewConteudo');
    if (!el || !tipoRelatorioAtual) return;

    const proformas = filtrarPorDatas();

    if (tipoRelatorioAtual === 'periodo') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = proformas.filter(p => selecionados.includes(p.status || 'enviado'));
        const empresas  = new Set(filtrados.map(p => p.parceiro_id).filter(Boolean)).size;
        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${filtrados.length} proforma${filtrados.length !== 1 ? 's' : ''}</strong></div>
            <div class="prev-linha"><span>Empresas distintas</span><strong>${empresas}</strong></div>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const labels = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', recusado: 'Recusado' };
        el.innerHTML = selecionados.map(s => {
            const qtd = proformas.filter(p => (p.status || 'enviado') === s).length;
            return `<div class="prev-linha"><span>${labels[s]}</span><strong>${qtd}</strong></div>`;
        }).join('') || `<div class="prev-vazio">Selecione ao menos um status</div>`;

    } else if (tipoRelatorioAtual === 'empresa') {
        const filtroStatus = document.getElementById('relStatusFiltro')?.value || '';
        const lista = filtroStatus ? proformas.filter(p => p.status === filtroStatus) : proformas;
        const contagem = {};
        lista.forEach(p => { const n = p.parceiro_nome || '—'; contagem[n] = (contagem[n] || 0) + 1; });
        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        el.innerHTML = ranking.length
            ? ranking.slice(0, 5).map(([emp, q], i) => `<div class="prev-linha"><span><b>${i + 1}.</b> ${emp}</span><strong>${q}</strong></div>`).join('')
            : `<div class="prev-vazio">Nenhum resultado</div>`;
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
    renderPreviewPeriodo();
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
    const proformas = filtrarPorDatas();
    const statusLabels = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', recusado: 'Recusado' };

    let conteudoTabela = '';

    if (tipoRelatorioAtual === 'periodo') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = proformas.filter(p => selecionados.includes(p.status || 'enviado'));
        conteudoTabela = `
            <table>
                <thead><tr><th>Código</th><th>Empresa</th><th>Tipo</th><th>Rota</th><th>Emissão</th><th>Status</th></tr></thead>
                <tbody>${filtrados.map(p => `
                    <tr>
                        <td>${p.codigo || '—'}</td>
                        <td>${p.parceiro_nome || '—'}</td>
                        <td>${p.tipo || '—'}</td>
                        <td>${p.origem_pais || '—'} → ${p.destino_pais || '—'}</td>
                        <td>${p.data_emissao ? new Date(p.data_emissao + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</td>
                        <td>${statusLabels[p.status] || p.status || '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const total = proformas.length || 1;
        conteudoTabela = `
            <table>
                <thead><tr><th>Status</th><th>Quantidade</th><th>%</th></tr></thead>
                <tbody>${selecionados.map(s => {
                    const qtd = proformas.filter(p => (p.status || 'enviado') === s).length;
                    const pct = Math.round((qtd / total) * 100);
                    return `<tr><td>${statusLabels[s]}</td><td>${qtd}</td><td>${pct}%</td></tr>`;
                }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'empresa') {
        const filtroStatus = document.getElementById('relStatusFiltro')?.value || '';
        const lista = filtroStatus ? proformas.filter(p => p.status === filtroStatus) : proformas;
        const contagem = {};
        lista.forEach(p => { const n = p.parceiro_nome || '—'; contagem[n] = (contagem[n] || 0) + 1; });
        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        conteudoTabela = `
            <table>
                <thead><tr><th>#</th><th>Empresa</th><th>Proformas</th><th>%</th></tr></thead>
                <tbody>${ranking.map(([emp, q], i) => {
                    const pct = lista.length ? Math.round((q / lista.length) * 100) : 0;
                    return `<tr><td>${i + 1}</td><td>${emp}</td><td>${q}</td><td>${pct}%</td></tr>`;
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
            <div class="pdf-logo">M Marpex</div>
            <div class="pdf-titulo">
                <h1>${cfg.nome}</h1>
                <p>Gerado em ${new Date().toLocaleString('pt-BR')}</p>
            </div>
        </div>
        <div class="pdf-meta">
            <div class="pdf-meta-item"><strong>Período</strong>${formatarData(di)} até ${formatarData(df)}</div>
            <div class="pdf-meta-item"><strong>Total de registros</strong>${proformas.length}</div>
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

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROF_KEY) || '[]');
    lista.unshift(registro);
    localStorage.setItem(HISTORICO_PROF_KEY, JSON.stringify(lista));
    renderHistorico();
}

function renderHistorico() {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROF_KEY) || '[]');

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
    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROF_KEY) || '[]').filter(r => r.id !== id);
    localStorage.setItem(HISTORICO_PROF_KEY, JSON.stringify(lista));
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
