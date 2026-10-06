-- Documentos por Processo (embarque) — Commercial Invoice, Packing List e DUE
-- passam a ser guardados por Processo; os demais documentos continuam por
-- Proforma (processo_id = NULL).
--
-- Antes: 1 arquivo por (proforma, tipo) → com 2+ Processos na mesma Proforma,
-- o Commercial Invoice de um embarque sobrescrevia o do outro.
-- Requer PostgreSQL 15+ (NULLS NOT DISTINCT) — padrão no Supabase.

ALTER TABLE proforma_documentos
    ADD COLUMN IF NOT EXISTS processo_id UUID REFERENCES processos(id) ON DELETE CASCADE;

ALTER TABLE proforma_documentos
    DROP CONSTRAINT IF EXISTS proforma_documentos_proforma_id_tipo_documento_key;

-- Idempotente: rodar de novo não dá erro (a constraint cria um índice com o
-- mesmo nome, por isso a segunda execução falhava com 42P07 duplicate_table).
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'proforma_documentos_proforma_tipo_processo_key') THEN
        ALTER TABLE proforma_documentos
            ADD CONSTRAINT proforma_documentos_proforma_tipo_processo_key
            UNIQUE NULLS NOT DISTINCT (proforma_id, tipo_documento, processo_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_proforma_documentos_processo ON proforma_documentos(processo_id);
