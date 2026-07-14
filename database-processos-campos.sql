-- ========================================================================
-- MIGRAÇÃO: completa os campos da tabela `processos`
-- ------------------------------------------------------------------------
-- Contexto: o formulário formularios.html?tab=processo coleta dezenas de
-- campos (endereços, navio/aeronave, datas, container, etapas, documentos,
-- transporte) que hoje NÃO são persistidos — _coletarDadosProcesso() só
-- enviava um subconjunto pequeno para o banco. Esta migração adiciona as
-- colunas que faltam para que nada mais seja perdido ao salvar.
--
-- Execute este arquivo uma vez no SQL Editor do Supabase.
-- Todas as colunas são adicionadas com IF NOT EXISTS, então é seguro rodar
-- mais de uma vez.
-- ========================================================================

ALTER TABLE processos
    -- Vínculo com a proforma que originou o processo (item 3 do relatório:
    -- hoje só a proforma sabe qual processo gerou, e não o contrário)
    ADD COLUMN IF NOT EXISTS proforma_id             UUID REFERENCES proformas(id),

    -- Dados do Processo — campos que faltavam
    ADD COLUMN IF NOT EXISTS proposito                TEXT,
    ADD COLUMN IF NOT EXISTS emissor_tipo              TEXT DEFAULT 'usuario',
    ADD COLUMN IF NOT EXISTS documento_tipo            TEXT,
    ADD COLUMN IF NOT EXISTS documento                 TEXT,
    -- Remetente (empresa terceira emissora, quando emissor_tipo = 'terceiro').
    -- Não confundir com empresa_parceira_id, que é o destinatário do processo.
    ADD COLUMN IF NOT EXISTS remetente_parceiro_id     UUID REFERENCES parceiros(id),

    -- Container
    ADD COLUMN IF NOT EXISTS container_tipo            TEXT,
    ADD COLUMN IF NOT EXISTS container_numero          TEXT,

    -- Origem / Destino — complementos que faltavam
    ADD COLUMN IF NOT EXISTS origem_pais_codigo        TEXT,
    ADD COLUMN IF NOT EXISTS destino_pais_codigo       TEXT,
    ADD COLUMN IF NOT EXISTS navio                     TEXT,
    ADD COLUMN IF NOT EXISTS aeronave                  TEXT,
    ADD COLUMN IF NOT EXISTS aeroporto_origem          TEXT,
    ADD COLUMN IF NOT EXISTS aeroporto_destino         TEXT,
    ADD COLUMN IF NOT EXISTS fronteira_saida           TEXT,
    ADD COLUMN IF NOT EXISTS fronteira_entrada         TEXT,

    -- Endereços completos (origem, coleta, destino) — objeto JSONB
    -- {cep, estado, cidade, bairro, endereco, numero, complemento}
    ADD COLUMN IF NOT EXISTS origem_endereco           JSONB DEFAULT '{}'::jsonb,
    -- origem_coleta inclui também: mesmo (bool), horario, intervalo
    ADD COLUMN IF NOT EXISTS origem_coleta              JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS destino_endereco           JSONB DEFAULT '{}'::jsonb,
    -- {nome, contato, email}
    ADD COLUMN IF NOT EXISTS destino_responsavel        JSONB DEFAULT '{}'::jsonb,

    -- Paradas intermediárias de rota (portos/aeroportos/fronteiras extras)
    -- array de {id, tipo, valor}
    ADD COLUMN IF NOT EXISTS rota_intermediarios        JSONB DEFAULT '[]'::jsonb,

    -- Prazos e status — datas que faltavam
    ADD COLUMN IF NOT EXISTS data_embarque               DATE,
    ADD COLUMN IF NOT EXISTS data_chegada                DATE,
    ADD COLUMN IF NOT EXISTS data_cancelamento           DATE,
    ADD COLUMN IF NOT EXISTS obs_prazos                  TEXT,

    -- Etapas do processo — array de {id, nome, data, responsavel, concluida}
    ADD COLUMN IF NOT EXISTS etapas                      JSONB DEFAULT '[]'::jsonb,

    -- Numeração dos documentos (sem os arquivos anexados — fora de escopo
    -- desta rodada, depende de um bucket no Supabase Storage)
    -- objeto {proforma, commercial, packing, due, le, certorigem, ctn, nfe,
    --         awb, manifesto, fcl, lcl, bl, apolice, crt, micdta}
    ADD COLUMN IF NOT EXISTS documentos                  JSONB DEFAULT '{}'::jsonb,

    -- Transporte (transportadora, veículo, motorista, frete, seguro)
    ADD COLUMN IF NOT EXISTS transporte                  JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN processos.proforma_id         IS 'Proforma de origem, quando o processo foi gerado a partir de uma (link reverso de processo_gerado_id em proformas)';
COMMENT ON COLUMN processos.remetente_parceiro_id IS 'Empresa terceira emissora do processo (quando emissor_tipo = terceiro). Distinto de empresa_parceira_id (destinatário).';
COMMENT ON COLUMN processos.origem_endereco     IS '{cep, estado, cidade, bairro, endereco, numero, complemento}';
COMMENT ON COLUMN processos.origem_coleta       IS '{mesmo, cep, estado, cidade, bairro, endereco, numero, complemento, horario, intervalo}';
COMMENT ON COLUMN processos.destino_endereco    IS '{cep, estado, cidade, bairro, endereco, numero, complemento}';
COMMENT ON COLUMN processos.destino_responsavel IS '{nome, contato, email}';
COMMENT ON COLUMN processos.rota_intermediarios IS 'Array de {id, tipo (porto|aeroporto|fronteira), valor}';
COMMENT ON COLUMN processos.etapas              IS 'Array de {id, nome, data, responsavel, concluida}';
COMMENT ON COLUMN processos.documentos          IS 'Numeração dos documentos do processo (sem arquivos anexados)';
COMMENT ON COLUMN processos.transporte          IS '{tipo, nome, razao, cnpj, num_coleta, tipo_veiculo, placa, motorista, motorista_cnh, motorista_contato, data_coleta, data_entrega, frete_moeda, frete_valor, frete_incoterm, seguro, obs}';

-- Índice para consulta reversa "quais processos vieram desta proforma"
CREATE INDEX IF NOT EXISTS idx_processos_proforma_id ON processos(proforma_id);
