-- Histórico de alterações (auditoria) de Proformas, Processos e Documentos
--
-- Registrado pelo próprio banco (triggers), então nada escapa: vale para
-- qualquer tela, para o kanban, para a assinatura digital pelo link e para a
-- remoção automática (registrada como "Sistema").
--
-- Cada linha guarda: quem (usuário), quando, o que (criado / alterado /
-- excluído / restaurado / removido / documento) e, nas alterações, cada campo
-- com o valor de antes e o de depois. Campos muito grandes (ex.: lista de
-- produtos) guardam só que mudaram.
-- Idempotente: pode rodar de novo sem erro.

CREATE TABLE IF NOT EXISTS historico_alteracoes (
    id            BIGSERIAL PRIMARY KEY,
    empresa_id    UUID,
    tabela        TEXT NOT NULL,          -- proformas | processos | proforma_documentos
    registro_id   UUID NOT NULL,          -- id da Proforma / Processo (documentos: id da Proforma)
    codigo        TEXT,                   -- código da Proforma / número do Processo / tipo do documento
    acao          TEXT NOT NULL,
    alteracoes    JSONB,
    usuario_id    UUID,
    usuario_nome  TEXT,
    criado_em     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_historico_registro ON historico_alteracoes(registro_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_historico_empresa  ON historico_alteracoes(empresa_id, criado_em DESC);

ALTER TABLE historico_alteracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS historico_alteracoes_sel ON historico_alteracoes;
CREATE POLICY historico_alteracoes_sel ON historico_alteracoes FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
-- sem policy de INSERT/UPDATE/DELETE: só os triggers (SECURITY DEFINER) escrevem, ninguém edita o histórico

CREATE OR REPLACE FUNCTION public.registrar_historico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old     jsonb;
    v_new     jsonb;
    v_reg     jsonb;
    v_dif     jsonb := '{}'::jsonb;
    k         text;
    v_acao    text;
    v_uid     uuid := auth.uid();
    v_usu_id  uuid;
    v_nome    text;
    v_empresa uuid;
    v_registro uuid;
    v_codigo  text;
    ignorar   text[] := ARRAY['atualizado_em', 'status_atualizado_em', 'updated_at', 'created_at', 'criado_em', 'atualizado_por'];
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_old := to_jsonb(OLD); v_reg := v_old; v_acao := 'removido';
    ELSIF TG_OP = 'INSERT' THEN
        v_new := to_jsonb(NEW); v_reg := v_new; v_acao := 'criado';
    ELSE
        v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_reg := v_new;
        FOR k IN SELECT jsonb_object_keys(v_new) LOOP
            CONTINUE WHEN k = ANY (ignorar);
            IF (v_old -> k) IS DISTINCT FROM (v_new -> k) THEN
                v_dif := v_dif || jsonb_build_object(k, jsonb_build_object(
                    'de',   CASE WHEN length(coalesce((v_old -> k)::text, '')) > 1500 THEN to_jsonb('(alterado)'::text) ELSE v_old -> k END,
                    'para', CASE WHEN length(coalesce((v_new -> k)::text, '')) > 1500 THEN to_jsonb('(alterado)'::text) ELSE v_new -> k END));
            END IF;
        END LOOP;
        IF v_dif = '{}'::jsonb THEN RETURN NEW; END IF;
        v_acao := CASE
            WHEN TG_TABLE_NAME = 'proforma_documentos' THEN 'documento'
            WHEN v_new ->> 'status' = 'excluido' AND (v_old ->> 'status') IS DISTINCT FROM 'excluido' THEN 'excluido'
            WHEN v_old ->> 'status' = 'excluido' AND (v_new ->> 'status') IS DISTINCT FROM 'excluido' THEN 'restaurado'
            ELSE 'alterado' END;
    END IF;

    IF TG_TABLE_NAME = 'proforma_documentos' THEN
        v_registro := (v_reg ->> 'proforma_id')::uuid;
        v_codigo   := v_reg ->> 'tipo_documento';
        SELECT empresa_id INTO v_empresa FROM proformas WHERE id = v_registro;
        IF TG_OP <> 'UPDATE' THEN v_acao := 'documento'; END IF;
        IF TG_OP = 'INSERT' THEN
            v_dif := jsonb_build_object('documento', jsonb_build_object('de', NULL, 'para', 'criado'));
        END IF;
        IF v_reg ->> 'processo_id' IS NOT NULL THEN
            v_dif := v_dif || jsonb_build_object('processo_id', jsonb_build_object('de', NULL, 'para', v_reg -> 'processo_id'));
        END IF;
    ELSE
        v_registro := (v_reg ->> 'id')::uuid;
        v_codigo   := coalesce(v_reg ->> 'codigo', v_reg ->> 'numero_processo');
        v_empresa  := coalesce((v_reg ->> 'empresa_id')::uuid, (v_reg ->> 'empresa_proprietaria_id')::uuid);
    END IF;

    IF v_uid IS NOT NULL THEN
        SELECT id, coalesce(nome_completo, email) INTO v_usu_id, v_nome FROM usuarios WHERE auth_id = v_uid;
    END IF;
    IF v_nome IS NULL THEN
        v_nome := CASE WHEN v_uid IS NULL AND current_user IN ('postgres', 'supabase_admin') THEN 'Sistema'
                       WHEN v_uid IS NULL THEN 'Assinatura pelo link / Sistema' ELSE 'Usuário' END;
    END IF;

    INSERT INTO historico_alteracoes (empresa_id, tabela, registro_id, codigo, acao, alteracoes, usuario_id, usuario_nome)
    VALUES (v_empresa, TG_TABLE_NAME, v_registro, v_codigo, v_acao,
            CASE WHEN v_dif = '{}'::jsonb THEN NULL ELSE v_dif END, v_usu_id, v_nome);

    RETURN coalesce(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
    -- histórico nunca pode impedir a gravação principal
    RAISE WARNING 'registrar_historico: %', SQLERRM;
    RETURN coalesce(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_historico_proformas ON proformas;
CREATE TRIGGER trg_historico_proformas AFTER INSERT OR UPDATE OR DELETE ON proformas
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico_processos ON processos;
CREATE TRIGGER trg_historico_processos AFTER INSERT OR UPDATE OR DELETE ON processos
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico_proforma_documentos ON proforma_documentos;
CREATE TRIGGER trg_historico_proforma_documentos AFTER INSERT OR UPDATE OR DELETE ON proforma_documentos
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();
