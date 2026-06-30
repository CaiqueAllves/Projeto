// ========================================
// PROFORMA — JAVASCRIPT
// ========================================

let _profTodos      = [];
let _profExcluirId  = null;
let _profListaAtual = [];

// ── Helpers ──────────────────────────────
function _profFmt(n) {
    return Number(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function _profStatusLabel(status) {
    const map = { enviado: 'Enviado', aprovado: 'Aprovado', pendente: 'Pendente', recusado: 'Recusado' };
    return map[status] || 'Ativo';
}

function _profTipoLabel(tipo) {
    const map = { exportacao_direta: 'Exp. Direta', exportacao_indireta: 'Exp. Indireta' };
    return map[tipo] || tipo || '';
}

function _profModalIcon(modal) {
    return { aereo: 'fa-plane', maritimo: 'fa-ship', terrestre: 'fa-truck' }[modal] || 'fa-route';
}

function _profEmissorNome(p) {
    if (p.emissor_tipo === 'terceiro') {
        return p.parceiro?.nome_fantasia || p.parceiro?.razao_social || '—';
    }
    return '(Própria empresa)';
}

function _profDestinatarioNome(p) {
    if (p.destinatario_emp?.razao_social) {
        return p.destinatario_emp.nome_fantasia || p.destinatario_emp.razao_social;
    }
    return p.destinatario_razao_social || '—';
}

function profAtualizarContadores(lista) {
    const counts = { enviado: 0, aprovado: 0, pendente: 0, recusado: 0 };
    lista.forEach(p => { if (counts[p.status] !== undefined) counts[p.status]++; });
    ['enviado', 'aprovado', 'pendente', 'recusado'].forEach(s => {
        const key   = s.charAt(0).toUpperCase() + s.slice(1);
        const badge = document.getElementById('count' + key);
        const num   = document.getElementById('count' + key + 'Num');
        if (badge) badge.style.display = counts[s] > 0 ? '' : 'none';
        if (num)   num.textContent = counts[s];
    });
}

// ── Lista ─────────────────────────────────
async function profCarregarLista() {
    const container = document.getElementById('listaContainer');
    if (!container) return;
    container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando...</div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('*')
            .neq('status', 'excluido')
            .order('created_at', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        const proformas = data || [];

        const ids = [...new Set([
            ...proformas.map(p => p.parceiro_id).filter(Boolean),
            ...proformas.map(p => p.destinatario_id).filter(Boolean),
        ])];

        let empresaMap = {};
        if (ids.length > 0) {
            const { data: emps } = await supabaseClient
                .from('empresas')
                .select('id, razao_social, nome_fantasia')
                .in('id', ids);
            (emps || []).forEach(e => { empresaMap[e.id] = e; });
        }

        _profTodos = proformas.map(p => ({
            ...p,
            parceiro:         empresaMap[p.parceiro_id]      || null,
            destinatario_emp: empresaMap[p.destinatario_id]  || null,
        }));

        profRenderizarLista(_profTodos);
    } catch (err) {
        container.innerHTML = `<div class="lista-vazia"><i class="fa-solid fa-circle-exclamation"></i> Erro ao carregar: ${err.message}</div>`;
    }
}

function profRenderizarLista(lista) {
    const container = document.getElementById('listaContainer');
    const countEl   = document.getElementById('listaCount');
    if (!container) return;
    _profListaAtual = lista;
    if (countEl) countEl.textContent = `${lista.length} ${lista.length === 1 ? 'proforma' : 'proformas'}`;
    profAtualizarContadores(lista);

    if (!lista.length) {
        container.innerHTML = '<div class="lista-vazia"><i class="fa-solid fa-file-circle-xmark"></i> Nenhuma proforma encontrada.</div>';
        return;
    }

    const rows = lista.map(p => {
        const dataEmis   = p.data_emissao  ? new Date(p.data_emissao  + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const dataVal    = p.data_validade ? new Date(p.data_validade + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
        const modalIco   = _profModalIcon(p.modal);
        const modalLabel = p.modal ? p.modal.charAt(0).toUpperCase() + p.modal.slice(1) : null;
        const status     = p.status || 'enviado';

        const optStatus = ['enviado','aprovado','pendente','recusado'].map(s =>
            `<option value="${s}" ${status === s ? 'selected' : ''}>${_profStatusLabel(s)}</option>`
        ).join('');

        return `
        <tr id="prof-card-${p.id}">
            <td class="prof-col-codigo">
                <span class="prof-card-num">${p.codigo || '—'}</span>
                ${p.tipo ? `<br><span class="prof-tipo-sub">${_profTipoLabel(p.tipo)}</span>` : ''}
            </td>
            <td class="prof-col-rota">
                <span title="${p.origem_pais || ''}">${p.origem_pais || '—'}</span>
                <i class="fa-solid fa-arrow-right prof-rota-arrow"></i>
                <span title="${p.destino_pais || ''}">${p.destino_pais || '—'}</span>
            </td>
            <td>
                <div style="display:flex;flex-direction:column;gap:3px;">
                    ${modalLabel ? `<span class="tag-badge" style="width:fit-content;"><i class="fa-solid ${modalIco}"></i> ${modalLabel}</span>` : '<span class="cell-vazio">—</span>'}
                    ${p.incoterm ? `<span class="tag-badge" style="width:fit-content;">${p.incoterm}</span>` : ''}
                </div>
            </td>
            <td class="cell-nowrap">
                <div style="font-size:12px;color:#374151;">${dataEmis}</div>
                <div style="font-size:11px;color:#94a3b8;">Val: ${dataVal}</div>
            </td>
            <td class="col-acoes">
                <div style="display:flex;align-items:center;gap:6px;">
                    <button class="btn-acao btn-ver" onclick="profVisualizar('${p.id}')" title="Visualizar">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button class="btn-acao btn-pdf" onclick="profGerarPDF('${p.id}')" title="Gerar PDF">
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                    <button class="btn-acao btn-editar" onclick="profEditar('${p.id}')" title="Editar">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-acao btn-excluir" onclick="profAbrirModalExcluir('${p.id}')" title="Excluir">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
            <td>
                <select class="prof-status-select prof-status-${status}"
                        onchange="profAlterarStatus('${p.id}', this)">
                    ${optStatus}
                </select>
            </td>
            <td class="col-gerar-processo">
                ${status === 'aprovado' ? `<button class="btn-seguir-processo" onclick="profSeguirProcesso('${p.id}')">Gerar Processo ?</button>` : ''}
            </td>
        </tr>`;
    }).join('');

    container.innerHTML = `
    <table class="empresa-tabela">
        <thead>
            <tr>
                <th>Código</th>
                <th>Rota</th>
                <th>Modal / Incoterm</th>
                <th>Data</th>
                <th class="col-acoes">Ações</th>
                <th>Status</th>
                <th class="col-gerar-processo"></th>
            </tr>
        </thead>
        <tbody>${rows}</tbody>
    </table>`;
}

// ── Alterar status rápido ─────────────────
async function profAlterarStatus(id, selectEl) {
    const novoStatus  = selectEl.value;
    const statusAntes = _profTodos.find(x => x.id === id)?.status || 'enviado';

    selectEl.className = `prof-status-select prof-status-${novoStatus}`;
    selectEl.disabled  = true;

    try {
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: novoStatus })
            .eq('id', id);
        if (error) throw error;

        const p = _profTodos.find(x => x.id === id);
        if (p) p.status = novoStatus;
        profAtualizarContadores(_profListaAtual);

        const row = document.getElementById(`prof-card-${id}`);
        if (row) {
            const gerarCell = row.querySelector('.col-gerar-processo');
            const btnExiste = row.querySelector('.btn-seguir-processo');
            if (novoStatus === 'aprovado' && !btnExiste && gerarCell) {
                const btn = document.createElement('button');
                btn.className = 'btn-seguir-processo';
                btn.textContent = 'Gerar Processo ?';
                btn.onclick = () => profSeguirProcesso(id);
                gerarCell.appendChild(btn);
            } else if (novoStatus !== 'aprovado' && btnExiste) {
                btnExiste.remove();
            }
        }
    } catch (err) {
        alert('Erro ao atualizar status: ' + err.message);
        selectEl.value     = statusAntes;
        selectEl.className = `prof-status-select prof-status-${statusAntes}`;
    } finally {
        selectEl.disabled = false;
    }
}

// ── Filtro ────────────────────────────────
function profFiltrar() {
    const q = (document.getElementById('filtroProformas')?.value.trim().toLowerCase()) || '';
    const s = document.getElementById('filtroStatus')?.value || '';

    let lista = _profTodos;
    if (s) lista = lista.filter(p => (p.status || 'enviado') === s);
    if (q) lista = lista.filter(p =>
        (p.codigo        || '').toLowerCase().includes(q) ||
        (p.origem_pais   || '').toLowerCase().includes(q) ||
        (p.destino_pais  || '').toLowerCase().includes(q) ||
        (p.tipo          || '').toLowerCase().includes(q) ||
        (p.incoterm      || '').toLowerCase().includes(q) ||
        (_profEmissorNome(p)    ).toLowerCase().includes(q) ||
        (_profDestinatarioNome(p)).toLowerCase().includes(q)
    );

    profRenderizarLista(lista);
}

// ── Editar ────────────────────────────────
function profEditar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}`, '_blank');
}

function profVisualizar(id) {
    window.open(`formularios.html?tab=proposta&id=${id}&modo=visualizar`, '_blank');
}

async function profGerarPDF(id) {
    const btn = event?.currentTarget;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; }
    try {
        const res = await window.supabaseAPI.buscarProforma(id);
        if (!res.sucesso || !res.data) { mostrarNotificacao('Proforma não encontrada.', 'erro'); return; }
        await _profGerarPDFDados(res.data);
    } catch (e) {
        mostrarNotificacao('Erro ao gerar PDF.', 'erro');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-file-pdf"></i> PDF'; }
    }
}

async function _profGerarPDFDados(d) {
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
    const moedaProforma = d.moeda || (d.itens && d.itens.length > 0 ? d.itens[0].moeda : null) || '—';

    // ── CABEÇALHO (20mm) ─────────────────────
    rx(0,0,W,20,NAVY); rx(0,0,4,20,AZUL_MED);
    sf('bold',13,BRANCO); doc.text('MARPEX',ML+3,8.5);
    sf('normal',6.5,[160,190,240]); doc.text('Gestão de Comércio Exterior',ML+3,14);
    sf('bold',11,BRANCO); doc.text('PROFORMA INVOICE',W-ML,8.5,{align:'right'});
    sf('normal',8,[160,190,240]); doc.text(codigo,W-ML,14,{align:'right'});
    sf('normal',6,[120,160,220]); doc.text('Gerado em: '+dataGeracao,W-ML,17.5,{align:'right'});
    Y=23;

    // ── BARRA INFO (6 campos, 10mm) ──────────
    doc.setFillColor(...CINZA_BG); doc.setDrawColor(...BORDA); doc.setLineWidth(0.3);
    doc.rect(ML,Y,W-ML*2,10,'FD');
    const cw6=(W-ML*2)/6;
    for(let i=1;i<=5;i++){doc.setDrawColor(...BORDA);doc.setLineWidth(0.2);doc.line(ML+cw6*i,Y+1.5,ML+cw6*i,Y+8.5);}
    [{label:'Tipo',valor:vv(d.tipo)},{label:'Propósito',valor:vv(d.proposito)},{label:'Modal',valor:modalTxt},
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
        ['Forma de Pagamento',vv(d.forma_pagamento)],
        ['Prazo de Pagamento',vv(d.prazo_pagamento)],
        ['Validade',vv(d.validade_dias)],
    ];
    const maxBRows=Math.max(emRows.length,deRows.length,rotaRows.length,condRows.length);
    const bandTH=bandHdr+maxBRows*bRH+2, bY=Y;

    [col1,col2,col3,col4].forEach(cx=>{
        doc.setFillColor(...BRANCO); doc.setDrawColor(...BORDA); doc.setLineWidth(0.25);
        doc.rect(cx,bY,colW,bandTH,'FD');
        rx(cx,bY,colW,bandHdr,NAVY); rx(cx,bY,3,bandHdr,AZUL_MED);
    });
    sf('bold',6.5,BRANCO);
    doc.text('EMISSOR',col1+colW/2,bY+4.8,{align:'center'});
    doc.text('DESTINATÁRIO',col2+colW/2,bY+4.8,{align:'center'});
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
    if(itens.length>0){
        pg(14); Y+=4;
        rx(ML,Y,3,6,AZUL); rx(ML+3,Y,W-ML*2-3,6,AZUL_CLARO);
        sf('bold',7.5,AZUL); doc.text('ITENS DA PROFORMA',ML+7,Y+4.2); Y+=9;

        // Colunas (total usável = 269mm)
        const CodW=16, ProdW=30, HsW=15, PaisOW=18, FabW=24, MarcaW=18, CompW=30, VolW=16, QtdW=13, VlrW=26;
        const xCod=ML, xProd=xCod+CodW, xHs=xProd+ProdW, xPaisO=xHs+HsW,
              xFab=xPaisO+PaisOW, xMarca=xFab+FabW, xComp=xMarca+MarcaW,
              xVol=xComp+CompW, xQtd=xVol+VolW, xVlr=xQtd+QtdW, xTot=xVlr+VlrW;

        function cabI(){
            rx(ML,Y,W-ML*2,8,NAVY); sf('bold',5.5,BRANCO);
            doc.text('CÓDIGO',xCod+2,Y+5.5);
            doc.text('PRODUTO',xProd+2,Y+5.5);
            doc.text('HS CODE',xHs+2,Y+5.5);
            doc.text('PAÍS ORIG.',xPaisO+2,Y+5.5);
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
            [xProd,xHs,xPaisO,xFab,xMarca,xComp,xVol,xQtd,xVlr,xTot].forEach(cx=>lv(cx,Y,Y+rH));
            const t=(item.qtd||0)*(item.preco||0); tot+=t;
            const tY=Y+3.8;
            sf('bold',6,AZUL);   doc.text(doc.splitTextToSize(item.sku||item.codigo||'—',CodW-3)[0],xCod+2,tY);
            sf('normal',6,PRETO); prodL.forEach((ln,li)=>doc.text(ln,xProd+2,tY+li*4.2));
            sf('normal',5.5,CINZA); doc.text(vv(item.hs_code||item.ncm),xHs+2,tY);
            doc.text(vv(item.pais_origem),xPaisO+2,tY);
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

    doc.save(`proforma_${codigo}_${new Date().toISOString().slice(0,10)}.pdf`);
}

// ── Seguir com Processo ───────────────────
function profSeguirProcesso(id) {
    window.open(`formularios.html?tab=processo&proforma_id=${id}`, '_blank');
}

// ── Excluir (soft delete) ─────────────────
function profAbrirModalExcluir(id) {
    _profExcluirId = id;
    const p    = _profTodos.find(x => x.id === id);
    const info = document.getElementById('excluirProformaInfo');
    if (info && p) {
        info.innerHTML = `
            <strong>${p.codigo || '—'}</strong><br>
            <span style="font-size:13px;color:#6b7280;">
                ${_profEmissorNome(p)} → ${_profDestinatarioNome(p)}
            </span>`;
    }
    document.getElementById('modalExcluirProforma').style.display = 'flex';
}

function profFecharModalExcluir() {
    document.getElementById('modalExcluirProforma').style.display = 'none';
    _profExcluirId = null;
}

async function profConfirmarExcluir() {
    if (!_profExcluirId) return;
    const btn = document.getElementById('btnConfirmarExcluirProforma');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Excluindo...'; }
    try {
        const usuario = obterUsuarioLogado();
        const { error } = await supabaseClient
            .from('proformas')
            .update({
                status:      'excluido',
                excluido_em: new Date().toISOString(),
                excluido_por: usuario?.nome || usuario?.email || 'Desconhecido',
            })
            .eq('id', _profExcluirId);
        if (error) throw error;
        profFecharModalExcluir();
        await profCarregarLista();
    } catch (err) {
        alert('Erro ao excluir: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Excluir'; }
    }
}

// ── Painel Excluídos ──────────────────────
let _profExcluidosAberto = false;

async function profToggleExcluidos() {
    const panel = document.getElementById('profExcluidosPanel');
    if (!panel) return;

    _profExcluidosAberto = !_profExcluidosAberto;
    panel.classList.toggle('aberto', _profExcluidosAberto);

    if (_profExcluidosAberto) await profCarregarExcluidos();
}

async function profCarregarExcluidos() {
    const container = document.getElementById('profExcluidosContainer');
    if (!container) return;
    container.innerHTML = '<div style="padding:16px;text-align:center;color:#94a3b8;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';

    try {
        const usuario = obterUsuarioLogado();
        let query = supabaseClient
            .from('proformas')
            .select('id, codigo, origem_pais, destino_pais, excluido_em, excluido_por')
            .eq('status', 'excluido')
            .order('excluido_em', { ascending: false });
        if (usuario?.empresa_id) query = query.eq('empresa_id', usuario.empresa_id);

        const { data, error } = await query;
        if (error) throw error;

        if (!data?.length) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#94a3b8;font-size:13px;">Nenhuma proforma excluída.</div>';
            return;
        }

        const agora = Date.now();
        container.innerHTML = data.map(p => {
            let metaHtml = '';
            if (p.excluido_em) {
                const exclMs   = new Date(p.excluido_em).getTime();
                const diasPassados = Math.floor((agora - exclMs) / 86400000);
                const diasRestantes = 7 - diasPassados;
                const dataFmt  = new Date(p.excluido_em).toLocaleDateString('pt-BR');
                const corDias  = diasRestantes <= 2 ? '#dc2626' : '#94a3b8';
                metaHtml = `
                    <span class="prof-excluido-rota">
                        <i class="fa-solid fa-calendar-xmark" style="font-size:10px;"></i> ${dataFmt}
                        ${p.excluido_por ? `· ${p.excluido_por}` : ''}
                    </span>
                    <span class="prof-excluido-rota" style="color:${corDias};">
                        <i class="fa-solid fa-clock" style="font-size:10px;"></i>
                        ${diasRestantes > 0 ? `${diasRestantes} dia${diasRestantes !== 1 ? 's' : ''} restante${diasRestantes !== 1 ? 's' : ''}` : 'Expira hoje'}
                    </span>`;
            }
            return `
            <div class="prof-excluido-item">
                <div class="prof-excluido-info">
                    <span class="prof-excluido-codigo">${p.codigo || '—'}</span>
                    <span class="prof-excluido-rota">${p.origem_pais || '—'} → ${p.destino_pais || '—'}</span>
                    ${metaHtml}
                </div>
                <button class="prof-excluido-restaurar" onclick="profRestaurar('${p.id}')">
                    <i class="fa-solid fa-rotate-left"></i> Restaurar
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        container.innerHTML = `<div style="padding:16px;color:#dc2626;font-size:13px;">Erro: ${err.message}</div>`;
    }
}

async function profRestaurar(id) {
    try {
        const { error } = await supabaseClient
            .from('proformas')
            .update({ status: 'enviado' })
            .eq('id', id);
        if (error) throw error;
        await profCarregarExcluidos();
        await profCarregarLista();
    } catch (err) {
        alert('Erro ao restaurar: ' + err.message);
    }
}

// Fechar painel ao clicar fora
document.addEventListener('click', function(e) {
    if (_profExcluidosAberto && !e.target.closest('#profExcluidosWrapper')) {
        _profExcluidosAberto = false;
        document.getElementById('profExcluidosPanel')?.classList.remove('aberto');
    }
});

// ── Init ──────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const usuario = obterUsuarioLogado();
    if (!usuario) { window.location.href = 'login.html'; return; }

    const nameEl  = document.getElementById('displayUsername');
    const emailEl = document.getElementById('userEmail');
    const iconEl  = document.getElementById('topbarAvatarIcon');
    const imgEl   = document.getElementById('topbarAvatarImg');
    if (nameEl)  nameEl.textContent  = usuario.nome  || usuario.email || '—';
    if (emailEl) emailEl.textContent = usuario.email || '—';
    if (usuario.avatar_url && imgEl && iconEl) {
        imgEl.src            = usuario.avatar_url;
        imgEl.style.display  = 'block';
        iconEl.style.display = 'none';
    }

    document.getElementById('btnConfirmarExcluirProforma')?.addEventListener('click', profConfirmarExcluir);

    await profCarregarLista();
});
