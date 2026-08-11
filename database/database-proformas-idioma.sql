-- ============================================================
-- MARPEX — proformas.idioma / idioma_outro
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: novo campo "Idioma" no formulário de Proforma (mesmo
-- padrão select+"Outro" já usado no formulário de Produto), pra
-- indicar em qual idioma essa Proforma foi/deve ser gerada.
-- ============================================================

ALTER TABLE proformas ADD COLUMN IF NOT EXISTS idioma       TEXT DEFAULT 'pt';
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS idioma_outro TEXT;
