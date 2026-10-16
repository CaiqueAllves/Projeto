-- Logo, Marcas e Contas bancárias (2026-10-16)
--   A) Logo da empresa: parceiros.logo_url e empresas.logo_url + bucket "logos"
--      (leitura pública — o PDF precisa baixar a imagem; gravação só na pasta
--      da própria empresa: logos/<empresa_id>/...)
--   B) Marcas do cadastro de empresa (a seção existia mas nunca salvava)
--   C) Contas bancárias de recebimento — várias por empresa; parceiro_id NULL
--      = conta da PRÓPRIA empresa. Migra a conta de "Recebimento" que já
--      existia em parceiro_financeiro (rec_*).
--   D) Proforma: conta escolhida para pagamento + cópia dos dados bancários
--      no momento do salvamento (a Proforma emitida/assinada não muda se a
--      conta for editada depois)
-- Idempotente: pode rodar de novo sem erro.

-- ── A) Logo ────────────────────────────────────────────────────────────
ALTER TABLE parceiros ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE empresas  ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS logos_select ON storage.objects;
DROP POLICY IF EXISTS logos_insert ON storage.objects;
DROP POLICY IF EXISTS logos_update ON storage.objects;
DROP POLICY IF EXISTS logos_delete ON storage.objects;
CREATE POLICY logos_select ON storage.objects FOR SELECT TO authenticated
    USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY logos_insert ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY logos_update ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth_empresa_id()::text);
CREATE POLICY logos_delete ON storage.objects FOR DELETE TO authenticated
    USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth_empresa_id()::text);

-- ── B) Marcas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS parceiro_marcas (
    id          BIGSERIAL PRIMARY KEY,
    parceiro_id BIGINT NOT NULL REFERENCES parceiros(id) ON DELETE CASCADE,
    nome        TEXT,
    imagem_url  TEXT,
    ordem       INT NOT NULL DEFAULT 1,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_parceiro_marcas_parceiro ON parceiro_marcas(parceiro_id);
ALTER TABLE parceiro_marcas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS parceiro_marcas_all ON parceiro_marcas;
CREATE POLICY parceiro_marcas_all ON parceiro_marcas FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_marcas.parceiro_id AND p.empresa_id = auth_empresa_id()))
    WITH CHECK (EXISTS (SELECT 1 FROM parceiros p WHERE p.id = parceiro_marcas.parceiro_id AND p.empresa_id = auth_empresa_id()));

-- ── C) Contas bancárias ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contas_bancarias (
    id             BIGSERIAL PRIMARY KEY,
    empresa_id     UUID NOT NULL,
    parceiro_id    BIGINT REFERENCES parceiros(id) ON DELETE CASCADE,   -- NULL = própria empresa
    apelido        TEXT,
    beneficiario   TEXT,
    banco          TEXT,
    agencia        TEXT,
    conta          TEXT,
    tipo_conta     TEXT,
    swift          TEXT,
    iban           TEXT,
    endereco_banco TEXT,
    moeda          TEXT,
    ordem          INT NOT NULL DEFAULT 1,
    criado_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contas_bancarias_dono ON contas_bancarias(empresa_id, parceiro_id);
ALTER TABLE contas_bancarias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contas_bancarias_all ON contas_bancarias;
CREATE POLICY contas_bancarias_all ON contas_bancarias FOR ALL TO authenticated
    USING (empresa_id = auth_empresa_id())
    WITH CHECK (empresa_id = auth_empresa_id()
        AND (parceiro_id IS NULL OR EXISTS (SELECT 1 FROM parceiros p WHERE p.id = contas_bancarias.parceiro_id AND p.empresa_id = auth_empresa_id())));

-- conta de Recebimento que já existia no cadastro (parceiro_financeiro) — só
-- para parceiros que ainda não têm nenhuma conta na tabela nova
INSERT INTO contas_bancarias (empresa_id, parceiro_id, banco, agencia, conta, tipo_conta, moeda, ordem)
SELECT p.empresa_id, f.parceiro_id, f.rec_banco, f.rec_agencia, f.rec_conta, f.rec_tipo_conta, f.rec_moeda, 1
  FROM parceiro_financeiro f
  JOIN parceiros p ON p.id = f.parceiro_id
 WHERE coalesce(f.rec_banco, f.rec_conta, '') <> ''
   AND NOT EXISTS (SELECT 1 FROM contas_bancarias c WHERE c.parceiro_id = f.parceiro_id);

-- ── D) Proforma: conta para pagamento ──────────────────────────────────
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS conta_bancaria_id BIGINT REFERENCES contas_bancarias(id) ON DELETE SET NULL;
ALTER TABLE proformas ADD COLUMN IF NOT EXISTS dados_bancarios JSONB;
