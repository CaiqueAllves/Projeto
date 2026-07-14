-- ============================================================
-- MARPEX — TABELAS: pedidos e pedido_itens
-- Execute no SQL Editor do Supabase
-- ============================================================
-- A tabela pedidos já existe ao vivo no Supabase sem schema
-- versionado neste repo. CREATE TABLE IF NOT EXISTS é um no-op
-- se ela já existir, por isso os ALTER TABLE abaixo garantem que
-- toda coluna esperada exista, mesmo em cima da tabela atual.
-- ============================================================

CREATE TABLE IF NOT EXISTS pedidos (
    id                       UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_proprietaria_id  UUID REFERENCES empresas(id),
    cliente_id               BIGINT REFERENCES parceiros(id),  -- parceiros.id é bigint nesta base, não uuid
    proforma_id              UUID,          -- sem FK: proformas ainda não tem SQL versionado neste repo
    oportunidade_id          UUID,          -- sem FK: oportunidades ainda não tem SQL versionado neste repo
    numero                   TEXT,
    status                   TEXT NOT NULL DEFAULT 'aguardando'
                                 CHECK (status IN ('aguardando','confirmado','em_producao','embarcado','entregue','cancelado')),
    valor_total              NUMERIC(15,2),
    moeda                    TEXT DEFAULT 'USD',
    data_pedido              DATE,
    data_entrega_prevista    DATE,
    observacoes              TEXT,
    created_at               TIMESTAMPTZ DEFAULT NOW(),
    updated_at               TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS empresa_proprietaria_id UUID REFERENCES empresas(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES parceiros(id);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS proforma_id UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS oportunidade_id UUID;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS numero TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'aguardando';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS valor_total NUMERIC(15,2);
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS moeda TEXT DEFAULT 'USD';
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_pedido DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS data_entrega_prevista DATE;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS observacoes TEXT;
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- O CHECK de status não pode ser adicionado via ADD COLUMN IF NOT EXISTS numa
-- coluna já existente. Adiciona defensivamente, ignorando se já existir.
DO $$ BEGIN
    ALTER TABLE pedidos ADD CONSTRAINT pedidos_status_check
        CHECK (status IN ('aguardando','confirmado','em_producao','embarcado','entregue','cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- pedido_itens (tabela filha — relação pedido ↔ produto)
-- ============================================================

CREATE TABLE IF NOT EXISTS pedido_itens (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    pedido_id       UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
    produto_id      UUID REFERENCES produtos(id),   -- nullable: produto real pode não existir ainda
    produto_nome    TEXT NOT NULL,                  -- snapshot: nome digitado ou copiado do produto selecionado
    quantidade      NUMERIC(10,4) NOT NULL DEFAULT 1,
    unidade_medida  TEXT DEFAULT 'UN',
    preco_unitario  NUMERIC(15,4) NOT NULL DEFAULT 0,
    subtotal        NUMERIC(15,2) GENERATED ALWAYS AS (quantidade * preco_unitario) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pedido_itens_pedido_id ON pedido_itens(pedido_id);

-- ============================================================
-- Row Level Security — padrão anon + filtro na aplicação
-- ============================================================
-- Sistema usa autenticação customizada (role anon), então as
-- policies liberam pra anon; o filtro por empresa/pedido é feito
-- nas queries da aplicação (ver supabase-api.js). NÃO usar
-- auth.uid() aqui — não há sessão real do Supabase Auth nesta app
-- (ver database-ncm.sql / database-chamados.sql pro mesmo padrão).
--
-- DROP POLICY IF EXISTS antes de cada CREATE torna o arquivo seguro
-- pra rodar mais de uma vez (CREATE POLICY sozinho não é idempotente).

ALTER TABLE pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedidos_select_anon" ON pedidos;
CREATE POLICY "pedidos_select_anon" ON pedidos FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "pedidos_insert_anon" ON pedidos;
CREATE POLICY "pedidos_insert_anon" ON pedidos FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "pedidos_update_anon" ON pedidos;
CREATE POLICY "pedidos_update_anon" ON pedidos FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pedidos_delete_anon" ON pedidos;
CREATE POLICY "pedidos_delete_anon" ON pedidos FOR DELETE TO anon USING (true);

ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedido_itens_select_anon" ON pedido_itens;
CREATE POLICY "pedido_itens_select_anon" ON pedido_itens FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "pedido_itens_insert_anon" ON pedido_itens;
CREATE POLICY "pedido_itens_insert_anon" ON pedido_itens FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_itens_update_anon" ON pedido_itens;
CREATE POLICY "pedido_itens_update_anon" ON pedido_itens FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "pedido_itens_delete_anon" ON pedido_itens;
CREATE POLICY "pedido_itens_delete_anon" ON pedido_itens FOR DELETE TO anon USING (true);
