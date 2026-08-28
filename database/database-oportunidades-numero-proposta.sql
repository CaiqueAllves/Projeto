-- ============================================================
-- MARPEX — oportunidades: numeração sequencial de Proposta
-- Execute no SQL Editor do Supabase
-- ------------------------------------------------------------
-- Contexto: o campo "Título da Oportunidade" (texto livre, digitado
-- pelo usuário) virou "Número da Proposta" — preenchido automaticamente
-- pelo sistema, sequencial por empresa, e que NUNCA pode repetir, nem
-- se a proposta for excluída depois (excluirOportunidade() faz DELETE
-- físico na tabela oportunidades).
--
-- O padrão já usado em Pedido/Processo (ver _gerarNumeroPedido/
-- _gerarNumeroProcesso em supabase-api.js: MAX(numero) na própria
-- tabela + 1) NÃO serve aqui: como Pedido/Processo nunca são excluídos
-- de verdade (soft delete), o número mais alto sempre existe na
-- tabela. Oportunidade pode sim ser excluída de verdade — reaproveitar
-- MAX+1 faria o próximo número repetir um já usado. Por isso uma
-- tabela de contador própria (nunca olha pro que existe na tabela de
-- destino, só pro seu próprio valor), incrementada atomicamente via
-- função — serve também pra qualquer numeração futura do mesmo tipo,
-- não só Proposta.
-- ============================================================

CREATE TABLE IF NOT EXISTS contadores_numeracao (
    empresa_id UUID NOT NULL,
    tipo       TEXT NOT NULL,
    ano        INTEGER NOT NULL,
    ultimo     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (empresa_id, tipo, ano)
);

ALTER TABLE contadores_numeracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contadores_numeracao_all" ON contadores_numeracao;
CREATE POLICY "contadores_numeracao_all" ON contadores_numeracao FOR ALL TO anon USING (true) WITH CHECK (true);

-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING é atômico no
-- Postgres — seguro contra duas pessoas salvando ao mesmo tempo
-- (diferente do MAX+1 local usado em Pedido/Processo, que tecnicamente
-- tem essa brecha de corrida, só nunca deu problema na prática lá).
CREATE OR REPLACE FUNCTION proximo_numero_sequencial(p_empresa_id UUID, p_tipo TEXT, p_prefixo TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_ano    INTEGER := EXTRACT(YEAR FROM NOW());
    v_ultimo INTEGER;
BEGIN
    INSERT INTO contadores_numeracao (empresa_id, tipo, ano, ultimo)
    VALUES (p_empresa_id, p_tipo, v_ano, 1)
    ON CONFLICT (empresa_id, tipo, ano)
    DO UPDATE SET ultimo = contadores_numeracao.ultimo + 1
    RETURNING ultimo INTO v_ultimo;

    RETURN p_prefixo || v_ano || LPAD(v_ultimo::TEXT, 6, '0');
END;
$$;
