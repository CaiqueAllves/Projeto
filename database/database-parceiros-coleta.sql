-- ============================================================
-- MARPEX — parceiros: endereço de coleta (separado do endereço fiscal)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o cadastro de Empresa (formularios.html) tem dois endereços —
-- o da empresa (fiscal: cep/estado/cidade/bairro/endereco/numero/complemento,
-- já em parceiros) e o "Endereço de Coleta" + horários. Até aqui o de coleta
-- só existia na tela: o salvamento nunca o enviava ao banco. Estas colunas
-- guardam o de coleta separado do fiscal (prefixo coleta_).
--
-- (Achado junto: parceiros.bairro já existia mas o app nunca o gravava — o
-- código passa a gravar. Nenhuma coluna nova é necessária pra isso.)
--
-- vw_parceiros_completo é definida com p.*, então NÃO herda colunas novas
-- sozinha: recriada com DROP + CREATE (não CREATE OR REPLACE — as colunas novas
-- entram antes de contatos/pag_*/rec_* e mudam a posição delas, erro 42P16;
-- ver database-parceiros-comprador-importador.sql). Como o DROP apaga a opção
-- security_invoker, ela é reaplicada no fim (ver database-processos-rls-e-view.sql),
-- senão a view voltaria a ignorar a RLS de parceiros.
-- ============================================================

ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_mesmo_fiscal BOOLEAN DEFAULT false;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_cep          TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_estado       TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_cidade       TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_bairro       TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_endereco     TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_numero       TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_complemento  TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_horario      TEXT;
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS coleta_intervalo    TEXT;

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
