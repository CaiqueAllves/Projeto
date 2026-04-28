-- ============================================================
-- MARPEX - SCRIPT DE CRIAÇÃO DE TABELAS
-- Execute no SQL Editor do Supabase
-- ============================================================

-- ============================================================
-- 1. PERMISSÕES POR MÓDULO (granular, por usuário)
-- ============================================================

CREATE TABLE IF NOT EXISTS permissoes_usuario (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    usuario_id      UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    modulo          TEXT NOT NULL,  -- 'processos', 'produtos', 'cadastros', 'relatorios', 'apoio', 'configuracoes'
    pode_visualizar BOOLEAN DEFAULT TRUE,
    pode_criar      BOOLEAN DEFAULT FALSE,
    pode_editar     BOOLEAN DEFAULT FALSE,
    pode_excluir    BOOLEAN DEFAULT FALSE,
    criado_em       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(usuario_id, modulo)
);

-- Índice de busca por usuário
CREATE INDEX IF NOT EXISTS idx_permissoes_usuario_id ON permissoes_usuario(usuario_id);

-- ============================================================
-- 2. PROCESSOS (Importação / Exportação)
-- ============================================================

CREATE TABLE IF NOT EXISTS processos (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    numero_processo         TEXT UNIQUE,                         -- Ex: IMP-2026-001
    tipo                    TEXT NOT NULL CHECK (tipo IN ('importacao', 'exportacao')),
    status                  TEXT NOT NULL DEFAULT 'aberto'
                                CHECK (status IN (
                                    'aberto',
                                    'em_andamento',
                                    'aguardando_documentos',
                                    'concluido',
                                    'cancelado'
                                )),
    empresa_proprietaria_id UUID REFERENCES empresas(id),        -- Empresa do usuário logado
    empresa_parceira_id     UUID REFERENCES empresas_cadastradas(id), -- Cliente/Fornecedor
    responsavel_id          UUID REFERENCES usuarios(id),        -- Usuário responsável
    moeda                   TEXT DEFAULT 'USD',
    valor_total             DECIMAL(15, 2),
    incoterm                TEXT,                                -- Ex: FOB, CIF, EXW
    porto_origem            TEXT,
    porto_destino           TEXT,
    data_abertura           DATE DEFAULT CURRENT_DATE,
    data_previsao           DATE,
    data_conclusao          DATE,
    observacoes             TEXT,
    criado_por              UUID REFERENCES usuarios(id),
    criado_em               TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processos_empresa   ON processos(empresa_proprietaria_id);
CREATE INDEX IF NOT EXISTS idx_processos_status    ON processos(status);
CREATE INDEX IF NOT EXISTS idx_processos_tipo      ON processos(tipo);

-- Auto-incrementar numero_processo por empresa
CREATE OR REPLACE FUNCTION gerar_numero_processo()
RETURNS TRIGGER AS $$
DECLARE
    prefixo TEXT;
    ano     TEXT;
    seq     INT;
BEGIN
    prefixo := CASE NEW.tipo WHEN 'importacao' THEN 'IMP' ELSE 'EXP' END;
    ano     := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1
      INTO seq
      FROM processos
     WHERE empresa_proprietaria_id = NEW.empresa_proprietaria_id
       AND tipo = NEW.tipo
       AND TO_CHAR(criado_em, 'YYYY') = ano;
    NEW.numero_processo := prefixo || '-' || ano || '-' || LPAD(seq::TEXT, 3, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_numero_processo
    BEFORE INSERT ON processos
    FOR EACH ROW
    WHEN (NEW.numero_processo IS NULL)
    EXECUTE FUNCTION gerar_numero_processo();

-- ============================================================
-- 3. PRODUTOS
-- ============================================================

CREATE TABLE IF NOT EXISTS produtos (
    id                      UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    codigo_interno          TEXT,                                -- Código próprio da empresa
    descricao               TEXT NOT NULL,
    descricao_complementar  TEXT,
    ncm                     TEXT,                                -- Nomenclatura Comum do Mercosul
    unidade_medida          TEXT DEFAULT 'UN',                   -- UN, KG, CX, MT, L...
    peso_bruto              DECIMAL(10, 4),
    peso_liquido            DECIMAL(10, 4),
    pais_origem             TEXT,
    fabricante              TEXT,
    marca                   TEXT,
    empresa_proprietaria_id UUID REFERENCES empresas(id),
    ativo                   BOOLEAN DEFAULT TRUE,
    criado_por              UUID REFERENCES usuarios(id),
    criado_em               TIMESTAMPTZ DEFAULT NOW(),
    atualizado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_empresa ON produtos(empresa_proprietaria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ncm     ON produtos(ncm);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo   ON produtos(ativo);

-- ============================================================
-- 4. ITENS DO PROCESSO (relação processo ↔ produto)
-- ============================================================

CREATE TABLE IF NOT EXISTS processo_itens (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    processo_id     UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
    produto_id      UUID REFERENCES produtos(id),
    descricao       TEXT,          -- Descrição avulsa se produto não cadastrado
    ncm             TEXT,
    quantidade      DECIMAL(10, 4) NOT NULL DEFAULT 1,
    unidade_medida  TEXT DEFAULT 'UN',
    valor_unitario  DECIMAL(15, 4),
    valor_total     DECIMAL(15, 2) GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
    peso_bruto      DECIMAL(10, 4),
    peso_liquido    DECIMAL(10, 4),
    criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processo_itens_processo ON processo_itens(processo_id);

-- ============================================================
-- 5. ADICIONAR CAMPOS À TABELA USUARIOS (se ainda não existirem)
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS cargo      TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS telefone   TEXT;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ============================================================
-- 6. ROW LEVEL SECURITY (RLS) - Proteção por empresa
-- ============================================================

ALTER TABLE processos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos           ENABLE ROW LEVEL SECURITY;
ALTER TABLE processo_itens     ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissoes_usuario ENABLE ROW LEVEL SECURITY;

-- Política: usuário vê apenas dados da sua empresa
CREATE POLICY "processos_empresa" ON processos
    FOR ALL USING (
        empresa_proprietaria_id = (
            SELECT empresa_id FROM usuarios
             WHERE id = auth.uid()
        )
    );

CREATE POLICY "produtos_empresa" ON produtos
    FOR ALL USING (
        empresa_proprietaria_id = (
            SELECT empresa_id FROM usuarios
             WHERE id = auth.uid()
        )
    );

CREATE POLICY "processo_itens_empresa" ON processo_itens
    FOR ALL USING (
        processo_id IN (
            SELECT id FROM processos
             WHERE empresa_proprietaria_id = (
                SELECT empresa_id FROM usuarios WHERE id = auth.uid()
             )
        )
    );

CREATE POLICY "permissoes_proprio_usuario" ON permissoes_usuario
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY "permissoes_admin" ON permissoes_usuario
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM usuarios
             WHERE id = auth.uid() AND perfil = 'admin'
        )
    );

-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
