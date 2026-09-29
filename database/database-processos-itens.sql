-- Produtos do Processo (formularios.html → seção "Produtos do Processo").
-- Mesmo formato de proformas.itens: [{produto_id, produto, qtd, unidade, preco, moeda}].
-- Enquanto não rodar, o salvamento do Processo segue funcionando sem os produtos
-- (fallback em supabase-api.js → _semColunasSemAssinatura).
ALTER TABLE processos ADD COLUMN IF NOT EXISTS itens JSONB NOT NULL DEFAULT '[]'::jsonb;
