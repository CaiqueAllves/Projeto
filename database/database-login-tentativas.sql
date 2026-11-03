-- Login: tentativas por CPF + IP (2026-11-03)
-- Antes: 5 senhas erradas de QUALQUER lugar travavam a conta por 15 min — quem
-- soubesse um CPF podia travar o cliente de propósito. Agora (login-usuario):
--   CPF + IP : 5 erros  → aquele CPF naquele endereço fica 15 min bloqueado
--   IP       : 30 erros em 1 h (qualquer CPF) → o endereço fica 15 min bloqueado
--   conta    : 20 erros somados de vários endereços → a conta fica 15 min bloqueada
-- Só a função (service_role) lê e grava: RLS ligada e nenhuma policy.
-- Sem esta tabela a função mantém a regra antiga (5 erros por conta).
-- Idempotente: pode rodar de novo sem erro.

CREATE TABLE IF NOT EXISTS login_tentativas (
    chave          TEXT PRIMARY KEY,          -- 'par:<cpf>|<ip>' ou 'ip:<ip>'
    erros          INTEGER NOT NULL DEFAULT 0,
    janela_inicio  TIMESTAMPTZ NOT NULL DEFAULT now(),
    bloqueado_ate  TIMESTAMPTZ,
    atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE login_tentativas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON login_tentativas FROM anon, authenticated;

-- Verificação: 1 linha, rls = true
SELECT relname, relrowsecurity AS rls FROM pg_class WHERE relname = 'login_tentativas';
