-- Agendamento da limpeza de arquivos órfãos (2026-11-03)
-- O agendamento "limpar-arquivos-orfaos" rodava toda noite, mas a função
-- respondia 401 (não autorizado): a chave gravada no comando não era a
-- service_role. Agora a função aceita um segredo próprio, só para a limpeza
-- (a chave de administrador deixa de ficar gravada no banco).
--
-- ANTES de rodar este SQL, no terminal (pasta do projeto):
--   1) supabase secrets set LIMPEZA_SEGREDO=<COLE_O_SEGREDO>
--   2) supabase functions deploy limpar-arquivos --no-verify-jwt
-- Use o MESMO segredo abaixo, no lugar de <COLE_O_SEGREDO> (2 lugares neste arquivo).
-- O Authorization leva a chave pública (anon, a mesma do site): só passa pela
-- porta de entrada do Supabase quando a função foi publicada sem --no-verify-jwt.
-- Quem autoriza a limpeza é o segredo.
-- Pode rodar de novo sem erro.

-- recria o agendamento com o cabeçalho do segredo (todo dia às 03:30 UTC)
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'limpar-arquivos-orfaos';
SELECT cron.schedule('limpar-arquivos-orfaos', '30 3 * * *', $cron$
    SELECT net.http_post(
        url     := 'https://mvgbgjqkxsptbndgoskw.supabase.co/functions/v1/limpar-arquivos',
        headers := jsonb_build_object('x-limpeza-segredo', '<COLE_O_SEGREDO>', 'Content-Type', 'application/json',
                               'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z2JnanFreHNwdGJuZGdvc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTgxNTcsImV4cCI6MjA4ODQ5NDE1N30.MSBVWGwpdlYeSKoLL64It5BGWatxoU9uuW6FypgN628'),
        body    := '{}'::jsonb)
$cron$);

-- roda uma vez agora, para não esperar a madrugada
SELECT net.http_post(
    url     := 'https://mvgbgjqkxsptbndgoskw.supabase.co/functions/v1/limpar-arquivos',
    headers := jsonb_build_object('x-limpeza-segredo', '<COLE_O_SEGREDO>', 'Content-Type', 'application/json',
                               'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12Z2JnanFreHNwdGJuZGdvc2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTgxNTcsImV4cCI6MjA4ODQ5NDE1N30.MSBVWGwpdlYeSKoLL64It5BGWatxoU9uuW6FypgN628'),
    body    := '{}'::jsonb) AS chamada_id;

-- Depois de ~10 segundos, rode database/verificar-limpeza-arquivos.sql:
-- ultima_chamada_funcao deve começar com 200 e "pendentes" deve cair para 0.
