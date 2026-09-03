-- Motivo da Perda de uma Proposta — registrado quando a etapa vira
-- "perdido", pra alimentar Relatórios/análise depois (hoje não existe
-- nenhum jeito de saber POR QUE uma proposta foi perdida, só que foi).
-- Ver proposta.js (propToggleMotivoPerda/propAlterarEtapa) e
-- supabase-api.js (salvarOportunidade).

ALTER TABLE oportunidades ADD COLUMN IF NOT EXISTS motivo_perda TEXT;
