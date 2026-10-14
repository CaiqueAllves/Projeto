// Apoio comum dos testes: servidor local, login, asserções e limpeza.
const { chromium, devices } = require('playwright');
const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORTA = Number(process.env.MARPEX_PORTA || 8947);
const BASE = `http://localhost:${PORTA}`;
const RAIZ = path.resolve(__dirname, '..');

function servidorNoAr() {
    return new Promise(res => {
        http.get(BASE + '/login.html', r => { r.resume(); res(r.statusCode === 200); }).on('error', () => res(false));
    });
}

async function garantirServidor() {
    if (await servidorNoAr()) return null;
    const proc = spawn('python3', ['-m', 'http.server', String(PORTA)], { cwd: RAIZ, stdio: 'ignore' });
    for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 250)); if (await servidorNoAr()) return proc; }
    throw new Error('Não foi possível subir o servidor local na porta ' + PORTA);
}

async function abrirNavegador({ mobile = false } = {}) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1500, height: 950 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.__erros = [];
    page.on('pageerror', e => page.__erros.push(e.message));
    return { browser, page };
}

async function login(page) {
    const cpf = process.env.MARPEX_CPF, senha = process.env.MARPEX_SENHA;
    if (!cpf || !senha) throw new Error('Defina MARPEX_CPF e MARPEX_SENHA (conta de teste).');
    await page.goto(BASE + '/login.html');
    await page.fill('#cpf', cpf);
    await page.fill('#password', senha);
    await page.click('#btnLogin');
    await page.waitForURL('**/app.html', { timeout: 20000 });
}

async function ir(page, caminho, espera = 3500) {
    await page.goto(BASE + '/' + caminho);
    await page.waitForTimeout(espera);
}

class FalhaTeste extends Error {}
function esperar(condicao, mensagem) { if (!condicao) throw new FalhaTeste(mensagem); }
function igual(atual, esperado, mensagem) {
    if (JSON.stringify(atual) !== JSON.stringify(esperado)) throw new FalhaTeste(`${mensagem} — esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(atual)}`);
}
function semErrosJS(page) { esperar(!page.__erros.length, 'Erros de JavaScript na página: ' + page.__erros.join(' | ')); }

const marca = () => 'TSTE2E' + Date.now() + Math.floor(Math.random() * 1000);

module.exports = { BASE, garantirServidor, abrirNavegador, login, ir, esperar, igual, semErrosJS, marca, FalhaTeste };

// ── Pular (quando depende de uma migração ainda não rodada) ──
class PularTeste extends Error {}
function pular(motivo) { throw new PularTeste(motivo); }
module.exports.pular = pular;
module.exports.PularTeste = PularTeste;

// ── Dados de teste: cria Exportador, Importador, Transportadora, produto
//    (com embalagem), Proforma e Processos; devolve os ids. Tudo marcado
//    com um código "TSTE2E…" e apagado por limparDados().
async function criarDados(page, { processos = 0, modal = 'terrestre', incoterm = 'EXW' } = {}) {
    const m = marca();
    return page.evaluate(async ({ m, processos, modal, incoterm }) => {
        const u = JSON.parse(sessionStorage.getItem('usuarioLogado'));
        const base = { empresa_id: u.empresa_id, is_comprador: false, is_fornecedor: false };
        // uma por vez: em inserção múltipla, campo ausente numa linha vai NULL (e não o padrão da coluna)
        const novo = async row => {
            const r = await supabaseClient.from('parceiros').insert(row).select('id').single();
            if (r.error) throw new Error('parceiros: ' + r.error.message);
            return r.data.id;
        };
        const exp = await novo({ ...base, razao_social: `${m} EXPORTADORA LTDA`, documento: '11.111.111/0001-11', endereco: 'Rua A', numero: '10', cidade: 'São Paulo', estado: 'SP', cep: '01000-000', pais: 'Brasil' });
        const imp = await novo({ ...base, razao_social: `${m} IMPORTADORA SA`, documento: '22.222.222/0001-22', codigo: 'IMP-' + m.slice(-4), endereco: 'Av B', numero: '20', cidade: 'Buenos Aires', estado: 'CABA', cep: 'C1000', pais: 'Argentina' });
        const transp = await novo({ ...base, razao_social: `${m} TRANSPORTES LTDA`, documento: '33.333.333/0001-33', modelo: 'transportadora', is_transportadora: true });
        const pr = await supabaseClient.from('produtos').insert({ empresa_id: u.empresa_id, criado_por: u.id, sku: 'SKU-' + m.slice(-6), nome: `${m} Café`, ncm: '0901.21.00', hscode: '090121', marca: 'MarcaT', empresa_parceira_id: exp, status: 'ativo' }).select('id').single();
        if (pr.error) throw new Error('produto: ' + pr.error.message);
        await supabaseClient.from('produto_embalagens').insert({ produto_id: pr.data.id, empresa_id: u.empresa_id, nome: 'Caixa', tipo: 'caixa', tipo_embalagem: 'Caixa de papelão', quantidade: 10, peso_liquido: 10, peso_bruto: 11, comprimento: 40, largura: 30, altura: 20 });
        const itens = [{ produto_id: pr.data.id, produto: `${m} Café`, qtd: 100, unidade: 'KG', preco: 5, moeda: 'USD' }];
        const pf = await supabaseClient.from('proformas').insert({
            codigo: m, empresa_id: u.empresa_id, criado_por: u.id, idioma: 'pt', tipo: 'exportacao_direta', proposito: 'vendas', status: 'pendente',
            emissor_tipo: 'terceiro', parceiro_id: exp, documento: '11.111.111/0001-11', documento_tipo: 'cnpj', destinatario_id: imp,
            modal, incoterm, origem_pais: 'Brasil', destino_pais: 'Argentina', forma_pagamento: 'cartao-credito', prazo_pagamento: 'avista',
            validade_dias: '2', valor_total: 500, moeda_principal: 'USD', itens,
        }).select('*').single();
        if (pf.error) throw new Error('proforma: ' + pf.error.message);
        const procs = [];
        for (let i = 0; i < processos; i++) {
            const r = await supabaseClient.from('processos').insert({
                proforma_id: pf.data.id, numero_processo: `${m}P${i + 1}`, empresa_proprietaria_id: u.empresa_id, criado_por: u.id,
                tipo: 'exportacao_direta', proposito: 'vendas', status: 'aberto', emissor_tipo: 'terceiro', remetente_parceiro_id: exp,
                empresa_parceira_id: imp, modal, incoterm, pais_origem: 'Brasil', pais_destino: 'Argentina',
                fronteira_saida: 'Uruguaiana', fronteira_entrada: 'Paso de los Libres', container_tipo: '40HC', container_numero: 'ABCU1234567',
                itens: [{ ...itens[0], qtd: 50 }], valor_total: 250, moeda: 'USD',
            }).select('id').single();
            if (r.error) throw new Error('processo: ' + r.error.message);
            procs.push(r.data.id);
        }
        return { marca: m, sku: 'SKU-' + m.slice(-6), exp, imp, transp, produto: pr.data.id, proforma: pf.data.id, processos: procs };
    }, { m, processos, modal, incoterm });
}

async function limparDados(page, ids) {
    if (!ids) return;
    await page.evaluate(async (ids) => {
        const del = (t, c, v) => supabaseClient.from(t).delete()[Array.isArray(v) ? 'in' : 'eq'](c, v);
        const { data: docs } = await supabaseClient.from('proforma_documentos').select('arquivo_path').eq('proforma_id', ids.proforma);
        const paths = (docs || []).map(d => d.arquivo_path).filter(Boolean);
        if (paths.length) await supabaseClient.storage.from('proforma-documentos-assinados').remove(paths);
        await del('proforma_documentos', 'proforma_id', ids.proforma);
        await del('processos', 'proforma_id', ids.proforma);
        await del('proformas', 'id', ids.proforma);
        await del('produto_embalagens', 'produto_id', ids.produto);
        await del('produtos', 'id', ids.produto);
        await del('parceiros', 'id', [ids.exp, ids.imp, ids.transp]);
    }, ids).catch(() => {});
}

// Texto de um PDF gerado pelo jsPDF (sem compressão: o texto fica legível no arquivo)
async function textoPdfDoBlob(page, expr) {
    return page.evaluate(async (expr) => {
        const blob = await (0, eval)(expr);
        const buf = new Uint8Array(await (blob.blob || blob).arrayBuffer());
        return new TextDecoder('latin1').decode(buf);
    }, expr);
}

module.exports.criarDados = criarDados;
module.exports.limparDados = limparDados;
module.exports.textoPdfDoBlob = textoPdfDoBlob;
