-- ============================================================
-- MARPEX — Plano de Contas: Bloco 1 (Receitas)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Primeira etapa da integração do Plano de Contas de Exportação (PDF
-- fornecido pelo usuário, 2026-08-27). Cria uma tabela de referência
-- hierárquica (Bloco > Conta > Subfator) e já popula só o Bloco 1
-- (RECEITAS) — os outros 6 blocos entram em migrações futuras,
-- reaproveitando esta mesma tabela (basta inserir linhas novas com
-- bloco = 2, 3, 4...).
--
-- Decisão tomada com o usuário: por enquanto a vinculação com o
-- Comercial (Proforma/Pedido) é manual — o usuário escolhe a Conta na
-- hora de lançar a Conta a Receber. Sugestão automática (ex: baseada
-- em Bem x Serviço do Pedido) fica pra uma melhoria futura, já que
-- Proforma/Pedido/Produto não têm hoje um campo estruturado pra isso.
-- ============================================================

CREATE TABLE IF NOT EXISTS plano_contas (
    id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bloco         SMALLINT NOT NULL,       -- 1 = Receitas, 2 = Aquisições, ... (blocos futuros)
    bloco_nome    TEXT NOT NULL,           -- 'RECEITAS'
    conta_codigo  TEXT NOT NULL,           -- '01.01' — nível pai, usado pra agrupar (optgroup) na UI
    conta_nome    TEXT NOT NULL,           -- 'EXPORTAÇÃO DE SERVIÇOS'
    codigo        TEXT NOT NULL UNIQUE,    -- '01.01.01' — código do subfator (nível folha, o que é selecionado)
    subfator_nome TEXT NOT NULL,           -- 'Serviços Próprios'
    descricao     TEXT,                    -- descrição do subfator
    base          TEXT,                    -- unidade de referência ('Valor contratado', 'Hora / projeto', etc.)
    ordem         INTEGER NOT NULL,
    ativo         BOOLEAN DEFAULT true,
    criado_em     TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de referência global (igual pra todos os tenants, como
-- apoio_moedas) — só leitura pelo app, sem insert/update/delete via
-- anon; blocos novos entram por migração, não pela interface.
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "plano_contas_select" ON plano_contas;
CREATE POLICY "plano_contas_select" ON plano_contas FOR SELECT TO anon USING (true);

INSERT INTO plano_contas (bloco, bloco_nome, conta_codigo, conta_nome, codigo, subfator_nome, descricao, base, ordem) VALUES
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.01','Serviços Próprios','Serviço executado diretamente pela empresa exportadora','Valor contratado',1),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.02','Revenda de Serviços','Serviço adquirido de terceiro e revendido ao cliente no exterior','Valor de venda',2),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.03','Serviços Compostos','Serviço formado por execução própria + serviços adquiridos de terceiros','Valor contratado',3),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.04','Consultoria / Assessoria','Serviços de consultoria, assessoria e orientação especializada','Valor contratado',4),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.05','Serviços Técnicos / Especializados','Serviços técnicos ou especializados exportados','Hora / projeto / valor',5),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.06','Gestão / Coordenação de Projeto','Gestão de processo ou projeto para cliente no exterior','Fixo / projeto / período',6),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.07','Serviços Operacionais','Execução operacional contratada pelo cliente','Operação / processo',7),
(1,'RECEITAS','01.01','EXPORTAÇÃO DE SERVIÇOS','01.01.08','Outros Serviços Exportados','Serviços não enquadrados nas contas anteriores','Valor contratado',8),

(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.01','Venda de Produto Próprio','Produto produzido ou de titularidade da própria empresa','Unidade / kg / litro etc.',9),
(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.02','Revenda de Mercadoria Nacional','Mercadoria adquirida no Brasil para exportação','Quantidade × preço',10),
(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.03','Revenda de Mercadoria Importada/Nacionalizada','Mercadoria previamente importada e posteriormente exportada','Quantidade × preço',11),
(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.04','Venda de Mercadoria sob Marca de Terceiro','Mercadoria comercializada/exportada sob marca de terceiro','Quantidade × preço',12),
(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.05','Venda de Kits / Combos / Conjuntos','Venda composta por múltiplos produtos','Kit / conjunto',13),
(1,'RECEITAS','01.02','EXPORTAÇÃO DE BENS E MERCADORIAS','01.02.06','Outras Vendas de Bens e Mercadorias','Demais receitas de exportação de bens','Quantidade × preço',14),

(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.01','Comissão sobre Venda Internacional','Comissão recebida pela realização/intermediação da venda','% da venda',15),
(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.02','Comissão de Representação Comercial','Receita decorrente de representação internacional','% / fixo',16),
(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.03','Comissão de Intermediação','Aproximação/intermediação entre comprador e vendedor','% / valor',17),
(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.04','Success Fee','Receita condicionada ao fechamento ou resultado da operação','% / valor',18),
(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.05','Fee Comercial Fixo','Remuneração comercial independente do valor negociado','Valor',19),
(1,'RECEITAS','01.03','COMISSÕES / INTERMEDIAÇÕES / REPRESENTAÇÕES','01.03.06','Outras Comissões','Outras receitas dessa natureza','% / valor',20),

(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.01','Receita de Frete Repassado ao Cliente','Frete cobrado separadamente do cliente','Valor',21),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.02','Receita de Seguro Repassado','Seguro cobrado separadamente','Valor',22),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.03','Receita de Embalagem / Acondicionamento','Cobrança específica de embalagem','Unidade / valor',23),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.04','Receita de Documentação','Documentos cobrados separadamente','Documento / processo',24),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.05','Receita de Logística / Operação','Serviço operacional cobrado adicionalmente','Operação',25),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.06','Receita de Armazenagem','Armazenagem cobrada do cliente','Dia / pallet / m³',26),
(1,'RECEITAS','01.04','RECEITAS ACESSÓRIAS DA OPERAÇÃO','01.04.07','Outras Receitas Acessórias','Receita vinculada à exportação não incluída no preço principal','Valor',27),

(1,'RECEITAS','01.05','REEMBOLSOS E REPASSES','01.05.01','Reembolso de Frete','Recuperação de despesa paga por conta do cliente','Valor efetivo',28),
(1,'RECEITAS','01.05','REEMBOLSOS E REPASSES','01.05.02','Reembolso de Taxas','Recuperação de taxas pagas por conta do cliente','Valor efetivo',29),
(1,'RECEITAS','01.05','REEMBOLSOS E REPASSES','01.05.03','Reembolso de Documentação','Recuperação de despesas documentais','Valor efetivo',30),
(1,'RECEITAS','01.05','REEMBOLSOS E REPASSES','01.05.04','Reembolso de Despesas Operacionais','Recuperação de outras despesas da operação','Valor efetivo',31),
(1,'RECEITAS','01.05','REEMBOLSOS E REPASSES','01.05.05','Outros Reembolsos / Repasses','Demais valores recuperados do cliente','Valor efetivo',32),

(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.01','Desconto Comercial','Desconto concedido sobre o preço','% / valor',33),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.02','Bonificação Financeira','Bonificação que reduz efetivamente a receita','% / valor',34),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.03','Cancelamento','Receita cancelada','Valor',35),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.04','Devolução de Mercadoria','Valor da mercadoria devolvida','Quantidade × valor',36),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.05','Estorno de Serviço','Estorno total ou parcial de serviço','Valor',37),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.06','Ajuste Comercial / Credit Note','Ajustes posteriores que reduzam a receita','Valor',38),
(1,'RECEITAS','1.90','DEDUÇÕES DA RECEITA','1.90.07','Outras Deduções da Receita','Demais reduções efetivas','Valor',39)
ON CONFLICT (codigo) DO NOTHING;

-- Substitui o antigo `categoria` (select de 4 opções, hoje nem usado
-- no DRE) em contas_receber. Mantém a coluna `categoria` como está —
-- sem remoção, só deixa de ser preenchida por telas novas.
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS plano_conta_id UUID REFERENCES plano_contas(id);
