-- ============================================================
-- MARPEX — processos: registro de "iniciado sem a Proforma assinada"
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: um Processo sempre nasce de uma Proforma. Até aqui o fluxo
-- esperado era só abrir o Processo depois da Proforma assinada (documento
-- "Nº Proforma Invoice" marcado como Assinado na tela Documentos — tabela
-- proforma_documentos, tipo_documento = 'proforma'). Agora dá pra iniciar
-- mesmo sem assinatura, desde que o usuário confirme num aviso (caixa
-- "li e aceito" + Sim). Estas colunas guardam esse aceite pra ficar visível
-- no formulário do Processo:
--   sem_assinatura               -> true quando o Processo foi iniciado com
--                                   a Proforma ainda não assinada
--   sem_assinatura_confirmado_por -> nome de quem aceitou (texto, snapshot)
--   sem_assinatura_confirmado_em  -> data/hora do aceite
-- ============================================================

ALTER TABLE processos ADD COLUMN IF NOT EXISTS sem_assinatura                BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS sem_assinatura_confirmado_por TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS sem_assinatura_confirmado_em  TIMESTAMPTZ;
