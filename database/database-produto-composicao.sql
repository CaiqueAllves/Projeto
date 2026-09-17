-- Nova seção "Composição" do formulário de Produto — lista de
-- ingredientes/matérias-primas que compõem o produto, útil pra compliance
-- regulatório de exportação (INS/E-number, CAS, país de origem do
-- ingrediente, etc.). Mesmo padrão de tabela-filha já usado no sistema pra
-- listas de um registro pai (ver database-produto-embalagens.sql,
-- database-produto-precos-alternativos.sql): id UUID próprio, FK pro
-- produto com ON DELETE CASCADE, e empresa_id duplicado (evita JOIN em
-- produtos só pra checar RLS a cada linha). CRUD é "substitui tudo" —
-- mesmo comportamento das outras listas de Produto.

CREATE TABLE IF NOT EXISTS produto_composicao (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id        UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    empresa_id        UUID NOT NULL REFERENCES empresas(id),

    ingrediente       TEXT,       -- "Ingrediente / Matéria-Prima"
    nome_tecnico      TEXT,
    cas               TEXT,       -- CAS Registry Number
    ins_enumber       TEXT,       -- INS / E-number
    concentracao_pct  NUMERIC,    -- "Concentração %"
    funcao            TEXT,       -- ex: Conservante, Corante, Emulsificante...
    pais_origem       TEXT,       -- país de origem do ingrediente (não do produto)
    observacao        TEXT,

    criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produto_composicao_produto ON produto_composicao(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_composicao_empresa ON produto_composicao(empresa_id);

ALTER TABLE produto_composicao ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de produto_embalagens: auth_empresa_id() já existe como
-- helper da migração de autenticação real (database-rls-real-parte1.sql).
CREATE POLICY produto_composicao_select_auth ON produto_composicao FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id());
CREATE POLICY produto_composicao_insert_auth ON produto_composicao FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produto_composicao_update_auth ON produto_composicao FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produto_composicao_delete_auth ON produto_composicao FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id());
