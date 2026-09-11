// ========================================
// PRODUTOS — LISTA (SUPABASE)
// ========================================

let _produtos = [];

// ── Bibliotecas pesadas sob demanda (revisão de performance) ────────────────
// xlsx (~600KB), pdf.js (~350KB) e jspdf (~340KB) só servem pro upload/
// modelo de Excel-PDF — antes carregavam sempre que a tela abria, mesmo
// pra quem só veio olhar a lista de produtos. Passam a carregar só na
// hora que o usuário realmente clica em importar/gerar modelo.
const LIBS_SOB_DEMANDA = {
    xlsx:  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    jspdf: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
};
const _libsCarregadas = {};

function carregarLibSobDemanda(nome) {
    if (_libsCarregadas[nome]) return _libsCarregadas[nome];
    _libsCarregadas[nome] = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = LIBS_SOB_DEMANDA[nome];
        script.onload = () => {
            if (nome === 'pdfjs') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            }
            resolve();
        };
        script.onerror = () => { delete _libsCarregadas[nome]; reject(new Error(`Falha ao carregar biblioteca (${nome})`)); };
        document.head.appendChild(script);
    });
    return _libsCarregadas[nome];
}

// ── Modelo de importação (Excel/PDF) ────────────────────────────────
// Fonte única dos campos aceitos no upload em lote — mesmo conjunto que
// PROD_UPLOAD_ALIASES reconhece (ver processarUploadProdutos acima).
// Cada coluna usada aqui já é uma chave literal desse mapa, garantindo
// que o modelo baixado seja reconhecido de volta pelo próprio upload.
// Fora daqui de propósito — não são input manual, o sistema já preenche
// sozinho: margem/lucro_liquido (calculados a partir dos preços) e
// hscode/ncm_utrib/ncm_descricao/ncm_descricao_completa (derivados do NCM
// digitado, via prod-ncm). embalagens/documentos e os idiomas EXTRAS ficam
// de fora (são listas). O idioma do nome/descrição principal entra sim, como
// uma coluna de texto livre (ver _prodUploadResolverIdioma).
const PROD_MODELO_CAMPOS = [
    // ── Identificação ──
    { secao: 'Identificação',  coluna: 'SKU',                    campo: 'sku',                  obrigatorio: true,  tipo: 'Texto',  exemplo: 'PROD001',                            obs: 'Código único do produto — não pode se repetir.' },
    { secao: 'Identificação',  coluna: 'Nome',                   campo: 'nome',                 obrigatorio: true,  tipo: 'Texto',  exemplo: 'Camiseta Algodão Premium',            obs: 'Nome completo do produto.' },
    { secao: 'Identificação',  coluna: 'Descrição',              campo: 'descricao',            obrigatorio: false, tipo: 'Texto',  exemplo: 'Camiseta 100% algodão, gola redonda', obs: 'Descrição detalhada (opcional).' },
    { secao: 'Identificação',  coluna: 'Idioma',                 campo: 'idioma_nome',          obrigatorio: false, tipo: 'Texto',  exemplo: 'Português',                           obs: 'Idioma do Nome/Descrição. Alemão, Chinês, Espanhol, Francês, Inglês ou Português caem na seleção; qualquer outro (ex: Italiano) vai pro campo "Outro". Em branco = Português.' },
    { secao: 'Identificação',  coluna: 'Categoria',              campo: 'categoria',            obrigatorio: false, tipo: 'Texto',  exemplo: 'Vestuário',                           obs: 'Categoria livre, sem lista fixa.' },
    { secao: 'Identificação',  coluna: 'Tipo',                   campo: 'tipo',                 obrigatorio: false, tipo: 'Texto',  exemplo: 'Produto acabado',                     obs: 'Ex: matéria-prima, produto acabado, insumo.' },
    { secao: 'Identificação',  coluna: 'Marca',                  campo: 'marca',                obrigatorio: false, tipo: 'Texto',  exemplo: 'Minha Marca',                         obs: 'Marca ou fabricante.' },
    { secao: 'Identificação',  coluna: 'Unidade',                campo: 'unidade_medida',       obrigatorio: false, tipo: 'Texto',  exemplo: 'UN',                                  obs: 'Unidade de medida: UN, KG, CX, L etc.' },
    { secao: 'Identificação',  coluna: 'Status',                 campo: 'status',               obrigatorio: false, tipo: 'Texto',  exemplo: 'ativo',                               obs: 'Valores aceitos: ativo, pendente, pausado, inativo. Em branco = ativo.' },
    { secao: 'Identificação',  coluna: 'Lote',                   campo: 'lote',                 obrigatorio: false, tipo: 'Texto',  exemplo: 'L2026-08',                            obs: 'Número do lote de fabricação.' },
    { secao: 'Identificação',  coluna: 'Imagem URL',             campo: 'imagem_url',           obrigatorio: false, tipo: 'Texto',  exemplo: 'https://exemplo.com/foto.jpg',        obs: 'Link direto pra uma imagem do produto (opcional).' },

    // ── Fiscal ──
    { secao: 'Fiscal',         coluna: 'NCM',                    campo: 'ncm',                  obrigatorio: false, tipo: 'Texto',  exemplo: '6109.10.00',                          obs: 'Código NCM do produto.' },
    { secao: 'Fiscal',         coluna: 'CEST',                   campo: 'cest',                 obrigatorio: false, tipo: 'Texto',  exemplo: '28.038.00',                           obs: 'Código Especificador da Substituição Tributária.' },
    { secao: 'Fiscal',         coluna: 'GTIN',                   campo: 'gtin',                 obrigatorio: false, tipo: 'Texto',  exemplo: '7891000315507',                       obs: 'Código de barras do produto (GTIN/EAN).' },
    { secao: 'Fiscal',         coluna: 'NALADI NESH',            campo: 'naladi_nesh',          obrigatorio: false, tipo: 'Texto',  exemplo: '3923.30.12',                          obs: 'Nomenclatura NALADI/NESH, quando aplicável.' },
    { secao: 'Fiscal',         coluna: 'DUN14',                  campo: 'dun14',                obrigatorio: false, tipo: 'Texto',  exemplo: '17891000315504',                      obs: 'Código de barras da embalagem logística (caixa/pallet).' },

    // ── Referências ──
    { secao: 'Referências',    coluna: 'Tags',                   campo: 'tags',                obrigatorio: false, tipo: 'Texto',  exemplo: 'sapato; camiseta',                    obs: 'Palavras-chave de classificação, separadas por ; ou vírgula.' },
    { secao: 'Referências',    coluna: 'Referência Fornecedor',  campo: 'referencia_fornecedor',obrigatorio: false, tipo: 'Texto',  exemplo: 'REF-FORN-9981',                       obs: 'Código de referência usado pelo fornecedor.' },
    { secao: 'Referências',    coluna: 'Referência Outra',       campo: 'referencia_outra',     obrigatorio: false, tipo: 'Texto',  exemplo: 'REF-CLI-55',                          obs: 'Outra referência (ex: código do cliente).' },
    { secao: 'Referências',    coluna: 'Empresa Parceira',       campo: 'empresa_parceira_ref', obrigatorio: false, tipo: 'Texto',  exemplo: 'Fornecedor ABC Ltda',                 obs: 'Razão Social, Nome Fantasia ou CNPJ/CPF de uma empresa já cadastrada em Empresas — o sistema localiza automaticamente.' },

    // ── Preço ──
    { secao: 'Preço',          coluna: 'Preço Custo',            campo: 'preco_custo',          obrigatorio: false, tipo: 'Número', exemplo: '15,00',                               obs: 'Use vírgula como separador decimal.' },
    { secao: 'Preço',          coluna: 'Custos Fixos',           campo: 'custos_fixos',         obrigatorio: false, tipo: 'Número', exemplo: '2,50',                                obs: 'Custos fixos rateados por unidade.' },
    { secao: 'Preço',          coluna: 'Imposto',                campo: 'imposto',              obrigatorio: false, tipo: 'Número', exemplo: '3,00',                                obs: 'Valor de imposto por unidade.' },
    { secao: 'Preço',          coluna: 'Preço Venda',            campo: 'preco_venda',          obrigatorio: false, tipo: 'Número', exemplo: '35,00',                               obs: 'Use vírgula como separador decimal.' },
    { secao: 'Preço',          coluna: 'Moeda',                  campo: 'moeda',                obrigatorio: false, tipo: 'Texto',  exemplo: 'BRL',                                 obs: 'Código da moeda: BRL, USD, EUR etc. Em branco = BRL.' },
    { secao: 'Preço',          coluna: 'Observações de Preço',   campo: 'obs_preco',            obrigatorio: false, tipo: 'Texto',  exemplo: 'Preço válido para pedidos acima de 100un', obs: 'Condições especiais, tabelas, notas (opcional).' },

    // ── Estoque ──
    { secao: 'Estoque',        coluna: 'Estoque Atual',          campo: 'estoque_atual',        obrigatorio: false, tipo: 'Número', exemplo: '100',                                 obs: 'Quantidade em estoque no momento do cadastro.' },
    { secao: 'Estoque',        coluna: 'Estoque Mínimo',         campo: 'estoque_minimo',       obrigatorio: false, tipo: 'Número', exemplo: '10',                                  obs: 'Nível mínimo antes do alerta de reposição.' },
    { secao: 'Estoque',        coluna: 'Estoque Máximo',         campo: 'estoque_maximo',       obrigatorio: false, tipo: 'Número', exemplo: '500',                                 obs: 'Capacidade máxima de estoque planejada.' },
    { secao: 'Estoque',        coluna: 'Controla Estoque',       campo: 'controla_estoque',     obrigatorio: false, tipo: 'Sim/Não',exemplo: 'Sim',                                 obs: 'Em branco = Sim.' },
    { secao: 'Estoque',        coluna: 'Venda sem Estoque',      campo: 'venda_sem_estoque',    obrigatorio: false, tipo: 'Sim/Não',exemplo: 'Não',                                 obs: 'Permite vender mesmo com estoque zerado. Em branco = Não.' },
    { secao: 'Estoque',        coluna: 'Data Fabricação',        campo: 'data_fabricacao',      obrigatorio: false, tipo: 'Data',   exemplo: '01/08/2026',                          obs: 'Formato DD/MM/AAAA.' },
    { secao: 'Estoque',        coluna: 'Data Validade',          campo: 'data_validade',        obrigatorio: false, tipo: 'Data',   exemplo: '01/08/2027',                          obs: 'Formato DD/MM/AAAA.' },
    { secao: 'Estoque',        coluna: 'Observações de Estoque', campo: 'obs_estoque',          obrigatorio: false, tipo: 'Texto',  exemplo: 'Armazenado no galpão B',              obs: 'Localização, controle, observações (opcional).' },

    // ── Logística ──
    { secao: 'Logística',      coluna: 'Observações de Logística', campo: 'obs_logistica',      obrigatorio: false, tipo: 'Texto',  exemplo: 'Frágil — manusear com cuidado',       obs: 'Embalagem, transporte, manuseio (opcional).' },
];

function abrirModalModeloProduto() {
    document.getElementById('modalModeloProduto').classList.add('active');
}

function fecharModalModeloProduto() {
    document.getElementById('modalModeloProduto').classList.remove('active');
}

// Gera um .xlsx de verdade (não .csv) — o upload de produtos só aceita
// .xlsx/.xls/.pdf (ver accept="" no input#uploadProdutos e a checagem de
// extensão em processarUploadProdutos), então um .csv baixado aqui não
// poderia ser reenviado pela mesma tela. SheetJS já está carregado nesta
// página (usado pelo upload), então gerar .xlsx tem custo zero a mais.
async function baixarModeloProdutoExcel() {
    try {
        await carregarLibSobDemanda('xlsx');
    } catch (e) { notify('Não foi possível carregar o gerador de planilha. Tente novamente.', 'error'); return; }

    const header = PROD_MODELO_CAMPOS.map(c => c.coluna);
    const exemplo = PROD_MODELO_CAMPOS.map(c => c.exemplo);
    const ws = XLSX.utils.aoa_to_sheet([header, exemplo]);
    ws['!cols'] = header.map(h => ({ wch: Math.max(h.length, 14) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo Produtos');
    XLSX.writeFile(wb, 'modelo-importacao-produtos.xlsx');
    fecharModalModeloProduto();
}

// --------------------------------------------------
// ATUALIZAR PREÇOS EM LOTE (Venda / Compra) — planilha à parte da de
// cadastro completo, só pra atualizar produtos já existentes. Referência é
// o SKU (já único por empresa) — HS Code entra só como coluna de exibição/
// conferência, igual já foi decidido pros preços múltiplos por moeda
// (não é chave: HS Code pode se repetir entre produtos diferentes).
// --------------------------------------------------

const PROD_MODELO_PRECO = {
    venda:  { titulo: 'Preço de Venda',  coluna: 'Preço de Venda',  campo: 'preco_venda', arquivo: 'modelo-preco-venda-produtos.xlsx' },
    compra: { titulo: 'Preço de Compra', coluna: 'Preço de Compra', campo: 'preco_custo', arquivo: 'modelo-preco-compra-produtos.xlsx' },
};

function abrirModalAtualizarPrecos() {
    document.getElementById('modalAtualizarPrecos').classList.add('active');
}

function fecharModalAtualizarPrecos() {
    document.getElementById('modalAtualizarPrecos').classList.remove('active');
}

// Colunas 1 (Moeda/Preço) atualizam o preço PRINCIPAL do produto; 2 a 4 são
// opcionais e atualizam (ou criam) uma linha em "Preços em outras Moedas"
// casando pela Moeda — mesmo teto de 4 já usado nessa seção do formulário.
async function baixarModeloPrecoExcel(tipo) {
    const cfg = PROD_MODELO_PRECO[tipo];
    if (!cfg) return;
    try {
        await carregarLibSobDemanda('xlsx');
    } catch (e) { notify('Não foi possível carregar o gerador de planilha. Tente novamente.', 'error'); return; }

    const header  = ['SKU', 'HS Code', 'Moeda', 'Preço', 'Moeda 2', 'Preço 2', 'Moeda 3', 'Preço 3', 'Moeda 4', 'Preço 4'];
    const exemplo = ['PROD001', '6109.10.00 (só conferência — não usado pra localizar o produto)', 'BRL', '35,00', 'USD', '7,00', '', '', '', ''];
    const ws = XLSX.utils.aoa_to_sheet([header, exemplo]);
    ws['!cols'] = header.map(h => ({ wch: Math.max(h.length, 12) }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, cfg.titulo);
    XLSX.writeFile(wb, cfg.arquivo);
    fecharModalModeloProduto();
}

async function processarUploadPreco(input, tipo) {
    if (!exigirEmpresaVinculada()) return;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    const cfg  = PROD_MODELO_PRECO[tipo];

    notify(`Lendo "${file.name}"...`, 'info');
    try {
        await carregarLibSobDemanda('xlsx');
        const linhas = await _prodUploadLerExcelPreco(file, cfg);
        if (!linhas.length) {
            notify('Nenhuma linha com SKU e preço reconhecidos na planilha.', 'aviso');
            return;
        }
        const res = await window.supabaseAPI.atualizarPrecosEmLote(cfg.campo, linhas);
        const avisoMoedas = res.moedasNaoReconhecidas?.length
            ? ` Moeda(s) não reconhecida(s), salva(s) do jeito que veio na planilha (confira se não é só um apelido — ex: use "Euro" ou "EUR", não "Moeda Europeia"): ${res.moedasNaoReconhecidas.join(', ')}.`
            : '';
        if (res.totalSucesso) {
            notify(`${res.totalSucesso} produto${res.totalSucesso !== 1 ? 's' : ''} atualizado${res.totalSucesso !== 1 ? 's' : ''}.${res.totalFalha ? ` ${res.totalFalha} SKU(s) não encontrado(s): ${res.skusNaoEncontrados.join(', ')}.` : ''}${avisoMoedas}`, (res.totalFalha || avisoMoedas) ? 'aviso' : 'success');
            carregarProdutos();
        } else {
            notify(`Nenhum produto atualizado — SKU(s) não encontrado(s): ${res.skusNaoEncontrados.join(', ') || '—'}.${avisoMoedas}`, 'error');
        }
    } catch (e) {
        console.error('[Atualizar Preços] erro:', e);
        notify('Não foi possível processar a planilha.', 'error');
    } finally {
        input.value = '';
        fecharModalAtualizarPrecos();
    }
}

function _prodUploadLerExcelPreco(arquivo, cfg) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                if (!rows.length) return resolve([]);

                const header  = rows[0].map(h => _prodUploadNorm(h));
                const idxSku  = header.findIndex(h => h === 'sku' || h === 'codigo sku' || h === 'codigo');
                if (idxSku === -1) return resolve([]);

                // Par 1 = preço principal do produto; pares 2 a 4 = "Preços
                // em outras Moedas" (casados pela Moeda, não pela posição).
                const pares = [1, 2, 3, 4].map(n => ({
                    idxMoeda: header.findIndex(h => h === (n === 1 ? 'moeda' : `moeda ${n}`)),
                    idxPreco: header.findIndex(h => h === (n === 1 ? 'preco' : `preco ${n}`)),
                }));
                if (pares[0].idxPreco === -1) return resolve([]);

                const linhas = [];
                for (let i = 1; i < rows.length; i++) {
                    const sku = String(rows[i][idxSku] || '').trim();
                    if (!sku) continue;

                    const precos = pares.map(p => {
                        const preco = p.idxPreco !== -1 ? _prodUploadParaNumero(rows[i][p.idxPreco]) : null;
                        const moeda = p.idxMoeda !== -1 ? String(rows[i][p.idxMoeda] || '').trim().toUpperCase() : '';
                        return (preco != null) ? { moeda: moeda || null, preco } : null;
                    });

                    if (!precos[0]) continue; // preço principal é obrigatório, os outros 3 são opcionais
                    linhas.push({ sku, principal: precos[0], extras: precos.slice(1).filter(Boolean) });
                }
                resolve(linhas);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

// --------------------------------------------------
// ATUALIZAR IDIOMAS EM LOTE — planilha à parte só pra adicionar/atualizar
// traduções (Nome + Descrição por idioma) de produtos já cadastrados.
// Chave é o SKU. Idioma é texto livre: cai na seleção se for um dos 6 da
// lista, senão vira "Outro" (mesma regra da planilha de cadastro).
// --------------------------------------------------

const PROD_IDIOMA_LABEL = { pt: 'Português', en: 'Inglês', de: 'Alemão', zh: 'Chinês', es: 'Espanhol', fr: 'Francês' };

async function baixarModeloIdiomasExcel() {
    try {
        await carregarLibSobDemanda('xlsx');
    } catch (e) { notify('Não foi possível carregar o gerador de planilha. Tente novamente.', 'error'); return; }

    let produtos = [];
    try {
        const res = await window.supabaseAPI.buscarProdutos();
        produtos = res.sucesso ? (res.data || []) : [];
    } catch (e) { /* segue com planilha só de cabeçalho */ }

    const header = ['SKU', 'Idioma', 'Nome do Produto', 'Descrição Técnica / Composição do Produto / Descrição Complementar do Produto'];
    const linhas = [];
    produtos.forEach(p => {
        const idiomas = Array.isArray(p.nomes_idiomas) && p.nomes_idiomas.length
            ? p.nomes_idiomas
            : [{ idioma: 'pt', idioma_outro: null, nome: p.nome, descricao: p.descricao || '' }];
        idiomas.forEach(idi => {
            const label = idi.idioma === 'outro'
                ? (idi.idioma_outro || 'Outro')
                : (PROD_IDIOMA_LABEL[idi.idioma] || 'Português');
            linhas.push([p.sku || '', label, idi.nome || p.nome || '', idi.descricao || '']);
        });
    });
    if (!linhas.length) {
        linhas.push(['PROD001', 'PORTUGUES', 'CAMISETA ALGODAO PREMIUM', 'CAMISETA 100% ALGODAO, GOLA REDONDA.']);
    }

    const ws = XLSX.utils.aoa_to_sheet([header, ...linhas]);
    ws['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 40 }, { wch: 60 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Idiomas');
    XLSX.writeFile(wb, 'modelo-idiomas-produtos.xlsx');
    fecharModalAtualizarPrecos();
}

async function processarUploadIdiomas(input) {
    if (!exigirEmpresaVinculada()) return;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];

    notify(`Lendo "${file.name}"...`, 'info');
    try {
        await carregarLibSobDemanda('xlsx');
        const linhas = await _prodUploadLerExcelIdiomas(file);
        if (!linhas.length) {
            notify('Nenhuma linha com SKU e Idioma reconhecidos na planilha.', 'aviso');
            return;
        }
        const res = await window.supabaseAPI.atualizarIdiomasEmLote(linhas);
        const avisos = [];
        if (res.totalFalha) avisos.push(`${res.totalFalha} SKU(s) não encontrado(s): ${res.skusNaoEncontrados.join(', ')}.`);
        if (res.limiteAtingido?.length) avisos.push(`Limite de 4 idiomas por produto atingido, ignorado(s): ${res.limiteAtingido.join(', ')}.`);
        if (res.idiomasComoOutro?.length) avisos.push(`Idioma(s) fora da lista, salvo(s) como "Outro": ${res.idiomasComoOutro.join(', ')}.`);
        const aviso = avisos.join(' ');

        if (res.totalSucesso) {
            notify(`${res.totalSucesso} produto${res.totalSucesso !== 1 ? 's' : ''} atualizado${res.totalSucesso !== 1 ? 's' : ''}.${aviso ? ' ' + aviso : ''}`, aviso ? 'aviso' : 'success');
            carregarProdutos();
        } else {
            notify(`Nenhum produto atualizado.${aviso ? ' ' + aviso : ''}`, 'error');
        }
    } catch (e) {
        console.error('[Atualizar Idiomas] erro:', e);
        notify('Não foi possível processar a planilha.', 'error');
    } finally {
        input.value = '';
        fecharModalAtualizarPrecos();
    }
}

function _prodUploadLerExcelIdiomas(arquivo) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                if (!rows.length) return resolve([]);

                const header    = rows[0].map(h => _prodUploadNorm(h));
                const idxSku    = header.findIndex(h => h === 'sku' || h === 'codigo sku' || h === 'codigo');
                const idxIdioma = header.findIndex(h => h === 'idioma' || h === 'lingua' || h === 'language');
                // "nome do produto" começa igual; a descrição é a coluna longa
                const idxNome   = header.findIndex(h => h.startsWith('nome'));
                const idxDesc   = header.findIndex(h => h.startsWith('descricao'));
                if (idxSku === -1 || idxIdioma === -1) return resolve([]);

                const linhas = [];
                for (let i = 1; i < rows.length; i++) {
                    const sku = String(rows[i][idxSku] || '').trim();
                    if (!sku) continue;
                    const idi = _prodUploadResolverIdioma(rows[i][idxIdioma]);
                    linhas.push({
                        sku,
                        idioma: idi.idioma,
                        idioma_outro: idi.idioma_outro,
                        idioma_texto: String(rows[i][idxIdioma] || '').trim(),
                        nome: idxNome !== -1 ? String(rows[i][idxNome] || '').trim() : '',
                        descricao: idxDesc !== -1 ? String(rows[i][idxDesc] || '').trim() : '',
                    });
                }
                resolve(linhas);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

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
    // Ordem alfabética pelo Nome do Produto — feito no cliente com localeCompare
    // (pt-BR, sem diferenciar maiúscula/acento) porque o ORDER BY do Postgres
    // depende do collation do banco e não fica um "A a Z" natural.
    _produtos.sort((a, b) =>
        (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' })
    );
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
                    <th>Nome do Produto</th>
                    <th>Categoria</th>
                    <th>Marca</th>
                    <th>NCM</th>
                    <th>Unidade Comercial</th>
                    <th>Lote</th>
                    <th>Valor de Venda</th>
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
                    <td>${escapeHtml(p.unidade_medida || '—')}</td>
                    <td>${escapeHtml(p.lote || '—')}</td>
                    <td>${_prodListaValoresVenda(p)}</td>
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

// Preço de Venda principal + preços em outras moedas (precos_alternativos,
// ver formularios.js), cada um numa tag separada, sempre com separador de
// milhar — um produto pode ter vários preços cadastrados hoje em dia.
function _prodListaValoresVenda(p) {
    const precos = [];
    if (p.preco_venda) precos.push({ moeda: p.moeda || 'USD', valor: p.preco_venda });
    (p.precos_alternativos || []).forEach(item => {
        if (item?.preco_venda) precos.push({ moeda: item.moeda || 'USD', valor: item.preco_venda });
    });

    if (!precos.length) return '—';

    return `<div class="prod-valores-venda">${precos.map(pr => `
        <span class="prod-valor-tag">${escapeHtml(pr.moeda)} ${Number(pr.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
    `).join('')}</div>`;
}

// --------------------------------------------------
// UPLOAD — EXCEL (LOTE) OU PDF (1 PRODUTO)
// --------------------------------------------------
async function processarUploadProdutos(input) {
    if (!exigirEmpresaVinculada()) return;
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
            await carregarLibSobDemanda('xlsx');
            const linhas = await _prodUploadLerExcel(file);
            await _prodUploadImportarLote(linhas);
        } else {
            await carregarLibSobDemanda('pdfjs');
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
    'idioma': 'idioma_nome', 'lingua': 'idioma_nome', 'language': 'idioma_nome', 'idioma do produto': 'idioma_nome',
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

    // Expansão (2026-08-28) — cobre o restante dos campos de input livre do
    // formulário de Produto. Ficam de fora: campos calculados/derivados
    // automaticamente (margem, lucro liquido, hscode, ncm utrib/descrição —
    // esses vêm do NCM ou dos preços, não são digitados) e os campos de
    // lista (nomes em outros idiomas, embalagens, documentos), que não cabem
    // numa única célula de planilha.
    'cest': 'cest',
    'gtin': 'gtin', 'ean': 'gtin', 'codigo de barras': 'gtin',
    'naladi nesh': 'naladi_nesh', 'naladi': 'naladi_nesh', 'nesh': 'naladi_nesh',
    'dun14': 'dun14', 'dun 14': 'dun14',
    'imagem url': 'imagem_url', 'imagem': 'imagem_url', 'url da imagem': 'imagem_url', 'foto': 'imagem_url',
    'lote': 'lote',
    'data fabricacao': 'data_fabricacao', 'fabricacao': 'data_fabricacao',
    'data validade': 'data_validade', 'validade': 'data_validade',
    'tags': 'tags', 'tag': 'tags', 'etiquetas': 'tags',
    'referencia fornecedor': 'referencia_fornecedor', 'ref fornecedor': 'referencia_fornecedor',
    'referencia outra': 'referencia_outra', 'outra referencia': 'referencia_outra',
    'empresa parceira': 'empresa_parceira_ref', 'parceiro': 'empresa_parceira_ref', 'fornecedor parceiro': 'empresa_parceira_ref',
    'custos fixos': 'custos_fixos', 'custo fixo': 'custos_fixos',
    'imposto': 'imposto', 'impostos': 'imposto',
    'obs preco': 'obs_preco', 'observacoes de preco': 'obs_preco', 'observacao de preco': 'obs_preco',
    'controla estoque': 'controla_estoque',
    'venda sem estoque': 'venda_sem_estoque',
    'estoque maximo': 'estoque_maximo',
    'obs estoque': 'obs_estoque', 'observacoes de estoque': 'obs_estoque',
    'obs logistica': 'obs_logistica', 'observacoes de logistica': 'obs_logistica',
};

// Campos que aceitam Sim/Não em vez de texto/número.
const PROD_UPLOAD_CAMPOS_BOOLEANOS = { controla_estoque: true, venda_sem_estoque: false };

// Campos com formato de data (aceita DD/MM/AAAA ou AAAA-MM-DD).
const PROD_UPLOAD_CAMPOS_DATA = ['data_fabricacao', 'data_validade'];

// Campos numéricos além dos já tratados (preco_custo/preco_venda/estoque_atual/estoque_minimo).
const PROD_UPLOAD_CAMPOS_NUMERO_EXTRA = ['custos_fixos', 'imposto', 'estoque_maximo'];

// Idioma do nome/descrição digitado à mão na planilha → código do <select> do
// formulário. Só os 6 da lista têm código; qualquer outro texto ("Italiano",
// "Japonês"...) vira idioma "outro" com o texto guardado no campo Outro.
const PROD_IDIOMA_ALIASES = {
    'de': 'de', 'alemao': 'de', 'german': 'de', 'deutsch': 'de',
    'zh': 'zh', 'chines': 'zh', 'mandarim': 'zh', 'chinese': 'zh',
    'es': 'es', 'espanhol': 'es', 'spanish': 'es', 'castelhano': 'es', 'castellano': 'es',
    'fr': 'fr', 'frances': 'fr', 'french': 'fr', 'francais': 'fr',
    'en': 'en', 'ingles': 'en', 'english': 'en',
    'pt': 'pt', 'portugues': 'pt', 'portuguese': 'pt', 'br': 'pt', 'pt br': 'pt',
};

function _prodUploadResolverIdioma(txt) {
    const bruto = String(txt || '').trim();
    if (!bruto) return { idioma: 'pt', idioma_outro: null };
    const norm = _prodUploadNorm(bruto);
    if (norm === 'outro') return { idioma: 'outro', idioma_outro: '' };
    const cod = PROD_IDIOMA_ALIASES[norm];
    return cod ? { idioma: cod, idioma_outro: null } : { idioma: 'outro', idioma_outro: bruto };
}

function _prodUploadNorm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

function _prodUploadParaNumero(v) {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
}

// Aceita "sim"/"não"/"nao"/"true"/"false"/"1"/"0" (com ou sem acento/caixa) —
// em branco cai no padrão de cada campo (ver PROD_UPLOAD_CAMPOS_BOOLEANOS).
function _prodUploadParaBooleano(v, padrao) {
    if (v === '' || v == null) return padrao;
    const n = _prodUploadNorm(v);
    if (['sim', 's', 'true', '1', 'verdadeiro'].includes(n)) return true;
    if (['nao', 'n', 'false', '0', 'falso'].includes(n)) return false;
    return padrao;
}

// Aceita DD/MM/AAAA (formato mais comum no Excel pt-BR) ou AAAA-MM-DD (ISO,
// caso o Excel já formate a célula como data) — devolve sempre AAAA-MM-DD,
// formato que o banco espera. Retorna null se não conseguir reconhecer.
function _prodUploadParaData(v) {
    if (v === '' || v == null) return null;
    const s = String(v).trim();
    const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (br) return `${br[3]}-${br[2].padStart(2,'0')}-${br[1].padStart(2,'0')}`;
    const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2,'0')}-${iso[3].padStart(2,'0')}`;
    return null;
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
        PROD_UPLOAD_CAMPOS_NUMERO_EXTRA.forEach(campo => {
            if (p[campo] != null) p[campo] = _prodUploadParaNumero(p[campo]);
        });
        PROD_UPLOAD_CAMPOS_DATA.forEach(campo => {
            if (p[campo] != null) p[campo] = _prodUploadParaData(p[campo]);
        });
        Object.entries(PROD_UPLOAD_CAMPOS_BOOLEANOS).forEach(([campo, padrao]) => {
            p[campo] = _prodUploadParaBooleano(p[campo], padrao);
        });
        // Tags: uma célula só, separada por ; ou vírgula → array de minúsculas
        p.tags = p.tags
            ? String(p.tags).split(/[;,]/).map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 10)
            : [];
        // Idioma do nome/descrição principal → entrada base de nomes_idiomas
        const _idi = _prodUploadResolverIdioma(p.idioma_nome);
        p.nomes_idiomas = [{
            idioma: _idi.idioma,
            idioma_outro: _idi.idioma_outro,
            nome: p.nome,
            descricao: p.descricao || '',
        }];
        delete p.idioma_nome;
        p.status = p.status || 'ativo';
        p.moeda  = p.moeda  || 'BRL';

        produtos.push(p);
    }
    return produtos;
}

// "Empresa Parceira" vem como texto livre (Razão Social ou CNPJ/CPF) na
// planilha, já que ninguém digita um UUID de cabeça — resolve contra
// `parceiros` da própria empresa antes de salvar. Não encontrando, segue o
// produto sem vínculo (não bloqueia a linha inteira por isso).
//
// Versão em lote (revisão de performance): antes fazia 1 consulta por
// produto (uma planilha de 200 linhas = 200 round-trips só pra isso).
// Busca os parceiros da empresa UMA vez só e resolve cada linha contra essa
// lista em memória.
async function _prodUploadResolverEmpresasParceiras(produtos) {
    const comRef = produtos.filter(p => p.empresa_parceira_ref);
    if (!comRef.length) return;

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia, documento');
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);
        const { data: parceiros } = await query;
        const lista = parceiros || [];

        for (const p of comRef) {
            const ref = p.empresa_parceira_ref;
            delete p.empresa_parceira_ref;
            const digitos = ref.replace(/\D/g, '');
            const match = digitos.length >= 11
                ? lista.find(pc => (pc.documento || '').replace(/\D/g, '') === digitos)
                : lista.find(pc =>
                    (pc.razao_social || '').toLowerCase().includes(ref.toLowerCase()) ||
                    (pc.nome_fantasia || '').toLowerCase().includes(ref.toLowerCase()));
            if (match) p.empresa_parceira_id = match.id;
        }
    } catch (e) {
        console.warn('[Produtos] Falha ao resolver Empresas Parceiras em lote:', e);
    }
}

async function _prodUploadImportarLote(produtos) {
    if (!produtos.length) {
        notify('Nenhum produto reconhecido na planilha. Confira se as colunas incluem pelo menos "SKU" e "Nome".', 'aviso');
        return;
    }

    await _prodUploadResolverEmpresasParceiras(produtos);
    const res = await window.supabaseAPI.salvarProdutosEmLote(produtos);

    if (res.totalSucesso) {
        notify(`${res.totalSucesso} produto${res.totalSucesso !== 1 ? 's' : ''} importado${res.totalSucesso !== 1 ? 's' : ''} com sucesso.${res.totalFalha ? ` ${res.totalFalha} falharam.` : ''}`, res.totalFalha ? 'aviso' : 'success');
    } else {
        notify('Não foi possível importar os produtos da planilha.', 'error');
    }
    if (res.falhas?.length) {
        res.falhas.forEach(f => console.warn('[Produtos] Bloco falhou:', f.skus, f.mensagem));
    }

    if (res.totalSucesso) carregarProdutos();
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
