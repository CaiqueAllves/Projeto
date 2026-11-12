-- Plano Gratuito com prazo de 15 dias e modo SÓ LEITURA depois (2026-11-12)
-- ----------------------------------------------------------------------------
-- Antes: a empresa criada no cadastro ficava no plano Gratuito para sempre
-- (status 'trial', sem vencimento). Agora:
--   • toda empresa nova no Gratuito ganha 15 dias (gatilho em empresas — não
--     precisa publicar a Edge Function de cadastro de novo)
--   • as empresas Gratuitas que já existem ganham 15 dias a partir de HOJE
--     (exceto a empresa da conta da Central, administrador@teste.com)
--   • vencido o prazo, a empresa entra em MODO SÓ LEITURA: continua entrando,
--     vendo e baixando tudo, mas o banco recusa criar/alterar/excluir dados até
--     contratar um plano (o dono da Marpex troca o plano no painel "Empresas e
--     planos" da Central, ou prorroga o período). Suporte (chamados), perfil do
--     usuário e aceite dos Termos continuam liberados.
--   • a conta SEM empresa (24 h) continua como era: bloqueia o login ao vencer.
--   • aviso de fim de prazo: 3 dias antes, o sistema avisa o administrador na
--     tela e manda 1 e-mail (aviso-vencimento.js + registrar_aviso_vencimento)
-- Rode também o database-usuarios-pelo-servidor.sql (painel). Ordem livre.
-- Idempotente: pode rodar de novo sem erro.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS aviso_vencimento_em TIMESTAMPTZ;   -- quando o e-mail de aviso saiu

-- ── 1. Prazo de 15 dias para as empresas novas no Gratuito ────────────────
CREATE OR REPLACE FUNCTION empresas_prazo_gratuito()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF coalesce(NEW.plano, 'free') = 'free' AND NEW.status IS DISTINCT FROM 'sandbox' AND NEW.expira_em IS NULL THEN
        NEW.expira_em := now() + interval '15 days';
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_empresas_prazo_gratuito ON empresas;
CREATE TRIGGER trg_empresas_prazo_gratuito BEFORE INSERT ON empresas
    FOR EACH ROW EXECUTE FUNCTION empresas_prazo_gratuito();

-- ── 2. Empresas Gratuitas que já existem: 15 dias a partir de hoje ────────
UPDATE empresas e
   SET expira_em = now() + interval '15 days'
 WHERE coalesce(e.plano, 'free') = 'free'
   AND e.status IS DISTINCT FROM 'sandbox'
   AND e.expira_em IS NULL
   AND NOT EXISTS (SELECT 1 FROM usuarios u WHERE u.empresa_id = e.id AND lower(u.email) = 'administrador@teste.com');

-- ── 3. Modo só leitura ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION empresa_em_modo_leitura(p_empresa UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (SELECT 1 FROM empresas e
                    WHERE e.id = p_empresa
                      AND coalesce(e.plano, 'free') = 'free'
                      AND e.status IS DISTINCT FROM 'sandbox'
                      AND e.expira_em IS NOT NULL AND e.expira_em <= now())
$$;

-- Gatilho: só vale para quem está logado no sistema (o robô da limpeza, as Edge
-- Functions com service_role e a assinatura pública pelo link passam).
CREATE OR REPLACE FUNCTION bloquear_modo_leitura()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF auth.uid() IS NOT NULL AND empresa_em_modo_leitura(auth_empresa_id()) THEN
        RAISE EXCEPTION 'MODO_SO_LEITURA: o período gratuito terminou — a empresa está em modo só leitura até contratar um plano.'
            USING ERRCODE = 'P0001';
    END IF;
    RETURN coalesce(NEW, OLD);
END $$;

-- Tabelas de dados da empresa (quem tem empresa_id/empresa_proprietaria_id) + as
-- tabelas "filhas" sem essas colunas. Ficam de fora: usuários/empresa (perfil),
-- suporte (chamados), Termos, histórico, fila de arquivos e controles de login.
DO $$
DECLARE t TEXT; lista TEXT := '';
BEGIN
    FOR t IN
        SELECT DISTINCT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables tb ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.column_name IN ('empresa_id', 'empresa_proprietaria_id')
           AND c.table_name NOT IN ('usuarios', 'empresas', 'chamados', 'chamados_mensagens', 'chamados_leituras',
                                    'solicitacoes_empresa', 'historico_alteracoes', 'arquivos_remover', 'termos_aceites',
                                    'login_tentativas', 'cadastro_tentativas', 'relatorios_historico', 'permissoes_usuario')
        UNION
        SELECT x FROM unnest(ARRAY['parceiro_contatos', 'parceiro_financeiro', 'parceiro_marcas', 'produto_embalagens',
                                   'produto_composicao', 'processo_itens', 'proforma_documentos', 'contas_bancarias',
                                   'documento_modelos', 'termos_modelos', 'assinaturas_proforma']) AS x
         WHERE to_regclass('public.' || x) IS NOT NULL
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_modo_leitura ON public.%I', t);
        EXECUTE format('CREATE TRIGGER trg_modo_leitura BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION bloquear_modo_leitura()', t);
        lista := lista || t || ' ';
    END LOOP;
    RAISE NOTICE 'Modo só leitura nas tabelas: %', lista;
END $$;

-- ── 4. Aviso de fim do prazo (3 dias antes) — 1 e-mail por período ───────
-- Chamado pelo aviso-vencimento.js quando o administrador abre o sistema.
-- Marca o envio de forma atômica (dois navegadores abertos não mandam 2 e-mails).
CREATE OR REPLACE FUNCTION registrar_aviso_vencimento()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v RECORD;
BEGIN
    IF NOT auth_is_admin() THEN RETURN jsonb_build_object('enviar', false); END IF;
    UPDATE empresas e
       SET aviso_vencimento_em = now()
     WHERE e.id = auth_empresa_id()
       AND coalesce(e.plano, 'free') = 'free'
       AND e.status IS DISTINCT FROM 'sandbox'
       AND e.expira_em > now() AND e.expira_em <= now() + interval '3 days'
       AND (e.aviso_vencimento_em IS NULL OR e.aviso_vencimento_em < e.expira_em - interval '3 days')
    RETURNING e.razao_social, e.expira_em INTO v;
    IF NOT FOUND THEN RETURN jsonb_build_object('enviar', false); END IF;
    RETURN (SELECT jsonb_build_object('enviar', true, 'empresa', v.razao_social, 'expira_em', v.expira_em,
                                      'email', u.email, 'nome', u.nome_completo)
              FROM usuarios u WHERE u.id = auth_usuario_id());
END $$;
-- desfaz a marcação se o e-mail não saiu (para tentar de novo no próximo acesso)
CREATE OR REPLACE FUNCTION desfazer_aviso_vencimento()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
    UPDATE empresas SET aviso_vencimento_em = NULL WHERE id = auth_empresa_id() AND auth_is_admin()
$$;

REVOKE ALL ON FUNCTION registrar_aviso_vencimento() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION desfazer_aviso_vencimento() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION empresa_em_modo_leitura(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION registrar_aviso_vencimento() TO authenticated;
GRANT EXECUTE ON FUNCTION desfazer_aviso_vencimento() TO authenticated;
GRANT EXECUTE ON FUNCTION empresa_em_modo_leitura(UUID) TO authenticated;

-- Verificação (1 linha)
SELECT
    (SELECT count(*) FROM pg_trigger WHERE tgname = 'trg_modo_leitura')                                         AS tabelas_protegidas,
    (SELECT count(*) FROM empresas WHERE coalesce(plano, 'free') = 'free' AND status IS DISTINCT FROM 'sandbox' AND expira_em IS NOT NULL) AS gratuitas_com_prazo,
    (SELECT count(*) FROM empresas WHERE coalesce(plano, 'free') = 'free' AND status IS DISTINCT FROM 'sandbox' AND expira_em IS NULL)     AS gratuitas_sem_prazo;
-- Esperado: tabelas_protegidas > 15 | gratuitas_com_prazo = suas empresas Gratuitas | gratuitas_sem_prazo = 1 (a da Central)
