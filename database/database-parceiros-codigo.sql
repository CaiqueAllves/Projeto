-- ============================================================
-- MARPEX — parceiros: Código Interno da empresa
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o formulário de Empresa tem o campo "Código Interno" (número que
-- identifica a empresa no sistema de cadastro interno de quem usa), mas a
-- coluna nunca existiu em parceiros — o valor era digitado e descartado.
--
-- vw_parceiros_completo usa p.*, então precisa ser recriada pra expor a
-- coluna nova (DROP + CREATE, não CREATE OR REPLACE — a coluna nova entra
-- antes de contatos/pag_*/rec_* e mudaria a posição delas, erro 42P16; ver
-- database-parceiros-coleta.sql). security_invoker é reaplicado no fim, senão
-- a view voltaria a ignorar a RLS de parceiros.
-- ============================================================

ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS codigo TEXT;

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

ALTER VIEW vw_parceiros_completo SET (security_invoker = true);
