-- Garante no banco (não só na tela) que cada empresa tem no máximo 1 usuário
-- com perfil='admin' — o "master" do plano. Hoje isso só era verdade porque
-- o formulário de "Adicionar Usuário" (Permissões e Controle) nunca oferece
-- a opção "Admin" no <select> — nada no banco impedia forçar um 2º admin
-- via API direto. A descrição do plano Profissional ("2 administradores")
-- também nunca bateu com isso — foi corrigida em perfil.js pra "1
-- administrador + 4 sub-usuários", igual os outros 3 planos.
--
-- Índice único PARCIAL (só considera linhas com perfil='admin') — dois
-- usuarios com perfil='usuario'/'gerente' na mesma empresa continuam sem
-- problema, só perfil='admin' é que fica travado em no máximo 1 por empresa.
--
-- ATENÇÃO antes de rodar: se alguma empresa já tiver 2+ usuários com
-- perfil='admin' hoje (não consigo checar isso com a chave anon — só o
-- SQL Editor com acesso total enxerga todas as empresas), este CREATE
-- INDEX vai falhar com "duplicate key". Rode antes, se quiser conferir:
--
--   SELECT empresa_id, count(*) FROM usuarios WHERE perfil = 'admin'
--   GROUP BY empresa_id HAVING count(*) > 1;
--
-- Se aparecer alguma linha, rebaixe o admin duplicado (perfil='gerente' ou
-- 'usuario') antes de rodar o CREATE UNIQUE INDEX abaixo.

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_um_admin_por_empresa
    ON usuarios (empresa_id)
    WHERE perfil = 'admin';
