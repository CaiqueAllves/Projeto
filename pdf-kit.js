// ========================================
// PDF KIT — partes comuns dos PDFs do sistema
// ========================================
// Cabeçalho e rodapé (A4 paisagem, faixa NAVY) usados por pdf-proforma.js,
// pdf-processo.js e pdf-documentos.js — antes cada um tinha a sua cópia.
// Mudou o visual aqui, muda nos três.

const PDF_CORES = {
    NAVY: [10, 40, 90], AZUL: [30, 86, 160], AZUL_MED: [59, 130, 246], AZUL_CLARO: [219, 234, 254],
    CINZA: [100, 116, 139], CINZA_BG: [248, 250, 252], BORDA: [209, 219, 234],
    PRETO: [15, 23, 42], BRANCO: [255, 255, 255], CLARO: [160, 190, 240], CLARO2: [120, 160, 220],
};

function _pdfFaixa(doc, y, altura) {
    const W = doc.internal.pageSize.getWidth();
    doc.setFillColor(...PDF_CORES.NAVY); doc.setDrawColor(...PDF_CORES.NAVY); doc.rect(0, y, W, altura, 'F');
    doc.setFillColor(...PDF_CORES.AZUL_MED); doc.setDrawColor(...PDF_CORES.AZUL_MED); doc.rect(0, y, 4, altura, 'F');
}

function _pdfTexto(doc, estilo, tamanho, cor, texto, x, y, opcoes) {
    doc.setFont('helvetica', estilo); doc.setFontSize(tamanho); doc.setTextColor(...cor);
    doc.text(texto, x, y, opcoes);
}

// Cabeçalho de 20mm: marca à esquerda (+ "Criado por"), título/número/data à direita.
// Devolve a posição Y onde o conteúdo começa.
// emissor: { nome, documento, logo } — documentos que vão para o cliente /
// aduana (Proforma, Commercial Invoice, Packing List) levam a identidade do
// EXPORTADOR no lugar da marca Marpex (que vai para o rodapé, discreta) e
// não mostram "Criado por" (informação interna). logo = pdfCarregarImagem().
function pdfCabecalho(doc, { titulo, numero, criadoPor, dataGeracao, ML = 14, t = PDF_IDIOMAS.pt, emissor = null }) {
    const W = doc.internal.pageSize.getWidth();
    _pdfFaixa(doc, 0, 20);
    if (emissor) {
        let x = ML + 3;
        if (emissor.logo) {
            // caixa branca para o logo aparecer sobre o fundo escuro
            const h = 14, pad = 1.2;
            const w = Math.min(46, Math.max(14, (h - pad * 2) * emissor.logo.razao + pad * 2));
            doc.setFillColor(...PDF_CORES.BRANCO); doc.roundedRect(x, 3, w, h, 1.5, 1.5, 'F');
            const iw = Math.min(w - pad * 2, (h - pad * 2) * emissor.logo.razao), ih = iw / emissor.logo.razao;
            try { doc.addImage(emissor.logo.dataUrl, 'PNG', x + (w - iw) / 2, 3 + (h - ih) / 2, iw, ih, undefined, 'FAST'); } catch (_) { /* imagem inválida: fica só a caixa */ }
            x += w + 4;
        }
        const largura = W / 2 - x;
        _pdfTexto(doc, 'bold', 11, PDF_CORES.BRANCO, doc.setFontSize(11).splitTextToSize(emissor.nome || '—', largura)[0], x, 9);
        if (emissor.documento) _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, `${t.identificacao}: ${emissor.documento}`, x, 14);
        if (emissor.linha) _pdfTexto(doc, 'normal', 6, PDF_CORES.CLARO2, doc.setFontSize(6).splitTextToSize(emissor.linha, largura)[0], x, 17.8);
    } else {
        _pdfTexto(doc, 'bold', 13, PDF_CORES.BRANCO, 'MARPEX', ML + 3, 8.5);
        _pdfTexto(doc, 'normal', 6.5, PDF_CORES.CLARO, t.tagline, ML + 3, 13);
        _pdfTexto(doc, 'normal', 6, PDF_CORES.CLARO2, `${t.criado_por}: ` + (criadoPor || '—'), ML + 3, 17.5);
    }
    _pdfTexto(doc, 'bold', 11, PDF_CORES.BRANCO, titulo, W - ML, 8.5, { align: 'right' });
    _pdfTexto(doc, 'normal', 8, PDF_CORES.CLARO, numero || '', W - ML, 14, { align: 'right' });
    _pdfTexto(doc, 'normal', 6, PDF_CORES.CLARO2, `${t.gerado_em}: ` + dataGeracao, W - ML, 17.5, { align: 'right' });
    return 23;
}

// Rodapé de 20mm em todas as páginas: marca, "Página X de N" e um texto à direita.
// discreto: rodapé dos documentos externos — só "Documento gerado pelo Marpex"
function pdfRodape(doc, { textoDireita = '', ML = 14, t = PDF_IDIOMAS.pt, discreto = false } = {}) {
    const W = doc.internal.pageSize.getWidth();
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        if (discreto) {
            // faixa fina de 10mm (y=200): sobra espaço para o conteúdo
            _pdfFaixa(doc, 200, 10);
            _pdfTexto(doc, 'normal', 6.5, PDF_CORES.CLARO, t.gerado_com, ML + 3, 206);
            _pdfTexto(doc, 'normal', 6.5, PDF_CORES.CLARO, t.pagina(p, n), W / 2, 206, { align: 'center' });
            _pdfTexto(doc, 'normal', 6.5, PDF_CORES.CLARO, textoDireita, W - ML, 206, { align: 'right' });
            continue;
        } else {
            _pdfFaixa(doc, 190, 20);
            _pdfTexto(doc, 'bold', 8, PDF_CORES.BRANCO, 'MARPEX', ML + 3, 198);
            _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, t.tagline, ML + 3, 205);
        }
        _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, t.pagina(p, n), W / 2, 202, { align: 'center' });
        _pdfTexto(doc, 'normal', 7, PDF_CORES.CLARO, textoDireita, W - ML, 202, { align: 'right' });
    }
}

// ========================================
// IDIOMAS dos documentos (Proforma, Commercial Invoice, Packing List)
// ========================================
// Saem no idioma escolhido na Proforma (proformas.idioma). A fonte padrão do
// jsPDF (Helvetica) não tem caracteres chineses: Chinês e "Outro" saem em inglês.
// O PDF do Processo é interno e continua em português.
const _PDF_FORMAS_PAG = ['dinheiro', 'cheque', 'cartao-credito', 'cartao-debito', 'duplicata', 'boleto', 'deposito', 'swift', 'cad',
    '30-advanced', '70-against-document', 'sem-pagamento', 'pagamento-posterior', 'outros'];
const _pdfMapa = (chaves, valores) => Object.fromEntries(chaves.map((k, i) => [k, valores[i]]));

const PDF_IDIOMAS = {
    pt: {
        _locale: 'pt-BR',
        itens: 'ITENS', valida_ate: 'Válida até', incoterm_rot: 'Incoterm® 2020', origem: 'Origem', destino: 'Destino',
        previsao_embarque: 'Previsão de embarque', forma: 'Forma', prazo: 'Prazo', validade_proposta: 'Validade da proposta',
        condicoes_pagamento: 'CONDIÇÕES DE PAGAMENTO', contato: 'Contato', subtotal: 'Subtotal', frete: 'Frete', seguro: 'Seguro',
        cubagem: 'Cubagem', volumes_rot: 'Volumes', pecas_rot: 'Peças', total_extenso: 'Total por extenso',
        assinatura_aceite: 'Importador — De acordo (aceite da proposta)', assinatura_aceite_comprador: 'Comprador — De acordo (aceite da proposta)', declaracao_ci: 'Declaramos que as informações desta fatura são verdadeiras e corretas e que as mercadorias descritas são originárias do país indicado.',
        col_volumes: 'VOLUMES', col_peso_liq: 'PESO LÍQ. (KG)', col_peso_bruto: 'PESO BRUTO (KG)', pais_origem_merc: 'País de origem das mercadorias',
        dados_bancarios: 'DADOS BANCÁRIOS', beneficiario: 'Beneficiário', banco: 'Banco', agencia: 'Agência', conta: 'Conta', swift: 'SWIFT / BIC', iban: 'IBAN', endereco_banco: 'Endereço do Banco', gerado_com: 'Documento gerado pelo Marpex', tagline: 'Gestão de Comércio Exterior', criado_por: 'Criado por', gerado_em: 'Gerado em',
        pagina: (p, n) => `Página ${p} de ${n}`,
        proforma_invoice: 'PROFORMA INVOICE', commercial_invoice: 'COMMERCIAL INVOICE', packing_list: 'PACKING LIST',
        tipo: 'Tipo', proposito: 'Propósito', modal: 'Modal', incoterm: 'Incoterm', moeda: 'Moeda', emissao: 'Emissão',
        data: 'Data', processo: 'Processo', proforma: 'Proforma',
        exportador: 'EXPORTADOR', importador: 'IMPORTADOR', comprador: 'COMPRADOR (TRADING)', vendedor: 'VENDEDOR', importador_final: 'Importador final', operacao: 'Operação', fim_especifico: 'Venda com fim específico de exportação', rota: 'ROTA DE EXPORTAÇÃO', condicoes: 'CONDIÇÕES COMERCIAIS', embarque: 'EMBARQUE',
        nome_empresa: 'Nome da Empresa', empresa: 'Empresa', identificacao: 'Identificação', identificacao_fiscal: 'Identificação Fiscal',
        endereco: 'Endereço', cidade: 'Cidade', estado: 'Estado', cep: 'CEP', pais: 'País', pais_origem: 'País de Origem', pais_destino: 'País de Destino',
        porto_origem: 'Porto de Origem', porto_destino: 'Porto de Destino', aeroporto_origem: 'Aeroporto de Origem', aeroporto_destino: 'Aeroporto de Destino',
        fronteira_saida: 'Fronteira de Saída', fronteira_entrada: 'Fronteira de Entrada',
        forma_pagamento: 'Forma de Pagamento', prazo_pagamento: 'Prazo de Pagamento', pagamento: 'Pagamento', validade: 'Validade',
        dias: n => `${n} dia${Number(n) === 1 ? '' : 's'}`, data_embarque: 'Embarque', container: 'Container',
        itens_proforma: 'ITENS DA PROFORMA', mercadorias: 'MERCADORIAS', volumes_pesos: 'VOLUMES E PESOS',
        col_codigo: 'CÓDIGO', col_descricao: 'DESCRIÇÃO DO PRODUTO', col_hs: 'HS CODE', col_ncm: 'NCM', col_fabricante: 'FABRICANTE',
        col_gtin: 'GTIN', col_lote: 'LOTE', col_fabricacao: 'FABRICAÇÃO', col_validade: 'VALIDADE', col_marca: 'MARCA', col_composicao: 'COMPOSIÇÃO', col_volpeso: 'VOL./PESO', col_qtd: 'QTD', col_valor_unit: 'VALOR UNIT.', col_total: 'TOTAL',
        col_produto: 'PRODUTO', col_ncm_hs: 'NCM / HS', col_un: 'UN.', col_preco_unit: 'PREÇO UNIT.', col_sku: 'CÓDIGO SKU',
        col_marcacao: 'MARCAÇÃO / NUMERAÇÃO', col_tipo_emb: 'TIPO DE EMBALAGEM', col_qtd_pecas: 'QTD. DE PEÇAS',
        col_peso_liq_unit: 'PESO LÍQ. UNIT. (KG)', col_peso_bruto_unit: 'PESO BRUTO UNIT. (KG)', col_dimensoes: 'DIMENSÕES (CM)',
        total_geral: 'TOTAL GERAL', totais: 'TOTAIS', logistica: 'LOGÍSTICA', volume_total: 'Volume total', peso_liquido: 'Peso líquido', peso_bruto: 'Peso bruto',
        volumes: n => `${n} volume${Number(n) === 1 ? '' : 's'}`, vol_abrev: 'vol.', pecas: 'peças',
        caixa: n => `Caixa ${n}`, caixas: (a, b) => `Caixas ${a} a ${b}`,
        assinatura_responsavel: 'Assinatura do Responsável', assinatura_exportador: 'Exportador — Assinatura do Responsável',
        assinatura_importador: 'Importador — Assinatura do Responsável', assinatura_vendedor: 'Vendedor — Assinatura do Responsável',
        observacoes: 'OBSERVAÇÕES', obs_gerais: 'Observações Gerais', obs_status: 'Observações de Status',
        nenhum_produto: 'Nenhum produto cadastrado neste processo.', atencao: 'Atenção',
        aviso_sem_embalagem: n => `${n} produto(s) sem embalagem de transporte (caixa) cadastrada — marcação, pesos e dimensões não calculados. Cadastre em Produtos › Logística.`,
        v_tipo: { exportacao_direta: 'Exportação Direta', exportacao_indireta: 'Exportação Indireta' },
        v_proposito: { vendas: 'Vendas', amostra: 'Amostra', troca: 'Troca', doacao: 'Doação', conserto: 'Conserto / Reparo', retorno: 'Retorno', exposicao: 'Exposição / Feira' },
        v_modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
        v_forma_pagamento: _pdfMapa(_PDF_FORMAS_PAG, ['Dinheiro', 'Cheque', 'Cartão de Crédito', 'Cartão de Débito', 'Duplicata Mercantil', 'Boleto Bancário',
            'Depósito Bancário', 'SWIFT', 'CAD', '30% ADVANCED', '70% AGAINST DOCUMENT', 'Sem Pagamento', 'Pagamento Posterior', 'Outros']),
        a_vista: 'À Vista',
    },
    en: {
        _locale: 'en-GB',
        itens: 'ITEMS', valida_ate: 'Valid until', incoterm_rot: 'Incoterm® 2020', origem: 'Origin', destino: 'Destination',
        previsao_embarque: 'Estimated shipment', forma: 'Method', prazo: 'Terms', validade_proposta: 'Offer validity',
        condicoes_pagamento: 'PAYMENT TERMS', contato: 'Contact', subtotal: 'Subtotal', frete: 'Freight', seguro: 'Insurance',
        cubagem: 'Volume (m³)', volumes_rot: 'Packages', pecas_rot: 'Pieces', total_extenso: 'Amount in words',
        assinatura_aceite: 'Importer — Agreed (acceptance of the offer)', assinatura_aceite_comprador: 'Buyer — Agreed (acceptance of the offer)', declaracao_ci: 'We hereby certify that the information in this invoice is true and correct and that the goods described are of the origin indicated.',
        col_volumes: 'PACKAGES', col_peso_liq: 'NET WT. (KG)', col_peso_bruto: 'GROSS WT. (KG)', pais_origem_merc: 'Country of origin of goods',
        dados_bancarios: 'BANK DETAILS', beneficiario: 'Beneficiary', banco: 'Bank', agencia: 'Branch', conta: 'Account', swift: 'SWIFT / BIC', iban: 'IBAN', endereco_banco: 'Bank Address', gerado_com: 'Document generated by Marpex', tagline: 'Foreign Trade Management', criado_por: 'Created by', gerado_em: 'Generated on',
        pagina: (p, n) => `Page ${p} of ${n}`,
        proforma_invoice: 'PROFORMA INVOICE', commercial_invoice: 'COMMERCIAL INVOICE', packing_list: 'PACKING LIST',
        tipo: 'Type', proposito: 'Purpose', modal: 'Transport', incoterm: 'Incoterm', moeda: 'Currency', emissao: 'Issue date',
        data: 'Date', processo: 'Shipment', proforma: 'Proforma',
        exportador: 'EXPORTER', importador: 'IMPORTER', comprador: 'BUYER (TRADING COMPANY)', vendedor: 'SELLER', importador_final: 'Final importer', operacao: 'Operation', fim_especifico: 'Sale for the specific purpose of export', rota: 'EXPORT ROUTE', condicoes: 'COMMERCIAL TERMS', embarque: 'SHIPMENT',
        nome_empresa: 'Company Name', empresa: 'Company', identificacao: 'Tax ID', identificacao_fiscal: 'Tax ID',
        endereco: 'Address', cidade: 'City', estado: 'State', cep: 'Postal Code', pais: 'Country', pais_origem: 'Country of Origin', pais_destino: 'Country of Destination',
        porto_origem: 'Port of Loading', porto_destino: 'Port of Discharge', aeroporto_origem: 'Airport of Departure', aeroporto_destino: 'Airport of Destination',
        fronteira_saida: 'Exit Border', fronteira_entrada: 'Entry Border',
        forma_pagamento: 'Payment Method', prazo_pagamento: 'Payment Terms', pagamento: 'Payment', validade: 'Validity',
        dias: n => `${n} day${Number(n) === 1 ? '' : 's'}`, data_embarque: 'Shipment Date', container: 'Container',
        itens_proforma: 'PROFORMA ITEMS', mercadorias: 'GOODS', volumes_pesos: 'PACKAGES AND WEIGHTS',
        col_codigo: 'CODE', col_descricao: 'PRODUCT DESCRIPTION', col_hs: 'HS CODE', col_ncm: 'NCM', col_fabricante: 'MANUFACTURER',
        col_gtin: 'GTIN', col_lote: 'BATCH', col_fabricacao: 'MFG. DATE', col_validade: 'EXPIRY DATE', col_marca: 'BRAND', col_composicao: 'COMPOSITION', col_volpeso: 'PKG/WEIGHT', col_qtd: 'QTY', col_valor_unit: 'UNIT PRICE', col_total: 'TOTAL',
        col_produto: 'PRODUCT', col_ncm_hs: 'NCM / HS', col_un: 'UNIT', col_preco_unit: 'UNIT PRICE', col_sku: 'SKU CODE',
        col_marcacao: 'MARKS / NUMBERS', col_tipo_emb: 'PACKAGE TYPE', col_qtd_pecas: 'QTY OF PIECES',
        col_peso_liq_unit: 'NET WT. UNIT (KG)', col_peso_bruto_unit: 'GROSS WT. UNIT (KG)', col_dimensoes: 'DIMENSIONS (CM)',
        total_geral: 'GRAND TOTAL', totais: 'TOTALS', logistica: 'LOGISTICS', volume_total: 'Total packages', peso_liquido: 'Net weight', peso_bruto: 'Gross weight',
        volumes: n => `${n} package${Number(n) === 1 ? '' : 's'}`, vol_abrev: 'pkg', pecas: 'pieces',
        caixa: n => `Box ${n}`, caixas: (a, b) => `Boxes ${a} to ${b}`,
        assinatura_responsavel: 'Authorized Signature', assinatura_exportador: 'Exporter — Authorized Signature',
        assinatura_importador: 'Importer — Authorized Signature', assinatura_vendedor: 'Seller — Authorized Signature',
        observacoes: 'REMARKS', obs_gerais: 'General Remarks', obs_status: 'Status Remarks',
        nenhum_produto: 'No products in this shipment.', atencao: 'Note',
        aviso_sem_embalagem: n => `${n} product(s) without a registered shipping package (box) — marks, weights and dimensions not calculated.`,
        v_tipo: { exportacao_direta: 'Direct Export', exportacao_indireta: 'Indirect Export' },
        v_proposito: { vendas: 'Sale', amostra: 'Sample', troca: 'Exchange', doacao: 'Donation', conserto: 'Repair', retorno: 'Return', exposicao: 'Exhibition / Fair' },
        v_modal: { aereo: 'Air', maritimo: 'Sea', terrestre: 'Road' },
        v_forma_pagamento: _pdfMapa(_PDF_FORMAS_PAG, ['Cash', 'Check', 'Credit Card', 'Debit Card', 'Trade Bill', 'Bank Slip (Boleto)',
            'Bank Deposit', 'SWIFT Transfer', 'CAD (Cash Against Documents)', '30% ADVANCED', '70% AGAINST DOCUMENT', 'No Payment', 'Deferred Payment', 'Other']),
        a_vista: 'At sight',
    },
    es: {
        _locale: 'es-ES',
        itens: 'ÍTEMS', valida_ate: 'Válida hasta', incoterm_rot: 'Incoterm® 2020', origem: 'Origen', destino: 'Destino',
        previsao_embarque: 'Embarque previsto', forma: 'Forma', prazo: 'Plazo', validade_proposta: 'Validez de la oferta',
        condicoes_pagamento: 'CONDICIONES DE PAGO', contato: 'Contacto', subtotal: 'Subtotal', frete: 'Flete', seguro: 'Seguro',
        cubagem: 'Cubicaje (m³)', volumes_rot: 'Bultos', pecas_rot: 'Piezas', total_extenso: 'Total en letras',
        assinatura_aceite: 'Importador — De acuerdo (aceptación de la oferta)', assinatura_aceite_comprador: 'Comprador — De acuerdo (aceptación de la oferta)', declaracao_ci: 'Declaramos que la información de esta factura es verdadera y correcta y que las mercancías descritas son originarias del país indicado.',
        col_volumes: 'BULTOS', col_peso_liq: 'PESO NETO (KG)', col_peso_bruto: 'PESO BRUTO (KG)', pais_origem_merc: 'País de origen de las mercancías',
        dados_bancarios: 'DATOS BANCARIOS', beneficiario: 'Beneficiario', banco: 'Banco', agencia: 'Agencia', conta: 'Cuenta', swift: 'SWIFT / BIC', iban: 'IBAN', endereco_banco: 'Dirección del Banco', gerado_com: 'Documento generado por Marpex', tagline: 'Gestión de Comercio Exterior', criado_por: 'Creado por', gerado_em: 'Generado el',
        pagina: (p, n) => `Página ${p} de ${n}`,
        proforma_invoice: 'FACTURA PROFORMA', commercial_invoice: 'FACTURA COMERCIAL', packing_list: 'LISTA DE EMPAQUE',
        tipo: 'Tipo', proposito: 'Propósito', modal: 'Transporte', incoterm: 'Incoterm', moeda: 'Moneda', emissao: 'Emisión',
        data: 'Fecha', processo: 'Embarque', proforma: 'Proforma',
        exportador: 'EXPORTADOR', importador: 'IMPORTADOR', comprador: 'COMPRADOR (TRADING)', vendedor: 'VENDEDOR', importador_final: 'Importador final', operacao: 'Operación', fim_especifico: 'Venta con fin específico de exportación', rota: 'RUTA DE EXPORTACIÓN', condicoes: 'CONDICIONES COMERCIALES', embarque: 'EMBARQUE',
        nome_empresa: 'Razón Social', empresa: 'Empresa', identificacao: 'Identificación Fiscal', identificacao_fiscal: 'Identificación Fiscal',
        endereco: 'Dirección', cidade: 'Ciudad', estado: 'Estado', cep: 'Código Postal', pais: 'País', pais_origem: 'País de Origen', pais_destino: 'País de Destino',
        porto_origem: 'Puerto de Carga', porto_destino: 'Puerto de Descarga', aeroporto_origem: 'Aeropuerto de Salida', aeroporto_destino: 'Aeropuerto de Destino',
        fronteira_saida: 'Frontera de Salida', fronteira_entrada: 'Frontera de Entrada',
        forma_pagamento: 'Forma de Pago', prazo_pagamento: 'Plazo de Pago', pagamento: 'Pago', validade: 'Validez',
        dias: n => `${n} día${Number(n) === 1 ? '' : 's'}`, data_embarque: 'Embarque', container: 'Contenedor',
        itens_proforma: 'ÍTEMS DE LA PROFORMA', mercadorias: 'MERCANCÍAS', volumes_pesos: 'BULTOS Y PESOS',
        col_codigo: 'CÓDIGO', col_descricao: 'DESCRIPCIÓN DEL PRODUCTO', col_hs: 'CÓDIGO HS', col_ncm: 'NCM', col_fabricante: 'FABRICANTE',
        col_gtin: 'GTIN', col_lote: 'LOTE', col_fabricacao: 'FABRICACIÓN', col_validade: 'VENCIMIENTO', col_marca: 'MARCA', col_composicao: 'COMPOSICIÓN', col_volpeso: 'BULTOS/PESO', col_qtd: 'CANT.', col_valor_unit: 'PRECIO UNIT.', col_total: 'TOTAL',
        col_produto: 'PRODUCTO', col_ncm_hs: 'NCM / HS', col_un: 'UN.', col_preco_unit: 'PRECIO UNIT.', col_sku: 'CÓDIGO SKU',
        col_marcacao: 'MARCAS / NUMERACIÓN', col_tipo_emb: 'TIPO DE EMBALAJE', col_qtd_pecas: 'CANT. DE PIEZAS',
        col_peso_liq_unit: 'PESO NETO UNIT. (KG)', col_peso_bruto_unit: 'PESO BRUTO UNIT. (KG)', col_dimensoes: 'DIMENSIONES (CM)',
        total_geral: 'TOTAL GENERAL', totais: 'TOTALES', logistica: 'LOGÍSTICA', volume_total: 'Total de bultos', peso_liquido: 'Peso neto', peso_bruto: 'Peso bruto',
        volumes: n => `${n} bulto${Number(n) === 1 ? '' : 's'}`, vol_abrev: 'bult.', pecas: 'piezas',
        caixa: n => `Caja ${n}`, caixas: (a, b) => `Cajas ${a} a ${b}`,
        assinatura_responsavel: 'Firma del Responsable', assinatura_exportador: 'Exportador — Firma del Responsable',
        assinatura_importador: 'Importador — Firma del Responsable', assinatura_vendedor: 'Vendedor — Firma del Responsable',
        observacoes: 'OBSERVACIONES', obs_gerais: 'Observaciones Generales', obs_status: 'Observaciones de Estado',
        nenhum_produto: 'Ningún producto en este embarque.', atencao: 'Atención',
        aviso_sem_embalagem: n => `${n} producto(s) sin embalaje de transporte (caja) registrado — marcas, pesos y dimensiones no calculados.`,
        v_tipo: { exportacao_direta: 'Exportación Directa', exportacao_indireta: 'Exportación Indirecta' },
        v_proposito: { vendas: 'Venta', amostra: 'Muestra', troca: 'Cambio', doacao: 'Donación', conserto: 'Reparación', retorno: 'Retorno', exposicao: 'Exposición / Feria' },
        v_modal: { aereo: 'Aéreo', maritimo: 'Marítimo', terrestre: 'Terrestre' },
        v_forma_pagamento: _pdfMapa(_PDF_FORMAS_PAG, ['Efectivo', 'Cheque', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'Letra de Cambio', 'Boleto Bancario',
            'Depósito Bancario', 'Transferencia SWIFT', 'CAD (Pago contra Documentos)', '30% ANTICIPADO', '70% CONTRA DOCUMENTOS', 'Sin Pago', 'Pago Diferido', 'Otros']),
        a_vista: 'Al contado',
    },
    fr: {
        _locale: 'fr-FR',
        itens: 'ARTICLES', valida_ate: "Valable jusqu'au", incoterm_rot: 'Incoterm® 2020', origem: 'Origine', destino: 'Destination',
        previsao_embarque: 'Expédition prévue', forma: 'Mode', prazo: 'Délai', validade_proposta: "Validité de l'offre",
        condicoes_pagamento: 'CONDITIONS DE PAIEMENT', contato: 'Contact', subtotal: 'Sous-total', frete: 'Fret', seguro: 'Assurance',
        cubagem: 'Cubage (m³)', volumes_rot: 'Colis', pecas_rot: 'Pièces', total_extenso: 'Montant en lettres',
        assinatura_aceite: "Importateur — Bon pour accord (acceptation de l'offre)", assinatura_aceite_comprador: "Acheteur — Bon pour accord (acceptation de l'offre)", declaracao_ci: 'Nous certifions que les informations de cette facture sont exactes et que les marchandises décrites sont originaires du pays indiqué.',
        col_volumes: 'COLIS', col_peso_liq: 'POIDS NET (KG)', col_peso_bruto: 'POIDS BRUT (KG)', pais_origem_merc: "Pays d'origine des marchandises",
        dados_bancarios: 'COORDONNÉES BANCAIRES', beneficiario: 'Bénéficiaire', banco: 'Banque', agencia: 'Agence', conta: 'Compte', swift: 'SWIFT / BIC', iban: 'IBAN', endereco_banco: 'Adresse de la Banque', gerado_com: 'Document généré par Marpex', tagline: 'Gestion du Commerce Extérieur', criado_por: 'Créé par', gerado_em: 'Généré le',
        pagina: (p, n) => `Page ${p} sur ${n}`,
        proforma_invoice: 'FACTURE PRO FORMA', commercial_invoice: 'FACTURE COMMERCIALE', packing_list: 'LISTE DE COLISAGE',
        tipo: 'Type', proposito: 'Objet', modal: 'Transport', incoterm: 'Incoterm', moeda: 'Devise', emissao: 'Émission',
        data: 'Date', processo: 'Expédition', proforma: 'Pro forma',
        exportador: 'EXPORTATEUR', importador: 'IMPORTATEUR', comprador: 'ACHETEUR (SOCIÉTÉ DE NÉGOCE)', vendedor: 'VENDEUR', importador_final: 'Importateur final', operacao: 'Opération', fim_especifico: "Vente à des fins spécifiques d'exportation", rota: "ITINÉRAIRE D'EXPORTATION", condicoes: 'CONDITIONS COMMERCIALES', embarque: 'EXPÉDITION',
        nome_empresa: 'Raison Sociale', empresa: 'Société', identificacao: 'Identifiant Fiscal', identificacao_fiscal: 'Identifiant Fiscal',
        endereco: 'Adresse', cidade: 'Ville', estado: 'État / Région', cep: 'Code Postal', pais: 'Pays', pais_origem: "Pays d'Origine", pais_destino: 'Pays de Destination',
        porto_origem: 'Port de Chargement', porto_destino: 'Port de Déchargement', aeroporto_origem: 'Aéroport de Départ', aeroporto_destino: "Aéroport d'Arrivée",
        fronteira_saida: 'Frontière de Sortie', fronteira_entrada: "Frontière d'Entrée",
        forma_pagamento: 'Mode de Paiement', prazo_pagamento: 'Délai de Paiement', pagamento: 'Paiement', validade: 'Validité',
        dias: n => `${n} jour${Number(n) === 1 ? '' : 's'}`, data_embarque: 'Expédition', container: 'Conteneur',
        itens_proforma: 'ARTICLES DE LA PRO FORMA', mercadorias: 'MARCHANDISES', volumes_pesos: 'COLIS ET POIDS',
        col_codigo: 'CODE', col_descricao: 'DESCRIPTION DU PRODUIT', col_hs: 'CODE SH', col_ncm: 'NCM', col_fabricante: 'FABRICANT',
        col_gtin: 'GTIN', col_lote: 'LOT', col_fabricacao: 'FABRICATION', col_validade: 'PÉREMPTION', col_marca: 'MARQUE', col_composicao: 'COMPOSITION', col_volpeso: 'COLIS/POIDS', col_qtd: 'QTÉ', col_valor_unit: 'PRIX UNIT.', col_total: 'TOTAL',
        col_produto: 'PRODUIT', col_ncm_hs: 'NCM / SH', col_un: 'UNITÉ', col_preco_unit: 'PRIX UNIT.', col_sku: 'CODE SKU',
        col_marcacao: 'MARQUES / NUMÉROS', col_tipo_emb: "TYPE D'EMBALLAGE", col_qtd_pecas: 'QTÉ DE PIÈCES',
        col_peso_liq_unit: 'POIDS NET UNIT. (KG)', col_peso_bruto_unit: 'POIDS BRUT UNIT. (KG)', col_dimensoes: 'DIMENSIONS (CM)',
        total_geral: 'TOTAL GÉNÉRAL', totais: 'TOTAUX', logistica: 'LOGISTIQUE', volume_total: 'Total des colis', peso_liquido: 'Poids net', peso_bruto: 'Poids brut',
        volumes: n => `${n} colis`, vol_abrev: 'colis', pecas: 'pièces',
        caixa: n => `Carton ${n}`, caixas: (a, b) => `Cartons ${a} à ${b}`,
        assinatura_responsavel: 'Signature du Responsable', assinatura_exportador: 'Exportateur — Signature du Responsable',
        assinatura_importador: 'Importateur — Signature du Responsable', assinatura_vendedor: 'Vendeur — Signature du Responsable',
        observacoes: 'OBSERVATIONS', obs_gerais: 'Observations Générales', obs_status: 'Observations de Statut',
        nenhum_produto: 'Aucun produit dans cette expédition.', atencao: 'Attention',
        aviso_sem_embalagem: n => `${n} produit(s) sans emballage de transport (carton) enregistré — marques, poids et dimensions non calculés.`,
        v_tipo: { exportacao_direta: 'Exportation Directe', exportacao_indireta: 'Exportation Indirecte' },
        v_proposito: { vendas: 'Vente', amostra: 'Échantillon', troca: 'Échange', doacao: 'Don', conserto: 'Réparation', retorno: 'Retour', exposicao: 'Exposition / Salon' },
        v_modal: { aereo: 'Aérien', maritimo: 'Maritime', terrestre: 'Routier' },
        v_forma_pagamento: _pdfMapa(_PDF_FORMAS_PAG, ['Espèces', 'Chèque', 'Carte de Crédit', 'Carte de Débit', 'Lettre de Change', 'Boleto Bancaire',
            'Dépôt Bancaire', 'Virement SWIFT', 'CAD (Paiement contre Documents)', "30% D'AVANCE", '70% CONTRE DOCUMENTS', 'Sans Paiement', 'Paiement Différé', 'Autres']),
        a_vista: 'Comptant',
    },
    de: {
        _locale: 'de-DE',
        itens: 'POSITIONEN', valida_ate: 'Gültig bis', incoterm_rot: 'Incoterm® 2020', origem: 'Ursprung', destino: 'Bestimmung',
        previsao_embarque: 'Voraussichtlicher Versand', forma: 'Art', prazo: 'Frist', validade_proposta: 'Angebotsgültigkeit',
        condicoes_pagamento: 'ZAHLUNGSBEDINGUNGEN', contato: 'Kontakt', subtotal: 'Zwischensumme', frete: 'Fracht', seguro: 'Versicherung',
        cubagem: 'Volumen (m³)', volumes_rot: 'Packstücke', pecas_rot: 'Stück', total_extenso: 'Betrag in Worten',
        assinatura_aceite: 'Importeur — Einverstanden (Annahme des Angebots)', assinatura_aceite_comprador: 'Käufer — Einverstanden (Annahme des Angebots)', declaracao_ci: 'Wir bestätigen, dass die Angaben in dieser Rechnung wahr und richtig sind und die beschriebenen Waren aus dem angegebenen Land stammen.',
        col_volumes: 'PACKSTÜCKE', col_peso_liq: 'NETTOGEW. (KG)', col_peso_bruto: 'BRUTTOGEW. (KG)', pais_origem_merc: 'Ursprungsland der Waren',
        dados_bancarios: 'BANKVERBINDUNG', beneficiario: 'Begünstigter', banco: 'Bank', agencia: 'Filiale', conta: 'Kontonummer', swift: 'SWIFT / BIC', iban: 'IBAN', endereco_banco: 'Bankadresse', gerado_com: 'Dokument erstellt mit Marpex', tagline: 'Außenhandelsmanagement', criado_por: 'Erstellt von', gerado_em: 'Erstellt am',
        pagina: (p, n) => `Seite ${p} von ${n}`,
        proforma_invoice: 'PROFORMA-RECHNUNG', commercial_invoice: 'HANDELSRECHNUNG', packing_list: 'PACKLISTE',
        tipo: 'Art', proposito: 'Zweck', modal: 'Transport', incoterm: 'Incoterm', moeda: 'Währung', emissao: 'Ausstellung',
        data: 'Datum', processo: 'Sendung', proforma: 'Proforma',
        exportador: 'EXPORTEUR', importador: 'IMPORTEUR', comprador: 'KÄUFER (HANDELSHAUS)', vendedor: 'VERKÄUFER', importador_final: 'Endimporteur', operacao: 'Vorgang', fim_especifico: 'Verkauf zum ausschließlichen Zweck der Ausfuhr', rota: 'EXPORTROUTE', condicoes: 'HANDELSBEDINGUNGEN', embarque: 'SENDUNG',
        nome_empresa: 'Firmenname', empresa: 'Firma', identificacao: 'Steuernummer', identificacao_fiscal: 'Steuernummer',
        endereco: 'Adresse', cidade: 'Stadt', estado: 'Bundesland', cep: 'Postleitzahl', pais: 'Land', pais_origem: 'Ursprungsland', pais_destino: 'Bestimmungsland',
        porto_origem: 'Verladehafen', porto_destino: 'Löschhafen', aeroporto_origem: 'Abflughafen', aeroporto_destino: 'Zielflughafen',
        fronteira_saida: 'Ausreisegrenze', fronteira_entrada: 'Einreisegrenze',
        forma_pagamento: 'Zahlungsart', prazo_pagamento: 'Zahlungsziel', pagamento: 'Zahlung', validade: 'Gültigkeit',
        dias: n => `${n} Tag${Number(n) === 1 ? '' : 'e'}`, data_embarque: 'Versanddatum', container: 'Container',
        itens_proforma: 'PROFORMA-POSITIONEN', mercadorias: 'WAREN', volumes_pesos: 'PACKSTÜCKE UND GEWICHTE',
        col_codigo: 'CODE', col_descricao: 'PRODUKTBESCHREIBUNG', col_hs: 'HS-CODE', col_ncm: 'NCM', col_fabricante: 'HERSTELLER',
        col_gtin: 'GTIN', col_lote: 'CHARGE', col_fabricacao: 'HERSTELLUNG', col_validade: 'HALTBAR BIS', col_marca: 'MARKE', col_composicao: 'ZUSAMMENSETZUNG', col_volpeso: 'PKT./GEWICHT', col_qtd: 'MENGE', col_valor_unit: 'EINZELPREIS', col_total: 'GESAMT',
        col_produto: 'PRODUKT', col_ncm_hs: 'NCM / HS', col_un: 'EINH.', col_preco_unit: 'EINZELPREIS', col_sku: 'SKU-CODE',
        col_marcacao: 'MARKIERUNG / NUMMERN', col_tipo_emb: 'VERPACKUNGSART', col_qtd_pecas: 'STÜCKZAHL',
        col_peso_liq_unit: 'NETTOGEW. EINZ. (KG)', col_peso_bruto_unit: 'BRUTTOGEW. EINZ. (KG)', col_dimensoes: 'ABMESSUNGEN (CM)',
        total_geral: 'GESAMTSUMME', totais: 'SUMMEN', logistica: 'LOGISTIK', volume_total: 'Packstücke gesamt', peso_liquido: 'Nettogewicht', peso_bruto: 'Bruttogewicht',
        volumes: n => `${n} Packstück${Number(n) === 1 ? '' : 'e'}`, vol_abrev: 'Pkt.', pecas: 'Stück',
        caixa: n => `Karton ${n}`, caixas: (a, b) => `Kartons ${a} bis ${b}`,
        assinatura_responsavel: 'Unterschrift des Verantwortlichen', assinatura_exportador: 'Exporteur — Unterschrift des Verantwortlichen',
        assinatura_importador: 'Importeur — Unterschrift des Verantwortlichen', assinatura_vendedor: 'Verkäufer — Unterschrift des Verantwortlichen',
        observacoes: 'BEMERKUNGEN', obs_gerais: 'Allgemeine Bemerkungen', obs_status: 'Statusbemerkungen',
        nenhum_produto: 'Keine Produkte in dieser Sendung.', atencao: 'Hinweis',
        aviso_sem_embalagem: n => `${n} Produkt(e) ohne erfasste Transportverpackung (Karton) — Markierung, Gewichte und Abmessungen nicht berechnet.`,
        v_tipo: { exportacao_direta: 'Direktexport', exportacao_indireta: 'Indirekter Export' },
        v_proposito: { vendas: 'Verkauf', amostra: 'Muster', troca: 'Umtausch', doacao: 'Spende', conserto: 'Reparatur', retorno: 'Rücksendung', exposicao: 'Ausstellung / Messe' },
        v_modal: { aereo: 'Luftfracht', maritimo: 'Seefracht', terrestre: 'Straße' },
        v_forma_pagamento: _pdfMapa(_PDF_FORMAS_PAG, ['Bargeld', 'Scheck', 'Kreditkarte', 'Debitkarte', 'Handelswechsel', 'Boleto (Bankzahlschein)',
            'Bankeinzahlung', 'SWIFT-Überweisung', 'CAD (Kasse gegen Dokumente)', '30% VORAUSZAHLUNG', '70% GEGEN DOKUMENTE', 'Ohne Zahlung', 'Spätere Zahlung', 'Sonstige']),
        a_vista: 'Sofort',
    },
};

// Textos do idioma da Proforma. Chinês / "Outro" / desconhecido → inglês (a
// fonte do PDF não tem esses caracteres); sem idioma → português.
// Devolve também helpers de formatação (número, data, valor traduzido).
function pdfIdioma(idioma) {
    const cod = !idioma ? 'pt' : (PDF_IDIOMAS[idioma] ? idioma : 'en');
    const t = PDF_IDIOMAS[cod];
    const loc = t._locale;
    return {
        cod, t, loc,
        trocado: !!idioma && cod !== idioma,   // pediu um idioma que saiu em inglês
        num: (n, dec = 2) => Number(n || 0).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec }),
        data: s => s ? new Date(String(s).length === 10 ? s + 'T00:00:00' : s).toLocaleDateString(loc) : '—',
        dataHora: d => (d || new Date()).toLocaleString(loc, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        tipo: v => v ? (t.v_tipo[v] || v) : '—',
        proposito: v => v ? (t.v_proposito[v] || v) : '—',
        modal: v => v ? (t.v_modal[v] || v) : '—',
        formaPagamento: v => v ? (t.v_forma_pagamento[v] || v) : '—',
        prazoPagamento: v => !v ? '—' : v === 'avista' ? t.a_vista : (/^\d+$/.test(String(v)) ? t.dias(v) : String(v)),
    };
}

// Logo para o PDF: baixa a imagem (bucket público "logos") e converte para PNG
// por canvas — aceita PNG/JPG/WebP. Devolve { dataUrl, razao } ou null.
const _pdfImagensCache = {};
function pdfCarregarImagem(url) {
    if (!url) return Promise.resolve(null);
    if (!_pdfImagensCache[url]) {
        _pdfImagensCache[url] = new Promise(resolve => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const max = 600, esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.naturalWidth * esc)); c.height = Math.max(1, Math.round(img.naturalHeight * esc));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    resolve({ dataUrl: c.toDataURL('image/png'), razao: c.width / c.height });
                } catch (_) { resolve(null); }
            };
            img.onerror = () => resolve(null);
            img.src = url;
        });
    }
    return _pdfImagensCache[url];
}

// Dados da própria empresa (Exportador = "Usuário"). logo_url só existe depois
// de database-logo-marcas-contas-bancarias.sql — sem a coluna, busca sem ela.
async function pdfEmpresaPropria(empresaId) {
    const base = 'razao_social, nome_fantasia, cnpj, endereco, numero, complemento, cidade, estado, cep';
    let r = await supabaseClient.from('empresas').select(base + ', logo_url').eq('id', empresaId).maybeSingle();
    if (r.error) r = await supabaseClient.from('empresas').select(base).eq('id', empresaId).maybeSingle();
    return r.data || null;
}

// ========================================
// TOTAL POR EXTENSO (pt, en, es, fr, de)
// ========================================
// pdfValorPorExtenso(24800.5, 'USD', 'en') → "twenty-four thousand eight hundred
// US dollars and fifty cents". Moeda: código (USD, EUR, BRL...) ou descrição
// ("Dólar Americano", "REAL/BRASIL"); moeda desconhecida sai como texto.
const _PDF_MOEDAS_EXTENSO = {
    USD: { pt: ['dólar americano', 'dólares americanos'], en: ['US dollar', 'US dollars'], es: ['dólar estadounidense', 'dólares estadounidenses'], fr: ['dollar américain', 'dollars américains'], de: ['US-Dollar', 'US-Dollar'] },
    EUR: { pt: ['euro', 'euros'], en: ['euro', 'euros'], es: ['euro', 'euros'], fr: ['euro', 'euros'], de: ['Euro', 'Euro'] },
    BRL: { pt: ['real', 'reais'], en: ['Brazilian real', 'Brazilian reais'], es: ['real brasileño', 'reales brasileños'], fr: ['réal brésilien', 'réaux brésiliens'], de: ['Brasilianischer Real', 'Brasilianische Real'] },
    GBP: { pt: ['libra esterlina', 'libras esterlinas'], en: ['pound sterling', 'pounds sterling'], es: ['libra esterlina', 'libras esterlinas'], fr: ['livre sterling', 'livres sterling'], de: ['Pfund Sterling', 'Pfund Sterling'] },
    ARS: { pt: ['peso argentino', 'pesos argentinos'], en: ['Argentine peso', 'Argentine pesos'], es: ['peso argentino', 'pesos argentinos'], fr: ['peso argentin', 'pesos argentins'], de: ['Argentinischer Peso', 'Argentinische Pesos'] },
    CNY: { pt: ['iuane', 'iuanes'], en: ['yuan', 'yuan'], es: ['yuan', 'yuanes'], fr: ['yuan', 'yuans'], de: ['Yuan', 'Yuan'] },
};
const _PDF_CENTAVOS = { pt: ['centavo', 'centavos'], en: ['cent', 'cents'], es: ['centavo', 'centavos'], fr: ['centime', 'centimes'], de: ['Cent', 'Cent'] };

function _pdfCodigoMoeda(moeda) {
    const m = String(moeda || '').toUpperCase();
    if (/^[A-Z]{3}$/.test(m)) return m;
    if (/D[ÓO]LAR/.test(m)) return 'USD';
    if (/EURO/.test(m)) return 'EUR';
    if (/REAL|REAIS/.test(m)) return 'BRL';
    if (/LIBRA|POUND/.test(m)) return 'GBP';
    if (/PESO/.test(m)) return 'ARS';
    if (/YUAN|IUAN|RENMINBI/.test(m)) return 'CNY';
    return null;
}

// número inteiro por extenso em cada idioma
const _pdfExtenso = {
    pt(n) {
        const u = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
        const d = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
        const c = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
        const ate999 = x => {
            if (x === 100) return 'cem';
            const p = [];
            if (x >= 100) p.push(c[Math.floor(x / 100)]);
            const r = x % 100;
            if (r) p.push(r < 20 ? u[r] : d[Math.floor(r / 10)] + (r % 10 ? ' e ' + u[r % 10] : ''));
            return p.join(' e ');
        };
        if (n === 0) return 'zero';
        const escalas = [['', ''], ['mil', 'mil'], ['milhão', 'milhões'], ['bilhão', 'bilhões']];
        const grupos = []; let x = n; while (x > 0) { grupos.push(x % 1000); x = Math.floor(x / 1000); }
        const partes = [];
        for (let i = grupos.length - 1; i >= 0; i--) {
            const g = grupos[i]; if (!g) continue;
            const txt = i === 1 && g === 1 ? 'mil' : (i === 0 ? ate999(g) : `${ate999(g)} ${g === 1 ? escalas[i][0] : escalas[i][1]}`);
            partes.push({ txt, g });
        }
        return partes.map((p, k) => (k > 0 && (p.g < 100 || p.g % 100 === 0) && k === partes.length - 1 ? 'e ' : '') + p.txt).join(' ');
    },
    en(n) {
        const u = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
        const d = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
        const ate999 = x => {
            const p = [];
            if (x >= 100) p.push(u[Math.floor(x / 100)] + ' hundred');
            const r = x % 100;
            if (r) p.push(r < 20 ? u[r] : d[Math.floor(r / 10)] + (r % 10 ? '-' + u[r % 10] : ''));
            return p.join(' ');
        };
        if (n === 0) return 'zero';
        const esc = ['', ' thousand', ' million', ' billion'];
        const g = []; let x = n; while (x > 0) { g.push(x % 1000); x = Math.floor(x / 1000); }
        return g.map((v, i) => v ? ate999(v) + esc[i] : '').reverse().filter(Boolean).join(' ');
    },
    es(n) {
        const u = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve',
                   'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
        const d = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
        const c = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
        const ate999 = x => {
            if (x === 100) return 'cien';
            const p = [];
            if (x >= 100) p.push(c[Math.floor(x / 100)]);
            const r = x % 100;
            if (r) p.push(r < 30 ? u[r] : d[Math.floor(r / 10)] + (r % 10 ? ' y ' + u[r % 10] : ''));
            return p.join(' ');
        };
        if (n === 0) return 'cero';
        const g = []; let x = n; while (x > 0) { g.push(x % 1000); x = Math.floor(x / 1000); }
        const apoc = s => s.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');
        const partes = [];
        for (let i = g.length - 1; i >= 0; i--) {
            const v = g[i]; if (!v) continue;
            if (i === 0) partes.push(ate999(v));
            else if (i === 1) partes.push(v === 1 ? 'mil' : apoc(ate999(v)) + ' mil');
            else if (i === 2) partes.push(v === 1 ? 'un millón' : apoc(ate999(v)) + ' millones');
            else partes.push(v === 1 ? 'mil millones' : apoc(ate999(v)) + ' mil millones');
        }
        return apoc(partes.join(' '));
    },
    fr(n) {
        const u = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize'];
        const ate99 = r => {
            if (r <= 16) return u[r];
            if (r < 20) return 'dix-' + u[r - 10];
            const dz = Math.floor(r / 10), un = r % 10;
            const base = { 2: 'vingt', 3: 'trente', 4: 'quarante', 5: 'cinquante', 6: 'soixante' };
            if (dz <= 6) return base[dz] + (un === 1 ? ' et un' : un ? '-' + u[un] : '');
            if (dz === 7) return 'soixante' + (un === 1 ? ' et onze' : '-' + ate99(10 + un));
            if (dz === 8) return un ? 'quatre-vingt-' + u[un] : 'quatre-vingts';
            return 'quatre-vingt-' + ate99(10 + un);
        };
        const ate999 = x => {
            const h = Math.floor(x / 100), r = x % 100, p = [];
            if (h) p.push(h === 1 ? 'cent' : u[h] + (r ? ' cent' : ' cents'));
            if (r) p.push(ate99(r));
            return p.join(' ');
        };
        if (n === 0) return 'zéro';
        const g = []; let x = n; while (x > 0) { g.push(x % 1000); x = Math.floor(x / 1000); }
        const partes = [];
        for (let i = g.length - 1; i >= 0; i--) {
            const v = g[i]; if (!v) continue;
            if (i === 0) partes.push(ate999(v));
            else if (i === 1) partes.push(v === 1 ? 'mille' : ate999(v).replace(/cents$/, 'cent') + ' mille');
            else if (i === 2) partes.push(ate999(v) + (v === 1 ? ' million' : ' millions'));
            else partes.push(ate999(v) + (v === 1 ? ' milliard' : ' milliards'));
        }
        return partes.join(' ');
    },
    de(n) {
        const u = ['null', 'ein', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'];
        const d = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
        const ate999 = x => {
            let s = '';
            if (x >= 100) s += u[Math.floor(x / 100)] + 'hundert';
            const r = x % 100;
            if (r) s += r < 20 ? u[r] : (r % 10 ? u[r % 10] + 'und' : '') + d[Math.floor(r / 10)];
            return s;
        };
        if (n === 0) return 'null';
        const g = []; let x = n; while (x > 0) { g.push(x % 1000); x = Math.floor(x / 1000); }
        const partes = [];
        for (let i = g.length - 1; i >= 0; i--) {
            const v = g[i]; if (!v) continue;
            if (i === 0) partes.push(ate999(v).replace(/ein$/, 'eins'));
            else if (i === 1) partes.push(ate999(v) + 'tausend');
            else if (i === 2) partes.push(v === 1 ? 'eine Million' : ate999(v) + ' Millionen');
            else partes.push(v === 1 ? 'eine Milliarde' : ate999(v) + ' Milliarden');
        }
        return partes.join(' ').replace(/tausend (?=[a-zß])/g, 'tausend');
    },
};

function pdfValorPorExtenso(valor, moeda, idioma = 'pt') {
    const lang = _pdfExtenso[idioma] ? idioma : 'en';
    const v = Math.round(Math.abs(Number(valor) || 0) * 100);
    const inteiro = Math.floor(v / 100), cent = v % 100;
    const cod = _pdfCodigoMoeda(moeda);
    const nomes = cod && _PDF_MOEDAS_EXTENSO[cod]?.[lang];
    const nomeMoeda = nomes ? nomes[inteiro === 1 ? 0 : 1] : String(moeda || '').trim();
    const conj = { pt: ' e ', en: ' and ', es: ' con ', fr: ' et ', de: ' und ' }[lang];
    let txt = _pdfExtenso[lang](inteiro);
    // "um milhão DE dólares" / "un millón DE dólares" / "un million DE dollars"
    const redondo = inteiro >= 1e6 && inteiro % 1e6 === 0;
    if (nomes && redondo && lang === 'pt') txt += ' de';
    if (nomes && redondo && (lang === 'es' || lang === 'fr')) txt += ' de';
    txt += nomeMoeda ? ' ' + nomeMoeda : '';
    // alemão: "eins" sozinho, mas "ein Cent"
    if (cent) txt += conj + _pdfExtenso[lang](cent).replace(/eins$/, 'ein') + ' ' + _PDF_CENTAVOS[lang][cent === 1 ? 0 : 1];
    return txt.charAt(0).toUpperCase() + txt.slice(1);
}

// ========================================
// LAYOUT VERTICAL (A4 retrato) — Proforma, Commercial Invoice, Packing List
// ========================================
// Modelo aprovado em mockups/proforma-vertical.png. Cada função desenha um
// bloco e devolve o novo Y. Conteúdo vai até PV.LIM; rodapé fino nos últimos 10mm.
// pvNovoDocumento({ paisagem: true }) troca as medidas para A4 deitado
// (Commercial Invoice: mais colunas escolhidas na janela de colunas).
const _PV_RETRATO  = { W: 210, H: 297, ML: 14, MR: 196, CW: 182, LIM: 281 };
const _PV_PAISAGEM = { W: 297, H: 210, ML: 14, MR: 283, CW: 269, LIM: 194 };
const PV = { ..._PV_RETRATO };

function pvNovoDocumento({ paisagem = false } = {}) {
    Object.assign(PV, paisagem ? _PV_PAISAGEM : _PV_RETRATO);
    return new window.jspdf.jsPDF({ orientation: paisagem ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
}
function _pvT(doc, estilo, tam, cor, txt, x, y, op) { doc.setFont('helvetica', estilo); doc.setFontSize(tam); doc.setTextColor(...cor); doc.text(txt, x, y, op); }
function _pvCorta(doc, txt, larg, tam, estilo = 'normal') { doc.setFont('helvetica', estilo); doc.setFontSize(tam); return doc.splitTextToSize(String(txt ?? ''), larg); }
// quebra de página: devolve o Y (20 numa página nova)
function pvGarantir(doc, Y, h, aoQuebrar) {
    if (Y + h <= PV.LIM) return Y;
    doc.addPage();
    return aoQuebrar ? aoQuebrar(16) : 16;
}

// Cabeçalho: logo + Exportador (nome, linhas) à esquerda; título, número e datas à direita.
// emissor = { nome, linhas: [], logo }; datas = [[rótulo, valor], ...]
function pvCabecalho(doc, { emissor, titulo, numero, datas = [] }) {
    const { ML, MR, CW } = PV, C = PDF_CORES;
    let x = ML;
    if (emissor.logo) {
        const h = 17, w = Math.min(36, Math.max(12, h * emissor.logo.razao));
        const hh = Math.min(h, w / emissor.logo.razao);
        try { doc.addImage(emissor.logo.dataUrl, 'PNG', x, 11 + (h - hh) / 2, w, hh, undefined, 'FAST'); } catch (_) { /* imagem inválida */ }
        x += w + 5;
    }
    // espaço do nome: até o título da direita (que muda de tamanho por documento/idioma)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    const largEsq = Math.min(CW * 0.62 - (x - ML), MR - doc.getTextWidth(titulo) - 8 - x);
    // nome longo: diminui a fonte até caber (mín. 9pt); ainda grande, corta com "…"
    let tamNome = 12.5, nome = emissor.nome || '—';
    doc.setFont('helvetica', 'bold');
    while (tamNome > 9 && (doc.setFontSize(tamNome), doc.getTextWidth(nome)) > largEsq) tamNome -= 0.5;
    if (doc.getTextWidth(nome) > largEsq) { while (nome.length > 3 && doc.getTextWidth(nome + '…') > largEsq) nome = nome.slice(0, -1); nome += '…'; }
    _pvT(doc, 'bold', tamNome, C.NAVY, nome, x, 16);
    (emissor.linhas || []).filter(Boolean).slice(0, 3).forEach((l, i) =>
        _pvT(doc, 'normal', 7.3, C.CINZA, _pvCorta(doc, l, largEsq, 7.3)[0], x, 21 + i * 3.9));
    _pvT(doc, 'bold', 15, C.NAVY, titulo, MR, 16.5, { align: 'right' });
    if (numero) _pvT(doc, 'bold', 9, C.AZUL, numero, MR, 22, { align: 'right' });
    datas.filter(([, v]) => v).forEach(([r, v], i) => {
        const y = 27 + i * 4;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
        const wv = doc.getTextWidth(String(v));
        _pvT(doc, 'bold', 7.5, C.PRETO, String(v), MR, y, { align: 'right' });
        _pvT(doc, 'normal', 7.5, C.CINZA, `${r}: `, MR - wv, y, { align: 'right' });
    });
    doc.setDrawColor(...C.NAVY); doc.setLineWidth(0.8); doc.line(ML, 36, MR, 36);
    return 40;
}

// Faixa de termos: [[rótulo, valor, peso], ...]
// Faixa de termos (Incoterm, Modal, Moeda...): itens = [[rótulo, valor, peso?]].
// O valor quebra em até 2 linhas; a faixa só cresce quando alguma célula precisa.
function pvFaixaTermos(doc, Y, itens) {
    const { ML, CW } = PV, C = PDF_CORES;
    const lista = itens.filter(([, v]) => v && v !== '—');
    if (!lista.length) return Y;
    const pesoTot = lista.reduce((t, it) => t + (it[2] || 1), 0);
    const cel = lista.map(([r, v, p]) => {
        const w = CW * (p || 1) / pesoTot;
        return { r, w, linhas: _pvCorta(doc, v, w - 5, 8.3, 'bold').slice(0, 2) };
    });
    const h = cel.some(c => c.linhas.length > 1) ? 14.5 : 11;
    doc.setFillColor(...C.CINZA_BG); doc.setDrawColor(...C.BORDA); doc.setLineWidth(0.25);
    doc.roundedRect(ML, Y, CW, h, 1.5, 1.5, 'FD');
    let x = ML;
    cel.forEach((c, i) => {
        if (i) { doc.setDrawColor(...C.BORDA); doc.line(x, Y, x, Y + h); }
        _pvT(doc, 'bold', 5.8, C.CINZA, c.r.toUpperCase(), x + 3, Y + 4.2);
        c.linhas.forEach((ln, k) => _pvT(doc, 'bold', 8.3, C.AZUL, ln, x + 3, Y + 8.7 + k * 3.5));
        x += c.w;
    });
    return Y + h + 4;
}

// Dois quadros lado a lado. Cada quadro: { titulo, nome?, linhas?: [], chaves?: [[rót, val]], obs? }
function _pvAlturaQuadro(doc, q, w) {
    let h = 7 + 3;
    if (q.nome) h += 4.8;
    (q.linhas || []).forEach(l => { h += _pvCorta(doc, l, w - 6, 7.5).length * 3.9; });
    if (q.chaves) h += q.chaves.length * 5;
    if (q.texto) h += _pvCorta(doc, q.texto, w - 6, 7.3).length * 3.6;
    if (q.grade) h += Math.ceil(q.grade.length / 2) * 8.2;
    return h + 1.5;
}
function _pvDesenhaQuadro(doc, q, x, Y, w, h) {
    const C = PDF_CORES;
    doc.setFillColor(...C.BRANCO); doc.setDrawColor(...C.BORDA); doc.setLineWidth(0.25);
    doc.roundedRect(x, Y, w, h, 1.5, 1.5, 'FD');
    doc.setFillColor(...C.NAVY); doc.roundedRect(x, Y, w, 6.5, 1.5, 1.5, 'F'); doc.rect(x, Y + 3, w, 3.5, 'F');
    doc.setFillColor(...C.AZUL_MED); doc.rect(x, Y + 0.6, 1.4, 5.9, 'F');
    _pvT(doc, 'bold', 6.8, C.BRANCO, q.titulo, x + 4, Y + 4.4);
    let y = Y + 11;
    if (q.nome) { _pvT(doc, 'bold', 8.5, C.PRETO, _pvCorta(doc, q.nome, w - 6, 8.5, 'bold')[0], x + 3, y); y += 4.8; }
    (q.linhas || []).forEach((l, i, arr) => {
        const cor = (q.ultimaCinza && i === arr.length - 1) ? C.CINZA : C.PRETO;
        _pvCorta(doc, l, w - 6, 7.5).forEach(ln => { _pvT(doc, 'normal', 7.5, cor, ln, x + 3, y); y += 3.9; });
    });
    if (q.chaves) {
        q.chaves.forEach(([r, v], i) => {
            _pvT(doc, 'bold', 6.2, C.CINZA, r.toUpperCase(), x + 3, y);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(6.2);
            const wr = doc.getTextWidth(r.toUpperCase()) + 4;
            _pvT(doc, 'bold', 7.5, C.PRETO, _pvCorta(doc, v || '—', w - 6 - wr, 7.5, 'bold')[0], x + w - 3, y, { align: 'right' });
            if (i < q.chaves.length - 1) { doc.setDrawColor(229, 234, 242); doc.setLineDashPattern([0.8, 0.8], 0); doc.line(x + 3, y + 1.8, x + w - 3, y + 1.8); doc.setLineDashPattern([], 0); }
            y += 5;
        });
    }
    if (q.grade) {
        const cw = (w - 6) / 2;
        q.grade.forEach(([r, v], i) => {
            const gx = x + 3 + (i % 2) * cw, gy = y + Math.floor(i / 2) * 8.2;
            const larga = q.grade.length % 2 === 1 && i === q.grade.length - 1;
            _pvT(doc, 'bold', 5.8, C.CINZA, r.toUpperCase(), gx, gy);
            _pvT(doc, 'bold', 7.5, C.PRETO, _pvCorta(doc, v, (larga ? w - 6 : cw) - 2, 7.5, 'bold')[0], gx, gy + 3.8);
        });
    }
    if (q.texto) _pvCorta(doc, q.texto, w - 6, 7.3).forEach(ln => { _pvT(doc, 'normal', 7.3, [51, 65, 85], ln, x + 3, y); y += 3.6; });
}
// quadros: 1, 2 ou mais; proporcao = largura do 1º (0–1), ou uma lista com a
// fração de cada quadro (ex.: [0.36, 0.36, 0.28] — 3 lado a lado na folha deitada)
function pvQuadros(doc, Y, quadros, proporcao = 0.5) {
    const { ML, CW } = PV, gap = 4;
    const lista = quadros.filter(Boolean);
    if (!lista.length) return Y;
    const util = CW - gap * (lista.length - 1);
    const ws = lista.length === 1 ? [CW]
        : Array.isArray(proporcao) && proporcao.length === lista.length ? proporcao.map(p => util * p)
        : lista.length === 2 ? [util * proporcao, util * (1 - proporcao)]
        : lista.map(() => util / lista.length);
    const h = Math.max(...lista.map((q, i) => _pvAlturaQuadro(doc, q, ws[i])));
    Y = pvGarantir(doc, Y, h);
    let x = ML;
    lista.forEach((q, i) => { _pvDesenhaQuadro(doc, q, x, Y, ws[i], h); x += ws[i] + gap; });
    return Y + h + 4;
}

function pvTituloSecao(doc, Y, titulo) {
    const { ML, CW } = PV, C = PDF_CORES;
    Y = pvGarantir(doc, Y, 18);
    doc.setFillColor(...C.AZUL_CLARO); doc.rect(ML, Y, CW, 6, 'F');
    doc.setFillColor(...C.AZUL); doc.rect(ML, Y, 1.4, 6, 'F');
    _pvT(doc, 'bold', 7.2, C.AZUL, titulo, ML + 4, Y + 4.2);
    return Y + 8;
}

// Tabela: colunas = [{ rot, w (0 = resto), al: 'l'|'r' }], linhas = [[{ txt, sub?, negrito?, cor? }|string]]
// maxTxt / maxSub: quantas linhas o texto e o subtexto de cada célula podem ocupar
function pvTabela(doc, Y, colunas, linhas, { vazio = '', maxTxt = 3, maxSub = 2 } = {}) {
    const { ML, CW } = PV, C = PDF_CORES;
    const fixo = colunas.reduce((t, c) => t + (c.w || 0), 0);
    const cols = colunas.map(c => ({ ...c, w: c.w || (CW - fixo) }));
    const xs = []; cols.reduce((x, c) => { xs.push(x); return x + c.w; }, ML);
    // títulos longos quebram em até 2 linhas (cabeçalho cresce de 7 para 10mm)
    const rotulos = cols.map(c => _pvCorta(doc, c.rot, c.w - 3, 6, 'bold').slice(0, 2));
    const hCab = rotulos.some(r => r.length > 1) ? 10 : 7;
    const cab = y => {
        doc.setFillColor(...C.NAVY); doc.rect(ML, y, CW, hCab, 'F');
        cols.forEach((c, i) => rotulos[i].forEach((ln, k) => _pvT(doc, 'bold', 6, C.BRANCO, ln,
            c.al === 'r' ? xs[i] + c.w - 2 : xs[i] + 2, y + (hCab === 7 ? 4.6 : 4.2 + k * 3), { align: c.al === 'r' ? 'right' : 'left' })));
        return y + hCab;
    };
    Y = pvGarantir(doc, Y, 16);
    Y = cab(Y);
    if (!linhas.length && vazio) { _pvT(doc, 'normal', 7.5, C.CINZA, vazio, ML + 2, Y + 5); return Y + 9; }
    linhas.forEach((ln, r) => {
        const cel = ln.map(v => (typeof v === 'object' && v !== null) ? v : { txt: v });
        const altura = Math.max(...cel.map((c, i) => {
            const linhasTxt = _pvCorta(doc, c.txt ?? '', cols[i].w - 4, 7.8).slice(0, maxTxt).length;
            const linhasSub = c.sub ? _pvCorta(doc, c.sub, cols[i].w - 4, 6.2).slice(0, maxSub).length : 0;
            return linhasTxt * 3.6 + linhasSub * 3 + 3.6;
        }), 7.5);
        Y = pvGarantir(doc, Y, altura, y => cab(y));
        if (r % 2 === 1) { doc.setFillColor(...C.CINZA_BG); doc.rect(ML, Y, CW, altura, 'F'); }
        doc.setDrawColor(229, 234, 242); doc.setLineWidth(0.2); doc.line(ML, Y + altura, ML + CW, Y + altura);
        cel.forEach((c, i) => {
            const al = cols[i].al === 'r' ? 'right' : 'left';
            const x = al === 'right' ? xs[i] + cols[i].w - 2 : xs[i] + 2;
            let y = Y + 4.2;
            _pvCorta(doc, c.txt ?? '', cols[i].w - 4, 7.8, c.negrito ? 'bold' : 'normal').slice(0, maxTxt).forEach(t => {
                _pvT(doc, c.negrito ? 'bold' : 'normal', 7.8, c.cor || C.PRETO, t, x, y, { align: al }); y += 3.6;
            });
            if (c.sub) _pvCorta(doc, c.sub, cols[i].w - 4, 6.2).slice(0, maxSub).forEach(t => { _pvT(doc, 'normal', 6.2, C.CINZA, t, x, y - 0.4, { align: al }); y += 3; });
        });
        Y += altura;
    });
    return Y + 3;
}

// Resumo: estatísticas (logística) + texto por extenso à esquerda; totais à direita.
// stats = [[rót, val]], totais = [[rót, val]] (último = total geral), rotuloTotal
function pvResumo(doc, Y, { stats = [], extenso = '', rotExtenso = '', totais = [], rotuloTotal = '' }) {
    const { ML, CW } = PV, C = PDF_CORES;
    const wTot = totais.length ? 64 : 0, gap = totais.length ? 5 : 0, wEsq = CW - wTot - gap;
    const linhasExt = extenso ? _pvCorta(doc, `${rotExtenso}: ${extenso}`, wEsq, 7) : [];
    const hTot = totais.length ? (totais.length - 1) * 6 + 10 : 0;
    const hEsq = (stats.length ? 12 : 0) + (linhasExt.length ? linhasExt.length * 3.4 + 3 : 0);
    Y = pvGarantir(doc, Y, Math.max(hTot, hEsq) + 2);
    if (stats.length) {
        const n = stats.length, wB = (wEsq - (n - 1) * 2.5) / n;
        stats.forEach(([r, v], i) => {
            const x = ML + i * (wB + 2.5);
            doc.setFillColor(...C.CINZA_BG); doc.setDrawColor(...C.BORDA); doc.setLineWidth(0.25);
            doc.roundedRect(x, Y, wB, 11, 1.3, 1.3, 'FD');
            _pvT(doc, 'bold', 5.6, C.CINZA, r.toUpperCase(), x + 2.5, Y + 4);
            _pvT(doc, 'bold', 8, C.PRETO, _pvCorta(doc, v || '—', wB - 4, 8, 'bold')[0], x + 2.5, Y + 8.6);
        });
    }
    if (linhasExt.length) {
        let y = Y + (stats.length ? 16 : 3);
        linhasExt.forEach(l => { _pvT(doc, 'italic', 7, C.CINZA, l, ML, y); y += 3.4; });
    }
    if (totais.length) {
        const x = ML + wEsq + gap;
        doc.setFillColor(...C.BRANCO); doc.setDrawColor(...C.BORDA); doc.setLineWidth(0.25);
        doc.roundedRect(x, Y, wTot, hTot, 1.5, 1.5, 'FD');
        totais.slice(0, -1).forEach(([r, v], i) => {
            const y = Y + 4.5 + i * 6;
            _pvT(doc, 'normal', 7.8, C.PRETO, r, x + 3, y);
            _pvT(doc, 'bold', 7.8, C.PRETO, v, x + wTot - 3, y, { align: 'right' });
        });
        const yT = Y + hTot - 10;
        doc.setFillColor(...C.NAVY); doc.roundedRect(x, yT, wTot, 10, 1.5, 1.5, 'F'); doc.rect(x, yT, wTot, 4, 'F');
        _pvT(doc, 'bold', 5.8, [160, 190, 240], rotuloTotal, x + 3, yT + 6.2);
        _pvT(doc, 'bold', 11, C.BRANCO, totais[totais.length - 1][1], x + wTot - 3, yT + 6.8, { align: 'right' });
    }
    return Y + Math.max(hTot, hEsq) + 5;
}

// Assinaturas no pé da página (ou na próxima, se não couberem).
// assinaturas = [{ nome, rotulo }]; declaracao = texto acima (opcional)
function pvAssinaturas(doc, Y, assinaturas, declaracao = '') {
    const { ML, CW } = PV, C = PDF_CORES;
    const linhasDecl = declaracao ? _pvCorta(doc, declaracao, CW, 7) : [];
    const h = 16 + (linhasDecl.length ? linhasDecl.length * 3.4 + 6 : 0);
    if (Y + h > PV.LIM) { doc.addPage(); Y = 16; }
    let yBase = PV.LIM - 12;   // fixas no pé
    if (linhasDecl.length) {
        let y = yBase - 12 - linhasDecl.length * 3.4;
        linhasDecl.forEach(l => { _pvT(doc, 'italic', 7, [51, 65, 85], l, ML, y); y += 3.4; });
    }
    const n = assinaturas.length, gap = 20, w = n === 1 ? CW * 0.48 : (CW - gap) / 2;
    assinaturas.forEach((a, i) => {
        const x = ML + i * (w + gap);
        doc.setDrawColor(...C.CINZA); doc.setLineWidth(0.3); doc.line(x, yBase, x + w, yBase);
        _pvT(doc, 'bold', 7.8, C.PRETO, _pvCorta(doc, a.nome || '—', w, 7.8, 'bold')[0], x + w / 2, yBase + 4.2, { align: 'center' });
        _pvT(doc, 'normal', 6.5, C.CINZA, a.rotulo, x + w / 2, yBase + 7.8, { align: 'center' });
    });
}

function pvRodape(doc, { t = PDF_IDIOMAS.pt, textoDireita = '' } = {}) {
    const { ML, MR, W, H } = PV, C = PDF_CORES;
    const n = doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
        doc.setPage(p);
        doc.setFillColor(...C.NAVY); doc.rect(0, H - 10, W, 10, 'F');
        _pvT(doc, 'normal', 6.5, C.CLARO, t.gerado_com, ML, H - 4);
        _pvT(doc, 'normal', 6.5, C.CLARO, t.pagina(p, n), W / 2, H - 4, { align: 'center' });
        _pvT(doc, 'normal', 6.5, C.CLARO, textoDireita, MR, H - 4, { align: 'right' });
    }
}

// Quadro "Dados bancários" (cópia guardada na Proforma)
function pvQuadroBanco(dados, t, beneficiarioPadrao) {
    if (!dados) return null;
    const grade = [
        [t.beneficiario, dados.beneficiario || beneficiarioPadrao], [t.banco, dados.banco],
        [`${t.agencia} / ${t.conta}`, [dados.agencia, dados.conta].filter(Boolean).join(' / ')],
        [t.swift, dados.swift], [t.moeda, dados.moeda], [t.endereco_banco, dados.endereco_banco], [t.iban, dados.iban],
    ].filter(([, v]) => v && String(v).trim());
    return grade.length ? { titulo: t.dados_bancarios, grade } : null;
}
