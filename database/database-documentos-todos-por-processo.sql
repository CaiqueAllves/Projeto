-- Documentos por Processo — todos os de embarque (2026-10-14)
-- Antes, só Commercial Invoice / Packing List / DUE eram de cada Processo;
-- NF-e, Certificado de Origem, LE, CTN e os do modal (BL, AWB, CRT, MIC/DTA,
-- FCL/LCL, Apólice, Manifesto) eram um só para a Proforma inteira — com 2+
-- Processos, um embarque sobrescrevia o outro. Agora só a Proforma Invoice é
-- da Proforma toda.
--
-- Este script move os anexos antigos (sem processo_id) para o Processo quando
-- não há dúvida: a Proforma tem UM único Processo (não excluído). Com 2+
-- Processos, eles ficam no bloco "Sem processo definido" da janela Documentos
-- para o usuário escolher o embarque.
-- Idempotente: pode rodar de novo sem erro.

UPDATE proforma_documentos d
   SET processo_id = u.processo_id
  FROM (
        SELECT proforma_id, (array_agg(id))[1] AS processo_id
          FROM processos
         WHERE status IS DISTINCT FROM 'excluido'
         GROUP BY proforma_id
        HAVING count(*) = 1
       ) u
 WHERE d.proforma_id = u.proforma_id
   AND d.processo_id IS NULL
   AND d.tipo_documento <> 'proforma'
   AND d.tipo_documento NOT LIKE 'custom\_%'
   -- não colide com um registro que já exista no Processo (UNIQUE proforma+tipo+processo)
   AND NOT EXISTS (
        SELECT 1 FROM proforma_documentos x
         WHERE x.proforma_id = d.proforma_id
           AND x.tipo_documento = d.tipo_documento
           AND x.processo_id = u.processo_id
       );

-- Conferência: anexos antigos que continuam sem processo (Proformas com 2+ Processos)
SELECT p.codigo AS proforma, d.tipo_documento, d.arquivo_nome
  FROM proforma_documentos d
  JOIN proformas p ON p.id = d.proforma_id
 WHERE d.processo_id IS NULL
   AND d.tipo_documento <> 'proforma'
   AND d.tipo_documento NOT LIKE 'custom\_%'
   AND (d.arquivo_path IS NOT NULL OR d.assinado)
 ORDER BY p.codigo;
