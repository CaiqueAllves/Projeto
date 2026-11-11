-- Remoção definitiva das tabelas do Pedido (2026-11-11)
-- O módulo Pedido foi eliminado do sistema em 2026-10-13 (Proposta → Proforma
-- direto). As tabelas pedidos, pedido_itens e pedido_documentos ficaram no banco
-- sem uso, junto com as colunas pedido_id em outras tabelas e os buckets
-- pedido-documentos-assinados e pedido-confirmacoes.
--
-- ⚠️  SÓ RODE COM O BACKUP ATIVO e com um backup do dia CONFERIDO (Release no
--     repositório marpex-backups). Depois disto, os Pedidos antigos só voltam
--     pelo backup.
--
-- Tudo roda numa transação: se algo falhar, nada é apagado. Antes de apagar,
-- o SQL confere se alguma função ou view do banco ainda usa as tabelas; se usar,
-- para com a lista do que depende delas (mande o resultado para revisar).
-- Pode rodar de novo sem erro.

BEGIN;

-- 1. Trava de segurança: funções e views que ainda citam o Pedido
DO $$
DECLARE funcoes TEXT; visoes TEXT;
BEGIN
    SELECT string_agg(DISTINCT p.proname, ', ') INTO funcoes
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prosrc ~* '\m(pedidos|pedido_itens|pedido_documentos|pedido_id)\M';
    SELECT string_agg(viewname, ', ') INTO visoes
      FROM pg_views
     WHERE schemaname = 'public'
       AND definition ~* '\m(pedidos|pedido_itens|pedido_documentos|pedido_id)\M';
    IF funcoes IS NOT NULL OR visoes IS NOT NULL THEN
        RAISE EXCEPTION 'Nada foi apagado. Ainda usam o Pedido — funções: % | views: %',
            coalesce(funcoes, '(nenhuma)'), coalesce(visoes, '(nenhuma)');
    END IF;
END $$;

-- 2. Linha do tempo das Propostas: guarda o número do Pedido no próprio evento
--    (a tela mostrava pelo vínculo com a tabela pedidos, que vai sumir)
DO $$
BEGIN
    IF to_regclass('public.pedidos') IS NOT NULL THEN
        UPDATE oportunidade_historico h
           SET para_valor = p.numero
          FROM pedidos p
         WHERE h.pedido_id = p.id
           AND h.evento = 'pedido_gerado'
           AND coalesce(h.para_valor, '') = '';
    END IF;
END $$;

-- 3. Arquivos dos buckets do Pedido vão para a fila da limpeza noturna
--    (a função limpar-arquivos apaga do Storage e esvazia a fila)
INSERT INTO arquivos_remover (bucket, caminho)
SELECT o.bucket_id, o.name
  FROM storage.objects o
 WHERE o.bucket_id IN ('pedido-documentos-assinados', 'pedido-confirmacoes')
   AND NOT EXISTS (SELECT 1 FROM arquivos_remover a WHERE a.bucket = o.bucket_id AND a.caminho = o.name);

-- 4. Colunas pedido_id nas tabelas que continuam (levam junto a ligação com pedidos)
ALTER TABLE IF EXISTS proformas              DROP COLUMN IF EXISTS pedido_id;
ALTER TABLE IF EXISTS processos              DROP COLUMN IF EXISTS pedido_id;
ALTER TABLE IF EXISTS contas_pagar           DROP COLUMN IF EXISTS pedido_id;
ALTER TABLE IF EXISTS contas_receber         DROP COLUMN IF EXISTS pedido_id;
ALTER TABLE IF EXISTS oportunidade_historico DROP COLUMN IF EXISTS pedido_id;

-- 5. As tabelas do Pedido (sem CASCADE: se ainda houver dependência, para aqui)
DROP TABLE IF EXISTS pedido_documentos;
DROP TABLE IF EXISTS pedido_itens;
DROP TABLE IF EXISTS pedidos;

-- 6. Numeração e histórico de alterações do Pedido
DELETE FROM contadores_numeracao WHERE tipo ILIKE 'pedido%';
DELETE FROM historico_alteracoes WHERE tabela IN ('pedidos', 'pedido_itens', 'pedido_documentos');

COMMIT;

-- Verificação (1 linha): tabelas e colunas removidas, arquivos na fila
SELECT
    (SELECT count(*) FROM information_schema.tables  WHERE table_schema = 'public' AND table_name IN ('pedidos', 'pedido_itens', 'pedido_documentos')) AS tabelas_restantes,
    (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'pedido_id')                                       AS colunas_pedido_id,
    (SELECT count(*) FROM arquivos_remover WHERE bucket IN ('pedido-documentos-assinados', 'pedido-confirmacoes'))                                        AS arquivos_na_fila;
-- Esperado: 0 | 0 | (qualquer número). No dia seguinte (limpeza às 03:30 UTC),
-- os buckets pedido-documentos-assinados e pedido-confirmacoes ficam vazios e
-- podem ser apagados pelo painel: Storage → bucket → Delete bucket.
