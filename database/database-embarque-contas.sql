-- Embarque confirmado → Financeiro (2026-10-28)
-- A confirmação do embarque é a "Data de Embarque" do Processo (a mesma que
-- marca a etapa "Embarque confirmado"). A partir dela:
--   1) Contas a Receber do Processo: o vencimento conta da data de embarque
--      + o prazo de pagamento da Proforma (À vista = 0, 30 dias = 30...).
--      Ao confirmar/alterar a data de embarque, as contas ainda não recebidas
--      são recalculadas sozinhas. Prazo "Personalizado" não é recalculado.
--   2) Contas a Pagar do Processo (custas): o pagamento só pode ser
--      confirmado (status pago) depois que o embarque foi confirmado.
-- Contas sem Processo vinculado não mudam. Idempotente: pode rodar de novo.

-- prazo da Proforma em dias (null = personalizado / não informado)
CREATE OR REPLACE FUNCTION public.fin_prazo_dias(p_prazo TEXT)
RETURNS INTEGER LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE WHEN p_prazo = 'avista' THEN 0
                WHEN p_prazo ~ '^\d{1,4}$' THEN p_prazo::int
                ELSE NULL END
$$;

-- 1) Recalcula o vencimento das Contas a Receber quando o embarque é confirmado
CREATE OR REPLACE FUNCTION public.fin_embarque_recalcular_receber()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_dias INTEGER;
BEGIN
    IF NEW.data_embarque IS NULL OR NEW.data_embarque IS NOT DISTINCT FROM OLD.data_embarque THEN
        RETURN NEW;
    END IF;
    SELECT fin_prazo_dias(prazo_pagamento) INTO v_dias FROM proformas WHERE id = NEW.proforma_id;
    IF v_dias IS NULL THEN RETURN NEW; END IF;
    UPDATE contas_receber
       SET data_vencimento = NEW.data_embarque::date + v_dias,
           atualizado_em   = now()
     WHERE processo_id = NEW.id
       AND status NOT IN ('recebido', 'cancelado')
       AND data_recebimento IS NULL
       AND data_vencimento IS DISTINCT FROM NEW.data_embarque::date + v_dias;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- nunca impede salvar o Processo
    RAISE WARNING 'fin_embarque_recalcular_receber: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_embarque_receber ON processos;
CREATE TRIGGER trg_fin_embarque_receber AFTER UPDATE OF data_embarque ON processos
    FOR EACH ROW EXECUTE FUNCTION public.fin_embarque_recalcular_receber();

-- 2) Custas do Processo: pagamento só depois do embarque confirmado
CREATE OR REPLACE FUNCTION public.fin_embarque_trava_pagar()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_embarque DATE;
    v_numero   TEXT;
BEGIN
    IF NEW.processo_id IS NULL OR NEW.status <> 'pago' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN RETURN NEW; END IF;   -- já estava paga
    SELECT data_embarque::date, numero_processo INTO v_embarque, v_numero FROM processos WHERE id = NEW.processo_id;
    IF FOUND AND v_embarque IS NULL THEN
        RAISE EXCEPTION 'Pagamento liberado só após a confirmação do embarque do Processo % (Data de Embarque).', coalesce(v_numero, '')
            USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_fin_embarque_pagar ON contas_pagar;
CREATE TRIGGER trg_fin_embarque_pagar BEFORE INSERT OR UPDATE ON contas_pagar
    FOR EACH ROW EXECUTE FUNCTION public.fin_embarque_trava_pagar();

-- Verificação
SELECT tgname, tgrelid::regclass AS tabela FROM pg_trigger
 WHERE tgname IN ('trg_fin_embarque_receber', 'trg_fin_embarque_pagar');
