-- Melhorias de outubro/2026 (lista de melhorias do projeto)
--   A) Tarefas do Início no banco (antes ficavam só no navegador)
--   B) Histórico de relatórios gerados no banco (antes só no navegador)
--   C) Status anterior guardado ao excluir — restaurar volta ao status de antes
--   D) Arquivos órfãos: a remoção automática anota os anexos a apagar e a
--      Edge Function "limpar-arquivos" apaga do Storage (de qualquer empresa)
-- Idempotente: pode rodar de novo sem erro.

-- ── A) Tarefas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tarefas (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    UUID NOT NULL,
    usuario_id    UUID NOT NULL,
    usuario_nome  TEXT,
    titulo        TEXT NOT NULL,
    prioridade    TEXT NOT NULL DEFAULT 'media',
    prazo         DATE,
    concluida     BOOLEAN NOT NULL DEFAULT false,
    compartilhada BOOLEAN NOT NULL DEFAULT false,   -- visível para toda a equipe
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa ON tarefas(empresa_id, criado_em DESC);

ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tarefas_sel ON tarefas;
DROP POLICY IF EXISTS tarefas_ins ON tarefas;
DROP POLICY IF EXISTS tarefas_upd ON tarefas;
DROP POLICY IF EXISTS tarefas_del ON tarefas;
-- vê as suas e as compartilhadas da equipe; só altera/apaga as suas
CREATE POLICY tarefas_sel ON tarefas FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id() AND (compartilhada OR usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())));
CREATE POLICY tarefas_ins ON tarefas FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id() AND usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid()));
CREATE POLICY tarefas_upd ON tarefas FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND (compartilhada OR usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid())))
    WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY tarefas_del ON tarefas FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND usuario_id = (SELECT id FROM usuarios WHERE auth_id = auth.uid()));

-- ── B) Histórico de relatórios ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS relatorios_historico (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    UUID NOT NULL,
    usuario_id    UUID,
    usuario_nome  TEXT,
    modulo        TEXT NOT NULL DEFAULT 'operacional',   -- operacional | produtos
    tipo          TEXT NOT NULL,                         -- nome do relatório
    periodo       TEXT,
    formato       TEXT NOT NULL DEFAULT 'PDF',
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_relatorios_historico_empresa ON relatorios_historico(empresa_id, criado_em DESC);

ALTER TABLE relatorios_historico ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS relatorios_historico_sel ON relatorios_historico;
DROP POLICY IF EXISTS relatorios_historico_ins ON relatorios_historico;
DROP POLICY IF EXISTS relatorios_historico_del ON relatorios_historico;
CREATE POLICY relatorios_historico_sel ON relatorios_historico FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY relatorios_historico_ins ON relatorios_historico FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY relatorios_historico_del ON relatorios_historico FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id() AND auth_is_admin());

-- ── C) Status anterior ao excluir ──────────────────────────────────────
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS status_anterior TEXT;
ALTER TABLE processos ADD COLUMN IF NOT EXISTS status_anterior TEXT;

CREATE OR REPLACE FUNCTION public.guardar_status_anterior()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.status = 'excluido' AND OLD.status IS DISTINCT FROM 'excluido' THEN
        NEW.status_anterior := OLD.status;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_status_anterior_proformas ON proformas;
CREATE TRIGGER trg_status_anterior_proformas BEFORE UPDATE OF status ON proformas
    FOR EACH ROW EXECUTE FUNCTION public.guardar_status_anterior();
DROP TRIGGER IF EXISTS trg_status_anterior_processos ON processos;
CREATE TRIGGER trg_status_anterior_processos BEFORE UPDATE OF status ON processos
    FOR EACH ROW EXECUTE FUNCTION public.guardar_status_anterior();

-- ── D) Arquivos a remover do Storage ───────────────────────────────────
CREATE TABLE IF NOT EXISTS arquivos_remover (
    id         BIGSERIAL PRIMARY KEY,
    bucket     TEXT NOT NULL,
    caminho    TEXT NOT NULL,
    criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE arquivos_remover ENABLE ROW LEVEL SECURITY;
-- sem policies: só a função de purga (SECURITY DEFINER) e a Edge Function
-- (service_role) acessam

-- purga dos excluídos há mais de 7 dias, agora anotando os anexos a apagar
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

    SELECT coalesce(array_agg(id), '{}') INTO v_processos
      FROM processos
     WHERE (status = 'excluido' AND excluido_em IS NOT NULL AND excluido_em < limite)
        OR proforma_id = ANY (v_proformas);

    IF cardinality(v_proformas) = 0 AND cardinality(v_processos) = 0 THEN
        RETURN jsonb_build_object('proformas', 0, 'processos', 0);
    END IF;

    INSERT INTO arquivos_remover (bucket, caminho)
    SELECT 'proforma-documentos-assinados', arquivo_path
      FROM proforma_documentos
     WHERE arquivo_path IS NOT NULL
       AND (proforma_id = ANY (v_proformas) OR processo_id = ANY (v_processos));

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

-- Agendamento da Edge Function "limpar-arquivos" (rodar DEPOIS de publicá-la:
-- `supabase functions deploy limpar-arquivos`). Troque <SERVICE_ROLE_KEY> pela
-- chave service_role (Project Settings › API) e descomente:
--
-- CREATE EXTENSION IF NOT EXISTS pg_net;
-- SELECT cron.schedule('limpar-arquivos-orfaos', '30 3 * * *', $cron$
--     SELECT net.http_post(
--         url     := 'https://mvgbgjqkxsptbndgoskw.supabase.co/functions/v1/limpar-arquivos',
--         headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
--         body    := '{}'::jsonb)
-- $cron$);
