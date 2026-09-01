-- Preços em outras moedas do Produto: lista solta de (Moeda, Preço),
-- independente da quantidade de idiomas cadastrados (mesmo padrão já usado
-- por nomes_idiomas/embalagens/documentos — array JSONB direto na linha do
-- produto, sem tabela filha nem RLS própria).
--
-- Formato de cada entrada: {"moeda": "USD", "preco_venda": 123.45}
-- (moeda = sigla de apoio_moedas; HS Code (produtos.hscode) só serve pra
-- exibição/conferência aqui, não é chave — SKU já é único por empresa).
--
-- Ver project_produto_precos_multiplos (memória) e formularios.js
-- (_prodColetarPrecos / prodAdicionarPrecoExtra).

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS precos_alternativos JSONB DEFAULT '[]'::jsonb;
