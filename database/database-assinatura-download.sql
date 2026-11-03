-- Página de assinatura: baixar a Proforma assinada (2026-11-03)
-- Depois de assinar, a página baixa o PDF da Proforma com uma página de
-- comprovante no fim. Para quem reabre o link já assinado poder baixar de
-- novo, assinatura_obter passa a devolver os dados da assinatura (só para
-- quem tem o link — o mesmo que acabou de assinar). Resto da função igual.
-- Idempotente: pode rodar de novo sem erro.

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
        -- já assinado: quem tem o link baixa a Proforma assinada (comprovante no fim)
        'assinatura', CASE WHEN a.status = 'assinado' THEN jsonb_build_object(
            'nome', a.assinante_nome, 'documento', a.assinante_documento, 'cargo', a.assinante_cargo,
            'email', a.assinante_email, 'imagem', a.assinatura_imagem, 'hash', a.hash_pdf,
            'assinado_em', a.assinado_em) END,
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

REVOKE ALL ON FUNCTION public.assinatura_obter(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assinatura_obter(TEXT) TO anon, authenticated;

-- Verificação: deve aparecer "assinatura" (1 linha)
SELECT 'assinatura' AS campo, position('''assinatura''' IN pg_get_functiondef('public.assinatura_obter(text)'::regprocedure)) > 0 AS presente;
