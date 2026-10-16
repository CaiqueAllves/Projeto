-- Campos da Proforma usados no PDF vertical (2026-10-16)
--   incoterm_local     — local nomeado do Incoterm (Incoterms® 2020): "FOB Porto de Santos"
--   previsao_embarque  — previsão de embarque (quadro Embarque do PDF)
--   frete_valor        — frete (Incoterms C e D), somado ao total da Proforma
--   seguro_valor       — seguro (Incoterms C e D), somado ao total da Proforma
-- Sem estas colunas o sistema salva a Proforma sem esses campos.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS incoterm_local    TEXT;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS previsao_embarque DATE;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS frete_valor       NUMERIC(14,2);
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS seguro_valor      NUMERIC(14,2);
