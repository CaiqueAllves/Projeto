-- ============================================================
-- MARPEX — empresas: dados fiscais e endereço completo
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: a tela Perfil > Dados da Empresa (perfil.html/perfil.js,
-- abrirEditarEmpresa()/salvarEdicaoEmpresa()/atualizarTenantEmpresa())
-- e o formulário de Processo (auto-preenchimento do Emissor/Origem
-- quando é "Própria empresa") já foram escritos assumindo essas
-- colunas em "empresas" — mas elas nunca existiram ao vivo. Confirmado
-- por erro real: "column empresas.ie does not exist" (400) ao tentar
-- buscar os dados da empresa pra auto-preencher o Processo.
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS ie           TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS im           TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS suframa      TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cep          TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS estado       TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cidade       TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS endereco     TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS numero       TEXT;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS complemento  TEXT;
