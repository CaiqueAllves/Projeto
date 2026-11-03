-- Conferência da limpeza automática de arquivos (2026-11-03) — SÓ LEITURA
-- Uma consulta, uma linha de resposta (o SQL Editor mostra só o último resultado).
-- Funciona mesmo sem as extensões pg_cron / pg_net instaladas.
WITH dyn AS (
    SELECT
        to_regclass('cron.job')              IS NOT NULL AS tem_cron,
        to_regclass('cron.job_run_details')  IS NOT NULL AS tem_execucoes,
        to_regclass('net._http_response')    IS NOT NULL AS tem_net
)
SELECT
    (SELECT coalesce(string_agg(extname || ' ' || extversion, ', '), 'nenhuma')
       FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net'))                       AS extensoes,
    CASE WHEN tem_cron THEN (xpath('/row/v/text()', query_to_xml(
        $q$SELECT coalesce(string_agg(jobname || ' [' || schedule || '] ativo=' || active, ' | '), 'nenhum agendamento') AS v FROM cron.job$q$,
        false, true, '')))[1]::text ELSE 'pg_cron não instalado' END                   AS agendamentos,
    CASE WHEN tem_execucoes THEN (xpath('/row/v/text()', query_to_xml(
        $q$SELECT coalesce((SELECT status || ' em ' || start_time::text || ': ' || left(coalesce(return_message, ''), 120)
                              FROM cron.job_run_details ORDER BY start_time DESC LIMIT 1), 'nunca rodou') AS v$q$,
        false, true, '')))[1]::text ELSE '—' END                                        AS ultima_execucao,
    CASE WHEN tem_net THEN (xpath('/row/v/text()', query_to_xml(
        $q$SELECT coalesce((SELECT status_code::text || ' em ' || created::text || ': ' || left(coalesce(content::text, error_msg, ''), 120)
                              FROM net._http_response ORDER BY created DESC LIMIT 1), 'nenhuma chamada') AS v$q$,
        false, true, '')))[1]::text ELSE 'pg_net não instalado' END                    AS ultima_chamada_funcao,
    (SELECT count(*) FROM arquivos_remover)                                             AS pendentes,
    (SELECT min(criado_em) FROM arquivos_remover)                                       AS mais_antigo
FROM dyn;
