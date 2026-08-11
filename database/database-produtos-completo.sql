-- ============================================================
-- MARPEX — produtos: acompanha os campos reais do formulário
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o formulário de Produto (formularios.html) cresceu
-- bastante (referências, HS Code/NALADI/DUN14, snapshot de NCM,
-- múltiplos idiomas por nome/descrição, múltiplas embalagens com
-- suas próprias medidas de caixa, múltiplos documentos) mas
-- database-produtos.sql nunca acompanhou — e o salvarProduto()
-- de supabase-api.js estava salvando campos que nem existem
-- (codigo_interno, descricao_complementar, pais_origem,
-- fabricante) e ignorando sku/status (NOT NULL), então todo
-- insert real teria falhado. Além disso, o RLS desse arquivo
-- usa auth.uid() — que nunca funciona nesta app (auth
-- customizada, sem sessão real do Supabase Auth). Nada disso
-- tinha sido detectado porque o botão Salvar era só um alert()
-- falso em formularios.js (nunca chegava a rodar de verdade).
--
-- Idiomas: cada produto pode ter até 4 nomes/descrições (1 base +
-- 3 extras), cada um no seu idioma. Guardado como JSONB (mesmo
-- padrão de proformas.itens): [{ idioma, idioma_outro, nome,
-- descricao }, ...] — "idioma_outro" só é preenchido quando
-- idioma = 'outro'. Isso é o que vai ser lido depois na hora de
-- gerar documentação de proposta/processo (ver comentário no
-- formulário).
--
-- Embalagens: várias por produto, cada uma com suas próprias
-- medidas de caixa extras — guardado como JSONB também (era só
-- estado JS em memória antes, nunca salvo).
--
-- Documentos: guardados como JSONB só para o tipo "link" (URL).
-- O tipo "arquivo" (upload de PDF) ainda não tem bucket de
-- Storage configurado nesta app — fica como limitação conhecida,
-- não persistido por enquanto.
-- ============================================================

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS referencia_interna     TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS referencia_fornecedor  TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS referencia_outra       TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS hscode                 TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS naladi_nesh            TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS dun14                  TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm_utrib              TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm_descricao          TEXT;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS ncm_descricao_completa TEXT;

-- "Identificação da Empresa" no topo do form — empresa fabricante/marca
-- associada ao produto. Propositalmente uma coluna nova e separada de
-- produtos.empresa_id, que continua sendo o dono/tenant do registro
-- (usado no RLS e em buscarProdutos) — não mexer nessa.
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS empresa_parceira_id UUID REFERENCES empresas(id);

ALTER TABLE produtos ADD COLUMN IF NOT EXISTS nomes_idiomas JSONB DEFAULT '[]'::jsonb;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS embalagens    JSONB DEFAULT '[]'::jsonb;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS documentos    JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_produtos_empresa_parceira_id ON produtos(empresa_parceira_id);

-- ── RLS: troca auth.uid() (nunca funciona nesta app) pelo padrão anon
-- já usado no resto do sistema — filtro por empresa é feito na aplicação.
DROP POLICY IF EXISTS "produtos_select_empresa" ON produtos;
DROP POLICY IF EXISTS "produtos_insert_empresa" ON produtos;
DROP POLICY IF EXISTS "produtos_update_empresa" ON produtos;
DROP POLICY IF EXISTS "produtos_delete_empresa" ON produtos;

DROP POLICY IF EXISTS "produtos_select_anon" ON produtos;
CREATE POLICY "produtos_select_anon" ON produtos FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "produtos_insert_anon" ON produtos;
CREATE POLICY "produtos_insert_anon" ON produtos FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "produtos_update_anon" ON produtos;
CREATE POLICY "produtos_update_anon" ON produtos FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "produtos_delete_anon" ON produtos;
CREATE POLICY "produtos_delete_anon" ON produtos FOR DELETE TO anon USING (true);
