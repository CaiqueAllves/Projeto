-- Nova seção "Embalagem Unitária" (Logística do Produto) reaproveita a
-- mesma tabela produto_embalagens da "Embalagem / Dimensões da Caixa" já
-- existente — só que como uma lista à parte, distinguida pela coluna
-- `tipo`. 'caixa' = a de transporte (com Modal/Acondicionamento/Cubagem,
-- já existia); 'unitaria' = a nova, do produto em si (Comprimento/Largura/
-- Altura/Volume/Quantidade/Peso, sem Modal/Acondicionamento).

ALTER TABLE produto_embalagens ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'caixa';
ALTER TABLE produto_embalagens ADD COLUMN IF NOT EXISTS quantidade INTEGER;

-- Postgres não aceita "ADD CONSTRAINT IF NOT EXISTS" — adiciona
-- defensivamente, ignorando se já existir.
DO $$ BEGIN
    ALTER TABLE produto_embalagens ADD CONSTRAINT chk_produto_embalagens_tipo CHECK (tipo IN ('caixa', 'unitaria'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_produto_embalagens_tipo ON produto_embalagens(produto_id, tipo);
