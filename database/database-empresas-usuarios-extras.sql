-- Usuários extras pagos à parte, além do limite do plano contratado
-- (empresas.plano). Modelo combinado (sem gateway de pagamento integrado):
-- o cliente combina o valor por fora (Pix, boleto etc.) e o Marpex libera
-- as vagas extras aqui manualmente, via SQL Editor:
--
--   UPDATE empresas SET usuarios_extras_pagos = 3 WHERE id = '<empresa_id>';
--
-- Mesmo espírito do plano "Empresa" já existente ("capacidade personalizada
-- conforme contrato") — só que agora qualquer plano pode comprar vagas
-- extras avulsas, sem precisar migrar de plano inteiro.

ALTER TABLE empresas ADD COLUMN IF NOT EXISTS usuarios_extras_pagos INTEGER NOT NULL DEFAULT 0;

-- Postgres não aceita "ADD CONSTRAINT IF NOT EXISTS" — adiciona
-- defensivamente, ignorando se já existir (mesmo padrão já usado em
-- database-oportunidades.sql).
DO $$ BEGIN
    ALTER TABLE empresas ADD CONSTRAINT chk_usuarios_extras_pagos_nao_negativo CHECK (usuarios_extras_pagos >= 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
