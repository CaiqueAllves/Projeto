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
