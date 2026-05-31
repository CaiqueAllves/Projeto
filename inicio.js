// ========================================
// PÁGINA INÍCIO - DASHBOARD
// ========================================

// Arrays para armazenar tarefas
let tarefas = [];

function _chaveTarefas() {
    try {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado') || '{}');
        return 'tarefasDashboard_' + (u.id || 'anonimo');
    } catch { return 'tarefasDashboard_anonimo'; }
}

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', async function() {
    console.log('Inicializando dashboard...');

    atualizarInformacoesUsuario();
    mostrarDataAtual();
    carregarTarefas();
    renderizarTarefas();

    // Buscar empresas do Supabase uma única vez e compartilhar com todas as funções
    const resultado = await buscarEmpresasCadastradas();
    const empresas = resultado.sucesso ? resultado.data : [];

    carregarEstatisticas(empresas);
    carregarAtividades(empresas);
    inicializarGraficos(empresas);
    
    // Inicializar chat
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                enviarMensagem();
            }
        });
    }
    
    // Adicionar efeito de scroll na topbar
    let lastScroll = 0;
    window.addEventListener('scroll', function() {
        const currentScroll = window.pageYOffset;
        const topbar = document.querySelector('.topbar');
        
        if (topbar) {
            if (currentScroll > 50) {
                topbar.classList.add('scrolled');
            } else {
                topbar.classList.remove('scrolled');
            }
        }
        
        lastScroll = currentScroll;
    });
});

// ========================================
// ATUALIZAR INFORMAÇÕES DO USUÁRIO
// ========================================

function atualizarInformacoesUsuario() {
    const usuarioLogado = sessionStorage.getItem('usuarioLogado');
    
    if (usuarioLogado) {
        const usuario = JSON.parse(usuarioLogado);
        
        // Atualizar nome completo
        const displayUsername = document.getElementById('displayUsername');
        if (displayUsername) {
            displayUsername.textContent = usuario.nome;
        }
        
        // Atualizar nome na mensagem de boas-vindas
        const welcomeUsername = document.getElementById('welcomeUsername');
        if (welcomeUsername) {
            const primeiroNome = usuario.nome.split(' ')[0];
            welcomeUsername.textContent = primeiroNome;
        }
        
        // Atualizar email
        const userEmail = document.getElementById('userEmail');
        if (userEmail) {
            userEmail.textContent = `${usuario.username}@${usuario.empresa.toLowerCase().replace(/\s+/g, '')}.com`;
        }
    }
}

// ========================================
// MOSTRAR DATA ATUAL
// ========================================

function mostrarDataAtual() {
    const hoje = new Date();
    const opcoes = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    
    const dataFormatada = hoje.toLocaleDateString('pt-BR', opcoes);
    
    const dataElement = document.getElementById('dataAtual');
    if (dataElement) {
        dataElement.textContent = dataFormatada;
    }
}

// ========================================
// CARREGAR ESTATÍSTICAS DOS CADASTROS
// ========================================

async function carregarEstatisticas(empresas) {
    const arquivos = JSON.parse(localStorage.getItem('arquivosUpload') || '[]');

    const totalEmpresas = empresas.length;
    const totalClientes = empresas.filter(e => e.is_cliente).length;
    const totalFornecedores = empresas.filter(e => e.is_fornecedor).length;

    const umaSemanaAtras = new Date();
    umaSemanaAtras.setDate(umaSemanaAtras.getDate() - 7);

    const novasEmpresasSemana = empresas.filter(e => {
        const dataCadastro = new Date(e.created_at);
        return dataCadastro > umaSemanaAtras;
    }).length;

    document.getElementById('totalEmpresas').textContent = totalEmpresas;

    try {
        const usuario = obterUsuarioLogado();
        const [{ count: countProc }, { count: countProd }, { count: countProf }] = await Promise.all([
            supabaseClient.from('processos').select('*', { count: 'exact', head: true }).eq('empresa_proprietaria_id', usuario.empresa_id),
            supabaseClient.from('produtos').select('*', { count: 'exact', head: true }).eq('empresa_proprietaria_id', usuario.empresa_id),
            supabaseClient.from('proformas').select('*', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id)
        ]);
        const elProc = document.getElementById('totalProcessos');
        if (elProc) elProc.textContent = countProc || 0;
        const elProd = document.getElementById('totalProdutos');
        if (elProd) elProd.textContent = countProd || 0;
        const elProf = document.getElementById('totalProformas');
        if (elProf) elProf.textContent = countProf || 0;
    } catch { /* silencioso */ }

    document.getElementById('badgeNovasEmpresas').textContent =
        novasEmpresasSemana > 0 ? `+${novasEmpresasSemana} esta semana` : 'Nenhuma esta semana';

    document.getElementById('badgeArquivos').textContent =
        arquivos.length > 0 ? `${arquivos.length} arquivo${arquivos.length > 1 ? 's' : ''} enviado${arquivos.length > 1 ? 's' : ''}` : 'Nenhum arquivo';

}

// ========================================
// SISTEMA DE TAREFAS
// ========================================

function carregarTarefas() {
    const tarefasSalvas = localStorage.getItem(_chaveTarefas());
    if (tarefasSalvas) {
        tarefas = JSON.parse(tarefasSalvas);
    } else {
        tarefas = [];
    }
}

function salvarTarefas() {
    localStorage.setItem(_chaveTarefas(), JSON.stringify(tarefas));
}

function coletarPendenciasModulos() {
    const pendencias = [];

    // Processos: aberto ou em andamento
    const processos = JSON.parse(localStorage.getItem('processosCadastros') || '[]');
    processos
        .filter(p => p.status === 'aberto' || p.status === 'andamento')
        .forEach(p => {
            pendencias.push({
                moduloLabel: 'Processo',
                moduloCor: '#7c3aed',
                icone: 'fa-solid fa-file-lines',
                titulo: `${p.codigo ? p.codigo + ' · ' : ''}${p.cliente || p.tipo || 'Sem descrição'}`,
                descricao: p.status === 'andamento' ? 'Em andamento' : 'Aberto',
                link: 'processos.html'
            });
        });

    // Produtos inativos
    const produtos = JSON.parse(localStorage.getItem('produtosCadastros') || '[]');
    produtos
        .filter(p => p.statusAtivo === 'inativo')
        .forEach(p => {
            pendencias.push({
                moduloLabel: 'Produto',
                moduloCor: '#0891b2',
                icone: 'fa-solid fa-box',
                titulo: p.nomeProduto || p.nome || 'Sem nome',
                descricao: 'Inativo',
                link: 'produtos.html'
            });
        });

    return pendencias;
}

function renderizarTarefas() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const pendencias = coletarPendenciasModulos();
    const totalPendente = tarefas.filter(t => !t.concluida).length + pendencias.length;

    const badge = document.getElementById('tarefasCountBadge');
    if (badge) badge.textContent = totalPendente || '';

    const section = document.getElementById('tasks-section');
    if (section) section.style.display = (tarefas.length === 0 && pendencias.length === 0) ? 'none' : '';

    if (tarefas.length === 0 && pendencias.length === 0) return;

    container.innerHTML = '';

    // Grupo 1: Minhas Tarefas
    if (tarefas.length > 0) {
        const group = document.createElement('div');
        group.className = 'tasks-group';
        group.innerHTML = `<div class="tasks-group-header"><i class="fa-solid fa-list-check"></i> Minhas Tarefas</div>`;

        tarefas.forEach(tarefa => {
            const prazoTexto = tarefa.prazo ? `<br><small style="color:#64748b;">📅 Prazo: ${formatarDataPrazo(tarefa.prazo)}</small>` : '';
            const item = document.createElement('div');
            item.className = 'task-item';
            item.innerHTML = `
                <div class="task-checkbox ${tarefa.concluida ? 'checked' : ''}" onclick="toggleTarefa(${tarefa.id})">
                    ${tarefa.concluida ? '<i class="fa-solid fa-check"></i>' : ''}
                </div>
                <div class="task-content">
                    <div class="task-title ${tarefa.concluida ? 'completed' : ''}">${tarefa.titulo}${prazoTexto}</div>
                    <div class="task-meta">${formatarDataTarefa(tarefa.data)}</div>
                </div>
                <div class="task-priority priority-${tarefa.prioridade}">${getPrioridadeTexto(tarefa.prioridade)}</div>
                <div class="task-delete" onclick="confirmarExclusaoTarefa(this, ${tarefa.id})"><i class="fa-solid fa-trash"></i></div>
                <div class="task-confirm-delete" id="confirm-del-${tarefa.id}" style="display:none;">
                    <span>Excluir?</span>
                    <button class="btn-confirm-sim" onclick="deletarTarefa(${tarefa.id})">Sim</button>
                    <button class="btn-confirm-nao" onclick="cancelarExclusaoTarefa(${tarefa.id})">Não</button>
                </div>
            `;
            group.appendChild(item);
        });

        container.appendChild(group);
    }

    // Grupo 2: Pendências dos módulos
    if (pendencias.length > 0) {
        const group = document.createElement('div');
        group.className = 'tasks-group';
        group.innerHTML = `<div class="tasks-group-header pendencias-header"><i class="fa-solid fa-triangle-exclamation"></i> Pendências do Sistema <span class="pendencias-count">${pendencias.length}</span></div>`;

        pendencias.forEach(p => {
            const item = document.createElement('div');
            item.className = 'task-item pendencia-item';
            item.onclick = () => window.location.href = p.link;
            item.innerHTML = `
                <div class="pendencia-icon" style="background:${p.moduloCor}18; color:${p.moduloCor};">
                    <i class="${p.icone}"></i>
                </div>
                <div class="task-content">
                    <div class="task-title">${p.titulo}</div>
                    <div class="task-meta">${p.descricao}</div>
                </div>
                <div class="pendencia-modulo" style="background:${p.moduloCor}15; color:${p.moduloCor}; border-color:${p.moduloCor}30;">${p.moduloLabel}</div>
                <i class="fa-solid fa-chevron-right pendencia-arrow"></i>
            `;
            group.appendChild(item);
        });

        container.appendChild(group);
    }
}

function adicionarTarefa() {
    document.getElementById('modalTarefa').classList.add('active');
    document.getElementById('tarefaTitulo').focus();
}

function fecharModal() {
    document.getElementById('modalTarefa').classList.remove('active');
    document.getElementById('tarefaTitulo').value = '';
    document.getElementById('tarefaPrioridade').value = 'media';
    document.getElementById('tarefaPrazo').value = '';
}

function salvarTarefa() {
    const titulo = document.getElementById('tarefaTitulo').value.trim();
    const prioridade = document.getElementById('tarefaPrioridade').value;
    const prazo = document.getElementById('tarefaPrazo').value;
    
    if (!titulo) {
        alert('Digite um título para a tarefa!');
        return;
    }
    
    const novaTarefa = {
        id: Date.now(),
        titulo: titulo,
        prioridade: prioridade,
        prazo: prazo || null,
        concluida: false,
        data: new Date().toISOString()
    };
    
    tarefas.unshift(novaTarefa);
    salvarTarefas();
    renderizarTarefas();
    fecharModal();
    
    mostrarNotificacao('✅ Tarefa adicionada com sucesso!', 'success');
}

function toggleTarefa(id) {
    const tarefa = tarefas.find(t => t.id === id);
    if (tarefa) {
        tarefa.concluida = !tarefa.concluida;
        salvarTarefas();
        renderizarTarefas();
        
        if (tarefa.concluida) {
            mostrarNotificacao('✅ Tarefa concluída!', 'success');
        }
    }
}

function confirmarExclusaoTarefa(btn, id) {
    // Fecha qualquer outro painel aberto
    document.querySelectorAll('.task-confirm-delete').forEach(el => el.style.display = 'none');
    const painel = document.getElementById('confirm-del-' + id);
    if (painel) painel.style.display = 'flex';
}

function cancelarExclusaoTarefa(id) {
    const painel = document.getElementById('confirm-del-' + id);
    if (painel) painel.style.display = 'none';
}

function deletarTarefa(id) {
    tarefas = tarefas.filter(t => t.id !== id);
    salvarTarefas();
    renderizarTarefas();
    mostrarNotificacao('Tarefa excluída!', 'info');
}

function getPrioridadeTexto(prioridade) {
    const textos = {
        baixa: '🟢 Baixa',
        media: '🟡 Média',
        alta: '🔴 Alta'
    };
    return textos[prioridade] || '🟡 Média';
}

function formatarDataTarefa(dataISO) {
    const data = new Date(dataISO);
    const hoje = new Date();
    const diff = hoje - data;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    if (dias < 7) return `Há ${dias} dias`;
    
    return data.toLocaleDateString('pt-BR');
}

function formatarDataPrazo(dataPrazo) {
    if (!dataPrazo) return '';
    
    const prazo = new Date(dataPrazo + 'T00:00:00');
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const diff = prazo - hoje;
    const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (dias < 0) {
        return `<span style="color: #dc2626; font-weight: 600;">Atrasado ${Math.abs(dias)} dia${Math.abs(dias) > 1 ? 's' : ''}</span>`;
    } else if (dias === 0) {
        return '<span style="color: #f59e0b; font-weight: 600;">Vence hoje!</span>';
    } else if (dias === 1) {
        return '<span style="color: #f59e0b;">Vence amanhã</span>';
    } else if (dias <= 7) {
        return `<span style="color: #4776ec;">Vence em ${dias} dias</span>`;
    } else {
        return prazo.toLocaleDateString('pt-BR');
    }
}

// ========================================
// ATIVIDADES RECENTES
// ========================================

function carregarAtividades(empresas) {
    const container = document.getElementById('timelineContainer');
    if (!container) return;

    const arquivos = JSON.parse(localStorage.getItem('arquivosUpload') || '[]');

    const atividades = [];

    // Adicionar empresas cadastradas (Supabase)
    empresas.slice(0, 5).forEach(empresa => {
        atividades.push({
            tipo: 'cadastro',
            titulo: empresa.nome_empresa || empresa.nome_fantasia || '—',
            descricao: `Empresa cadastrada como ${(empresa.tipos || []).join(' e ') || 'não especificado'}`,
            data: empresa.criado_em,
            cor: '#22C55E'
        });
    });
    
    // Adicionar uploads
    arquivos.slice(-5).reverse().forEach(arquivo => {
        atividades.push({
            tipo: 'upload',
            titulo: arquivo.nome,
            descricao: `Arquivo enviado (${arquivo.tamanhoFormatado})`,
            data: arquivo.dataUpload,
            cor: '#4776ec'
        });
    });
    
    // Filtrar apenas atividades dos últimos 2 dias
    const limite2Dias = new Date();
    limite2Dias.setDate(limite2Dias.getDate() - 2);
    limite2Dias.setHours(0, 0, 0, 0);

    const atividadesFiltradas = atividades.filter(a => new Date(a.data) >= limite2Dias);

    // Ordenar por data
    atividadesFiltradas.sort((a, b) => new Date(b.data) - new Date(a.data));

    // Limitar a 10 atividades
    const atividadesRecentes = atividadesFiltradas.slice(0, 10);
    
    const section = document.getElementById('recent-section');
    if (section) section.style.display = atividadesRecentes.length === 0 ? 'none' : '';

    if (atividadesRecentes.length === 0) return;
    
    container.innerHTML = '';
    
    atividadesRecentes.forEach(atividade => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
            <div class="timeline-dot" style="background: ${atividade.cor};"></div>
            <div class="timeline-content">
                <div class="timeline-title">${atividade.titulo}</div>
                <div class="timeline-desc">${atividade.descricao}</div>
                <div class="timeline-time">${formatarDataAtividade(atividade.data)}</div>
            </div>
        `;
        container.appendChild(item);
    });
}

function formatarDataAtividade(dataISO) {
    const data = new Date(dataISO);
    return data.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ========================================
// GRÁFICOS
// ========================================

async function inicializarGraficos(empresas) {
    criarGraficoTipos(empresas);
    criarGraficoEstados(empresas);

    try {
        const usuario = obterUsuarioLogado();
        if (!usuario?.empresa_id) return;
        const [resProc, resProf] = await Promise.all([
            supabaseClient.from('processos').select('status').eq('empresa_proprietaria_id', usuario.empresa_id),
            supabaseClient.from('proformas').select('status').eq('empresa_id', usuario.empresa_id)
        ]);
        criarGraficoProcessos(resProc.data || []);
        criarGraficoProformas(resProf.data || []);
    } catch (e) { console.error('Gráficos operações:', e); }
}

// Gráfico de Parceiros por Tipo
function criarGraficoTipos(empresas) {
    const ctx = document.getElementById('chartTipos');
    if (!ctx) return;

    const counts = [
        empresas.filter(e => e.is_cliente).length,
        empresas.filter(e => e.is_fornecedor).length,
        empresas.filter(e => e.is_fabricante).length,
        empresas.filter(e => e.is_transportadora).length,
        empresas.filter(e => e.is_remetente).length,
    ];

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Clientes', 'Fornecedores', 'Fabricantes', 'Transportadoras', 'Remetentes'],
            datasets: [{
                data: counts,
                backgroundColor: ['#22C55E', '#f59e0b', '#4776ec', '#06b6d4', '#f43f5e'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// Gráfico de Novos Cadastros por Mês
function criarGraficoCadastros(empresas) {
    const ctx = document.getElementById('chartCadastros');
    if (!ctx) return;

    const hoje = new Date();
    const meses = Array.from({ length: 6 }, (_, i) => {
        const d = new Date(hoje.getFullYear(), hoje.getMonth() - (5 - i), 1);
        return {
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
            count: 0
        };
    });

    empresas.forEach(e => {
        const d = new Date(e.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const mes = meses.find(m => m.key === key);
        if (mes) mes.count++;
    });

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: meses.map(m => m.label),
            datasets: [{
                data: meses.map(m => m.count),
                backgroundColor: 'rgba(34,197,94,0.12)',
                borderColor: '#22c55e',
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: { label: c => ` ${c.parsed.y} cadastro${c.parsed.y !== 1 ? 's' : ''}` }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                y: { beginAtZero: true, ticks: { stepSize: 1, color: '#94a3b8', font: { size: 11 } }, grid: { color: '#f8fafc' } }
            }
        }
    });
}

// Gráfico de Uploads por Mês (legado — mantido para referência)
function criarGraficoUploads(arquivos) {
    const ctx = document.getElementById('chartUploads');
    if (!ctx) return;
    
    // Agrupar por mês
    const meses = {};
    arquivos.forEach(arquivo => {
        const data = new Date(arquivo.dataUpload);
        const mes = data.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
        meses[mes] = (meses[mes] || 0) + 1;
    });
    
    // Pegar últimos 6 meses
    const labels = Object.keys(meses).slice(-6);
    const valores = labels.map(mes => meses[mes] || 0);
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.length > 0 ? labels : ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'],
            datasets: [{
                label: 'Uploads',
                data: valores.length > 0 ? valores : [0, 0, 0, 0, 0, 0],
                borderColor: '#4776ec',
                backgroundColor: 'rgba(71, 118, 236, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Gráfico de Empresas por Estado
function criarGraficoEstados(empresas) {
    const ctx = document.getElementById('chartEstados');
    if (!ctx) return;
    
    // Normaliza código de país para nome de exibição
    const normalizarPais = p => {
        if (!p) return 'Não informado';
        const upper = p.trim().toUpperCase();
        if (['BR', 'BRA', 'BRASIL', 'BRAZIL'].includes(upper)) return 'BRASIL';
        return p.trim();
    };

    // Agrupar por país
    const estados = {};
    empresas.forEach(empresa => {
        const estado = normalizarPais(empresa.pais);
        estados[estado] = (estados[estado] || 0) + 1;
    });
    
    // Ordenar e pegar top 8
    const estadosOrdenados = Object.entries(estados)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);
    
    const labels = estadosOrdenados.map(e => e[0]);
    const valores = estadosOrdenados.map(e => e[1]);
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels.length > 0 ? labels : ['Brasil', 'EUA', 'China'],
            datasets: [{
                label: 'Empresas',
                data: valores.length > 0 ? valores : [0, 0, 0],
                backgroundColor: 'rgba(71, 118, 236, 0.85)',
                hoverBackgroundColor: '#4776ec',
                borderRadius: 6,
                borderSkipped: false,
                barPercentage: 0.4,
                categoryPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} empresa${ctx.parsed.y !== 1 ? 's' : ''}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 12 }, color: '#64748b' }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f1f5f9', drawBorder: false },
                    ticks: { stepSize: 1, color: '#94a3b8', font: { size: 11 } }
                }
            }
        }
    });
}

// Gráfico de Processos por Status
function criarGraficoProcessos(processos) {
    const ctx = document.getElementById('chartProcessos');
    if (!ctx) return;

    const labels = ['Aberto', 'Em Andamento', 'Ag. Documentos', 'Concluído', 'Cancelado'];
    const keys   = ['aberto', 'em_andamento', 'aguardando_documentos', 'concluido', 'cancelado'];
    const colors = ['#4776ec', '#f59e0b', '#06b6d4', '#22c55e', '#ef4444'];
    const counts = keys.map(k => processos.filter(p => p.status === k).length);

    if (counts.every(c => c === 0)) {
        ctx.parentElement.insertAdjacentHTML('beforeend', '<p class="chart-sem-dados">Nenhum processo cadastrado</p>');
        ctx.style.display = 'none';
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }] },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// Gráfico de Proformas por Status
function criarGraficoProformas(proformas) {
    const ctx = document.getElementById('chartProformas');
    if (!ctx) return;

    const labels = ['Enviado', 'Aprovado', 'Pendente', 'Recusado'];
    const keys   = ['enviado', 'aprovado', 'pendente', 'recusado'];
    const colors = ['#4776ec', '#22c55e', '#f59e0b', '#ef4444'];
    const counts = keys.map(k => proformas.filter(p => p.status === k).length);

    if (counts.every(c => c === 0)) {
        ctx.parentElement.insertAdjacentHTML('beforeend', '<p class="chart-sem-dados">Nenhuma proforma cadastrada</p>');
        ctx.style.display = 'none';
        return;
    }

    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ========================================
// WHATSAPP CHAT
// ========================================

function toggleWhatsappChat() {
    const chat = document.getElementById('whatsappChat');
    chat.classList.toggle('active');
}

function enviarMensagem() {
    const input = document.getElementById('chatInput');
    const mensagem = input.value.trim();
    
    if (mensagem === '') return;
    
    const chatBody = document.querySelector('.chat-body');
    const userMessage = document.createElement('div');
    userMessage.className = 'chat-message user';
    userMessage.innerHTML = `
        <div class="message-content">${mensagem}</div>
        <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
    `;
    chatBody.appendChild(userMessage);
    
    input.value = '';
    chatBody.scrollTop = chatBody.scrollHeight;
    
    setTimeout(() => {
        const botMessage = document.createElement('div');
        botMessage.className = 'chat-message bot';
        botMessage.innerHTML = `
            <div class="message-content">Obrigado pela sua mensagem! Nossa equipe responderá em breve. 😊</div>
            <div class="message-time">${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatBody.appendChild(botMessage);
        chatBody.scrollTop = chatBody.scrollHeight;
    }, 1000);
}

// ========================================
// NOTIFICAÇÕES
// ========================================

function mostrarNotificacao(mensagem, tipo = 'info') {
    const notificacao = document.createElement('div');
    notificacao.className = `notificacao notificacao-${tipo}`;
    
    const icones = {
        success: 'fa-circle-check',
        error: 'fa-circle-exclamation',
        warning: 'fa-triangle-exclamation',
        info: 'fa-circle-info'
    };
    
    const cores = {
        success: '#22C55E',
        error: '#dc2626',
        warning: '#f59e0b',
        info: '#4776ec'
    };
    
    notificacao.innerHTML = `
        <i class="fa-solid ${icones[tipo]}"></i>
        <span>${mensagem}</span>
    `;
    
    notificacao.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: white;
        color: ${cores[tipo]};
        padding: 16px 24px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.15);
        display: flex;
        align-items: center;
        gap: 12px;
        font-weight: 600;
        z-index: 10000;
        animation: slideIn 0.3s ease;
        border-left: 4px solid ${cores[tipo]};
        max-width: 400px;
    `;
    
    document.body.appendChild(notificacao);
    
    setTimeout(() => {
        notificacao.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notificacao.remove(), 300);
    }, 5000);
}

// Adicionar animações CSS
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);