// ========================================
// PDF — PROFORMA (registro já salvo)
// Usado por proforma.js (lista) e pedidos.js (botão "Ver Proforma gerada")
// ========================================

// jsPDF sob demanda (revisão de performance) — ~340KB que só servem pra
// gerar PDF; este arquivo é carregado tanto em proforma.html quanto em
// pedidos.html, então o helper mora aqui em vez de duplicado nos dois
// (pdf-pedido.js, que só existe em pedidos.html, reaproveita esta função).
let _jspdfCarregado = null;
function carregarJsPDFSobDemanda() {
    if (_jspdfCarregado) return _jspdfCarregado;
    _jspdfCarregado = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
        script.onload = resolve;
        script.onerror = () => { _jspdfCarregado = null; reject(new Error('Falha ao carregar jsPDF')); };
        document.head.appendChild(script);
    });
    return _jspdfCarregado;
}

const PDF_PROF_ROTULOS = {
    tipo: { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' },
    proposito: { vendas: 'Vendas', amostra: 'Amostra', troca: 'Troca', doacao: 'Doação', conserto: 'Conserto / Reparo', retorno: 'Retorno', exposicao: 'Exposição / Feira' },
    forma_pagamento: { dinheiro: 'Dinheiro', cheque: 'Cheque', 'cartao-credito': 'Cartão de Crédito', 'cartao-debito': 'Cartão de Débito',
        duplicata: 'Duplicata Mercantil', boleto: 'Boleto Bancário', deposito: 'Depósito Bancário', swift: 'SWIFT', cad: 'CAD',
        '30-advanced': '30% ADVANCED', '70-against-document': '70% AGAINST DOCUMENT', 'sem-pagamento': 'Sem Pagamento',
        'pagamento-posterior': 'Pagamento Posterior', outros: 'Outros' },
    prazo_pagamento: { avista: 'À Vista', 15: '15 dias', 30: '30 dias', 45: '45 dias', 60: '60 dias', 90: '90 dias', 120: '120 dias' },
};

// Completa os dados da Proforma com o cadastro: Exportador (parceiro escolhido
// ou a própria empresa), Importador, e os produtos dos itens (SKU, NCM, HS Code,
// marca, fabricante) + logística (volumes/pesos pela embalagem tipo caixa).
// Só preenche o que estiver vazio — nunca sobrescreve o que veio salvo.
async function _pdfProformaCompletar(d) {
    if (typeof supabaseClient === 'undefined') return d;
    const vazio = v => v === null || v === undefined || String(v).trim() === '';
    const endereco = e => [[e.endereco, e.numero].filter(Boolean).join(', '), e.complemento].filter(Boolean).join(' - ');
    try {
        const ids = [d.emissor_tipo === 'terceiro' ? d.parceiro_id : null, d.destinatario_id].filter(Boolean);
        const { data: parcs } = ids.length ? await supabaseClient.from('parceiros').select('*').in('id', ids) : { data: [] };
        const parc = id => (parcs || []).find(p => String(p.id) === String(id));

        let exp = d.emissor_tipo === 'terceiro' ? parc(d.parceiro_id) : null;
        if (!exp && d.emissor_tipo !== 'terceiro') {
            const u = obterUsuarioLogado?.();
            const { data: emp } = await supabaseClient.from('empresas')
                .select('razao_social, nome_fantasia, cnpj, endereco, numero, complemento, cidade, estado, cep')
                .eq('id', d.empresa_id || u?.empresa_id).maybeSingle();
            if (emp) exp = { ...emp, documento: emp.cnpj };
        }
        if (exp) {
            if (vazio(d.empresa_nome) && vazio(d.razao_social)) d.empresa_nome = exp.razao_social || exp.nome_fantasia;
            if (vazio(d.documento)) d.documento = exp.documento;
            if (vazio(d.endereco))  d.endereco  = endereco(exp);
            if (vazio(d.cidade))    d.cidade    = exp.cidade;
            if (vazio(d.estado))    d.estado    = exp.estado;
            if (vazio(d.cep))       d.cep       = exp.cep;
        }
        const imp = parc(d.destinatario_id);
        if (imp) {
            if (vazio(d.destinatario_razao_social)) d.destinatario_razao_social = imp.razao_social || imp.nome_fantasia;
            if (vazio(d.destinatario_doc))      d.destinatario_doc      = imp.documento;
            if (vazio(d.destinatario_endereco)) d.destinatario_endereco = endereco(imp);
            if (vazio(d.destinatario_cidade))   d.destinatario_cidade   = imp.cidade;
            if (vazio(d.destinatario_estado))   d.destinatario_estado   = imp.estado;
            if (vazio(d.destinatario_cep))      d.destinatario_cep      = imp.cep;
        }

        const prodIds = [...new Set((d.itens || []).map(i => i.produto_id).filter(Boolean))];
        if (prodIds.length) {
            const [{ data: prods }, { data: embs }] = await Promise.all([
                supabaseClient.from('produtos').select('id, sku, ncm, hscode, marca, empresa_parceira_id').in('id', prodIds),
                supabaseClient.from('produto_embalagens').select('*').in('produto_id', prodIds),
            ]);
            const fabIds = [...new Set((prods || []).map(p => p.empresa_parceira_id).filter(Boolean))];
            const { data: fabs } = fabIds.length ? await supabaseClient.from('parceiros').select('id, razao_social, nome_fantasia').in('id', fabIds) : { data: [] };
            const prodPor = {}; (prods || []).forEach(p => { prodPor[p.id] = p; });
            const caixa = {}; (embs || []).filter(e => (e.tipo || 'caixa') === 'caixa').forEach(e => { if (!caixa[e.produto_id]) caixa[e.produto_id] = e; });
            const soma = { vol: 0, liq: 0, bruto: 0, ok: false };
            d.itens.forEach(it => {
                const p = prodPor[it.produto_id];
                if (!p) return;
                if (vazio(it.sku))     it.sku     = p.sku;
                if (vazio(it.ncm))     it.ncm     = p.ncm;
                if (vazio(it.hs_code)) it.hs_code = p.hscode;
                if (vazio(it.marca))   it.marca   = p.marca;
                if (vazio(it.fabricante)) {
                    const f = (fabs || []).find(x => String(x.id) === String(p.empresa_parceira_id));
                    if (f) it.fabricante = f.razao_social || f.nome_fantasia;
                }
                const e = caixa[it.produto_id], porVol = Number(e?.quantidade) || 0;
                if (e && porVol) {
                    const vols = Math.ceil((Number(it.qtd) || 0) / porVol);
                    soma.vol += vols; soma.liq += vols * (Number(e.peso_liquido) || 0); soma.bruto += vols * (Number(e.peso_bruto) || 0); soma.ok = true;
                    if (vazio(it.volume_peso)) it.volume_peso = `${vols} vol. / ${(vols * (Number(e.peso_bruto) || 0)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} kg`;
                }
            });
            const n3 = v => v.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
            if (soma.ok) {
                if (vazio(d.volume_total)) d.volume_total = `${soma.vol} volume${soma.vol !== 1 ? 's' : ''}`;
                if (vazio(d.peso_liquido)) d.peso_liquido = `${n3(soma.liq)} kg`;
                if (vazio(d.peso_bruto))   d.peso_bruto   = `${n3(soma.bruto)} kg`;
            }
        }
    } catch (e) { console.warn('[PDF Proforma] não foi possível completar com o cadastro:', e); }
    return d;
}

// opcoes.retornarBlob: em vez de baixar, devolve o PDF (Blob) — usado pelo
// anexo automático do documento "Nº Proforma Invoice" (ver mais abaixo).
async function gerarPDFProformaDados(d, opcoes = {}) {
    try {
        await carregarJsPDFSobDemanda();
    } catch (e) { if (!opcoes.retornarBlob) alert('Não foi possível carregar o gerador de PDF. Tente novamente.'); return null; }

    // "Criado por": quem cadastrou a proforma (proformas.criado_por)
    let criadoPor = null;
    if (d.criado_por && window.supabaseAPI?.buscarNomesUsuarios) {
        criadoPor = (await window.supabaseAPI.buscarNomesUsuarios([d.criado_por]))[d.criado_por];
    }
    if (!criadoPor) { const u = obterUsuarioLogado?.(); criadoPor = (!d.criado_por || d.criado_por === u?.id) ? (u?.nome || u?.email || null) : null; }

    // A Proforma guarda só os ids/nome das empresas e os itens como foram
    // digitados — completa com o cadastro (endereço, documento, NCM, marca...).
    d = await _pdfProformaCompletar({ ...d, itens: (d.itens || []).map(it => ({ ...it })) });

    const jsPDFLib = window.jspdf;
    if (!jsPDFLib) { alert('jsPDF não carregado. Recarregue a página.'); return; }
    const { jsPDF } = jsPDFLib;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const W = 297, ML = 14, MR = 283;
    let Y = 0;

    const NAVY=[10,40,90], AZUL=[30,86,160], AZUL_MED=[59,130,246];
    const AZUL_CLARO=[219,234,254], CINZA=[100,116,139], CINZA_BG=[248,250,252];
    const BORDA=[209,219,234], PRETO=[15,23,42], BRANCO=[255,255,255];

    function sf(style, size, color) { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...(color||PRETO)); }
    function rx(x, y, w, h, cor) { doc.setFillColor(...cor); doc.setDrawColor(...cor); doc.rect(x,y,w,h,'F'); }
    function lv(x,y1,y2) { doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(x,y1,x,y2); }
    function cp(label, valor, x, y, maxW) {
        sf('bold',6,CINZA); doc.text(label.toUpperCase(),x,y);
        sf('normal',8,PRETO);
        const v=String(valor||'—');
        doc.text(maxW ? doc.splitTextToSize(v,maxW)[0] : v, x, y+4.2);
    }
    function pg(h) { if(Y+h>185){doc.addPage();Y=20;} }
    function shL(titulo, x, y, w) {
        rx(x,y,3,6,AZUL); rx(x+3,y,w-3,6,AZUL_CLARO);
        sf('bold',7.5,AZUL); doc.text(titulo.toUpperCase(),x+7,y+4.2);
    }

    const vv = s => s||'—';
    const fd = s => s ? new Date(s+'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const codigo = vv(d.codigo);
    const dataGeracao = new Date().toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
    const modalTxt = {aereo:'Aéreo',maritimo:'Marítimo',terrestre:'Terrestre'}[d.modal] || vv(d.modal);
    const rot = (mapa, v) => v ? (mapa[v] || v) : '—';
    const moedaProforma = d.moeda || (d.itens && d.itens.length > 0 ? d.itens[0].moeda : null) || '—';

    // ── CABEÇALHO (20mm) ─────────────────────
    rx(0,0,W,20,NAVY); rx(0,0,4,20,AZUL_MED);
    sf('bold',13,BRANCO); doc.text('MARPEX',ML+3,8.5);
    sf('normal',6.5,[160,190,240]); doc.text('Gestão de Comércio Exterior',ML+3,13);
    sf('bold',11,BRANCO); doc.text('PROFORMA INVOICE',W-ML,8.5,{align:'right'});
    sf('normal',8,[160,190,240]); doc.text(codigo,W-ML,14,{align:'right'});
    sf('normal',6,[120,160,220]); doc.text('Gerado em: '+dataGeracao,W-ML,17.5,{align:'right'});
    sf('normal',6,[120,160,220]); doc.text('Criado por: '+(criadoPor||'—'),ML+3,17.5);
    Y=23;

    // ── BARRA INFO (6 campos, 10mm) ──────────
    doc.setFillColor(...CINZA_BG); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.rect(ML,Y,W-ML*2,10,'FD');
    const cw6=(W-ML*2)/6;
    for(let i=1;i<=5;i++){doc.setDrawColor(...BORDA);doc.setLineWidth(0.2);doc.line(ML+cw6*i,Y+1.5,ML+cw6*i,Y+8.5);}
    [{label:'Tipo',valor:rot(PDF_PROF_ROTULOS.tipo,d.tipo)},{label:'Propósito',valor:rot(PDF_PROF_ROTULOS.proposito,d.proposito)},{label:'Modal',valor:modalTxt},
     {label:'Incoterm',valor:vv(d.incoterm)},{label:'Moeda',valor:moedaProforma},{label:'Emissão',valor:fd(d.data_emissao)}
    ].forEach((info,i)=>{
        const cx=ML+cw6*i+cw6/2;
        sf('bold',5.5,CINZA); doc.text(info.label.toUpperCase(),cx,Y+4,{align:'center'});
        sf('bold',7,AZUL); doc.text(doc.splitTextToSize(info.valor,cw6-4)[0],cx,Y+8.5,{align:'center'});
    });
    Y+=13;

    // ── BANDA 4 COLUNAS: EMISSOR | DESTINATÁRIO | ROTA | CONDIÇÕES ──
    pg(48);
    const colW=(W-ML*2-9)/4;
    const col1=ML, col2=ML+colW+3, col3=ML+(colW+3)*2, col4=ML+(colW+3)*3;
    const bRH=5, lblBW=27, bandHdr=7;
    const emRows=[
        ['Nome da Empresa', vv(d.empresa_nome||d.razao_social)],
        ['Identificação',   vv(d.documento)],
        ['Endereço',        vv(d.endereco)],
        ['Cidade',          vv(d.cidade)],
        ['Estado',          vv(d.estado)],
        ['CEP',             vv(d.cep)],
        ['País de Origem',  vv(d.origem_pais)],
    ];
    const deRows=[
        ['Nome da Empresa',     vv(d.destinatario_razao_social)],
        ['Identificação Fiscal',vv(d.destinatario_doc)],
        ['Endereço',            vv(d.destinatario_endereco)],
        ['Cidade',              vv(d.destinatario_cidade)],
        ['Estado',              vv(d.destinatario_estado)],
        ['CEP',                 vv(d.destinatario_cep)],
        ['País de Destino',     vv(d.destino_pais)],
    ];
    const rotaRows=[['País de Origem',vv(d.origem_pais)],['País de Destino',vv(d.destino_pais)]];
    if(d.modal==='maritimo')  rotaRows.push(['Porto de Origem',vv(d.porto_origem)],['Porto de Destino',vv(d.porto_destino)]);
    else if(d.modal==='aereo') rotaRows.push(['Aeroporto de Origem',vv(d.aeroporto_origem)],['Aeroporto de Destino',vv(d.aeroporto_destino)]);
    else if(d.modal==='terrestre') rotaRows.push(['Fronteira de Saída',vv(d.fronteira_saida)],['Fronteira de Entrada',vv(d.fronteira_entrada)]);
    const condRows=[
        ['Forma de Pagamento',rot(PDF_PROF_ROTULOS.forma_pagamento,d.forma_pagamento)],
        ['Prazo de Pagamento',rot(PDF_PROF_ROTULOS.prazo_pagamento,d.prazo_pagamento)],
        ['Validade',d.validade_dias ? (/^\d+$/.test(String(d.validade_dias)) ? `${d.validade_dias} dia${String(d.validade_dias)==='1'?'':'s'}` : String(d.validade_dias)) : '—'],
    ];
    const maxBRows=Math.max(emRows.length,deRows.length,rotaRows.length,condRows.length);
    const bandTH=bandHdr+maxBRows*bRH+2, bY=Y;

    [col1,col2,col3,col4].forEach(cx=>{
        doc.setFillColor(...BRANCO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.rect(cx,bY,colW,bandTH,'FD');
        rx(cx,bY,colW,bandHdr,NAVY); rx(cx,bY,3,bandHdr,AZUL_MED);
    });
    sf('bold',6.5,BRANCO);
    doc.text('EXPORTADOR',col1+colW/2,bY+4.8,{align:'center'});
    doc.text('IMPORTADOR',col2+colW/2,bY+4.8,{align:'center'});
    doc.text('ROTA DE EXPORTAÇÃO',col3+colW/2,bY+4.8,{align:'center'});
    doc.text('CONDIÇÕES COMERCIAIS',col4+colW/2,bY+4.8,{align:'center'});

    function bandRow(label, valor, cx, ri) {
        const ry=bY+bandHdr+ri*bRH;
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.1);
        doc.line(cx,ry,cx+colW,ry);
        sf('bold',5.5,CINZA);  doc.text(label.toUpperCase()+':',cx+2,ry+3.2);
        sf('normal',6,PRETO);  doc.text(doc.splitTextToSize(String(valor||'—'),colW-lblBW-3)[0],cx+lblBW,ry+3.2);
    }
    emRows.forEach(([l,v],i)=>bandRow(l,v,col1,i));
    deRows.forEach(([l,v],i)=>bandRow(l,v,col2,i));
    rotaRows.forEach(([l,v],i)=>bandRow(l,v,col3,i));
    condRows.forEach(([l,v],i)=>bandRow(l,v,col4,i));
    Y+=bandTH+4;

    // ── ITENS ─────────────────────────────────
    const itens=d.itens||[];

    // Resolve nome/descrição de cada item no idioma escolhido na Proforma —
    // só pros itens vinculados a um produto cadastrado (produto_id). Itens
    // digitados livremente (sem produto_id) mantêm o texto já salvo.
    const produtoIds = [...new Set(itens.map(i => i.produto_id).filter(Boolean))];
    if (produtoIds.length > 0 && d.idioma && typeof supabaseClient !== 'undefined') {
        try {
            const { data: produtosDados } = await supabaseClient
                .from('produtos').select('id, nomes_idiomas').in('id', produtoIds);
            const mapaIdiomas = {};
            (produtosDados || []).forEach(p => { mapaIdiomas[p.id] = p.nomes_idiomas || []; });
            itens.forEach(item => {
                if (!item.produto_id) return;
                const opcoes = mapaIdiomas[item.produto_id] || [];
                const match = opcoes.find(o =>
                    o.idioma === d.idioma && (d.idioma !== 'outro' || o.idioma_outro === d.idioma_outro));
                if (match) {
                    if (match.nome)      item.produto    = match.nome;
                    if (match.descricao) item.descricao  = match.descricao;
                }
            });
        } catch (e) { /* silêncio — mantém o texto já salvo no item */ }
    }

    if(itens.length>0){
        pg(14); Y+=4;
        rx(ML,Y,3,6,AZUL); rx(ML+3,Y,W-ML*2-3,6,AZUL_CLARO);
        sf('bold',7.5,AZUL); doc.text('ITENS DA PROFORMA',ML+7,Y+4.2); Y+=9;

        // Colunas (total usável = 269mm)
        const CodW=16, ProdW=30, HsW=15, NcmW=18, FabW=24, MarcaW=18, CompW=30, VolW=16, QtdW=13, VlrW=26;
        const xCod=ML, xProd=xCod+CodW, xHs=xProd+ProdW, xNcm=xHs+HsW,
              xFab=xNcm+NcmW, xMarca=xFab+FabW, xComp=xMarca+MarcaW,
              xVol=xComp+CompW, xQtd=xVol+VolW, xVlr=xQtd+QtdW, xTot=xVlr+VlrW;

        function cabI(){
            rx(ML,Y,W-ML*2,8,NAVY); sf('bold',5.5,BRANCO);
            doc.text('CÓDIGO',xCod+2,Y+5.5);
            doc.text('DESCRIÇÃO DO PRODUTO',xProd+2,Y+5.5);
            doc.text('HS CODE',xHs+2,Y+5.5);
            doc.text('NCM',xNcm+2,Y+5.5);
            doc.text('FABRICANTE',xFab+2,Y+5.5);
            doc.text('MARCA',xMarca+2,Y+5.5);
            doc.text('COMPOSIÇÃO',xComp+2,Y+5.5);
            doc.text('VOL./PESO',xVol+2,Y+5.5);
            doc.text('QTD',xQtd+QtdW-1,Y+5.5,{align:'right'});
            doc.text('VALOR UNIT.',xVlr+2,Y+5.5);
            doc.text('TOTAL',MR-2,Y+5.5,{align:'right'});
            Y+=9;
        }
        cabI();
        let tot=0, pag=doc.getNumberOfPages();
        itens.forEach((item,i)=>{
            const prodL=doc.splitTextToSize(item.produto||'—',ProdW-3);
            const compL=(item.composicao||item.descricao)?doc.splitTextToSize(item.composicao||item.descricao,CompW-3):[];
            const fabL=item.fabricante?doc.splitTextToSize(item.fabricante,FabW-3):[];
            const rH=Math.max(10,Math.max(prodL.length,compL.length,fabL.length,1)*4.2+3.5);
            pg(rH+2); if(doc.getNumberOfPages()>pag){pag=doc.getNumberOfPages();cabI();}
            rx(ML,Y,W-ML*2,rH,i%2===0?CINZA_BG:BRANCO);
            doc.setDrawColor(...BORDA); doc.setLineWidth(0.15); doc.line(ML,Y+rH,MR,Y+rH);
            [xProd,xHs,xNcm,xFab,xMarca,xComp,xVol,xQtd,xVlr,xTot].forEach(cx=>lv(cx,Y,Y+rH));
            const t=(item.qtd||0)*(item.preco||0); tot+=t;
            const tY=Y+3.8;
            sf('bold',6,AZUL);   doc.text(doc.splitTextToSize(item.sku||item.codigo||'—',CodW-3)[0],xCod+2,tY);
            sf('normal',6,PRETO); prodL.forEach((ln,li)=>doc.text(ln,xProd+2,tY+li*4.2));
            sf('normal',5.5,CINZA); doc.text(vv(item.hs_code),xHs+2,tY);
            doc.text(vv(item.ncm),xNcm+2,tY);
            fabL.forEach((ln,li)=>doc.text(ln,xFab+2,tY+li*4.2));
            doc.text(vv(item.marca),xMarca+2,tY);
            sf('normal',5.5,CINZA); compL.forEach((ln,li)=>doc.text(ln,xComp+2,tY+li*4.2));
            doc.text(vv(item.volume_peso||item.volume||item.peso),xVol+2,tY);
            sf('bold',6.5,PRETO); doc.text(String(item.qtd||0),xQtd+QtdW-2,tY,{align:'right'});
            sf('normal',6,PRETO); doc.text((item.preco||0).toLocaleString('pt-BR',{minimumFractionDigits:2}),xVlr+2,tY);
            sf('bold',7,PRETO);  doc.text(t.toLocaleString('pt-BR',{minimumFractionDigits:2}),MR-2,tY,{align:'right'});
            Y+=rH;
        });
        // Total geral
        pg(10); rx(ML,Y,W-ML*2,9,NAVY);
        sf('bold',7,[160,190,240]); doc.text('TOTAL GERAL',ML+2,Y+6);
        sf('normal',7,[160,190,240]); doc.text(moedaProforma,xVlr+2,Y+6);
        sf('bold',10,BRANCO); doc.text(tot.toLocaleString('pt-BR',{minimumFractionDigits:2}),MR-2,Y+6.5,{align:'right'});
        Y+=14;

        // ── LOGÍSTICA ─────────────────────────
        pg(24);
        doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.line(ML,Y,MR,Y);
        sf('bold',7,CINZA); doc.text('LOGÍSTICA',ML,Y-1.5);
        Y+=5;
        [['Volume Total',vv(d.volume_total)],['Peso Líquido',vv(d.peso_liquido)],['Peso Bruto',vv(d.peso_bruto)]
        ].forEach(([lbl,val])=>{
            sf('bold',6,CINZA); doc.text(lbl.toUpperCase()+':',ML,Y);
            sf('normal',8,PRETO); doc.text(val,ML+36,Y);
            Y+=5;
        });
        Y+=4;

        // ── ASSINATURAS ───────────────────────
        pg(36);
        Y+=10;
        const sigLW=(W-ML*2-30)/2, sigRX=ML+sigLW+30;
        const emLocal=(vv(d.cidade)!=='—'?vv(d.cidade)+', ':'')+dataGeracao;
        const deLocal=(vv(d.destinatario_cidade)!=='—'?vv(d.destinatario_cidade)+', ':'')+dataGeracao;

        const emCX=ML+sigLW/2, deCX=sigRX+sigLW/2;
        doc.setDrawColor(...CINZA); doc.setLineWidth(0.3);
        doc.line(ML,Y,ML+sigLW,Y); doc.line(sigRX,Y,sigRX+sigLW,Y);
        Y+=4;
        sf('bold',6,PRETO);
        doc.text(vv(d.empresa_nome||d.razao_social),emCX,Y,{align:'center'});
        doc.text(vv(d.destinatario_razao_social),deCX,Y,{align:'center'});
        Y+=4;
        sf('normal',6,CINZA);
        doc.text('Assinatura do Responsável',emCX,Y,{align:'center'});
        doc.text('Assinatura do Responsável',deCX,Y,{align:'center'});
        Y+=4;
        doc.text(emLocal,emCX,Y,{align:'center'});
        doc.text(deLocal,deCX,Y,{align:'center'});
        Y+=10;
    }

    // ── OBSERVAÇÕES ───────────────────────────
    if(d.observacoes||d.obs_status){
        pg(14); Y+=4;
        rx(ML,Y,3,6,AZUL); rx(ML+3,Y,W-ML*2-3,6,AZUL_CLARO);
        sf('bold',7.5,AZUL); doc.text('OBSERVAÇÕES',ML+7,Y+4.2); Y+=9;
        [[d.observacoes,'Observações Gerais'],[d.obs_status,'Observações de Status']].forEach(([txt,tit])=>{
            if(!txt)return; pg(14);
            sf('bold',7,CINZA); doc.text(tit.toUpperCase(),ML+3,Y); Y+=4;
            sf('normal',8,PRETO);
            const ls=doc.splitTextToSize(txt,W-ML*2-6); pg(ls.length*5+4); doc.text(ls,ML+3,Y); Y+=ls.length*5+4;
        });
    }

    // ── RODAPÉ (20mm) ─────────────────────────
    const nPags=doc.getNumberOfPages();
    for(let p=1;p<=nPags;p++){
        doc.setPage(p); rx(0,190,W,20,NAVY); rx(0,190,4,20,AZUL_MED);
        sf('bold',8,BRANCO); doc.text('MARPEX',ML+3,198);
        sf('normal',7,[160,190,240]); doc.text('Gestão de Comércio Exterior',ML+3,205);
        sf('normal',7,[160,190,240]); doc.text(`Página ${p} de ${nPags}`,W/2,202,{align:'center'});
        sf('normal',7,[160,190,240]); doc.text(dataGeracao,W-ML,202,{align:'right'});
    }

    if (opcoes.retornarBlob) return doc.output('blob');
    doc.save(`proforma_${codigo}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ========================================
// ANEXO AUTOMÁTICO — "Nº Proforma Invoice"
// ========================================
// O PDF da Proforma é gerado pelo próprio sistema, então ele mesmo anexa o
// arquivo ao documento "Nº Proforma Invoice" (tela Documentos), registrando
// quem criou e quando. Nunca sobrescreve um arquivo enviado pelo usuário nem
// um documento já assinado — só substitui a versão anterior gerada pelo sistema.
const PDF_PROFORMA_PREFIXO_SISTEMA = 'proforma_sistema_';

async function anexarPDFProformaAutomatico(d, registroAtual) {
    if (!d?.id) return null;
    try {
        if (registroAtual === undefined) {
            const { data } = await supabaseClient.from('proforma_documentos')
                .select('*').eq('proforma_id', d.id).eq('tipo_documento', 'proforma').maybeSingle();
            registroAtual = data || null;
        }
        const anterior = registroAtual?.arquivo_path || '';
        const doSistema = anterior.split('/').pop().startsWith(PDF_PROFORMA_PREFIXO_SISTEMA);
        if (registroAtual?.assinado || (anterior && !doSistema)) return null;

        const blob = await gerarPDFProformaDados(d, { retornarBlob: true });
        if (!blob) return null;
        const path = `${d.id}/${PDF_PROFORMA_PREFIXO_SISTEMA}${Date.now()}.pdf`;
        const { error } = await supabaseClient.storage.from('proforma-documentos-assinados')
            .upload(path, blob, { contentType: 'application/pdf' });
        if (error) { console.warn('[Proforma] anexo automático:', error.message); return null; }

        const res = await window.supabaseAPI.anexarDocumentoProforma(d.id, 'proforma', null, path, `Proforma_${d.codigo || d.id}.pdf`);
        if (!res.sucesso) { supabaseClient.storage.from('proforma-documentos-assinados').remove([path]).catch(() => {}); return null; }
        if (anterior) supabaseClient.storage.from('proforma-documentos-assinados').remove([anterior]).catch(() => {});
        return res.data;
    } catch (e) {
        console.warn('[Proforma] anexo automático falhou:', e);
        return null;
    }
}
