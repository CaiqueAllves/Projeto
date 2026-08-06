-- ============================================================
-- MARPEX — parceiros.modelo (Fabricante/Fornecedor, Company,
-- Transportadora, Outro — intermediário)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o card "Modelo" escolhido no cadastro de empresa
-- (formularios.html) nunca era salvo no banco — só decidia quais
-- checkboxes de "Tipo" mostrar na hora. Isso impedia relatórios
-- de contar quantas empresas foram cadastradas como "Outro"
-- (empresa intermediária), e também impedia restaurar esse valor
-- corretamente ao editar uma empresa já cadastrada como "Outro".
--
-- Registros já existentes não têm como saber com certeza qual
-- modelo foi escolhido originalmente — o backfill abaixo usa a
-- mesma heurística que já existia no front-end (transportadora
-- pela flag, estrangeira vira "company", resto vira "empresa").
-- Só cadastros feitos a partir de agora guardam o valor real,
-- incluindo "outros".
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS modelo TEXT;

UPDATE parceiros
SET modelo = CASE
    WHEN is_transportadora THEN 'transportadora'
    WHEN pais IS NOT NULL AND upper(pais) NOT IN ('BR', 'BRASIL', 'BRAZIL') THEN 'company'
    ELSE 'empresa'
END
WHERE modelo IS NULL;

ALTER TABLE parceiros ALTER COLUMN modelo SET DEFAULT 'empresa';

DO $$ BEGIN
    ALTER TABLE parceiros ADD CONSTRAINT parceiros_modelo_check
        CHECK (modelo IN ('empresa', 'company', 'transportadora', 'outros'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN parceiros.modelo IS 'Modelo escolhido no cadastro: empresa (Fabricante/Fornecedor BR), company (estrangeira), transportadora, outros (empresa intermediária)';

-- Recria a view pra expor a coluna nova no "p.*" (SELECT * numa view não
-- acompanha automaticamente colunas adicionadas depois na tabela — precisa
-- recriar a view pra ela "ver" a coluna nova).
-- Precisa ser DROP + CREATE (não CREATE OR REPLACE): a coluna "modelo" nova
-- entra no meio da lista de colunas de "p.*" (antes de "contatos"), e o
-- Postgres só permite REPLACE quando as colunas existentes não mudam de
-- posição/nome — só permite acrescentar colunas no final.
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
