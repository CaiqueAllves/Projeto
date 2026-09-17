-- ============================================================
-- MARPEX — pedido_documentos: anexo desacoplado da assinatura
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: até aqui, "arquivo_path/arquivo_nome/enviado_por" só
-- existiam junto da assinatura (upload e assinatura aconteciam no
-- mesmo passo, só pela tela Documentos). Agora o anexo passa a poder
-- acontecer bem antes — direto na seção "Documentos" do formulário de
-- Processo (onde antes o botão "Anexar" era só decoração, o arquivo
-- nunca era salvo em lugar nenhum) — e a assinatura, feita depois na
-- tela Documentos, reaproveita esse mesmo arquivo sem precisar de um
-- novo upload.
--
-- "enviado_em" é novo: precisa de uma data própria pro anexo, já que
-- ele pode acontecer bem antes (ou nunca, se o documento for assinado
-- direto) da assinatura — "assinado_em" continua só pra assinatura.
-- ============================================================

ALTER TABLE pedido_documentos ADD COLUMN IF NOT EXISTS enviado_em TIMESTAMPTZ;
