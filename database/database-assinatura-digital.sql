-- Assinatura digital da Proforma por link (enviado pelo WhatsApp)
--
-- Fluxo: o usuário gera um link na tela Documentos → envia pelo WhatsApp →
-- o Importador abre assinar.html?t=<token> SEM login, confere a Proforma,
-- informa nome/documento/cargo, marca o aceite e desenha a assinatura.
-- O sistema registra as evidências (data/hora, IP, navegador, hash do PDF)
-- e marca o documento "Nº Proforma Invoice" como assinado (Proforma → Aprovado).
--
-- Validade jurídica: assinatura eletrônica entre empresas, aceita quando as
-- partes concordam com esse meio (MP 2.200-2/2001 art. 10 §2º, Lei 14.063/2020).
-- Idempotente: pode rodar de novo sem erro.

CREATE TABLE IF NOT EXISTS assinaturas_proforma (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token               TEXT NOT NULL UNIQUE
                        DEFAULT (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
    empresa_id          UUID NOT NULL,
    proforma_id         UUID NOT NULL REFERENCES proformas(id) ON DELETE CASCADE,
    status              TEXT NOT NULL DEFAULT 'pendente',
    criado_por          UUID,
    criado_por_nome     TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_em           TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
    enviado_para        TEXT,
    arquivo_path        TEXT,
    hash_pdf            TEXT,
    assinante_nome      TEXT,
    assinante_documento TEXT,
    assinante_cargo     TEXT,
    assinante_email     TEXT,
    assinatura_imagem   TEXT,
    assinado_em         TIMESTAMPTZ,
    ip                  TEXT,
    user_agent          TEXT
);

DO $$ BEGIN
    ALTER TABLE assinaturas_proforma ADD CONSTRAINT assinaturas_proforma_status_check
        CHECK (status IN ('pendente', 'assinado', 'cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_assinaturas_proforma_proforma ON assinaturas_proforma(proforma_id);

-- RLS: a equipe da empresa vê/cria/cancela as suas. O Importador (sem login)
-- só acessa pelas funções abaixo, e só o pedido do token que recebeu.
ALTER TABLE assinaturas_proforma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS assinaturas_proforma_sel ON assinaturas_proforma;
DROP POLICY IF EXISTS assinaturas_proforma_ins ON assinaturas_proforma;
DROP POLICY IF EXISTS assinaturas_proforma_upd ON assinaturas_proforma;
CREATE POLICY assinaturas_proforma_sel ON assinaturas_proforma FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY assinaturas_proforma_ins ON assinaturas_proforma FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY assinaturas_proforma_upd ON assinaturas_proforma FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());

-- ── Abrir o link: dados para conferência ─────────────────────────────
CREATE OR REPLACE FUNCTION public.assinatura_obter(p_token TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    a  assinaturas_proforma%ROWTYPE;
    p  proformas%ROWTYPE;
    v_exportador TEXT;
    v_importador TEXT;
    v_importador_doc TEXT;
    v_status TEXT;
BEGIN
    SELECT * INTO a FROM assinaturas_proforma WHERE token = p_token;
    IF NOT FOUND THEN RETURN jsonb_build_object('erro', 'nao_encontrado'); END IF;
    SELECT * INTO p FROM proformas WHERE id = a.proforma_id;
    IF NOT FOUND OR p.status = 'excluido' THEN RETURN jsonb_build_object('erro', 'nao_encontrado'); END IF;

    v_status := a.status;
    IF a.status = 'pendente' AND a.expira_em < now() THEN v_status := 'expirado'; END IF;

    IF p.emissor_tipo = 'terceiro' AND p.parceiro_id IS NOT NULL THEN
        SELECT coalesce(razao_social, nome_fantasia) INTO v_exportador FROM parceiros WHERE id = p.parceiro_id;
    END IF;
    IF v_exportador IS NULL THEN
        SELECT coalesce(razao_social, nome_fantasia) INTO v_exportador FROM empresas WHERE id = p.empresa_id;
    END IF;
    IF p.destinatario_id IS NOT NULL THEN
        SELECT coalesce(razao_social, nome_fantasia), documento INTO v_importador, v_importador_doc FROM parceiros WHERE id = p.destinatario_id;
    END IF;

    RETURN jsonb_build_object(
        'status',        v_status,
        'expira_em',     a.expira_em,
        'criado_em',     a.criado_em,
        'criado_por',    a.criado_por_nome,
        'arquivo_path',  a.arquivo_path,
        'assinante_nome', a.assinante_nome,
        'assinado_em',   a.assinado_em,
        'proforma', jsonb_build_object(
            'codigo',       p.codigo,
            'exportador',   v_exportador,
            'importador',   coalesce(v_importador, p.destinatario_razao_social),
            'importador_doc', coalesce(v_importador_doc, p.destinatario_doc),
            'incoterm',     p.incoterm,
            'modal',        p.modal,
            'valor_total',  p.valor_total,
            'moeda',        p.moeda_principal,
            'itens',        coalesce(p.itens, '[]'::jsonb),
            'forma_pagamento', p.forma_pagamento,
            'prazo_pagamento', p.prazo_pagamento
        )
    );
END;
$$;

-- ── Confirmar a assinatura ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assinatura_confirmar(
    p_token TEXT, p_nome TEXT, p_documento TEXT, p_cargo TEXT, p_email TEXT,
    p_imagem TEXT, p_hash TEXT, p_user_agent TEXT)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    a  assinaturas_proforma%ROWTYPE;
    v_ip TEXT;
    v_quem TEXT;
BEGIN
    SELECT * INTO a FROM assinaturas_proforma WHERE token = p_token FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('erro', 'nao_encontrado'); END IF;
    IF a.status = 'assinado' THEN RETURN jsonb_build_object('erro', 'ja_assinado'); END IF;
    IF a.status <> 'pendente' THEN RETURN jsonb_build_object('erro', 'cancelado'); END IF;
    IF a.expira_em < now() THEN RETURN jsonb_build_object('erro', 'expirado'); END IF;
    IF coalesce(trim(p_nome), '') = '' OR coalesce(trim(p_documento), '') = '' OR coalesce(p_imagem, '') = '' THEN
        RETURN jsonb_build_object('erro', 'dados_incompletos');
    END IF;
    IF length(p_imagem) > 400000 THEN RETURN jsonb_build_object('erro', 'imagem_grande'); END IF;

    BEGIN
        v_ip := split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1);
    EXCEPTION WHEN OTHERS THEN v_ip := NULL; END;

    UPDATE assinaturas_proforma SET
        status = 'assinado', assinante_nome = trim(p_nome), assinante_documento = trim(p_documento),
        assinante_cargo = nullif(trim(p_cargo), ''), assinante_email = nullif(trim(p_email), ''),
        assinatura_imagem = p_imagem, hash_pdf = nullif(p_hash, ''), assinado_em = now(),
        ip = nullif(v_ip, ''), user_agent = left(p_user_agent, 400)
    WHERE id = a.id;

    -- outros links pendentes da mesma proforma deixam de valer
    UPDATE assinaturas_proforma SET status = 'cancelado'
     WHERE proforma_id = a.proforma_id AND status = 'pendente' AND id <> a.id;

    v_quem := trim(p_nome) || ' (assinatura digital)';
    INSERT INTO proforma_documentos (proforma_id, tipo_documento, processo_id, assinado, assinado_por, assinado_em, arquivo_path, arquivo_nome, atualizado_em)
    VALUES (a.proforma_id, 'proforma', NULL, true, v_quem, now(), a.arquivo_path, NULL, now())
    ON CONFLICT ON CONSTRAINT proforma_documentos_proforma_tipo_processo_key
    DO UPDATE SET assinado = true, assinado_por = v_quem, assinado_em = now(), atualizado_em = now(),
                  arquivo_path = coalesce(proforma_documentos.arquivo_path, EXCLUDED.arquivo_path);

    UPDATE proformas SET status = 'aprovado', status_atualizado_em = now()
     WHERE id = a.proforma_id AND status IN ('pendente', 'enviado');

    RETURN jsonb_build_object('ok', true, 'assinado_em', now());
END;
$$;

REVOKE ALL ON FUNCTION public.assinatura_obter(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.assinatura_confirmar(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinatura_obter(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assinatura_confirmar(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
