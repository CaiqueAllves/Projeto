-- Corrige produtos.empresa_parceira_id: foi criado como UUID referenciando
-- empresas(id) (diretório global, RLS aberta pra qualquer autenticado — ver
-- database-rls-real-parte1.sql), mas o campo "Identificação da Empresa" do
-- Produto deveria buscar só nos PRÓPRIOS Parceiros do usuário (tabela
-- parceiros, id bigint, já isolada por empresa_id). O desenho anterior vazava
-- empresas cadastradas por outros tenants nesse campo.
--
-- Como só existe 1 registro de teste com esse campo preenchido em produção
-- (criado durante a investigação do bug, apontando pra um id de `empresas`
-- que não existe em `parceiros`), o mais simples e seguro é derrubar a coluna
-- e recriar já com o tipo/FK corretos — não há dado real pra migrar.
--
-- Ver project_produto_empresa_parceira_bug (memória) e formularios.js
-- (iniciarAutocompleteEmpresaProduto).

ALTER TABLE produtos DROP COLUMN IF EXISTS empresa_parceira_id;
ALTER TABLE produtos ADD COLUMN empresa_parceira_id BIGINT REFERENCES parceiros(id);
