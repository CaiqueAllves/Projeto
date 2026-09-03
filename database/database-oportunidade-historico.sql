-- Histórico/linha do tempo de uma Proposta: da criação até virar Pedido e
-- ser finalizado, inclusive quando não avança (Perdido) ou é excluída.
-- Log só de inserção (sem UPDATE/DELETE) — é uma trilha de auditoria, não
-- um dado editável.

CREATE TABLE IF NOT EXISTS oportunidade_historico (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oportunidade_id         UUID NOT NULL REFERENCES oportunidades(id) ON DELETE CASCADE,
    pedido_id               UUID REFERENCES pedidos(id),
    evento                  TEXT NOT NULL, -- 'criada' | 'etapa_alterada' | 'pedido_gerado' | 'pedido_status_alterado' | 'pedido_excluido' | 'excluida' | 'restaurada'
    de_valor                TEXT,
    para_valor              TEXT,
    usuario_nome            TEXT,
    empresa_proprietaria_id UUID REFERENCES empresas(id),
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oportunidade_historico_oportunidade ON oportunidade_historico(oportunidade_id);
CREATE INDEX IF NOT EXISTS idx_oportunidade_historico_criado_em    ON oportunidade_historico(criado_em);

ALTER TABLE oportunidade_historico ENABLE ROW LEVEL SECURITY;

-- Usa os helpers auth_empresa_id()/auth_is_admin() já criados em
-- database-usuarios-rls-real.sql (Estágio 2.2 da migração de autenticação).
CREATE POLICY oportunidade_historico_select_auth ON oportunidade_historico FOR SELECT TO authenticated
    USING (empresa_proprietaria_id = auth_empresa_id());
CREATE POLICY oportunidade_historico_insert_auth ON oportunidade_historico FOR INSERT TO authenticated
    WITH CHECK (empresa_proprietaria_id = auth_empresa_id());
-- Sem policy de UPDATE/DELETE de propósito — histórico é só-inserção.
