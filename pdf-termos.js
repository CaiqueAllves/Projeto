// ========================================
// TERMOS E CONDIÇÕES GERAIS DE VENDA INTERNACIONAL
// ========================================
// Páginas finais do PDF de cada Proforma (pdf-proforma.js). O texto fica aqui
// para ser atualizado num lugar só. Formato: "# " = seção, linha em branco
// separa parágrafos; "a) ..." vira item recuado.
const PDF_TERMOS_VENDA = {
    titulo: 'TERMOS E CONDIÇÕES GERAIS DE VENDA INTERNACIONAL',
    subtitulo: 'EXPORTAÇÃO DE MERCADORIAS DO BRASIL',
    versao: 'Versão 2 | Vigência: 2026',
    texto: `
Os presentes Termos e Condições Gerais de Venda Internacional ("Termos Gerais") regulam as operações de venda e exportação de mercadorias originadas ou expedidas do Brasil e integram, para todos os fins aplicáveis, a Proforma Invoice ("Proforma") emitida pelo vendedor/exportador identificado naquele documento ("Vendedor") ao comprador/importador nele identificado ("Comprador").

A Proforma e estes Termos Gerais, em conjunto com eventuais anexos, especificações ou aditivos expressamente incorporados à operação, constituem o acordo comercial entre as Partes.

# 1. OBJETO E ÂMBITO DE APLICAÇÃO

1.1. Estes Termos Gerais estabelecem as condições aplicáveis à venda internacional, preparação, disponibilização, entrega e exportação das mercadorias descritas na respectiva Proforma.

1.2. As características específicas de cada operação, incluindo produtos, quantidades, preços, moeda, condições de pagamento, prazo, local de entrega e Incoterm aplicável, serão aquelas indicadas na respectiva Proforma.

1.3. Estes Termos Gerais aplicam-se exclusivamente à operação de exportação à qual a Proforma fizer referência, salvo quando expressamente acordado de forma diversa entre as Partes.

# 2. FORMAÇÃO E ACEITAÇÃO DA OPERAÇÃO

2.1. A Proforma terá validade pelo período nela indicado.

2.2. A operação será considerada aceita pelo Comprador mediante assinatura ou aceite expresso da Proforma, pagamento total ou parcial previsto para confirmação do pedido, ou outro ato inequívoco de aceitação expressamente admitido pelo Vendedor.

2.3. A aceitação implica ciência e concordância com a Proforma e com estes Termos Gerais.

2.4. Condições constantes de pedidos de compra, ordens, formulários ou outros documentos emitidos unilateralmente pelo Comprador não modificarão estes Termos Gerais, salvo se expressamente aceitas por escrito pelo Vendedor.

# 3. DOCUMENTOS CONTRATUAIS E ORDEM DE PREVALÊNCIA

3.1. Integram a operação, quando aplicáveis:

a) a Proforma Invoice;

b) eventuais aditivos ou condições especiais expressamente acordados entre as Partes;

c) estes Termos e Condições Gerais de Venda Internacional;

d) especificações técnicas, fichas de produto, artes, amostras ou outros documentos expressamente aprovados pelas Partes.

3.2. Em caso de divergência, as condições específicas expressamente estabelecidas na Proforma prevalecerão sobre estes Termos Gerais quanto aos elementos particulares daquela operação.

3.3. Documentos operacionais posteriores, incluindo Commercial Invoice, Packing List e documentos de transporte, deverão refletir a operação contratada e não serão considerados, isoladamente, alteração das condições comerciais previamente acordadas.

# 4. PRODUTOS, QUANTIDADES E ESPECIFICAÇÕES

4.1. Os produtos, quantidades, unidades de medida, apresentações e demais características comerciais serão aqueles descritos na Proforma.

4.2. Quando a mercadoria for produzida, embalada, rotulada ou personalizada especificamente para o Comprador, este deverá fornecer ou aprovar, dentro dos prazos solicitados, todas as informações, especificações e materiais necessários.

4.3. Eventuais tolerâncias de peso, volume, quantidade ou características decorrentes da natureza do produto ou de práticas comerciais e industriais aplicáveis deverão ser previamente informadas ou constar da documentação comercial da operação.

# 5. PREÇOS E MOEDA

5.1. Os preços e a moeda da operação serão aqueles indicados na Proforma.

5.2. O preço será estabelecido considerando o Incoterm, o ponto ou local nomeado e as demais condições comerciais indicadas na Proforma.

5.3. Salvo disposição expressa em contrário, despesas, serviços, documentos especiais, inspeções, certificações, armazenagem, transporte, seguro, direitos, tributos ou encargos que não estejam compreendidos nas obrigações do Vendedor segundo a condição comercial contratada não estarão incluídos no preço.

5.4. Alterações solicitadas pelo Comprador após a aceitação poderão implicar revisão do preço e do prazo.

# 6. CONDIÇÕES DE PAGAMENTO

6.1. A forma, os percentuais, os vencimentos e os meios de pagamento serão aqueles estabelecidos na Proforma.

6.2. O pagamento somente será considerado realizado após a efetiva disponibilidade dos fundos ao Vendedor.

6.3. Salvo disposição diferente na Proforma, despesas bancárias cobradas no país ou pela instituição do Comprador, bem como despesas de bancos intermediários decorrentes da transferência, serão suportadas pelo Comprador.

6.4. O Vendedor poderá suspender a produção, preparação, entrega ou disponibilização da mercadoria enquanto houver valores vencidos ou condições

6.5. A suspensão decorrente de inadimplemento do Comprador poderá implicar revisão do prazo de entrega e cobrança das despesas adicionais comprovadamente ocasionadas.
`,
};

// Desenha os Termos a partir de uma página nova. Devolve o Y final.
function pvTermosGerais(doc, termos = PDF_TERMOS_VENDA) {
    const { ML, CW } = PV, C = PDF_CORES;
    doc.addPage();
    let Y = 18;
    _pvT(doc, 'bold', 12.5, C.NAVY, termos.titulo, ML + CW / 2, Y, { align: 'center' }); Y += 6;
    _pvT(doc, 'bold', 9.5, C.AZUL, termos.subtitulo, ML + CW / 2, Y, { align: 'center' }); Y += 5;
    if (termos.versao) { _pvT(doc, 'normal', 7.5, C.CINZA, termos.versao, ML + CW / 2, Y, { align: 'center' }); Y += 4; }
    doc.setDrawColor(...C.NAVY); doc.setLineWidth(0.6); doc.line(ML, Y, ML + CW, Y);
    Y += 6;

    const TAM = 8, LH = 3.6;
    termos.texto.trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).forEach(p => {
        if (p.startsWith('# ')) {
            Y = pvGarantir(doc, Y, 14);   // título não fica sozinho no pé da página
            Y += 2;
            _pvT(doc, 'bold', 9, C.NAVY, p.slice(2), ML, Y);
            Y += 5;
            return;
        }
        const item = /^[a-z]\)\s/.test(p);
        const x = ML + (item ? 6 : 0);
        const linhas = _pvCorta(doc, p, CW - (item ? 6 : 0), TAM);
        linhas.forEach(l => {
            Y = pvGarantir(doc, Y, LH);
            _pvT(doc, 'normal', TAM, C.PRETO, l, x, Y);
            Y += LH;
        });
        Y += 1.8;
    });
    return Y;
}

// ========================================
// BIBLIOTECA DE TERMOS DA EMPRESA (database-termos-modelos.sql)
// ========================================
// Escolha guardada na Proforma (proformas.termos_modelo):
//   'base'   → Termos base acima (PDF_TERMOS_VENDA), desenhados pelo sistema
//   'nenhum' → sem Termos
//   <id>     → PDF enviado pela empresa, anexado ao final como veio
//   vazio    → o padrão da empresa (modelo marcado; sem marcado = base)
const TERMOS_BUCKET = 'termos-modelos';
const TERMOS_MAX_MB = 10;
let _termosLista = null;

async function termosListar(recarregar = false) {
    if (_termosLista && !recarregar) return _termosLista;
    const { data, error } = await supabaseClient.from('termos_modelos').select('*').order('nome');
    _termosLista = error ? [] : (data || []);
    return _termosLista;
}

async function termosEscolhaPadrao() {
    return (await termosListar()).find(m => m.padrao)?.id || 'base';
}

// Escolha gravada → o que usar de fato (modelo excluído volta para o padrão)
async function termosResolver(escolha) {
    const lista = await termosListar();
    if (!escolha) escolha = await termosEscolhaPadrao();
    if (escolha === 'base' || escolha === 'nenhum') return { tipo: escolha };
    const modelo = lista.find(m => m.id === escolha);
    if (modelo) return { tipo: 'modelo', modelo };
    const padrao = lista.find(m => m.padrao);
    return padrao ? { tipo: 'modelo', modelo: padrao } : { tipo: 'base' };
}

async function termosEnviar(file, idioma) {
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('Envie os Termos em PDF.');
    if (file.size > TERMOS_MAX_MB * 1024 * 1024) throw new Error(`O PDF deve ter no máximo ${TERMOS_MAX_MB} MB.`);
    const u = obterUsuarioLogado();
    const path = `${u.empresa_id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { error } = await supabaseClient.storage.from(TERMOS_BUCKET).upload(path, file, { contentType: 'application/pdf' });
    if (error) throw new Error('Não foi possível enviar o PDF: ' + error.message);
    const { data, error: e2 } = await supabaseClient.from('termos_modelos').insert({
        empresa_id: u.empresa_id, nome: file.name.replace(/\.pdf$/i, '').toUpperCase(), idioma: idioma || null,
        arquivo_path: path, arquivo_nome: file.name, criado_por: u.id,
    }).select().single();
    if (e2) { supabaseClient.storage.from(TERMOS_BUCKET).remove([path]).catch(() => {}); throw new Error(e2.message); }
    await termosListar(true);
    return data;
}

async function termosExcluir(modelo) {
    const { error } = await supabaseClient.from('termos_modelos').delete().eq('id', modelo.id);
    if (error) throw new Error(error.message);
    supabaseClient.storage.from(TERMOS_BUCKET).remove([modelo.arquivo_path]).catch(() => {});
    await termosListar(true);
}

// id = modelo que vira padrão; null = Termos base voltam a ser o padrão
async function termosDefinirPadrao(id) {
    const u = obterUsuarioLogado();
    const { error } = await supabaseClient.from('termos_modelos').update({ padrao: false }).eq('empresa_id', u.empresa_id).eq('padrao', true);
    if (error) throw new Error(error.message);
    if (id) {
        const { error: e2 } = await supabaseClient.from('termos_modelos').update({ padrao: true }).eq('id', id);
        if (e2) throw new Error(e2.message);
    }
    await termosListar(true);
}

// ── Anexar o PDF da empresa ao final da Proforma (pdf-lib, sob demanda) ──
let _pdfLibCarregado = null;
function _termosCarregarPdfLib() {
    if (window.PDFLib) return Promise.resolve();
    if (_pdfLibCarregado) return _pdfLibCarregado;
    _pdfLibCarregado = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        s.integrity = 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI';   // SRI
        s.crossOrigin = 'anonymous';
        s.onload = resolve;
        s.onerror = () => { _pdfLibCarregado = null; reject(new Error('Falha ao carregar o leitor de PDF.')); };
        document.head.appendChild(s);
    });
    return _pdfLibCarregado;
}

// pdfBase = ArrayBuffer da Proforma; devolve Uint8Array com os Termos no fim
async function termosAnexarPdf(pdfBase, modelo) {
    await _termosCarregarPdfLib();
    const { data, error } = await supabaseClient.storage.from(TERMOS_BUCKET).download(modelo.arquivo_path);
    if (error || !data) throw new Error('Não foi possível baixar o PDF dos Termos.');
    const doc = await PDFLib.PDFDocument.load(pdfBase);
    const termos = await PDFLib.PDFDocument.load(await data.arrayBuffer(), { ignoreEncryption: true });
    (await doc.copyPages(termos, termos.getPageIndices())).forEach(p => doc.addPage(p));
    return doc.save();
}

// ========================================
// JANELA DE EMISSÃO — idioma (e Termos, na Proforma)
// ========================================
// pdfDialogoEmissao({ titulo, idioma, termos }) → Promise<{ idioma, termos } | null>
// termos: escolha atual ('base' | 'nenhum' | id | '') — sem `termos`, só pergunta o idioma.
const PDF_EMISSAO_IDIOMAS = [['pt', 'Português'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'], ['de', 'Deutsch']];

function pdfDialogoEmissao({ titulo = 'Emitir PDF', idioma = 'pt', termos } = {}) {
    const comTermos = termos !== undefined;
    const podeGerenciar = typeof usuarioPodeExcluir === 'function' && usuarioPodeExcluir();
    return new Promise(async resolve => {
        const ov = document.createElement('div');
        ov.className = 'confirmar-overlay';
        ov.innerHTML = `
            <div class="confirmar-caixa pdf-emissao" role="dialog" aria-modal="true" aria-labelledby="pdfEmTitulo">
                <h3 class="confirmar-titulo" id="pdfEmTitulo"></h3>
                <label class="pdf-emissao-rotulo" for="pdfEmIdioma">Idioma do documento</label>
                <select id="pdfEmIdioma" class="pdf-emissao-select"></select>
                ${comTermos ? `
                <span class="pdf-emissao-rotulo">Termos e Condições</span>
                <div class="pdf-emissao-termos" id="pdfEmTermos"></div>
                <small class="pdf-emissao-aviso" id="pdfEmAviso" hidden></small>
                ${podeGerenciar ? `<button type="button" class="pdf-emissao-enviar" id="pdfEmEnviar"><i class="fa-solid fa-upload"></i> Enviar Termos da empresa (PDF)</button>
                <input type="file" id="pdfEmArquivo" accept="application/pdf,.pdf" hidden>` : ''}` : ''}
                <div class="confirmar-acoes">
                    <button type="button" class="confirmar-btn confirmar-btn--cancelar">Cancelar</button>
                    <button type="button" class="confirmar-btn confirmar-btn--ok"><i class="fa-solid fa-file-pdf"></i> Emitir PDF</button>
                </div>
            </div>`;
        ov.querySelector('#pdfEmTitulo').textContent = titulo;
        const selIdioma = ov.querySelector('#pdfEmIdioma');
        PDF_EMISSAO_IDIOMAS.forEach(([v, t]) => selIdioma.add(new Option(t, v)));
        selIdioma.value = PDF_EMISSAO_IDIOMAS.some(([v]) => v === idioma) ? idioma : 'en';
        document.body.appendChild(ov);

        let escolha = termos || '';
        const box = ov.querySelector('#pdfEmTermos');
        const aviso = ov.querySelector('#pdfEmAviso');
        const opcao = (valor, nome, detalhe, modelo) => {
            const lbl = document.createElement('label');
            lbl.className = 'pdf-emissao-opcao';
            lbl.innerHTML = `<input type="radio" name="pdfEmTermo"><span class="pdf-emissao-nome"></span><small></small>`;
            lbl.querySelector('input').value = valor;
            lbl.querySelector('input').checked = valor === escolha;
            lbl.querySelector('input').addEventListener('change', () => { escolha = valor; atualizarAviso(); });
            lbl.querySelector('.pdf-emissao-nome').textContent = nome;
            lbl.querySelector('small').textContent = detalhe;
            if (modelo && podeGerenciar) {
                const acoes = document.createElement('span');
                acoes.className = 'pdf-emissao-acoes';
                acoes.innerHTML = `<button type="button" title="${modelo.padrao ? 'Deixar de ser o padrão' : 'Usar como padrão'}"><i class="fa-${modelo.padrao ? 'solid' : 'regular'} fa-star"></i></button>
                    <button type="button" title="Excluir modelo"><i class="fa-solid fa-trash"></i></button>`;
                const [bPadrao, bExcluir] = acoes.querySelectorAll('button');
                bPadrao.addEventListener('click', async e => {
                    e.preventDefault();
                    try { await termosDefinirPadrao(modelo.padrao ? null : modelo.id); montar(); }
                    catch (err) { mostrarNotificacao(err.message, 'erro'); }
                });
                bExcluir.addEventListener('click', async e => {
                    e.preventDefault();
                    ov.style.visibility = 'hidden';
                    const ok = await confirmarAcao(`Excluir os Termos "${modelo.nome}"? Proformas que usavam este modelo passam a usar o padrão da empresa.`,
                        { titulo: 'Excluir Termos?', confirmar: 'Excluir', perigo: true });
                    ov.style.visibility = '';
                    if (!ok) return;
                    try { await termosExcluir(modelo); if (escolha === modelo.id) escolha = ''; montar(); }
                    catch (err) { mostrarNotificacao(err.message, 'erro'); }
                });
                lbl.appendChild(acoes);
            }
            box.appendChild(lbl);
        };
        const nomeIdioma = c => (PDF_EMISSAO_IDIOMAS.find(([v]) => v === c) || [])[1] || '';
        function atualizarAviso() {
            if (!aviso) return;
            const pt = selIdioma.value === 'pt';
            const usaBase = escolha === 'base' || (!escolha && !(_termosLista || []).some(m => m.padrao));
            aviso.hidden = pt || !usaBase;
            aviso.textContent = `Os Termos base do sistema existem só em português — o documento sai em ${nomeIdioma(selIdioma.value)} com os Termos em português. `
                + (podeGerenciar ? 'Para Termos no mesmo idioma, envie os da empresa abaixo (PDF) ou escolha "Sem Termos".' : 'Para Termos no mesmo idioma, peça ao administrador para enviar os da empresa.');
        }
        // Trocou o idioma: se a empresa tem Termos naquele idioma, já marca eles
        function termosDoIdioma() {
            const lista = _termosLista || [];
            const atual = lista.find(m => m.id === escolha);
            if (escolha === 'nenhum' || atual?.idioma === selIdioma.value) return;
            const doIdioma = lista.find(m => m.idioma === selIdioma.value && m.padrao) || lista.find(m => m.idioma === selIdioma.value);
            if (!doIdioma) return;
            escolha = doIdioma.id;
            box?.querySelectorAll('input[name="pdfEmTermo"]').forEach(r => { r.checked = r.value === escolha; });
        }
        async function montar() {
            if (!box) return;
            const lista = await termosListar();
            const padrao = lista.find(m => m.padrao);
            if (!escolha) escolha = padrao?.id || 'base';
            if (escolha !== 'base' && escolha !== 'nenhum' && !lista.some(m => m.id === escolha)) escolha = padrao?.id || 'base';
            box.innerHTML = '';
            lista.forEach(m => opcao(m.id, m.nome, [nomeIdioma(m.idioma), m.padrao ? 'padrão' : ''].filter(Boolean).join(' · '), m));
            opcao('base', 'Termos base do sistema', ['Português', !padrao ? 'padrão' : ''].filter(Boolean).join(' · '));
            opcao('nenhum', 'Sem Termos e Condições', '');
            atualizarAviso();
        }
        selIdioma.addEventListener('change', () => { termosDoIdioma(); atualizarAviso(); });
        await montar();
        termosDoIdioma(); atualizarAviso();

        const arq = ov.querySelector('#pdfEmArquivo');
        ov.querySelector('#pdfEmEnviar')?.addEventListener('click', () => arq.click());
        arq?.addEventListener('change', async () => {
            const f = arq.files?.[0];
            arq.value = '';
            if (!f) return;
            const btn = ov.querySelector('#pdfEmEnviar');
            btn.disabled = true;
            try { const m = await termosEnviar(f, selIdioma.value); escolha = m.id; await montar(); mostrarNotificacao('Termos enviados.', 'sucesso'); }
            catch (err) { mostrarNotificacao(err.message, 'erro'); }
            finally { btn.disabled = false; }
        });

        const fechar = r => { document.removeEventListener('keydown', teclas, true); ov.remove(); resolve(r); };
        const teclas = e => { if (e.key === 'Escape') { e.stopPropagation(); fechar(null); } };
        document.addEventListener('keydown', teclas, true);
        ov.querySelector('.confirmar-btn--cancelar').addEventListener('click', () => fechar(null));
        ov.querySelector('.confirmar-btn--ok').addEventListener('click', () => fechar({ idioma: selIdioma.value, ...(comTermos ? { termos: escolha } : {}) }));
        ov.addEventListener('click', e => { if (e.target === ov) fechar(null); });
        selIdioma.focus();
    });
}
