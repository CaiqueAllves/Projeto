-- Código DDI nos contatos da empresa (2026-11-03)
-- Guarda país e código juntos, ex.: "BR +55" (EUA e Canadá usam o mesmo +1).
-- Usado no WhatsApp das Propostas e dos Documentos.
-- Contatos já cadastrados ficam sem DDI até serem editados.
-- Sem esta coluna o sistema salva os contatos sem o DDI.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE parceiro_contatos ADD COLUMN IF NOT EXISTS ddi TEXT;

COMMENT ON COLUMN parceiro_contatos.ddi IS 'Código DDI do telefone: país + código, ex.: BR +55';

-- Verificação: 1 linha
SELECT column_name, data_type FROM information_schema.columns
 WHERE table_name = 'parceiro_contatos' AND column_name = 'ddi';
