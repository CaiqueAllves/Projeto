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

// --------------------------------------------------
// UPLOAD — EXCEL (LOTE) OU PDF (1 PRODUTO)
// --------------------------------------------------
async function processarUploadProdutos(input) {
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const ext  = (file.name.split('.').pop() || '').toLowerCase();

    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
        notify('Formato não suportado. Envie um arquivo .xlsx, .xls ou .pdf.', 'error');
        input.value = '';
        return;
    }

    notify(`Lendo "${file.name}"...`, 'info');

    try {
        if (ext === 'xlsx' || ext === 'xls') {
            const linhas = await _prodUploadLerExcel(file);
            await _prodUploadImportarLote(linhas);
        } else {
            const dados = await _prodUploadLerPDF(file);
            if (!dados || !Object.keys(dados).length) {
                notify('Não foi possível extrair dados do PDF. Ele pode ser uma imagem escaneada (sem texto selecionável).', 'aviso');
            } else {
                sessionStorage.setItem('_uploadProdutoDados', JSON.stringify(dados));
                window.open('formularios.html?tab=produto&from_upload=1', '_blank');
            }
        }
    } catch (err) {
        console.error('Erro ao processar upload de produto:', err);
        notify('Erro ao processar o arquivo: ' + err.message, 'error');
    } finally {
        input.value = '';
    }
}

// ── Excel — importação em lote (cada linha vira 1 produto) ────────

async function _prodUploadLerExcel(arquivo) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS não carregado');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                resolve(_prodUploadParsearExcelLote(rows));
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

const PROD_UPLOAD_ALIASES = {
    'sku': 'sku', 'codigo sku': 'sku', 'codigo': 'sku', 'cod': 'sku',
    'nome': 'nome', 'produto': 'nome', 'nome do produto': 'nome', 'descricao': 'descricao',
    'descricao tecnica': 'descricao',
    'categoria': 'categoria',
    'tipo': 'tipo',
    'marca': 'marca', 'fabricante': 'marca',
    'ncm': 'ncm',
    'unidade': 'unidade_medida', 'unidade medida': 'unidade_medida', 'un': 'unidade_medida', 'unidade comercial': 'unidade_medida',
    'status': 'status',
    'preco custo': 'preco_custo', 'preco de custo': 'preco_custo', 'custo': 'preco_custo',
    'preco venda': 'preco_venda', 'preco de venda': 'preco_venda', 'venda': 'preco_venda', 'preco': 'preco_venda',
    'moeda': 'moeda',
    'estoque': 'estoque_atual', 'estoque atual': 'estoque_atual', 'quantidade': 'estoque_atual', 'qtd': 'estoque_atual',
    'estoque minimo': 'estoque_minimo',
};

function _prodUploadNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function _prodUploadParaNumero(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

function _prodUploadParsearExcelLote(rows) {
    if (!rows || !rows.length) return [];

    // Linha de cabeçalho: a primeira que reconhecer ao menos "sku" e "nome"
    let headerIdx = -1, headerMap = {};
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const mapped = {};
        rows[i].forEach((cell, idx) => {
            const n = _prodUploadNorm(cell);
            if (PROD_UPLOAD_ALIASES[n] && mapped[PROD_UPLOAD_ALIASES[n]] === undefined) mapped[PROD_UPLOAD_ALIASES[n]] = idx;
        });
        if (mapped.sku !== undefined && mapped.nome !== undefined) { headerIdx = i; headerMap = mapped; break; }
    }
    if (headerIdx < 0) return [];

    const produtos = [];
    for (let i = headerIdx + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.every(c => String(c || '').trim() === '')) continue;

        const p = {};
        Object.entries(headerMap).forEach(([campo, idx]) => {
            const v = String(row[idx] ?? '').trim();
            if (v) p[campo] = v;
        });
        if (!p.sku || !p.nome) continue;

        if (p.preco_custo != null) p.preco_custo = _prodUploadParaNumero(p.preco_custo);
        if (p.preco_venda != null) p.preco_venda = _prodUploadParaNumero(p.preco_venda);
        if (p.estoque_atual != null) p.estoque_atual = _prodUploadParaNumero(p.estoque_atual);
        if (p.estoque_minimo != null) p.estoque_minimo = _prodUploadParaNumero(p.estoque_minimo);
        p.status = p.status || 'ativo';
        p.moeda  = p.moeda  || 'BRL';

        produtos.push(p);
    }
    return produtos;
}

async function _prodUploadImportarLote(produtos) {
    if (!produtos.length) {
        notify('Nenhum produto reconhecido na planilha. Confira se as colunas incluem pelo menos "SKU" e "Nome".', 'aviso');
        return;
    }

    let sucesso = 0, falha = 0;
    for (const p of produtos) {
        const res = await window.supabaseAPI.salvarProduto(p);
        if (res.sucesso) sucesso++; else { falha++; console.warn('Falha ao importar produto', p.sku, res.mensagem); }
    }

    if (sucesso) notify(`${sucesso} produto${sucesso !== 1 ? 's' : ''} importado${sucesso !== 1 ? 's' : ''} com sucesso.${falha ? ` ${falha} falharam.` : ''}`, falha ? 'aviso' : 'success');
    else notify('Não foi possível importar os produtos da planilha.', 'error');

    if (sucesso) carregarProdutos();
}

// ── PDF — ficha técnica de 1 produto (preenche o formulário) ──────

async function _prodUploadLerPDF(arquivo) {
    if (typeof pdfjsLib === 'undefined') throw new Error('PDF.js não carregado');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async e => {
            try {
                const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(e.target.result) }).promise;
                let texto = '';
                for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
                    const page = await pdf.getPage(i);
                    const content = await page.getTextContent();
                    texto += content.items.map(item => item.str).join(' ') + '\n';
                }
                if (texto.trim().length < 10) {
                    resolve({}); // PDF escaneado — sem texto legível
                } else {
                    resolve(_prodUploadParsearTextoPDF(texto));
                }
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

function _prodUploadParsearTextoPDF(texto) {
    const d = {};
    const t = texto.replace(/\s+/g, ' ');

    // Rótulos dos próximos campos, usados como ponto de parada das capturas
    // (o texto do PDF vem achatado, sem quebras de linha, então não dá pra
    // usar "\s{2,}" pra saber onde um campo termina e o outro começa).
    const PROX = 'SKU|C[oó]digo|Nome(?:\\s*do\\s*Produto)?|Descri[cç][aã]o|Categoria|Marca|Fabricante|NCM|Unidade|Pre[cç]o|Peso|Estoque|Dimens[oõ]es|Comprimento|Largura|Altura|Status';

    const skuM = t.match(/\bSKU[:\s]+([A-Za-z0-9._-]{2,30})/i);
    if (skuM) d.sku = skuM[1].trim();

    const nomeM = t.match(new RegExp(`(?:Nome\\s*do\\s*Produto|Nome\\s*do\\s*Item|Produto|Nome)[:\\s]+([A-Za-zÀ-ú0-9\\s&.,'"()-]{2,80}?)(?=\\s*(?:${PROX})\\b|$)`, 'i'));
    if (nomeM) d.nome = nomeM[1].trim().replace(/\s+/g, ' ');

    // Texto livre — usa [\s\S] (qualquer caractere) em vez da classe restrita
    // usada nos outros campos, já que descrição pode ter "%", "/" etc.
    const descM = t.match(new RegExp(`Descri[cç][aã]o(?:\\s*T[eé]cnica)?[:\\s]+([\\s\\S]{2,300}?)(?=\\s*(?:${PROX})\\b|$)`, 'i'));
    if (descM) d.descricao = descM[1].trim().replace(/\s+/g, ' ');

    const marcaM = t.match(new RegExp(`(?:Marca|Fabricante)[:\\s]+([A-Za-zÀ-ú0-9\\s&.,'"()-]{2,50}?)(?=\\s*(?:${PROX})\\b|$)`, 'i'));
    if (marcaM) d.marca = marcaM[1].trim();

    const categoriaM = t.match(new RegExp(`Categoria[:\\s]+([A-Za-zÀ-ú0-9\\s&.,'"()-]{2,50}?)(?=\\s*(?:${PROX})\\b|$)`, 'i'));
    if (categoriaM) d.categoria = categoriaM[1].trim();

    const ncmM = t.match(/\bNCM[:\s]+([0-9]{4}\.?[0-9]{2}\.?[0-9]{2})/i);
    if (ncmM) d.ncm = ncmM[1].trim();

    const unidadeM = t.match(new RegExp(`Unidade(?:\\s*Comercial)?[:\\s]+([A-Za-zÀ-ú]{1,15}?)(?=\\s*(?:${PROX})\\b|$)`, 'i'));
    if (unidadeM) d.unidade_medida = unidadeM[1].trim();

    const custoM = t.match(/Pre[cç]o\s*(?:de\s*)?Custo[:\s]+R?\$?\s*([\d.,]{1,15})/i);
    if (custoM) d.preco_custo = _prodUploadParaNumero(custoM[1]);

    const vendaM = t.match(/Pre[cç]o\s*(?:de\s*)?Venda[:\s]+R?\$?\s*([\d.,]{1,15})/i);
    if (vendaM) d.preco_venda = _prodUploadParaNumero(vendaM[1]);

    const estoqueM = t.match(/Estoque(?:\s*Atual)?[:\s]+([\d.,]{1,10})/i);
    if (estoqueM) d.estoque_atual = _prodUploadParaNumero(estoqueM[1]);

    return d;
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
