-- ============================================================
-- MARPEX — "visto" dos chamados guardado no servidor
-- Execute no SQL Editor do Supabase. Idempotente.
-- ------------------------------------------------------------
-- Problema: a notificação de resposta do suporte guardava o "visto" só no
-- navegador (localStorage), começando a contar na PRIMEIRA vez que o widget
-- carregava naquele navegador. Quem abriu o chamado e voltou depois (ou usa
-- outro computador/navegador) nunca era avisado de respostas que chegaram
-- enquanto estava fora. Agora cada usuário tem, por chamado, o instante em
-- que viu a conversa pela última vez; resposta do suporte mais nova que isso
-- = não lida, em qualquer dispositivo.
-- ============================================================

CREATE TABLE IF NOT EXISTS chamados_leituras (
    chamado_id UUID NOT NULL REFERENCES chamados(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    visto_em   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (chamado_id, usuario_id)
);

ALTER TABLE chamados_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS chamados_leituras_select_auth ON chamados_leituras;
CREATE POLICY chamados_leituras_select_auth ON chamados_leituras FOR SELECT TO authenticated
    USING (usuario_id = auth_usuario_id());
DROP POLICY IF EXISTS chamados_leituras_insert_auth ON chamados_leituras;
CREATE POLICY chamados_leituras_insert_auth ON chamados_leituras FOR INSERT TO authenticated
    WITH CHECK (usuario_id = auth_usuario_id());
DROP POLICY IF EXISTS chamados_leituras_update_auth ON chamados_leituras;
CREATE POLICY chamados_leituras_update_auth ON chamados_leituras FOR UPDATE TO authenticated
    USING (usuario_id = auth_usuario_id()) WITH CHECK (usuario_id = auth_usuario_id());

-- Chamados que já existem: considera "visto" até a última ação do próprio
-- usuário (abertura ou última mensagem dele) — assim respostas recentes do
-- suporte que ele ainda não viu aparecem como novas. Se a última resposta do
-- suporte tem mais de 14 dias, considera vista (evita inundar com histórico).
INSERT INTO chamados_leituras (chamado_id, usuario_id, visto_em)
SELECT c.id, c.usuario_id,
       CASE
         WHEN (SELECT max(m.created_at) FROM chamados_mensagens m WHERE m.chamado_id = c.id AND m.autor_tipo = 'suporte') > now() - interval '14 days'
         THEN greatest(c.created_at, coalesce((SELECT max(m.created_at) FROM chamados_mensagens m WHERE m.chamado_id = c.id AND m.autor_tipo = 'usuario'), c.created_at))
         ELSE now()
       END
FROM chamados c
WHERE c.usuario_id IS NOT NULL
ON CONFLICT DO NOTHING;
