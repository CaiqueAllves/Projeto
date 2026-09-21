-- ============================================================
-- MARPEX — número de referência do chamado (#0001, #0002, ...)
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Cada chamado ganha um número sequencial curto, usado como referência
-- (Central de Chamados, mensagem de WhatsApp, "Meus chamados"). Os chamados
-- já existentes são numerados pela data de criação (o mais antigo = 1).
-- ============================================================

CREATE SEQUENCE IF NOT EXISTS chamados_numero_seq;

ALTER TABLE chamados ADD COLUMN IF NOT EXISTS numero BIGINT;

-- Backfill na ordem de criação (só quem ainda não tem número)
WITH ordenados AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) + coalesce((SELECT max(numero) FROM chamados), 0) AS n
    FROM chamados WHERE numero IS NULL
)
UPDATE chamados c SET numero = o.n FROM ordenados o WHERE c.id = o.id;

SELECT setval('chamados_numero_seq', greatest(coalesce((SELECT max(numero) FROM chamados), 0), 1), (SELECT count(*) > 0 FROM chamados));

ALTER TABLE chamados ALTER COLUMN numero SET DEFAULT nextval('chamados_numero_seq');
ALTER TABLE chamados ALTER COLUMN numero SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chamados_numero ON chamados(numero);
