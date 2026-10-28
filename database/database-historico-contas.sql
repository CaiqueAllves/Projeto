-- Histórico das Contas a Pagar / Receber (2026-10-28)
-- Registra toda alteração das contas (criação, pagamento/recebimento
-- registrado, valores e datas, comprovante anexado/trocado/removido,
-- exclusão) com QUEM fez e QUANDO — mesmo mecanismo das Proformas/Processos
-- (tabela historico_alteracoes, função registrar_historico).
-- O histórico das contas só pode ser lido por quem tem o módulo Financeiro
-- (o restante do histórico continua visível para a empresa toda).
-- Também: travas de exclusão/alteração antes e depois da baixa e a coluna
-- commercial_invoice (fim do arquivo).
-- Só registra a partir de agora. Idempotente: pode rodar de novo sem erro.

-- Função do trigger: mesma de database-historico-etapas.sql, com a descrição
-- da conta como "código" do registro
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
                    -- etapas do Processo: guarda a lista inteira (o Histórico mostra o que mudou em cada etapa)
                    'de',   CASE WHEN length(coalesce((v_old -> k)::text, '')) > (CASE WHEN k = 'etapas' THEN 60000 ELSE 1500 END) THEN to_jsonb('(alterado)'::text) ELSE v_old -> k END,
                    'para', CASE WHEN length(coalesce((v_new -> k)::text, '')) > (CASE WHEN k = 'etapas' THEN 60000 ELSE 1500 END) THEN to_jsonb('(alterado)'::text) ELSE v_new -> k END));
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
            -- guarda também o arquivo e a assinatura com que o documento nasceu
            -- (o Histórico mostra "Arquivo anexado: X · gerado pelo sistema/upload")
            v_dif := jsonb_build_object('documento', jsonb_build_object('de', NULL, 'para', 'criado'));
            FOREACH k IN ARRAY ARRAY['arquivo_nome', 'arquivo_path', 'assinado', 'assinado_por', 'assinado_em'] LOOP
                IF (v_new ->> k) IS NOT NULL AND (v_new ->> k) <> 'false' THEN
                    v_dif := v_dif || jsonb_build_object(k, jsonb_build_object('de', NULL, 'para', v_new -> k));
                END IF;
            END LOOP;
        ELSIF TG_OP = 'DELETE' AND (v_old ->> 'arquivo_nome') IS NOT NULL THEN
            v_dif := jsonb_build_object('arquivo_nome', jsonb_build_object('de', v_old -> 'arquivo_nome', 'para', NULL));
        END IF;
        IF v_reg ->> 'processo_id' IS NOT NULL THEN
            v_dif := v_dif || jsonb_build_object('processo_id', jsonb_build_object('de', NULL, 'para', v_reg -> 'processo_id'));
        END IF;
    ELSE
        v_registro := (v_reg ->> 'id')::uuid;
        v_codigo   := coalesce(v_reg ->> 'codigo', v_reg ->> 'numero_processo', v_reg ->> 'descricao');   -- contas: a descrição
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

DROP TRIGGER IF EXISTS trg_historico_contas_pagar ON contas_pagar;
CREATE TRIGGER trg_historico_contas_pagar AFTER INSERT OR UPDATE OR DELETE ON contas_pagar
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

DROP TRIGGER IF EXISTS trg_historico_contas_receber ON contas_receber;
CREATE TRIGGER trg_historico_contas_receber AFTER INSERT OR UPDATE OR DELETE ON contas_receber
    FOR EACH ROW EXECUTE FUNCTION public.registrar_historico();

-- Leitura: histórico das contas só com o Financeiro
DROP POLICY IF EXISTS historico_alteracoes_sel ON historico_alteracoes;
CREATE POLICY historico_alteracoes_sel ON historico_alteracoes FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id()
           AND (tabela NOT IN ('contas_pagar', 'contas_receber') OR auth_tem_modulo('financeiro')));

-- ── Travas de alteração/exclusão (2026-10-28) ─────────────────────────────
-- Antes da baixa (sem pagamento/recebimento confirmado):
--   alterar → Financeiro; excluir → quem lançou a conta OU o Financeiro.
-- Depois da baixa (status pago/recebido ou data do pagamento preenchida):
--   alterar ou excluir → só o administrador (usuário master).
-- Quem lançou passa a enxergar as próprias contas (necessário para excluir).
DROP POLICY IF EXISTS contas_pagar_select_auth ON contas_pagar;
CREATE POLICY contas_pagar_select_auth ON contas_pagar FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id() AND (auth_tem_modulo('financeiro') OR criado_por = auth_usuario_id()));

DROP POLICY IF EXISTS contas_pagar_update_auth ON contas_pagar;
CREATE POLICY contas_pagar_update_auth ON contas_pagar FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro')
           AND ((status NOT IN ('pago') AND data_pagamento IS NULL) OR auth_is_admin()))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));

DROP POLICY IF EXISTS contas_pagar_delete_auth ON contas_pagar;
CREATE POLICY contas_pagar_delete_auth ON contas_pagar FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND (
        auth_is_admin()
        OR (status NOT IN ('pago') AND data_pagamento IS NULL
            AND (auth_tem_modulo('financeiro') OR criado_por = auth_usuario_id()))));

DROP POLICY IF EXISTS contas_receber_select_auth ON contas_receber;
CREATE POLICY contas_receber_select_auth ON contas_receber FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id() AND (auth_tem_modulo('financeiro') OR criado_por = auth_usuario_id()));

DROP POLICY IF EXISTS contas_receber_update_auth ON contas_receber;
CREATE POLICY contas_receber_update_auth ON contas_receber FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro')
           AND ((status NOT IN ('recebido') AND data_recebimento IS NULL) OR auth_is_admin()))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));

DROP POLICY IF EXISTS contas_receber_delete_auth ON contas_receber;
CREATE POLICY contas_receber_delete_auth ON contas_receber FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id() AND (
        auth_is_admin()
        OR (status NOT IN ('recebido') AND data_recebimento IS NULL
            AND (auth_tem_modulo('financeiro') OR criado_por = auth_usuario_id()))));

-- ── Commercial Invoice vinculada à conta (nº da CI do Processo) ────────────
ALTER TABLE contas_pagar   ADD COLUMN IF NOT EXISTS commercial_invoice TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS commercial_invoice TEXT;

-- Verificação: as 4 policies de cada tabela
SELECT tablename, policyname, cmd FROM pg_policies
 WHERE tablename IN ('contas_pagar', 'contas_receber') ORDER BY tablename, cmd;
