-- Estágio 2.0 da migração de autenticação (ver auditoria de segurança).
-- Coluna ponte entre a tabela customizada `usuarios` e o Supabase Auth real
-- (auth.users). Aditiva e nullable — não muda nada do comportamento atual;
-- só passa a ser preenchida a partir do Estágio 2.1 (login linkando cada
-- conta na hora que ela loga de novo, sem exigir troca de senha).

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_usuarios_auth_id ON usuarios(auth_id);
