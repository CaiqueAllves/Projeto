-- Contas a Pagar / Receber: anexar comprovante depois da baixa (2026-10-30)
-- Conta baixada continua fechada, com uma exceção: quem tem o Financeiro pode
-- ACRESCENTAR comprovantes (preencher o principal vazio e os adicionais, até 2).
-- Não pode mudar mais nada, nem remover ou trocar um comprovante existente.
-- O administrador segue podendo alterar tudo. O Histórico registra quem anexou.
-- A trava fica num trigger porque a policy não enxerga o antes e o depois.
-- Idempotente: pode rodar de novo sem erro.

CREATE OR REPLACE FUNCTION public.fin_conta_baixada_trava()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_old   jsonb := to_jsonb(OLD);
    v_new   jsonb := to_jsonb(NEW);
    v_anexo text[] := ARRAY['comprovante_path', 'comprovante_nome', 'comprovantes_extras', 'atualizado_em'];
    v_baixada boolean;
BEGIN
    -- rotinas internas e SQL Editor (sem usuário logado) não passam por esta trava
    IF auth.uid() IS NULL OR auth_is_admin() THEN RETURN NEW; END IF;

    v_baixada := (v_old ->> 'status') IN ('pago', 'recebido')
              OR (v_old ->> 'data_pagamento') IS NOT NULL
              OR (v_old ->> 'data_recebimento') IS NOT NULL;
    IF NOT v_baixada THEN RETURN NEW; END IF;

    IF (v_old - v_anexo) IS DISTINCT FROM (v_new - v_anexo) THEN
        RAISE EXCEPTION 'Conta já baixada: só o administrador pode alterar. O Financeiro pode apenas anexar comprovantes.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- o principal já anexado não muda
    IF OLD.comprovante_path IS NOT NULL
       AND (OLD.comprovante_path IS DISTINCT FROM NEW.comprovante_path
            OR OLD.comprovante_nome IS DISTINCT FROM NEW.comprovante_nome) THEN
        RAISE EXCEPTION 'Conta já baixada: só o administrador pode trocar ou remover o comprovante.'
            USING ERRCODE = 'check_violation';
    END IF;
    -- os adicionais já anexados continuam na lista, com no máximo 2
    IF coalesce(jsonb_array_length(NEW.comprovantes_extras), 0) > 2
       OR NOT coalesce(NEW.comprovantes_extras, '[]'::jsonb) @> coalesce(OLD.comprovantes_extras, '[]'::jsonb) THEN
        RAISE EXCEPTION 'Conta já baixada: só o administrador pode trocar ou remover o comprovante.'
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_baixada_pagar ON contas_pagar;
CREATE TRIGGER trg_fin_baixada_pagar BEFORE UPDATE ON contas_pagar
    FOR EACH ROW EXECUTE FUNCTION public.fin_conta_baixada_trava();

DROP TRIGGER IF EXISTS trg_fin_baixada_receber ON contas_receber;
CREATE TRIGGER trg_fin_baixada_receber BEFORE UPDATE ON contas_receber
    FOR EACH ROW EXECUTE FUNCTION public.fin_conta_baixada_trava();

-- A policy passa a deixar o Financeiro chegar na conta baixada; o trigger acima limita o quê
DROP POLICY IF EXISTS contas_pagar_update_auth ON contas_pagar;
CREATE POLICY contas_pagar_update_auth ON contas_pagar FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));

DROP POLICY IF EXISTS contas_receber_update_auth ON contas_receber;
CREATE POLICY contas_receber_update_auth ON contas_receber FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'))
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_tem_modulo('financeiro'));

-- Verificação: 2 linhas
SELECT tgname, tgrelid::regclass AS tabela FROM pg_trigger
 WHERE tgname IN ('trg_fin_baixada_pagar', 'trg_fin_baixada_receber');
