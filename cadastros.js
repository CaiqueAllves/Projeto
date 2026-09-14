// ========================================
// CADASTRO DE EMPRESAS
// ========================================

let empresaExcluindoId = null;
let todasEmpresas = [];

// ── Bibliotecas pesadas sob demanda (revisão de performance) ────────────────
// xlsx (~600KB) e pdf.js (~350KB) só servem pro upload de Excel/PDF — antes
// carregavam sempre que a tela abria, mesmo pra quem só veio cadastrar uma
// empresa manualmente. Passam a carregar só na hora do upload de verdade.
const LIBS_SOB_DEMANDA = {
    xlsx:  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    pdfjs: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
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

// ========================================
// INICIALIZAÇÃO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    carregarEmpresas();

    document.getElementById('filterInput').addEventListener('input', function() {
        filtrarEmpresas(this.value);
    });
});

// ========================================
// LISTA DE EMPRESAS
// ========================================

async function carregarEmpresas() {
    const resultado = await window.supabaseAPI.buscarEmpresas();

    if (!resultado.sucesso) {
        document.getElementById('listaContainer').innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar empresas.
            </div>`;
        return;
    }

    todasEmpresas = resultado.data || [];
    renderizarEmpresas(todasEmpresas);
}

const _TIPO_LABELS = { fabricante: 'Fabricante', cliente: 'Cliente', fornecedor: 'Fornecedor', transportadora: 'Transportadora', remetente: 'Remetente', comprador: 'Comprador', importador: 'Importador' };

function _normalizarPais(pais) {
    if (!pais) return '';
    const upper = pais.trim().toUpperCase();
    if (['BR', 'BRA', 'BRASIL', 'BRAZIL'].includes(upper)) return 'BRASIL';
    return pais.trim();
}

function _isBrasil(pais) {
    if (!pais) return true;
    return ['br', 'bra', 'brasil', 'brazil'].includes(pais.toLowerCase().trim());
}

function _modeloBadge(e) {
    if (e.is_transportadora)
        return '<span class="tag-modelo tag-modelo-transportadora">Transportadora</span>';
    if (!_isBrasil(e.pais))
        return '<span class="tag-modelo tag-modelo-estrangeira">Estrangeira</span>';
    return '<span class="tag-modelo tag-modelo-nacional">Nacional</span>';
}

function _tiposBadges(e) {
    const tipos = [];
    if (e.is_fabricante)     tipos.push('fabricante');
    if (e.is_cliente)        tipos.push('cliente');
    if (e.is_fornecedor)     tipos.push('fornecedor');
    if (e.is_transportadora) tipos.push('transportadora');
    if (e.is_remetente)      tipos.push('remetente');
    if (e.is_comprador)      tipos.push('comprador');
    if (e.is_importador)     tipos.push('importador');
    return tipos.map(t => `<span class="tag-tipo tag-${t}">${_TIPO_LABELS[t]}</span>`).join('');
}

// Formata o documento com pontos/traço na exibição, mesmo quando salvo só
// com dígitos — idempotente se já vier formatado (só reaplica em cima dos dígitos).
function _formatarDocumentoExibicao(documento) {
    const digitos = String(documento || '').replace(/\D/g, '');
    if (digitos.length === 14) return digitos.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    if (digitos.length === 11) return digitos.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    return documento || '';
}

// Identificação da Empresa (CNPJ ou CPF) — usa tipo_cadastro quando existe,
// senão infere pela quantidade de dígitos (mesmo heurístico já usado ao
// normalizar o documento no formulário).
function _docTipoLabel(e) {
    if (e.tipo_cadastro === 'cnpj') return 'CNPJ';
    if (e.tipo_cadastro === 'cpf')  return 'CPF';
    const digitos = String(e.documento || '').replace(/\D/g, '');
    if (digitos.length === 14) return 'CNPJ';
    if (digitos.length === 11) return 'CPF';
    return '';
}

function renderizarEmpresas(lista) {
    const container = document.getElementById('listaContainer');
    const count     = document.getElementById('listaCount');

    count.textContent = `${lista.length} empresa(s)`;

    if (!lista || lista.length === 0) {
        container.innerHTML = `
            <div class="lista-vazia">
                <i class="fa-solid fa-building"></i>
                <p>Nenhuma empresa cadastrada ainda.</p>
                <p style="font-size:13px;color:#9ca3af;">Clique em <b>Cadastrar</b> para adicionar a primeira.</p>
            </div>`;
        return;
    }

    container.innerHTML = `
        <table class="empresa-tabela">
            <thead>
                <tr>
                    <th class="col-modelo">Modelo</th>
                    <th class="col-tipo">Tipo</th>
                    <th class="col-razao">Razão Social</th>
                    <th class="col-fantasia">Nome Fantasia</th>
                    <th class="col-doc">Documento</th>
                    <th class="col-loc">País / Estado</th>
                    <th class="col-tags">Tags</th>
                    <th class="col-acoes" style="text-align:center;">Ações</th>
                </tr>
            </thead>
            <tbody>
                ${lista.map(e => `
                    <tr>
                        <td class="col-modelo" data-label="Modelo:">${_modeloBadge(e)}</td>
                        <td class="col-tipo" data-label="Tipo:">
                            <div class="tipo-badges">
                                ${_tiposBadges(e) || '<span class="cell-vazio">—</span>'}
                            </div>
                        </td>
                        <td class="col-razao" data-label="Razão Social:"><span class="empresa-nome">${e.razao_social || '—'}</span></td>
                        <td class="col-fantasia" data-label="Nome Fantasia:"><span class="empresa-fantasia">${e.nome_fantasia || '<span class="cell-vazio">—</span>'}</span></td>
                        <td class="col-doc cell-nowrap" data-label="Documento:">${e.documento
                            ? `${_docTipoLabel(e) ? `<span class="doc-tipo-label">${_docTipoLabel(e)}</span>` : ''}${_formatarDocumentoExibicao(e.documento)}`
                            : '—'}</td>
                        <td class="col-loc cell-nowrap" data-label="Localização:">${[_normalizarPais(e.pais), e.estado].filter(Boolean).join(' / ') || '—'}</td>
                        <td class="col-tags" data-label="Tags:">${(e.tags && e.tags.length) ? renderTagsMini(e.tags) : '<span class="cell-vazio">—</span>'}</td>
                        <td class="col-acoes" style="text-align:center;white-space:nowrap;" data-label="">
                            <button class="btn-acao btn-visualizar" onclick="visualizarEmpresa('${e.id}')" title="Visualizar">
                                <i class="fa-solid fa-eye"></i>
                            </button>
                            <button class="btn-acao btn-editar" onclick="editarEmpresa('${e.id}')" title="Editar">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-acao btn-excluir" onclick="excluirEmpresa('${e.id}')" title="Excluir">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>`;
}

function renderTagsMini(tags) {
    return tags.slice(0, 2).map(t => `<span class="tag-item-mini">${t}</span>`).join('');
}

function filtrarEmpresas(valor) {
    const filtro = (valor !== undefined ? valor : document.getElementById('filterInput').value).toLowerCase().trim();

    if (!filtro) { renderizarEmpresas(todasEmpresas); return; }

    const lista = todasEmpresas.filter(e => {
        const tagMatch = e.tags && e.tags.some(t => t.toLowerCase().includes(filtro));
        return (e.razao_social  && e.razao_social.toLowerCase().includes(filtro)) ||
               (e.nome_fantasia && e.nome_fantasia.toLowerCase().includes(filtro)) ||
               (e.documento     && e.documento.includes(filtro)) ||
               (e.cidade        && e.cidade.toLowerCase().includes(filtro)) ||
               (e.pais          && e.pais.toLowerCase().includes(filtro)) ||
               tagMatch;
    });

    renderizarEmpresas(lista);
}

// ========================================
// EDITAR EMPRESA
// ========================================

function visualizarEmpresa(id) {
    window.open(`formularios.html?tab=empresa&empresa_id=${id}&modo=visualizar`, '_blank');
}

function editarEmpresa(id) {
    window.open(`formularios.html?tab=empresa&empresa_id=${id}`, '_blank');
}

// ========================================
// EXCLUIR EMPRESA
// ========================================

function excluirEmpresa(id) {
    empresaExcluindoId = id;

    const empresa = todasEmpresas.find(e => String(e.id) === String(id));
    const infoEl  = document.getElementById('excluirEmpresaInfo');

    if (infoEl) {
        if (empresa) {
            const loc = [_normalizarPais(empresa.pais), empresa.estado].filter(Boolean).join(' / ') || '—';
            infoEl.innerHTML = `
                <div class="excluir-info-row excluir-razao">
                    <i class="fa-solid fa-building"></i>
                    <span>${empresa.razao_social || '—'}</span>
                </div>
                ${empresa.nome_fantasia ? `<div class="excluir-info-fantasia"><i class="fa-solid fa-tag"></i> ${empresa.nome_fantasia}</div>` : ''}
                <div class="excluir-info-grid">
                    <div class="excluir-info-item">
                        <span class="excluir-label">Documento</span>
                        <span class="excluir-valor">${empresa.documento || '—'}</span>
                    </div>
                    <div class="excluir-info-item">
                        <span class="excluir-label">País / Estado</span>
                        <span class="excluir-valor">${loc}</span>
                    </div>
                </div>`;
        } else {
            infoEl.innerHTML = `<span style="color:#6b7280;font-size:13px;">ID: ${id}</span>`;
        }
    }

    document.getElementById('btnConfirmarExcluir').onclick = confirmarExclusao;
    document.getElementById('modalExcluir').classList.add('active');
}

function fecharModalExcluir() {
    document.getElementById('modalExcluir').classList.remove('active');
    empresaExcluindoId = null;
}

async function confirmarExclusao() {
    if (!empresaExcluindoId) return;

    const btn = document.getElementById('btnConfirmarExcluir');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Excluindo...';

    const resultado = await window.supabaseAPI.excluirEmpresa(empresaExcluindoId);

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir';

    fecharModalExcluir();

    if (resultado.sucesso) {
        mostrarNotificacao('Empresa excluída com sucesso!', 'success');
        carregarEmpresas();
    } else {
        mostrarNotificacao(resultado.mensagem, 'error');
    }
}

// ========================================
// UPLOAD DE ARQUIVO
// ========================================

// ========================================
// UPLOAD — LEITURA E PREENCHIMENTO AUTO
// ========================================

async function processarUpload(input) {
    if (!exigirEmpresaVinculada()) return;
    const arquivo = input.files[0];
    if (!arquivo) return;

    const ext = arquivo.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'pdf'].includes(ext)) {
        mostrarNotificacao('Apenas Excel ou PDF são permitidos.', 'error');
        input.value = ''; return;
    }
    if (arquivo.size > 10 * 1024 * 1024) {
        mostrarNotificacao('O arquivo deve ter no máximo 10MB.', 'error');
        input.value = ''; return;
    }

    mostrarNotificacao('Lendo arquivo, aguarde...', 'info');
    input.value = '';

    let dados = {};
    try {
        if (['xlsx', 'xls'].includes(ext)) {
            await carregarLibSobDemanda('xlsx');
            dados = await _uploadLerExcel(arquivo);
        } else {
            await carregarLibSobDemanda('pdfjs');
            dados = await _uploadLerPDF(arquivo);
        }
    } catch (err) {
        console.error('Erro ao processar upload:', err);
        mostrarNotificacao('Não foi possível ler o arquivo. Verifique o formato.', 'error');
        return;
    }

    sessionStorage.setItem('_uploadEmpresaDados', JSON.stringify(dados));
    window.open('formularios.html?tab=empresa&from_upload=1', '_blank');

    const qtd = Object.entries(dados)
        .filter(([k, v]) => v && String(v).trim() && !['tipo_cadastro', 'pais'].includes(k)).length;

    mostrarNotificacao(
        qtd > 0
            ? `${qtd} campo(s) identificado(s). O formulário foi aberto com os dados preenchidos.`
            : 'Nenhum dado identificado no arquivo. Preencha manualmente.',
        qtd > 0 ? 'success' : 'warning'
    );
}

// ── Leitura Excel ─────────────────────────────────────────────

async function _uploadLerExcel(arquivo) {
    if (typeof XLSX === 'undefined') throw new Error('SheetJS não carregado');
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
                const ws = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
                resolve(_uploadParsearExcel(rows));
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

function _uploadParsearExcel(rows) {
    if (!rows || !rows.length) return {};

    const norm = s => String(s || '').toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

    const ALIASES = {
        'razao social': 'razao_social', 'razao': 'razao_social', 'empresa': 'razao_social',
        'nome fantasia': 'nome_fantasia', 'fantasia': 'nome_fantasia',
        'cnpj': 'cnpj_raw', 'cpf': 'cpf_raw', 'documento': 'cnpj_raw',
        'ie': 'inscricao_estadual', 'inscricao estadual': 'inscricao_estadual',
        'suframa': 'suframa', 'cep': 'cep',
        'estado': 'estado', 'uf': 'estado',
        'cidade': 'cidade', 'municipio': 'cidade',
        'bairro': 'bairro',
        'endereco': 'endereco', 'logradouro': 'endereco', 'rua': 'endereco',
        'numero': 'numero', 'num': 'numero',
        'complemento': 'complemento',
        'site': 'site', 'website': 'site',
        'email': 'email_contato', 'e-mail': 'email_contato',
        'telefone': 'telefone_contato', 'fone': 'telefone_contato', 'celular': 'telefone_contato',
        'horario': 'horario_atendimento', 'horario atendimento': 'horario_atendimento',
    };

    // Formato chave/valor (col A = label, col B = valor)
    const kv = {};
    rows.forEach(row => {
        const chave = norm(row[0]);
        const valor = String(row[1] || '').trim();
        if (chave && valor && ALIASES[chave]) kv[ALIASES[chave]] = valor;
    });
    if (Object.keys(kv).length >= 2) return _uploadNormalizar(kv);

    // Formato tabular (linha 0 = cabeçalhos, linha 1 = dados)
    let headerIdx = -1, headerMap = {};
    for (let i = 0; i < Math.min(5, rows.length); i++) {
        const mapped = {};
        rows[i].forEach((cell, idx) => {
            const n = norm(cell);
            if (ALIASES[n]) mapped[ALIASES[n]] = idx;
        });
        if (Object.keys(mapped).length >= 2) { headerIdx = i; headerMap = mapped; break; }
    }
    if (headerIdx >= 0 && rows[headerIdx + 1]) {
        const dr = rows[headerIdx + 1];
        const tab = {};
        Object.entries(headerMap).forEach(([field, idx]) => {
            const v = String(dr[idx] || '').trim();
            if (v) tab[field] = v;
        });
        return _uploadNormalizar(tab);
    }

    // Fallback: texto livre
    return _uploadParsearTexto(rows.flat().map(c => String(c || '')).join(' '));
}

// ── Leitura PDF ───────────────────────────────────────────────

async function _uploadLerPDF(arquivo) {
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
                if (texto.trim().length < 30) {
                    resolve({});  // PDF escaneado — sem texto legível
                } else {
                    resolve(_uploadParsearTexto(texto));
                }
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(arquivo);
    });
}

// ── Extração por regex (PDF e fallback Excel) ─────────────────

function _uploadParsearTexto(texto) {
    const d = {};
    const t = texto.replace(/\s+/g, ' ');

    // CNPJ
    const cnpjM = t.match(/\d{2}[.\s]?\d{3}[.\s]?\d{3}[/\s]?\d{4}[-\s]?\d{2}/);
    if (cnpjM && cnpjM[0].replace(/\D/g, '').length === 14) d.cnpj_raw = cnpjM[0].replace(/\D/g, '');

    // CPF (só se não tiver CNPJ)
    if (!d.cnpj_raw) {
        const cpfM = t.match(/\d{3}[.\s]?\d{3}[.\s]?\d{3}[-\s]?\d{2}(?!\d)/);
        if (cpfM && cpfM[0].replace(/\D/g, '').length === 11) d.cpf_raw = cpfM[0].replace(/\D/g, '');
    }

    // Razão Social — terminadores ampliados pro formato do Cartão CNPJ da
    // Receita ("NOME EMPRESARIAL ... TÍTULO DO ESTABELECIMENTO ..."), que
    // não tem nenhum dos rótulos antigos logo em seguida.
    const razaoM = t.match(/(?:Raz[aã]o\s*Social|Nome\s*Empresarial)[:\s]+([A-ZÀ-Ú][A-Za-zÀ-ú0-9\s&.,'"()-]{2,80}?)(?=\s*(?:CNPJ|CPF|Endere[cç]o|Logradouro|Inscri[cç][aã]o|Bairro|CEP|T[íi]tulo|Porte|C[oó]digo|N[uú]mero|Complemento)\b|$)/i);
    if (razaoM) d.razao_social = razaoM[1].trim().replace(/\s+/g, ' ');

    // Nome Fantasia — no Cartão CNPJ o rótulo vem entre parênteses
    // ("(NOME DE FANTASIA)"), então aceita ")" colado antes do valor.
    const fantasiaM = t.match(/(?:Nome\s*Fantasia|Fantasia)[:\s)]+([A-Za-zÀ-ú0-9\s&.,'"()-]{2,60}?)(?=\s*(?:CNPJ|CPF|Endere[cç]o|Porte|C[oó]digo)\b|$)/i);
    if (fantasiaM) d.nome_fantasia = fantasiaM[1].trim().replace(/\s+/g, ' ');

    // IE
    const ieM = t.match(/(?:Inscri[cç][aã]o\s*Estadual|I\.?E\.?)[:\s]+([0-9.\-/ISENTOisento]{3,20})/i);
    if (ieM) d.inscricao_estadual = ieM[1].trim();

    // CEP — aceita ponto após os 2 primeiros dígitos (formato "07.223-190"
    // usado no Cartão CNPJ) além do "01310-100"/"01310100" já suportados.
    const cepM = t.match(/\b(\d{2})\.?(\d{3})-?(\d{3})\b/);
    if (cepM) d.cep = `${cepM[1]}${cepM[2]}-${cepM[3]}`;

    // UF
    const ufM = t.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
    if (ufM) d.estado = ufM[1];

    // Cidade / Município — tenta "Município" primeiro. No Cartão CNPJ, o
    // valor de "BAIRRO/DISTRITO" pode conter a palavra "Cidade" dentro do
    // próprio nome do bairro (ex: "Cidade Industrial Satélite de São
    // Paulo"), o que fazia o regex de "Cidade" morder esse texto errado
    // antes mesmo de chegar no rótulo real "MUNICÍPIO".
    const TERM_CIDADE = /(?=\s*(?:UF|CEP|Bairro)\b|\s*\b(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b|$)/;
    let cidadeM = t.match(new RegExp(`Munic[ií]pio[:\\s]+([A-Za-zÀ-ú\\s]{3,40}?)${TERM_CIDADE.source}`, 'i'));
    if (!cidadeM) cidadeM = t.match(new RegExp(`\\bCidade[:\\s]+([A-Za-zÀ-ú\\s]{3,40}?)${TERM_CIDADE.source}`, 'i'));
    if (cidadeM) d.cidade = cidadeM[1].trim();

    // Bairro — o texto já vem com as quebras de linha achatadas em espaço
    // simples (ver `t` acima), então "\s{2,}" nunca bate; o corte real
    // precisa ser pelos rótulos dos próximos campos. Aceita "/Distrito"
    // colado no rótulo (formato do Cartão CNPJ: "BAIRRO/DISTRITO").
    const bairroM = t.match(/Bairro(?:\s*\/\s*Distrito)?[:\s]+([A-Za-zÀ-ú\s]{3,40}?)(?=\s*(?:CEP|Cidade|Munic[ií]pio|Endere[cç]o|Logradouro|N[uú]mero|N[°º]|Complemento|UF)\b|\s*\d{5}|$)/i);
    if (bairroM) d.bairro = bairroM[1].trim();

    // Endereço / Logradouro — mesmo cuidado: sem o corte pelos rótulos dos
    // campos seguintes, a captura "vazava" pra dentro de Número/Complemento.
    const endM = t.match(/(?:Endere[cç]o|Logradouro)[:\s]+([A-Za-zÀ-ú0-9\s.,°ª-]{5,80}?)(?=\s*(?:Bairro|CEP|Cidade|Munic[ií]pio|N[uú]mero|N[°º]|Complemento)\b|\s*\d{5}|$)/i);
    if (endM) d.endereco = endM[1].trim().replace(/\s+/g, ' ');

    // Número
    const numM = t.match(/(?:N[uú]mero|N[°º]\.?)[:\s]*(\d{1,6}|S\/N)/i);
    if (numM) d.numero = numM[1];

    // Complemento
    const compM = t.match(/Complemento[:\s]+([A-Za-zÀ-ú0-9\s.,°ª-]{1,40}?)(?=\s*(?:CEP|Bairro|Cidade|Munic[ií]pio|UF)\b|\s*\d{5}|$)/i);
    if (compM) d.complemento = compM[1].trim();

    // E-mail
    const emailM = t.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailM) d.email_contato = emailM[0];

    // Telefone
    const telM = t.match(/\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/);
    if (telM) d.telefone_contato = telM[0].replace(/\D/g, '');

    // Site
    const siteM = t.match(/(?:www\.|https?:\/\/)[^\s,;]{4,60}/i);
    if (siteM) d.site = siteM[0];

    return _uploadNormalizar(d);
}

// ── Normalizar documento (formatar + detectar tipo) ───────────

function _uploadNormalizar(raw) {
    const d = { ...raw };

    const formatarCNPJ = n => n.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    const formatarCPF  = n => n.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');

    if (d.cnpj_raw) {
        const n = String(d.cnpj_raw).replace(/\D/g, '');
        if (n.length === 14) { d.tipo_cadastro = 'cnpj'; d.documento = formatarCNPJ(n); }
        delete d.cnpj_raw;
    } else if (d.cpf_raw) {
        const n = String(d.cpf_raw).replace(/\D/g, '');
        if (n.length === 11) { d.tipo_cadastro = 'cpf'; d.documento = formatarCPF(n); }
        delete d.cpf_raw;
    } else if (d.documento) {
        const n = String(d.documento).replace(/\D/g, '');
        if (n.length === 14) { d.tipo_cadastro = 'cnpj'; d.documento = formatarCNPJ(n); }
        else if (n.length === 11) { d.tipo_cadastro = 'cpf'; d.documento = formatarCPF(n); }
    }

    return d;
}

// ========================================
// NOTIFICAÇÕES
// ========================================

function mostrarNotificacao(mensagem, tipo = 'info') {
    const icones = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
    const cores  = { success: '#22C55E', error: '#dc2626', warning: '#f59e0b', info: '#4776ec' };

    const n = document.createElement('div');
    n.className = `notificacao notificacao-${tipo}`;
    n.innerHTML = `<i class="fa-solid ${icones[tipo]}"></i><span>${mensagem}</span>`;
    n.style.cssText = `position:fixed;top:100px;right:20px;background:white;color:${cores[tipo]};padding:16px 24px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.15);display:flex;align-items:center;gap:12px;font-weight:600;z-index:99999;animation:slideIn .3s ease;border-left:4px solid ${cores[tipo]};max-width:400px;`;

    document.body.appendChild(n);
    setTimeout(() => { n.style.animation = 'slideOut .3s ease'; setTimeout(() => n.remove(), 300); }, 5000);
}

const _notifStyle = document.createElement('style');
_notifStyle.textContent = `
@keyframes slideIn  { from { transform:translateX(400px); opacity:0; } to { transform:translateX(0); opacity:1; } }
@keyframes slideOut { from { transform:translateX(0); opacity:1; } to { transform:translateX(400px); opacity:0; } }
`;
document.head.appendChild(_notifStyle);
