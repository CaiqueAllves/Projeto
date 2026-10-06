-- Remoção definitiva de Proformas e Processos excluídos há MAIS de 7 dias
-- corridos sem restaurar (a tela Excluídos mostra esse prazo).
--
-- Antes desta migração o prazo era só visual: nada era removido.
--
-- O que acontece com cada item vencido:
--   - Processos da Proforma e os próprios Processos excluídos sozinhos são apagados;
--   - documentos (proforma_documentos) caem junto (ON DELETE CASCADE);
--   - vínculos que não podem ficar apontando pra um registro apagado viram NULL:
--     contas_pagar/contas_receber (proforma_id, processo_id), oportunidades.proforma_id,
--     proformas.processo_gerado_id.
-- Os arquivos anexados no Storage são removidos pelo próprio sistema
-- (supabase-api.js → purgarExcluidosVencidos) antes de chamar esta função.
--
-- Roda todo dia às 03:15 (UTC) via pg_cron e também é chamada pelo sistema.
-- Idempotente: pode rodar de novo sem erro.

CREATE OR REPLACE FUNCTION public.purgar_excluidos_vencidos()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    limite        timestamptz := now() - interval '7 days';
    v_proformas   uuid[];
    v_processos   uuid[];
BEGIN
    SELECT coalesce(array_agg(id), '{}') INTO v_proformas
      FROM proformas WHERE status = 'excluido' AND excluido_em IS NOT NULL AND excluido_em < limite;

    -- Processos vencidos sozinhos + todos os processos das proformas vencidas
    SELECT coalesce(array_agg(id), '{}') INTO v_processos
      FROM processos
     WHERE (status = 'excluido' AND excluido_em IS NOT NULL AND excluido_em < limite)
        OR proforma_id = ANY (v_proformas);

    IF cardinality(v_proformas) = 0 AND cardinality(v_processos) = 0 THEN
        RETURN jsonb_build_object('proformas', 0, 'processos', 0);
    END IF;

    UPDATE contas_receber SET processo_id = NULL WHERE processo_id = ANY (v_processos);
    UPDATE contas_pagar   SET processo_id = NULL WHERE processo_id = ANY (v_processos);
    UPDATE contas_receber SET proforma_id = NULL WHERE proforma_id = ANY (v_proformas);
    UPDATE contas_pagar   SET proforma_id = NULL WHERE proforma_id = ANY (v_proformas);
    UPDATE oportunidades  SET proforma_id = NULL WHERE proforma_id = ANY (v_proformas);
    UPDATE proformas      SET processo_gerado_id = NULL WHERE processo_gerado_id = ANY (v_processos);

    DELETE FROM processos WHERE id = ANY (v_processos);
    DELETE FROM proformas WHERE id = ANY (v_proformas);

    RETURN jsonb_build_object('proformas', cardinality(v_proformas), 'processos', cardinality(v_processos));
END;
$$;

REVOKE ALL ON FUNCTION public.purgar_excluidos_vencidos() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purgar_excluidos_vencidos() TO authenticated;

-- Agendamento diário (pg_cron). Se a extensão não puder ser habilitada no
-- seu plano, o sistema continua fazendo a limpeza ao ser aberto.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$ BEGIN
    PERFORM cron.unschedule('purgar-excluidos-vencidos')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-excluidos-vencidos');
    PERFORM cron.schedule('purgar-excluidos-vencidos', '15 3 * * *', 'SELECT public.purgar_excluidos_vencidos()');
END $$;
