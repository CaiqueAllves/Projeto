-- "Referência Interna" do Produto virou Tags (ex: "sapato", "camiseta").
-- Mesmo formato de tags que já existe em parceiros.tags: JSONB array.
-- A coluna referencia_interna NÃO é apagada — fica como histórico morto
-- (o código para de ler/gravar nela a partir deste commit).

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Backfill: o que já estava em referencia_interna (texto livre) vira uma
-- tag única, em minúsculas, pra não perder o dado de quem já preencheu.
UPDATE produtos
SET tags = jsonb_build_array(lower(trim(referencia_interna)))
WHERE referencia_interna IS NOT NULL
  AND trim(referencia_interna) <> ''
  AND (tags IS NULL OR tags = '[]'::jsonb);

-- Índice GIN pra permitir filtrar/relatar por tag depois
-- (ex: WHERE tags @> '["sapato"]').
CREATE INDEX IF NOT EXISTS idx_produtos_tags ON produtos USING gin (tags);
