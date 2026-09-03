-- Estágio 2.2, continuação — troca TO anon USING(true) por TO authenticated
-- + auth.uid() de verdade no resto das tabelas (usuarios já foi migrada em
-- database-usuarios-rls-real.sql). Ver auditoria de segurança.
--
-- Não cobre `storage.objects` (Storage) — tratado à parte, precisa ver as
-- definições atuais antes de reescrever.
--
-- Helpers já existem (auth_empresa_id/auth_is_admin, criados na migração
-- de usuarios) — adiciono só o que falta.

CREATE OR REPLACE FUNCTION auth_usuario_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM usuarios WHERE auth_id = auth.uid()
$$;

-- Defensivo/idempotente — não muda nada se já estiver ativo (deve estar,
-- já que as policies anon só valem com RLS ligada).
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE proformas ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE contadores_numeracao ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados ENABLE ROW LEVEL SECURITY;
ALTER TABLE chamados_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiro_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiro_financeiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_empresa ENABLE ROW LEVEL SECURITY;
ALTER TABLE apoio_ncm ENABLE ROW LEVEL SECURITY;
ALTER TABLE plano_contas ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Tabelas com empresa_id/empresa_proprietaria_id direto
-- ============================================================

-- contas_pagar
DROP POLICY IF EXISTS contas_pagar_select_anon ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_insert_anon ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_update_anon ON contas_pagar;
DROP POLICY IF EXISTS contas_pagar_delete_anon ON contas_pagar;
CREATE POLICY contas_pagar_select_auth ON contas_pagar FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY contas_pagar_insert_auth ON contas_pagar FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY contas_pagar_update_auth ON contas_pagar FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY contas_pagar_delete_auth ON contas_pagar FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- contas_receber
DROP POLICY IF EXISTS contas_receber_select_anon ON contas_receber;
DROP POLICY IF EXISTS contas_receber_insert_anon ON contas_receber;
DROP POLICY IF EXISTS contas_receber_update_anon ON contas_receber;
DROP POLICY IF EXISTS contas_receber_delete_anon ON contas_receber;
CREATE POLICY contas_receber_select_auth ON contas_receber FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY contas_receber_insert_auth ON contas_receber FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY contas_receber_update_auth ON contas_receber FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY contas_receber_delete_auth ON contas_receber FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- oportunidades
DROP POLICY IF EXISTS oportunidades_select_anon ON oportunidades;
DROP POLICY IF EXISTS oportunidades_insert_anon ON oportunidades;
DROP POLICY IF EXISTS oportunidades_update_anon ON oportunidades;
DROP POLICY IF EXISTS oportunidades_delete_anon ON oportunidades;
CREATE POLICY oportunidades_select_auth ON oportunidades FOR SELECT TO authenticated USING (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY oportunidades_insert_auth ON oportunidades FOR INSERT TO authenticated WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY oportunidades_update_auth ON oportunidades FOR UPDATE TO authenticated USING (empresa_proprietaria_id = auth_empresa_id()) WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY oportunidades_delete_auth ON oportunidades FOR DELETE TO authenticated USING (empresa_proprietaria_id = auth_empresa_id());

-- pedidos
DROP POLICY IF EXISTS pedidos_select_anon ON pedidos;
DROP POLICY IF EXISTS pedidos_insert_anon ON pedidos;
DROP POLICY IF EXISTS pedidos_update_anon ON pedidos;
DROP POLICY IF EXISTS pedidos_delete_anon ON pedidos;
CREATE POLICY pedidos_select_auth ON pedidos FOR SELECT TO authenticated USING (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY pedidos_insert_auth ON pedidos FOR INSERT TO authenticated WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY pedidos_update_auth ON pedidos FOR UPDATE TO authenticated USING (empresa_proprietaria_id = auth_empresa_id()) WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY pedidos_delete_auth ON pedidos FOR DELETE TO authenticated USING (empresa_proprietaria_id = auth_empresa_id());

-- produtos
DROP POLICY IF EXISTS produtos_select_anon ON produtos;
DROP POLICY IF EXISTS produtos_insert_anon ON produtos;
DROP POLICY IF EXISTS produtos_update_anon ON produtos;
DROP POLICY IF EXISTS produtos_delete_anon ON produtos;
CREATE POLICY produtos_select_auth ON produtos FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY produtos_insert_auth ON produtos FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produtos_update_auth ON produtos FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produtos_delete_auth ON produtos FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- proformas
DROP POLICY IF EXISTS select_proformas ON proformas;
DROP POLICY IF EXISTS insert_proformas ON proformas;
DROP POLICY IF EXISTS update_proformas ON proformas;
DROP POLICY IF EXISTS delete_proformas ON proformas;
CREATE POLICY proformas_select_auth ON proformas FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY proformas_insert_auth ON proformas FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY proformas_update_auth ON proformas FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY proformas_delete_auth ON proformas FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- parceiros
DROP POLICY IF EXISTS select_parceiros ON parceiros;
DROP POLICY IF EXISTS insert_parceiros ON parceiros;
DROP POLICY IF EXISTS update_parceiros ON parceiros;
DROP POLICY IF EXISTS delete_parceiros ON parceiros;
CREATE POLICY parceiros_select_auth ON parceiros FOR SELECT TO authenticated USING (empresa_id = auth_empresa_id());
CREATE POLICY parceiros_insert_auth ON parceiros FOR INSERT TO authenticated WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY parceiros_update_auth ON parceiros FOR UPDATE TO authenticated USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY parceiros_delete_auth ON parceiros FOR DELETE TO authenticated USING (empresa_id = auth_empresa_id());

-- contadores_numeracao (era uma policy "ALL" só)
DROP POLICY IF EXISTS contadores_numeracao_all ON contadores_numeracao;
CREATE POLICY contadores_numeracao_auth ON contadores_numeracao FOR ALL TO authenticated
    USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());

-- chamados (suporte — visível pra qualquer colega da empresa, mesmo padrão de pedidos/parceiros)
DROP POLICY IF EXISTS chamados_select_anon ON chamados;
DROP POLICY IF EXISTS chamados_insert_anon ON chamados;
DROP POLICY IF EXISTS chamados_update_anon ON chamados;
-- empresa_proprietaria_id fica null quando quem abre o chamado é uma conta
-- sandbox ainda sem empresa (ver suporte.js) — por isso o OR com
-- usuario_id: o próprio criador sempre vê/edita o chamado dele, tenha
-- empresa vinculada ou não.
CREATE POLICY chamados_select_auth ON chamados FOR SELECT TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() OR usuario_id = auth_usuario_id());
CREATE POLICY chamados_insert_auth ON chamados FOR INSERT TO authenticated
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id() OR usuario_id = auth_usuario_id() OR empresa_proprietaria_id IS NULL);
CREATE POLICY chamados_update_auth ON chamados FOR UPDATE TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id() OR usuario_id = auth_usuario_id())
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id() OR usuario_id = auth_usuario_id());

-- ============================================================
-- Tabelas filhas sem empresa_id próprio — join até a tabela pai
-- ============================================================

-- chamados_mensagens (mesma visibilidade do chamado pai — inclui o OR com
-- usuario_id pelo mesmo motivo do chamado sandbox sem empresa, acima).
DROP POLICY IF EXISTS chamados_mensagens_select_anon ON chamados_mensagens;
DROP POLICY IF EXISTS chamados_mensagens_insert_anon ON chamados_mensagens;
CREATE POLICY chamados_mensagens_select_auth ON chamados_mensagens FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM chamados c WHERE c.id = chamados_mensagens.chamado_id
                     AND (c.empresa_proprietaria_id = auth_empresa_id() OR c.usuario_id = auth_usuario_id())));
CREATE POLICY chamados_mensagens_insert_auth ON chamados_mensagens FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM chamados c WHERE c.id = chamados_mensagens.chamado_id
                     AND (c.empresa_proprietaria_id = auth_empresa_id() OR c.usuario_id = auth_usuario_id())));

-- pedido_itens (via pedidos.empresa_proprietaria_id)
DROP POLICY IF EXISTS pedido_itens_select_anon ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_insert_anon ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_update_anon ON pedido_itens;
DROP POLICY IF EXISTS pedido_itens_delete_anon ON pedido_itens;
CREATE POLICY pedido_itens_select_auth ON pedido_itens FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_itens_insert_auth ON pedido_itens FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_itens_update_auth ON pedido_itens FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_itens_delete_auth ON pedido_itens FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_itens.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));

-- pedido_documentos (via pedidos.empresa_proprietaria_id)
DROP POLICY IF EXISTS pedido_documentos_select_anon ON pedido_documentos;
DROP POLICY IF EXISTS pedido_documentos_insert_anon ON pedido_documentos;
DROP POLICY IF EXISTS pedido_documentos_update_anon ON pedido_documentos;
DROP POLICY IF EXISTS pedido_documentos_delete_anon ON pedido_documentos;
CREATE POLICY pedido_documentos_select_auth ON pedido_documentos FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_documentos.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_documentos_insert_auth ON pedido_documentos FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_documentos.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_documentos_update_auth ON pedido_documentos FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_documentos.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_documentos.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));
CREATE POLICY pedido_documentos_delete_auth ON pedido_documentos FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM pedidos p WHERE p.id = pedido_documentos.pedido_id AND p.empresa_proprietaria_id = auth_empresa_id()));

-- parceiro_contatos / parceiro_financeiro (via parceiros.empresa_id)
DROP POLICY IF EXISTS select_contatos ON parceiro_contatos;
DROP POLICY IF EXISTS insert_contatos ON parceiro_contatos;
DROP POLICY IF EXISTS update_contatos ON parceiro_contatos;
DROP POLICY IF EXISTS delete_contatos ON parceiro_contatos;
CREATE POLICY parceiro_contatos_select_auth ON parceiro_contatos FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_contatos.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_contatos_insert_auth ON parceiro_contatos FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_contatos.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_contatos_update_auth ON parceiro_contatos FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_contatos.parceiro_id AND p.empresa_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_contatos.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_contatos_delete_auth ON parceiro_contatos FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_contatos.parceiro_id AND p.empresa_id = auth_empresa_id()));

DROP POLICY IF EXISTS select_financeiro ON parceiro_financeiro;
DROP POLICY IF EXISTS insert_financeiro ON parceiro_financeiro;
DROP POLICY IF EXISTS update_financeiro ON parceiro_financeiro;
DROP POLICY IF EXISTS delete_financeiro ON parceiro_financeiro;
CREATE POLICY parceiro_financeiro_select_auth ON parceiro_financeiro FOR SELECT TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_financeiro.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_financeiro_insert_auth ON parceiro_financeiro FOR INSERT TO authenticated
    WITH CHECK (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_financeiro.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_financeiro_update_auth ON parceiro_financeiro FOR UPDATE TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_financeiro.parceiro_id AND p.empresa_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_financeiro.parceiro_id AND p.empresa_id = auth_empresa_id()));
CREATE POLICY parceiro_financeiro_delete_auth ON parceiro_financeiro FOR DELETE TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_financeiro.parceiro_id AND p.empresa_id = auth_empresa_id()));

-- ============================================================
-- empresas — caso especial: outras telas leem empresas de OUTROS tenants
-- (ex: "Empresa Parceira" de um Produto é uma empresa de terceiro, não a
-- sua própria). SELECT fica aberto pra qualquer autenticado (só remove o
-- anon); INSERT também (registrarEmpresaPropria — sandbox criando a
-- própria empresa, cadastro normal já vai por Edge Function); UPDATE
-- continua restrito só à própria empresa.
-- ============================================================

DROP POLICY IF EXISTS select_empresas ON empresas;
DROP POLICY IF EXISTS insert_empresas ON empresas;
DROP POLICY IF EXISTS update_empresas ON empresas;
CREATE POLICY empresas_select_auth ON empresas FOR SELECT TO authenticated USING (true);
CREATE POLICY empresas_insert_auth ON empresas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY empresas_update_auth ON empresas FOR UPDATE TO authenticated USING (id = auth_empresa_id()) WITH CHECK (id = auth_empresa_id());

-- ============================================================
-- solicitacoes_empresa — visível pro próprio solicitante OU admin da
-- empresa solicitada; INSERT só em nome do próprio usuário autenticado.
-- ============================================================

DROP POLICY IF EXISTS select_solicitacoes ON solicitacoes_empresa;
DROP POLICY IF EXISTS insert_solicitacoes ON solicitacoes_empresa;
DROP POLICY IF EXISTS update_solicitacoes ON solicitacoes_empresa;
CREATE POLICY solicitacoes_select_auth ON solicitacoes_empresa FOR SELECT TO authenticated
    USING (usuario_id = auth_usuario_id() OR empresa_id = auth_empresa_id());
CREATE POLICY solicitacoes_insert_auth ON solicitacoes_empresa FOR INSERT TO authenticated
    WITH CHECK (usuario_id = auth_usuario_id());
CREATE POLICY solicitacoes_update_auth ON solicitacoes_empresa FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id() AND auth_is_admin())
    WITH CHECK (empresa_id = auth_empresa_id() AND auth_is_admin());

-- ============================================================
-- Catálogos compartilhados (sem dono/tenant) — só remove o anon, mantém
-- leitura livre pra qualquer autenticado.
-- ============================================================

DROP POLICY IF EXISTS apoio_ncm_anon_select ON apoio_ncm;
CREATE POLICY apoio_ncm_select_auth ON apoio_ncm FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS plano_contas_select ON plano_contas;
CREATE POLICY plano_contas_select_auth ON plano_contas FOR SELECT TO authenticated USING (true);
