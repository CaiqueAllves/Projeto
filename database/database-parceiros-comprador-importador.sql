-- ============================================================
-- MARPEX — parceiros: novos Tipos "Comprador" e "Importador"
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: cadastro de Empresa (formularios.html) ganhou 2 novos
-- checkboxes de "Tipo" além de Fabricante/Fornecedor — Comprador e
-- Importador — disponíveis nos modelos Fabricante/Fornecedor, Company
-- e Outros (todos exceto Transportadora, que não usa esse grupo de Tipo).
--
-- vw_parceiros_completo é recriada porque foi definida com `p.*` — uma
-- view assim NÃO herda colunas novas automaticamente quando a tabela é
-- alterada depois; precisa recriar a view pra pegar a coluna nova.
--
-- Usa DROP + CREATE (não CREATE OR REPLACE): como as colunas novas do
-- `p.*` entram ANTES de `contatos`/`pag_*`/`rec_*` na lista de saída,
-- isso desloca a posição dessas colunas — e o Postgres não permite que
-- CREATE OR REPLACE VIEW mude a posição de uma coluna já existente
-- (erro 42P16 "cannot change name of view column"). Mesmo padrão já
-- usado em database-parceiros-modelo.sql.
-- ============================================================

ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS is_comprador  BOOLEAN DEFAULT false;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS is_importador BOOLEAN DEFAULT false;

DROP VIEW IF EXISTS vw_parceiros_completo;

CREATE VIEW vw_parceiros_completo AS
SELECT
    p.*,
    COALESCE(
        (SELECT json_agg(c ORDER BY c.ordem)
         FROM parceiro_contatos c
         WHERE c.parceiro_id = p.id),
        '[]'::json
    ) AS contatos,
    f.pag_forma,      f.pag_condicao,  f.pag_banco,     f.pag_tipo_conta,
    f.pag_agencia,    f.pag_conta,
    f.rec_forma,      f.rec_moeda,     f.rec_banco,      f.rec_tipo_conta,
    f.rec_agencia,    f.rec_conta
FROM parceiros p
LEFT JOIN parceiro_financeiro f ON f.parceiro_id = p.id;
