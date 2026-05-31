-- ============================================================
-- MARPEX — TABELAS: parceiros (empresas cadastradas)
-- Execute no SQL Editor do Supabase
-- ============================================================
-- Remove tabelas anteriores antes de recriar.
DROP TABLE IF EXISTS parceiro_financeiro CASCADE;
DROP TABLE IF EXISTS parceiro_contatos   CASCADE;
DROP TABLE IF EXISTS parceiros           CASCADE;
DROP VIEW  IF EXISTS vw_parceiros_completo CASCADE;
-- ============================================================

-- ── Tabela principal ─────────────────────────────────────────
CREATE TABLE parceiros (

    id                  UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    empresa_id          UUID            REFERENCES empresas(id) ON DELETE CASCADE,
    created_by          UUID            REFERENCES usuarios(id),
    created_at          TIMESTAMPTZ     DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     DEFAULT NOW(),

    -- Tipos
    is_fabricante       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_cliente          BOOLEAN         NOT NULL DEFAULT FALSE,
    is_fornecedor       BOOLEAN         NOT NULL DEFAULT FALSE,
    is_transportadora   BOOLEAN         NOT NULL DEFAULT FALSE,
    is_remetente        BOOLEAN         NOT NULL DEFAULT FALSE,

    -- Identificação
    tipo_cadastro       TEXT,                               -- cnpj | cpf | outros
    documento           TEXT,
    razao_social        TEXT            NOT NULL,
    nome_fantasia       TEXT,
    inscricao_estadual  TEXT,
    inscricao_municipal TEXT,
    rntrc               TEXT,
    suframa             TEXT,
    codigo_interno      TEXT,

    -- Localização
    pais                TEXT,
    cep                 TEXT,
    estado              TEXT,
    cidade              TEXT,
    bairro              TEXT,
    endereco            TEXT,
    numero              TEXT,
    complemento         TEXT,

    -- Endereço de coleta
    coleta_cep          TEXT,
    coleta_estado       TEXT,
    coleta_cidade       TEXT,
    coleta_bairro       TEXT,
    coleta_endereco     TEXT,
    coleta_numero       TEXT,
    coleta_complemento  TEXT,
    coleta_horario      TEXT,
    coleta_intervalo    TEXT,

    -- Extras
    site                TEXT,
    rede_social         TEXT,
    horario_atendimento TEXT,
    tags                JSONB           DEFAULT '[]',
    observacoes         TEXT,
    status              TEXT            NOT NULL DEFAULT 'ativo'
                                        CHECK (status IN ('ativo', 'inativo', 'excluido'))
);

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX idx_parceiros_empresa_id  ON parceiros(empresa_id);
CREATE INDEX idx_parceiros_created_by  ON parceiros(created_by);
CREATE INDEX idx_parceiros_documento   ON parceiros(documento);
CREATE INDEX idx_parceiros_status      ON parceiros(status);

-- Documento único por empresa (não global)
CREATE UNIQUE INDEX idx_parceiros_doc_unico ON parceiros(empresa_id, documento)
    WHERE documento IS NOT NULL AND documento <> '';

-- ── Trigger: atualizar updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION atualizar_timestamp_parceiros()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_parceiros_updated_at
    BEFORE UPDATE ON parceiros
    FOR EACH ROW
    EXECUTE FUNCTION atualizar_timestamp_parceiros();

-- ============================================================
-- TABELA: parceiro_contatos
-- ============================================================
CREATE TABLE parceiro_contatos (
    id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    parceiro_id UUID        NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    tipo        TEXT,
    nome        TEXT,
    email       TEXT,
    telefone    TEXT,
    ordem       INT         DEFAULT 1
);

CREATE INDEX idx_pcontatos_parceiro ON parceiro_contatos(parceiro_id);

-- ============================================================
-- TABELA: parceiro_financeiro
-- ============================================================
CREATE TABLE parceiro_financeiro (
    id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
    parceiro_id     UUID        NOT NULL UNIQUE REFERENCES parceiros(id) ON DELETE CASCADE,
    -- Pagamento
    pag_forma       TEXT,
    pag_condicao    TEXT,
    pag_banco       TEXT,
    pag_tipo_conta  TEXT,
    pag_agencia     TEXT,
    pag_conta       TEXT,
    pag_swift       TEXT,
    pag_iban        TEXT,
    pag_end_banco   TEXT,
    -- Recebimento
    rec_forma       TEXT,
    rec_moeda       TEXT,
    rec_banco       TEXT,
    rec_tipo_conta  TEXT,
    rec_agencia     TEXT,
    rec_conta       TEXT,
    rec_swift       TEXT,
    rec_iban        TEXT,
    rec_end_banco   TEXT
);

-- ============================================================
-- VIEW: vw_parceiros_completo
-- Une parceiros + contatos (agregados) + financeiro
-- ============================================================
CREATE OR REPLACE VIEW vw_parceiros_completo AS
SELECT
    p.*,
    -- Contatos como array JSON
    COALESCE(
        (SELECT json_agg(c ORDER BY c.ordem)
         FROM parceiro_contatos c
         WHERE c.parceiro_id = p.id),
        '[]'::json
    ) AS contatos,
    -- Financeiro
    f.pag_forma,      f.pag_condicao,  f.pag_banco,     f.pag_tipo_conta,
    f.pag_agencia,    f.pag_conta,     f.pag_swift,      f.pag_iban,      f.pag_end_banco,
    f.rec_forma,      f.rec_moeda,     f.rec_banco,      f.rec_tipo_conta,
    f.rec_agencia,    f.rec_conta,     f.rec_swift,      f.rec_iban,      f.rec_end_banco
FROM parceiros p
LEFT JOIN parceiro_financeiro f ON f.parceiro_id = p.id;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE parceiros           ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiro_contatos   ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiro_financeiro ENABLE ROW LEVEL SECURITY;

-- Parceiros: usuário vê e gerencia apenas os da sua empresa
CREATE POLICY "parceiros_select" ON parceiros FOR SELECT
    USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "parceiros_insert" ON parceiros FOR INSERT
    WITH CHECK (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "parceiros_update" ON parceiros FOR UPDATE
    USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

CREATE POLICY "parceiros_delete" ON parceiros FOR DELETE
    USING (empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid()));

-- Contatos: herdado via parceiro
CREATE POLICY "pcontatos_select" ON parceiro_contatos FOR SELECT
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pcontatos_insert" ON parceiro_contatos FOR INSERT
    WITH CHECK (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pcontatos_update" ON parceiro_contatos FOR UPDATE
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pcontatos_delete" ON parceiro_contatos FOR DELETE
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

-- Financeiro: herdado via parceiro
CREATE POLICY "pfin_select" ON parceiro_financeiro FOR SELECT
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pfin_insert" ON parceiro_financeiro FOR INSERT
    WITH CHECK (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pfin_update" ON parceiro_financeiro FOR UPDATE
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

CREATE POLICY "pfin_delete" ON parceiro_financeiro FOR DELETE
    USING (parceiro_id IN (SELECT id FROM parceiros WHERE empresa_id = (SELECT empresa_id FROM usuarios WHERE id = auth.uid())));

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
