// ========================================
// RELATÓRIOS — PROCESSOS
// ========================================

const PROCESSOS_KEY        = 'processosCadastros';
const HISTORICO_PROC_KEY   = 'relatoriosProcessosHistorico';

let todosProcessos  = [];
let periodoAtual    = 'mensal';
let tipoRelatorioAtual = null;

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function () {
    verificarPermissoes();
    todosProcessos = lerProcessos();
    carregarStats();
    renderPreviewPeriodo();
    renderPreviewStatus();
    renderPreviewModal();
    renderHistorico();
});

function lerProcessos() {
    try {
        const raw = localStorage.getItem(PROCESSOS_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

// ========================================
// PERMISSÕES
// ========================================

function verificarPermissoes() {
    const usuario = JSON.parse(sessionStorage.getItem('usuarioLogado') || 'null');
    if (usuario && usuario.perfil === 'admin') {
        document.getElementById('secaoHistorico').style.display = '';
    }
}

// ========================================
// STATS
// ========================================

function carregarStats() {
    const total     = todosProcessos.length;
    const abertos   = todosProcessos.filter(p => p.status === 'aberto').length;
    const andamento = todosProcessos.filter(p => p.status === 'andamento').length;
    const concluidos= todosProcessos.filter(p => p.status === 'concluido').length;

    document.getElementById('totalProcessos').textContent  = total;
    document.getElementById('totalAbertos').textContent    = abertos;
    document.getElementById('totalAndamento').textContent  = andamento;
    document.getElementById('totalConcluidos').textContent = concluidos;
}

// ========================================
// PREVIEWS DOS CARDS
// ========================================

function renderPreviewPeriodo() {
    const el = document.getElementById('previewPeriodo');
    if (!el) return;

    const dias = { mensal: 30, trimestral: 90, anual: 365 };
    const corte = new Date();
    corte.setDate(corte.getDate() - (dias[periodoAtual] || 30));

    const filtrados = todosProcessos.filter(p => {
        if (!p.abertura) return false;
        return new Date(p.abertura) >= corte;
    });

    const abertos   = filtrados.filter(p => p.status === 'aberto').length;
    const andamento = filtrados.filter(p => p.status === 'andamento').length;

    el.innerHTML = `
        <div class="preview-stat-row">
            <span class="preview-num" style="color:#7c3aed;">${filtrados.length}</span>
            <span class="preview-label">processos no período</span>
        </div>
        <div class="preview-sub-row">
            <span class="preview-chip" style="background:#fef3c7;color:#d97706;">${abertos} aberto${abertos !== 1 ? 's' : ''}</span>
            <span class="preview-chip" style="background:#dbeafe;color:#2563eb;">${andamento} em andamento</span>
        </div>`;
}

function renderPreviewStatus() {
    const el = document.getElementById('previewStatus');
    if (!el) return;

    const total = todosProcessos.length || 1;
    const statusList = [
        { key: 'aberto',    label: 'Aberto',       cor: '#f59e0b' },
        { key: 'andamento', label: 'Em andamento',  cor: '#3b82f6' },
        { key: 'concluido', label: 'Concluído',     cor: '#22c55e' },
        { key: 'cancelado', label: 'Cancelado',     cor: '#ef4444' },
    ];

    el.innerHTML = statusList.map(s => {
        const qtd = todosProcessos.filter(p => p.status === s.key).length;
        const pct = Math.round((qtd / total) * 100);
        return `
            <div class="preview-bar-item">
                <span class="preview-bar-label"><span style="color:${s.cor};">●</span> ${s.label}</span>
                <div class="preview-bar-track"><div class="preview-bar-fill" style="width:${pct}%;background:${s.cor};"></div></div>
                <span class="preview-bar-val">${qtd}</span>
            </div>`;
    }).join('');
}

function renderPreviewModal() {
    const el = document.getElementById('previewModal');
    if (!el) return;

    const contagem = {};
    todosProcessos.forEach(p => {
        const m = p.modal || 'Não informado';
        contagem[m] = (contagem[m] || 0) + 1;
    });

    const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
    const max = ranking[0]?.[1] || 1;

    if (ranking.length === 0) {
        el.innerHTML = `<div class="preview-vazio">Nenhum processo cadastrado</div>`;
        return;
    }

    const labels = { maritimo: 'Marítimo', aereo: 'Aéreo', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };

    el.innerHTML = ranking.map(([modal, qtd], i) => `
        <div class="preview-bar-item">
            <span class="preview-bar-label preview-rank">
                <span class="rank-num">${i + 1}</span>
                ${labels[modal] || modal}
            </span>
            <div class="preview-bar-track">
                <div class="preview-bar-fill" style="width:${Math.round((qtd/max)*100)}%;background:#0891b2;"></div>
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
        cor:   'linear-gradient(135deg,#7c3aed,#6366f1)',
        icone: 'fa-solid fa-calendar',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="aberto" checked> Aberto</label>
                    <label class="rel-check"><input type="checkbox" value="andamento" checked> Em andamento</label>
                    <label class="rel-check"><input type="checkbox" value="concluido" checked> Concluído</label>
                    <label class="rel-check"><input type="checkbox" value="cancelado"> Cancelado</label>
                </div>
            </div>`
    },
    status: {
        nome:  'Relatório por Status',
        cor:   'linear-gradient(135deg,#f59e0b,#f97316)',
        icone: 'fa-solid fa-list-check',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-filter"></i> Incluir status</label>
                <div class="rel-check-row">
                    <label class="rel-check"><input type="checkbox" value="aberto" checked> Aberto</label>
                    <label class="rel-check"><input type="checkbox" value="andamento" checked> Em andamento</label>
                    <label class="rel-check"><input type="checkbox" value="concluido" checked> Concluído</label>
                    <label class="rel-check"><input type="checkbox" value="cancelado" checked> Cancelado</label>
                </div>
            </div>`
    },
    modal: {
        nome:  'Relatório por Modal',
        cor:   'linear-gradient(135deg,#0891b2,#06b6d4)',
        icone: 'fa-solid fa-ship',
        params: `
            <div class="rel-param-group">
                <label class="rel-param-label"><i class="fa-solid fa-ship"></i> Modal</label>
                <select id="relModalFiltro" class="rel-select" onchange="atualizarPreviewModal_modal()">
                    <option value="">Todos os modais</option>
                    <option value="maritimo">Marítimo</option>
                    <option value="aereo">Aéreo</option>
                    <option value="rodoviario">Rodoviário</option>
                    <option value="ferroviario">Ferroviário</option>
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

    // Datas padrão
    const hoje = new Date();
    const corte = new Date();
    corte.setDate(corte.getDate() - 30);
    document.getElementById('relDataInicio').value = corte.toISOString().split('T')[0];
    document.getElementById('relDataFim').value    = hoje.toISOString().split('T')[0];

    // Reset período
    document.querySelectorAll('.period-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
    periodoAtual = 'mensal';

    document.getElementById('relDataInicio').addEventListener('change', atualizarPreviewModal_modal);
    document.getElementById('relDataFim').addEventListener('change', atualizarPreviewModal_modal);
    document.querySelectorAll('#relParamsEspecificos input[type=checkbox]').forEach(cb =>
        cb.addEventListener('change', atualizarPreviewModal_modal)
    );

    atualizarPreviewModal_modal();
    document.getElementById('modalRelatorio').classList.add('active');
}

function fecharModalRelatorio() {
    document.getElementById('modalRelatorio').classList.remove('active');
    tipoRelatorioAtual = null;
}

function filtrarPorDatas() {
    const di = document.getElementById('relDataInicio')?.value;
    const df = document.getElementById('relDataFim')?.value;
    if (!di || !df) return todosProcessos;
    const inicio = new Date(di);
    const fim    = new Date(df + 'T23:59:59');
    return todosProcessos.filter(p => {
        const d = new Date(p.abertura || p.id?.split('_')[0] || Date.now());
        return d >= inicio && d <= fim;
    });
}

function atualizarPreviewModal_modal() {
    const el = document.getElementById('relPreviewConteudo');
    if (!el || !tipoRelatorioAtual) return;

    const processos = filtrarPorDatas();

    if (tipoRelatorioAtual === 'periodo') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = processos.filter(p => selecionados.includes(p.status || 'aberto'));
        const modais = new Set(filtrados.map(p => p.modal).filter(Boolean)).size;
        el.innerHTML = `
            <div class="prev-linha"><span>Total no período</span><strong>${filtrados.length} processo${filtrados.length !== 1 ? 's' : ''}</strong></div>
            <div class="prev-linha"><span>Modais distintos</span><strong>${modais}</strong></div>
            <div class="prev-linha"><span>Clientes distintos</span><strong>${new Set(filtrados.map(p => p.cliente).filter(Boolean)).size}</strong></div>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const labels = { aberto: 'Aberto', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };
        el.innerHTML = selecionados.map(s => {
            const qtd = processos.filter(p => (p.status || 'aberto') === s).length;
            return `<div class="prev-linha"><span>${labels[s]}</span><strong>${qtd}</strong></div>`;
        }).join('') || `<div class="prev-vazio">Selecione ao menos um status</div>`;

    } else if (tipoRelatorioAtual === 'modal') {
        const modalFiltro = document.getElementById('relModalFiltro')?.value || '';
        const lista = modalFiltro ? processos.filter(p => p.modal === modalFiltro) : processos;
        const contagem = {};
        lista.forEach(p => { const m = p.modal || 'Não informado'; contagem[m] = (contagem[m] || 0) + 1; });
        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        const labels = { maritimo: 'Marítimo', aereo: 'Aéreo', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };
        el.innerHTML = ranking.length
            ? ranking.map(([m, q], i) => `<div class="prev-linha"><span><b>${i + 1}.</b> ${labels[m] || m}</span><strong>${q}</strong></div>`).join('')
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

    const dias = { mensal: 30, trimestral: 90, anual: 365 };
    const hoje = new Date();
    const corte = new Date();
    corte.setDate(corte.getDate() - (dias[periodo] || 30));

    const diEl = document.getElementById('relDataInicio');
    const dfEl = document.getElementById('relDataFim');
    if (diEl) diEl.value = corte.toISOString().split('T')[0];
    if (dfEl) dfEl.value = hoje.toISOString().split('T')[0];

    atualizarPreviewModal_modal();
}

// ========================================
// BAIXAR PDF
// ========================================

function baixarPDF() {
    const cfg = CONFIG_REL[tipoRelatorioAtual];
    if (!cfg) return;

    const di = document.getElementById('relDataInicio')?.value || '';
    const df = document.getElementById('relDataFim')?.value || '';
    const usuario = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
    const processos = filtrarPorDatas();
    const labels = { maritimo: 'Marítimo', aereo: 'Aéreo', rodoviario: 'Rodoviário', ferroviario: 'Ferroviário' };
    const statusLabels = { aberto: 'Aberto', andamento: 'Em andamento', concluido: 'Concluído', cancelado: 'Cancelado' };

    let conteudoTabela = '';

    if (tipoRelatorioAtual === 'periodo') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        const filtrados = processos.filter(p => selecionados.includes(p.status || 'aberto'));
        conteudoTabela = `
            <table>
                <thead><tr><th>Código</th><th>Cliente</th><th>Tipo</th><th>Modal</th><th>Origem</th><th>Destino</th><th>Status</th></tr></thead>
                <tbody>${filtrados.map(p => `
                    <tr>
                        <td>${p.codigo || '—'}</td>
                        <td>${p.cliente || '—'}</td>
                        <td>${p.tipo || '—'}</td>
                        <td>${labels[p.modal] || p.modal || '—'}</td>
                        <td>${p.origem || '—'}</td>
                        <td>${p.destino || '—'}</td>
                        <td>${statusLabels[p.status] || p.status || '—'}</td>
                    </tr>`).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'status') {
        const selecionados = [...document.querySelectorAll('#relParamsEspecificos input[type=checkbox]:checked')].map(c => c.value);
        conteudoTabela = `
            <table>
                <thead><tr><th>Status</th><th>Quantidade</th><th>%</th></tr></thead>
                <tbody>${selecionados.map(s => {
                    const qtd = processos.filter(p => (p.status || 'aberto') === s).length;
                    const pct = processos.length ? Math.round((qtd / processos.length) * 100) : 0;
                    return `<tr><td>${statusLabels[s]}</td><td>${qtd}</td><td>${pct}%</td></tr>`;
                }).join('')}
                </tbody>
            </table>`;

    } else if (tipoRelatorioAtual === 'modal') {
        const modalFiltro = document.getElementById('relModalFiltro')?.value || '';
        const lista = modalFiltro ? processos.filter(p => p.modal === modalFiltro) : processos;
        const contagem = {};
        lista.forEach(p => { const m = p.modal || 'Não informado'; contagem[m] = (contagem[m] || 0) + 1; });
        const ranking = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
        conteudoTabela = `
            <table>
                <thead><tr><th>#</th><th>Modal</th><th>Processos</th><th>%</th></tr></thead>
                <tbody>${ranking.map(([m, q], i) => {
                    const pct = lista.length ? Math.round((q / lista.length) * 100) : 0;
                    return `<tr><td>${i + 1}</td><td>${labels[m] || m}</td><td>${q}</td><td>${pct}%</td></tr>`;
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
            <div class="pdf-meta-item"><strong>Total de registros</strong>${processos.length}</div>
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
        id:      Date.now(),
        tipo:    cfg.nome,
        usuario: usuario.nome || '—',
        dataGer: new Date().toISOString(),
        periodo: di && df ? `${formatarData(di)} – ${formatarData(df)}` : '—',
        formato: 'PDF'
    };

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROC_KEY) || '[]');
    lista.unshift(registro);
    localStorage.setItem(HISTORICO_PROC_KEY, JSON.stringify(lista));
    renderHistorico();
}

function renderHistorico() {
    const tbody = document.getElementById('historicoBody');
    if (!tbody) return;

    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROC_KEY) || '[]');

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
    const lista = JSON.parse(localStorage.getItem(HISTORICO_PROC_KEY) || '[]').filter(r => r.id !== id);
    localStorage.setItem(HISTORICO_PROC_KEY, JSON.stringify(lista));
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

function mostrarNotificacao(mensagem, tipo = 'info') {
    const cores = { success: '#22C55E', error: '#dc2626', warning: '#f59e0b', info: '#4776ec' };
    const icones = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const n = document.createElement('div');
    n.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;
    n.style.cssText = `position:fixed;top:100px;right:20px;background:white;color:${cores[tipo]};padding:14px 22px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:10px;font-weight:600;z-index:99999;border-left:4px solid ${cores[tipo]};font-size:14px;`;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 5000);
}
