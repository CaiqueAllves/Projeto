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
    carregarPendenciasSistema().then(renderizarTarefas);

    // Buscar empresas do Supabase uma única vez e compartilhar com todas as funções
    const resultado = await buscarEmpresasCadastradas();
    const empresas = resultado.sucesso ? resultado.data : [];

    carregarEstatisticas(empresas);
    carregarAtividades(empresas);
    inicializarGraficos(empresas);
    
    // Inicializar chat
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
            supabaseClient.from('produtos').select('*', { count: 'exact', head: true }).eq('empresa_id', usuario.empresa_id),
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

// ========================================
// PENDÊNCIAS DO SISTEMA (dados reais do Supabase)
// ========================================
// Critérios confirmados com o usuário: Pedido com status "aguardando",
// Proforma com status "pendente", Processo com status "aberto", e
// documentos já feitos mas ainda não assinados (usa a mesma taxonomia/
// cálculo de doc-tipos.js, compartilhada com a tela Documentos). Produtos
// pendentes (status "pendente") não pertencem a um Pedido específico, por
// isso ficam numa lista separada, fora da tabela.

let _pendPedidos            = []; // pedidos com pelo menos 1 pendência, já com o detalhe calculado
let _pendProdutosPendentes  = [];
let _pendExpandidos         = new Set();

async function carregarPendenciasSistema() {
    const usuario = obterUsuarioLogado();
    if (!usuario) { _pendPedidos = []; _pendProdutosPendentes = []; return; }

    const resPedidos = await buscarPedidos();
    const pedidos = resPedidos.sucesso ? (resPedidos.data || []) : [];
    const pedidoIds = pedidos.map(p => p.id).filter(Boolean);

    const proformasMap = {};
    const processosMap = {};
    let docsMap = {};

    if (pedidoIds.length > 0) {
        const { data: proformas } = await supabaseClient
            .from('proformas').select('id, codigo, modal, status, pedido_id').in('pedido_id', pedidoIds);
        (proformas || []).forEach(pf => { (proformasMap[pf.pedido_id] ||= []).push(pf); });

        const proformaIds = (proformas || []).map(pf => pf.id);
        if (proformaIds.length > 0) {
            const { data: procs } = await supabaseClient
                .from('processos').select('id, numero_processo, status, proforma_id, documentos').in('proforma_id', proformaIds);
            (procs || []).forEach(pr => { (processosMap[pr.proforma_id] ||= []).push(pr); });
        }

        const resDocs = await window.supabaseAPI.buscarDocumentosPedidos(pedidoIds);
        (resDocs.data || []).forEach(d => { (docsMap[d.pedido_id] ||= {})[d.tipo_documento] = d; });
    }

    _pendPedidos = pedidos.map(p => {
        const proformasDoPedido = proformasMap[p.id] || [];
        const processosDoPedido = proformasDoPedido.flatMap(pf => processosMap[pf.id] || []);
        const docsSalvos        = docsMap[p.id] || {};

        const pedidoPendente     = p.status === 'aguardando';
        const proformasPendentes = proformasDoPedido.filter(pf => pf.status === 'pendente');
        const processosAbertos   = processosDoPedido.filter(pr => pr.status === 'aberto');

        // Só conta documentos "feitos" pra saber quantos ainda faltam assinar
        // — um tipo que nunca foi gerado não é uma pendência de assinatura.
        let docsFeitos = 0, docsAssinados = 0;
        docTiposDoPedido(proformasDoPedido, docsSalvos).forEach(tipo => {
            if (tipo.custom) return;
            const reg = docsSalvos[tipo.id];
            const assinado = !!reg?.assinado;
            const feito = assinado || docFeitoAutomatico(processosDoPedido, tipo.id);
            if (feito) { docsFeitos++; if (assinado) docsAssinados++; }
        });
        const temDocPendente = docsFeitos > docsAssinados;

        const temPendencia = pedidoPendente || proformasPendentes.length > 0 || processosAbertos.length > 0 || temDocPendente;
        if (!temPendencia) return null;

        return {
            pedido: p,
            remetente:    p.remetente?.nome_fantasia || p.remetente?.razao_social || 'Própria empresa',
            destinatario: p.parceiros?.nome_fantasia || p.parceiros?.razao_social || '—',
            pedidoPendente, proformasPendentes, processosAbertos,
            docsFeitos, docsAssinados, temDocPendente,
        };
    }).filter(Boolean);

    const resProdutos = await window.supabaseAPI.buscarProdutos();
    const produtos = resProdutos.sucesso ? (resProdutos.data || []) : [];
    _pendProdutosPendentes = produtos.filter(pr => pr.status === 'pendente');
}

function renderizarTarefas() {
    const container = document.getElementById('tasksContainer');
    if (!container) return;

    const totalPendencias = _pendPedidos.length + _pendProdutosPendentes.length;
    const totalPendente   = tarefas.filter(t => !t.concluida).length + totalPendencias;

    const badge = document.getElementById('tarefasCountBadge');
    if (badge) badge.textContent = totalPendente || '';

    const section = document.getElementById('tasks-section');
    if (section) section.style.display = (tarefas.length === 0 && totalPendencias === 0) ? 'none' : '';

    if (tarefas.length === 0 && totalPendencias === 0) return;

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

    // Grupo 2: Pendências do Sistema — 1 linha por Pedido, com expandir
    if (_pendPedidos.length > 0) {
        const group = document.createElement('div');
        group.className = 'tasks-group';
        group.innerHTML = `
            <div class="tasks-group-header pendencias-header"><i class="fa-solid fa-triangle-exclamation"></i> Pendências do Sistema <span class="pendencias-count">${_pendPedidos.length}</span></div>
            <table class="pend-tabela">
                <thead><tr><th class="pend-col-seta"></th><th>Pedido</th><th>Pendências</th></tr></thead>
                <tbody>${_pendPedidos.map(_pendRenderLinha).join('')}</tbody>
            </table>`;
        container.appendChild(group);
    }

    // Grupo 3: Produtos Pendentes — lista simples, não pertence a um Pedido
    if (_pendProdutosPendentes.length > 0) {
        const group = document.createElement('div');
        group.className = 'tasks-group';
        group.innerHTML = `<div class="tasks-group-header pendencias-header"><i class="fa-solid fa-box"></i> Produtos Pendentes <span class="pendencias-count">${_pendProdutosPendentes.length}</span></div>`;

        _pendProdutosPendentes.forEach(produto => {
            const item = document.createElement('div');
            item.className = 'task-item pendencia-item';
            item.onclick = () => window.open(`formularios.html?tab=produto&id=${produto.id}`, '_blank');
            item.innerHTML = `
                <div class="pendencia-icon" style="background:#0891b218; color:#0891b2;">
                    <i class="fa-solid fa-box"></i>
                </div>
                <div class="task-content">
                    <div class="task-title">${produto.nome || 'Sem nome'}</div>
                    <div class="task-meta">SKU: ${produto.sku || '—'} · Cadastro pendente</div>
                </div>
                <i class="fa-solid fa-chevron-right pendencia-arrow"></i>
            `;
            group.appendChild(item);
        });

        container.appendChild(group);
    }
}

function pendToggleLinha(pedidoId) {
    if (_pendExpandidos.has(pedidoId)) _pendExpandidos.delete(pedidoId);
    else _pendExpandidos.add(pedidoId);
    renderizarTarefas();
}

function _pendRenderLinha(item) {
    const pedidoId  = item.pedido.id;
    const expandido = _pendExpandidos.has(pedidoId);

    const tags = [];
    if (item.pedidoPendente) tags.push(`<span class="pend-tag pend-tag-pedido">Pedido Aguardando</span>`);
    if (item.proformasPendentes.length) tags.push(`<span class="pend-tag pend-tag-proforma">Proforma Pendente${item.proformasPendentes.length > 1 ? ` (${item.proformasPendentes.length})` : ''}</span>`);
    if (item.processosAbertos.length) tags.push(`<span class="pend-tag pend-tag-processo">Processo Aberto${item.processosAbertos.length > 1 ? ` (${item.processosAbertos.length})` : ''}</span>`);
    if (item.temDocPendente) tags.push(`<span class="pend-tag pend-tag-doc">${item.docsAssinados}/${item.docsFeitos} assinados</span>`);

    const linhaResumo = `
        <tr class="pend-linha">
            <td class="pend-col-seta">
                <button class="pend-toggle" onclick="pendToggleLinha('${pedidoId}')" title="${expandido ? 'Recolher' : 'Expandir'}">
                    <i class="fa-solid fa-chevron-${expandido ? 'up' : 'down'}"></i>
                </button>
            </td>
            <td>
                <div class="pend-pedido-numero">${item.pedido.numero || '—'}</div>
                <div class="pend-pedido-parceiro">${item.destinatario}</div>
            </td>
            <td class="pend-tags">${tags.join('')}</td>
        </tr>`;

    if (!expandido) return linhaResumo;

    const detalhes = [];
    if (item.pedidoPendente) {
        detalhes.push(`<div class="pend-detalhe-linha"><i class="fa-solid fa-bag-shopping"></i> Pedido está <strong>aguardando</strong> confirmação. <a href="pedidos.html?editar=${pedidoId}">Abrir pedido</a></div>`);
    }
    item.proformasPendentes.forEach(pf => {
        detalhes.push(`<div class="pend-detalhe-linha"><i class="fa-solid fa-file-invoice"></i> Proforma <strong>${pf.codigo || '—'}</strong> está pendente. <a href="formularios.html?tab=proposta&id=${pf.id}" target="_blank">Abrir proforma</a></div>`);
    });
    item.processosAbertos.forEach(pr => {
        detalhes.push(`<div class="pend-detalhe-linha"><i class="fa-solid fa-diagram-project"></i> Processo <strong>${pr.numero_processo || '—'}</strong> está aberto. <a href="formularios.html?tab=processo&id=${pr.id}" target="_blank">Abrir processo</a></div>`);
    });
    if (item.temDocPendente) {
        detalhes.push(`<div class="pend-detalhe-linha"><i class="fa-solid fa-file-signature"></i> Documentos: <strong>${item.docsAssinados}/${item.docsFeitos}</strong> assinados. <a href="documentos.html">Abrir documentos</a></div>`);
    }

    return linhaResumo + `
        <tr class="pend-linha-detalhe">
            <td colspan="3"><div class="pend-detalhe-wrap">${detalhes.join('')}</div></td>
        </tr>`;
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

    const labels = ['Enviado', 'Aprovado', 'Pendente', 'Encerrado'];
    const keys   = ['enviado', 'aprovado', 'pendente', 'encerrado'];
    const colors = ['#4776ec', '#22c55e', '#f59e0b', '#ef4444'];
    // 'recusado'/'finalizado' são status legados, hoje contabilizados como
    // "Encerrado" (mesmo mapeamento de proforma.js _profGetColuna)
    const colunaDe = status => (status === 'recusado' || status === 'finalizado') ? 'encerrado' : (status || 'enviado');
    const counts = keys.map(k => proformas.filter(p => colunaDe(p.status) === k).length);

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