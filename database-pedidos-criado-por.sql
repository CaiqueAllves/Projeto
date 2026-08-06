-- ============================================================
-- MARPEX — pedidos.criado_por
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: a tela Documentos passou a mostrar quem criou cada
-- Pedido, mas essa informação nunca foi persistida — só existe
-- "empresa_proprietaria_id" (o tenant), não o usuário individual.
-- Mesmo padrão simples já usado em pedidos.excluido_por (texto
-- com nome/e-mail do usuário, não FK pra tabela usuarios).
--
-- Pedidos criados antes desta coluna existir ficam com o campo
-- vazio (não tem como recuperar retroativamente quem criou).
-- ============================================================

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS criado_por TEXT;
