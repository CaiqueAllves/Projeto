-- ============================================================
-- MARPEX — TABELA: contas_receber
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: contas-receber.html/contas-receber.js e as funções
-- buscarContasReceber/salvarContaReceber/atualizarContaReceber/
-- excluirContaReceber (supabase-api.js) já esperam esta tabela
-- (o schema já estava documentado em comentário lá, mas a tabela
-- nunca foi criada de fato no Supabase — por isso "relation
-- contas_receber does not exist" ao rodar
-- database-financeiro-vinculos.sql).
--
-- Execute este arquivo ANTES de database-financeiro-vinculos.sql
-- (junto com database-contas-pagar.sql, se ainda não tiver rodado).
-- Todas as colunas são adicionadas com IF NOT EXISTS, então é
-- seguro rodar mais de uma vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS contas_receber (
    id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id       UUID REFERENCES empresas(id),
    descricao        TEXT NOT NULL,
    parceiro_id      BIGINT REFERENCES parceiros(id),  -- parceiros.id é bigint nesta base, não uuid
    valor            NUMERIC NOT NULL,
    moeda            TEXT DEFAULT 'BRL',
    data_vencimento  DATE NOT NULL,
    data_recebimento DATE,
    status           TEXT NOT NULL DEFAULT 'pendente'
                         CHECK (status IN ('pendente','recebido','vencido','cancelado')),
    categoria        TEXT,
    observacoes      TEXT,
    criado_por       UUID,
    criado_em        TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS empresa_id       UUID REFERENCES empresas(id);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS descricao        TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS parceiro_id      BIGINT REFERENCES parceiros(id);
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS valor            NUMERIC;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS moeda            TEXT DEFAULT 'BRL';
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS data_vencimento  DATE;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS data_recebimento DATE;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS status           TEXT DEFAULT 'pendente';
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS categoria        TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS observacoes      TEXT;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS criado_por       UUID;
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS criado_em        TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE contas_receber ADD COLUMN IF NOT EXISTS atualizado_em    TIMESTAMPTZ DEFAULT NOW();

-- O CHECK de status não pode ser adicionado via ADD COLUMN IF NOT EXISTS numa
-- coluna já existente. Adiciona defensivamente, ignorando se já existir.
DO $$ BEGIN
    ALTER TABLE contas_receber ADD CONSTRAINT contas_receber_status_check
        CHECK (status IN ('pendente','recebido','vencido','cancelado'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa_id  ON contas_receber(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_parceiro_id ON contas_receber(parceiro_id);

-- ============================================================
-- Row Level Security — padrão anon + filtro na aplicação
-- ============================================================
-- Sistema usa autenticação customizada (role anon), então as
-- policies liberam pra anon; o filtro por empresa é feito nas
-- queries da aplicação (ver supabase-api.js). NÃO usar auth.uid()
-- aqui — não há sessão real do Supabase Auth nesta app (ver
-- database-pedidos.sql / database-chamados.sql pro mesmo padrão).
--
-- DROP POLICY IF EXISTS antes de cada CREATE torna o arquivo seguro
-- pra rodar mais de uma vez (CREATE POLICY sozinho não é idempotente).

ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contas_receber_select_anon" ON contas_receber;
CREATE POLICY "contas_receber_select_anon" ON contas_receber FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "contas_receber_insert_anon" ON contas_receber;
CREATE POLICY "contas_receber_insert_anon" ON contas_receber FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "contas_receber_update_anon" ON contas_receber;
CREATE POLICY "contas_receber_update_anon" ON contas_receber FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "contas_receber_delete_anon" ON contas_receber;
CREATE POLICY "contas_receber_delete_anon" ON contas_receber FOR DELETE TO anon USING (true);
