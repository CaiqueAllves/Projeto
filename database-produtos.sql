-- ============================================================
-- MARPEX — TABELA: produtos (versão completa)
-- Execute no SQL Editor do Supabase
-- ============================================================
-- Remove a tabela anterior (e todos os seus índices/triggers)
-- antes de recriar com a estrutura atualizada.
DROP TABLE IF EXISTS produtos CASCADE;
-- ============================================================

CREATE TABLE produtos (

    -- ── Identificação ────────────────────────────────────────
    id                          UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id                  UUID            NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    criado_por                  UUID            REFERENCES usuarios(id),
    criado_em                   TIMESTAMPTZ     DEFAULT NOW(),
    atualizado_em               TIMESTAMPTZ     DEFAULT NOW(),

    -- ── Dados Gerais ─────────────────────────────────────────
    sku                         TEXT            NOT NULL,
    nome                        TEXT            NOT NULL,
    ncm                         TEXT,                               -- Ex: 8471.30.12
    cest                        TEXT,                               -- Ex: 28.038.00
    gtin                        TEXT,                               -- Código de barras EAN/GTIN (max 14 dígitos)
    status                      TEXT            NOT NULL DEFAULT 'ativo'
                                                CHECK (status IN ('ativo', 'pendente', 'pausado', 'inativo')),
    imagem_url                  TEXT,
    descricao                   TEXT,
    categoria                   TEXT,
    tipo                        TEXT,
    marca                       TEXT,
    unidade_medida              TEXT,
    lote                        TEXT,
    data_fabricacao             DATE,
    data_validade               DATE,

    -- ── Precificação ─────────────────────────────────────────
    preco_custo                 NUMERIC(15, 4),                     -- Custo de fabricação / compra
    custos_fixos                NUMERIC(15, 4),                     -- Impostos, frete, embalagem
    imposto                     NUMERIC(15, 4),                     -- Taxas de marketplace / cartão
    preco_venda                 NUMERIC(15, 4),
    margem                      NUMERIC(8,  4),                     -- Margem de lucro em %
    lucro_liquido               NUMERIC(15, 4),                     -- Lucro líquido em R$
    moeda                       TEXT,                               -- Ex: Real Brasileiro, Dólar Americano
    obs_preco                   TEXT,

    -- ── Estoque ──────────────────────────────────────────────
    controla_estoque            BOOLEAN         DEFAULT TRUE,
    venda_sem_estoque           BOOLEAN         DEFAULT FALSE,
    estoque_atual               NUMERIC(15, 4),
    estoque_minimo              NUMERIC(15, 4),
    estoque_maximo              NUMERIC(15, 4),
    obs_estoque                 TEXT,

    -- ── Logística ────────────────────────────────────────────
    embalagem                   TEXT,                               -- Texto do autocomplete
    embalagem_codigo            TEXT,                               -- Código interno da embalagem
    acondicionamento            TEXT,                               -- Texto do autocomplete
    acondicionamento_numero     TEXT,                               -- Número interno do acondicionamento
    acondicionamento_descricao  TEXT,                               -- Preenchido quando tipo = "Outros"
    comprimento                 NUMERIC(10, 4),                     -- cm
    largura                     NUMERIC(10, 4),                     -- cm
    altura                      NUMERIC(10, 4),                     -- cm
    peso_bruto                  NUMERIC(10, 4),                     -- kg
    peso_liquido                NUMERIC(10, 4),                     -- kg
    obs_logistica               TEXT,

    -- ── Restrição: SKU único por empresa ─────────────────────
    UNIQUE (empresa_id, sku)
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_produtos_empresa_id  ON produtos(empresa_id);
CREATE INDEX idx_produtos_sku         ON produtos(empresa_id, sku);
CREATE INDEX idx_produtos_ncm         ON produtos(ncm);
CREATE INDEX idx_produtos_status      ON produtos(status);
CREATE INDEX idx_produtos_nome        ON produtos USING gin(to_tsvector('portuguese', nome));

-- ── Trigger: atualizar atualizado_em automaticamente ─────────
CREATE OR REPLACE FUNCTION atualizar_timestamp_produtos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_produtos_atualizado_em
    BEFORE UPDATE ON produtos
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp_produtos();

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;

-- Leitura: usuário vê apenas produtos da sua empresa
CREATE POLICY "produtos_select_empresa" ON produtos
    FOR SELECT USING (
        empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = auth.uid()
        )
    );

-- Inserção: apenas na própria empresa
CREATE POLICY "produtos_insert_empresa" ON produtos
    FOR INSERT WITH CHECK (
        empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = auth.uid()
        )
    );

-- Edição: apenas na própria empresa
CREATE POLICY "produtos_update_empresa" ON produtos
    FOR UPDATE USING (
        empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = auth.uid()
        )
    );

-- Exclusão: apenas na própria empresa
CREATE POLICY "produtos_delete_empresa" ON produtos
    FOR DELETE USING (
        empresa_id = (
            SELECT empresa_id FROM usuarios WHERE id = auth.uid()
        )
    );

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
