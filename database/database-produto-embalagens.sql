-- Normaliza as "Embalagens" de um Produto (hoje empilhadas soltas dentro da
-- coluna produtos.embalagens, tipo JSONB) numa tabela própria, com produto_id
-- como chave estrangeira. Motivo: sem uma chave de verdade ligando cada
-- embalagem ao seu produto, não dá pra gerar relatório algum (nem filtrar
-- por Modal de Transporte, nem somar peso, nem agrupar por produto) sem usar
-- operadores jsonb do Postgres — inviável pra relatório de verdade.
--
-- Mesmo padrão de tabela-filha já usado no sistema pra listas de um registro
-- pai (ver database-oportunidade-historico.sql, database-pedido-documentos.sql):
-- id UUID próprio, FK pro pai com ON DELETE CASCADE, e empresa_id duplicado
-- aqui (evita um JOIN em produtos só pra checar RLS a cada linha).

CREATE TABLE IF NOT EXISTS produto_embalagens (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id                    UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    empresa_id                    UUID NOT NULL REFERENCES empresas(id),

    nome                          TEXT,       -- "Nome da Embalagem" (obrigatório na tela)
    tipo_embalagem                TEXT,       -- descrição livre/autocomplete (tabela de apoio "embalagens")
    tipo_embalagem_codigo         TEXT,       -- código da tabela de apoio, quando veio de lá
    tipo_acondicionamento         TEXT,       -- descrição livre/autocomplete (tabela de apoio "apoio_acondicionamento")
    tipo_acondicionamento_numero  TEXT,       -- número da tabela de apoio, quando veio de lá
    acondicionamento_descricao    TEXT,       -- só usado quando o acondicionamento é "Outros"
    modal_transporte              TEXT,       -- value do <select> (ex: 'maritimo','aereo','rodoviario')

    comprimento                   NUMERIC,    -- cm
    largura                       NUMERIC,    -- cm
    altura                        NUMERIC,    -- cm
    peso_bruto                    NUMERIC,    -- kg
    peso_liquido                  NUMERIC,    -- kg
    empilhamento_maximo           INTEGER,

    observacoes                   TEXT,
    -- Linhas extras de "+ Adicionar Medida Caixa": continuam em JSONB porque
    -- são um detalhe interno de UMA embalagem, não alvo de relatório próprio.
    medidas_caixa                 JSONB NOT NULL DEFAULT '[]'::jsonb,

    criado_em                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produto_embalagens_produto ON produto_embalagens(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_embalagens_empresa ON produto_embalagens(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produto_embalagens_modal   ON produto_embalagens(modal_transporte);

ALTER TABLE produto_embalagens ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de produtos (database-rls-real-parte1.sql): auth_empresa_id()
-- já existe como helper da migração de autenticação real.
CREATE POLICY produto_embalagens_select_auth ON produto_embalagens FOR SELECT TO authenticated
    USING (empresa_id = auth_empresa_id());
CREATE POLICY produto_embalagens_insert_auth ON produto_embalagens FOR INSERT TO authenticated
    WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produto_embalagens_update_auth ON produto_embalagens FOR UPDATE TO authenticated
    USING (empresa_id = auth_empresa_id()) WITH CHECK (empresa_id = auth_empresa_id());
CREATE POLICY produto_embalagens_delete_auth ON produto_embalagens FOR DELETE TO authenticated
    USING (empresa_id = auth_empresa_id());

-- ── Backfill ────────────────────────────────────────────────────────────
-- Migra o que já existe hoje em produtos.embalagens (array JSONB, chaves
-- literalmente iguais aos ids dos campos do formulário) pra linhas de
-- verdade. Números vêm como texto com vírgula decimal ("22,50") — troca
-- por ponto e converte; NULLIF em string vazia evita erro de cast.
INSERT INTO produto_embalagens (
    produto_id, empresa_id, nome, tipo_embalagem, tipo_embalagem_codigo,
    tipo_acondicionamento, tipo_acondicionamento_numero, acondicionamento_descricao,
    modal_transporte, comprimento, largura, altura, peso_bruto, peso_liquido,
    empilhamento_maximo, observacoes, medidas_caixa
)
SELECT
    p.id,
    p.empresa_id,
    NULLIF(e->>'prod-embalagem-nome', ''),
    NULLIF(e->>'prod-embalagem', ''),
    NULLIF(e->>'prod-embalagem-codigo', ''),
    NULLIF(e->>'prod-acondicionamento', ''),
    NULLIF(e->>'prod-acondicionamento-numero', ''),
    NULLIF(e->>'prod-acond-descricao', ''),
    NULLIF(e->>'prod-embalagem-transporte', ''),
    NULLIF(REPLACE(e->>'prod-comprimento', ',', '.'), '')::NUMERIC,
    NULLIF(REPLACE(e->>'prod-largura', ',', '.'), '')::NUMERIC,
    NULLIF(REPLACE(e->>'prod-altura', ',', '.'), '')::NUMERIC,
    NULLIF(REPLACE(e->>'prod-peso-bruto', ',', '.'), '')::NUMERIC,
    NULLIF(REPLACE(e->>'prod-peso-liquido', ',', '.'), '')::NUMERIC,
    NULLIF(e->>'prod-empilhamento', '')::INTEGER,
    NULLIF(e->>'prod-obs-logistica', ''),
    COALESCE(e->'medidas_caixa', '[]'::jsonb)
FROM produtos p, jsonb_array_elements(p.embalagens) AS e
WHERE p.embalagens IS NOT NULL AND jsonb_typeof(p.embalagens) = 'array' AND jsonb_array_length(p.embalagens) > 0
ON CONFLICT DO NOTHING;

-- A coluna produtos.embalagens NÃO é apagada nesta migração — fica como
-- histórico morto (o código para de ler/gravar nela a partir deste commit).
-- Depois de confirmar que os dados migraram certo, rode à parte, se quiser:
--   ALTER TABLE produtos DROP COLUMN embalagens;
