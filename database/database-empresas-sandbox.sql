-- ============================================================
-- MARPEX — empresas: suporte a conta sandbox (cadastro sem chave/empresa)
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: novo caminho de cadastro (login.html) permite criar conta sem
-- informar chave de empresa nem cadastrar uma nova — nesse caso é criada
-- uma empresa "sandbox" temporária (empresas.status = 'sandbox'), com
-- acesso de 24h. `expira_em` é a condição real do bloqueio de login em
-- auth.js; `status` continua sendo escrito como já era ('trial' pras
-- empresas reais criadas no cadastro normal, sem mudança nesse caso).
-- ============================================================

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS expira_em TIMESTAMPTZ;
