// ========================================
// PRODUTOS — LISTA (SUPABASE)
// ========================================

let _produtos = [];

// --------------------------------------------------
// UTILITÁRIOS
// --------------------------------------------------
function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = String(value ?? '');
    return div.innerHTML;
}

function notify(msg, type) {
    if (typeof mostrarNotificacao === 'function') mostrarNotificacao(msg, type || 'info');
}

async function carregarProdutos() {
    const container = document.getElementById('listaContainer');
    if (container) {
        container.innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>`;
    }
    try {
        const res = await window.supabaseAPI.buscarProdutos();
        if (!res.sucesso) {
            console.error('Falha ao buscar produtos:', res.mensagem);
            notify(res.mensagem || 'Não foi possível carregar os produtos.', 'error');
            _produtos = [];
        } else {
            _produtos = res.data || [];
        }
    } catch (err) {
        console.error('Erro ao buscar produtos:', err);
        notify('Erro ao carregar produtos.', 'error');
        _produtos = [];
    }
    renderTabela(document.getElementById('filtroProdutos')?.value || '');
}

// --------------------------------------------------
// MODAL DE EXCLUSÃO
// --------------------------------------------------
let _idParaExcluir = '';

function abrirModalExcluir(id) {
    const prod = _produtos.find(p => p.id === id);
    if (!prod) return;
    _idParaExcluir = id;

    document.getElementById('excluirProdutoInfo').innerHTML = `
        <div style="font-weight:700; color:#991b1b; font-size:15px; margin-bottom:6px;">
            <i class="fa-solid fa-boxes-stacked"></i> ${escapeHtml(prod.nome || '—')}
        </div>
        <div style="font-size:13px; color:#6b7280;">SKU: ${escapeHtml(prod.sku || '—')} &mdash; ${escapeHtml(prod.categoria || 'Sem categoria')}</div>
    `;

    document.getElementById('modalExcluir').classList.add('active');
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    _idParaExcluir = '';
}

// --------------------------------------------------
// TABELA DE PRODUTOS
// --------------------------------------------------
function statusProdBadge(s) {
    return s === 'inativo'
        ? '<span class="prod-badge inativo">Inativo</span>'
        : '<span class="prod-badge ativo">Ativo</span>';
}

function renderTabela(filtro) {
    const container = document.getElementById('listaContainer');
    const count     = document.getElementById('listaCount');
    if (!container) return;

    const q    = (filtro || '').trim().toLowerCase();
    const all  = _produtos;
    const list = q
        ? all.filter(p => `${p.sku} ${p.nome} ${p.categoria} ${p.ncm} ${p.marca}`.toLowerCase().includes(q))
        : all;

    count.textContent = `${list.length} produto${list.length !== 1 ? 's' : ''}`;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-inbox"></i>
                ${q ? 'Nenhum produto encontrado para este filtro.' : 'Nenhum produto cadastrado ainda. Clique em "Novo Produto".'}
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="prod-tabela">
            <thead>
                <tr>
                    <th>SKU</th>
                    <th>Nome</th>
                    <th>Categoria</th>
                    <th>Marca</th>
                    <th>NCM</th>
                    <th>Status</th>
                    <th>Ações</th>
                </tr>
            </thead>
            <tbody>
                ${list.map(p => `
                <tr>
                    <td><span class="prod-sku">${escapeHtml(p.sku || '—')}</span></td>
                    <td>${escapeHtml(p.nome || '—')}</td>
                    <td>${escapeHtml(p.categoria || '—')}</td>
                    <td>${escapeHtml(p.marca || '—')}</td>
                    <td>${escapeHtml(p.ncm || '—')}</td>
                    <td>${statusProdBadge(p.status)}</td>
                    <td>
                        <button class="btn-acao btn-editar" data-action="editar" data-id="${escapeHtml(p.id)}" title="Editar">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="btn-acao btn-excluir" data-action="excluir" data-id="${escapeHtml(p.id)}" title="Excluir">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

function processarUploadProdutos(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    notify(`Arquivo "${file.name}" recebido. Integração de importação em desenvolvimento.`, 'info');
    input.value = '';
}

// --------------------------------------------------
// INICIALIZAÇÃO
// --------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    carregarProdutos();

    // Filtro
    document.getElementById('filtroProdutos')?.addEventListener('input', e => renderTabela(e.target.value));

    // Cliques na tabela
    document.getElementById('listaContainer')?.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.getAttribute('data-action');
        const id     = btn.getAttribute('data-id');
        if (action === 'editar')  window.open(`formularios.html?tab=produto&id=${id}`, '_blank');
        if (action === 'excluir') abrirModalExcluir(id);
    });

    // Confirmar exclusão
    document.getElementById('btnConfirmarExcluir')?.addEventListener('click', async () => {
        if (!_idParaExcluir) return;
        const res = await window.supabaseAPI.excluirProduto(_idParaExcluir);
        if (!res.sucesso) {
            notify(res.mensagem || 'Não foi possível excluir o produto.', 'error');
            return;
        }
        notify('Produto excluído.', 'success');
        fecharModalExcluir();
        carregarProdutos();
    });

    // Atualiza a lista quando a aba volta a ficar visível (ex: após cadastrar/editar em outra aba)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') carregarProdutos();
    });
});
