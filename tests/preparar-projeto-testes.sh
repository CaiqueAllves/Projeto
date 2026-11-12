#!/usr/bin/env bash
# Monta o projeto Supabase de TESTES a partir da produção (2026-11-12)
# -------------------------------------------------------------------
# Copia a ESTRUTURA do banco de produção (tabelas, funções, gatilhos, regras de
# acesso, buckets e regras do Storage) e só os DADOS DE REFERÊNCIA (tabelas
# apoio_* e plano_contas). Nenhum dado de cliente vai para o projeto de testes.
#
# Uso (no terminal, na pasta do projeto) — as senhas ficam só nas variáveis:
#   export PROD_DB_URL='postgresql://postgres.mvgbgjqkxsptbndgoskw:SENHA_PROD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
#   export TESTE_DB_URL='postgresql://postgres.REF_TESTE:SENHA_TESTE@aws-....pooler.supabase.com:5432/postgres'
#   export TESTE_REF='REF_TESTE'            # o código do projeto de testes (está na URL dele)
#   bash tests/preparar-projeto-testes.sh
# As duas conexões são "Session pooler" (botão Connect de cada projeto).
# Pode rodar de novo: o que já existe gera aviso e é ignorado.

set -uo pipefail
: "${PROD_DB_URL:?Defina PROD_DB_URL (conexão Session pooler da PRODUÇÃO)}"
: "${TESTE_DB_URL:?Defina TESTE_DB_URL (conexão Session pooler do projeto de TESTES)}"
: "${TESTE_REF:?Defina TESTE_REF (código do projeto de testes)}"
case "$TESTE_DB_URL" in *mvgbgjqkxsptbndgoskw*) echo "ERRO: TESTE_DB_URL aponta para a PRODUÇÃO. Pare."; exit 1;; esac

PG=/usr/lib/postgresql/17/bin
if [ ! -x "$PG/pg_dump" ]; then
  echo "== Instalando o cliente PostgreSQL 17"
  sudo apt-get update -qq && sudo apt-get install -y -qq postgresql-common >/dev/null
  sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null
  sudo apt-get install -y -qq postgresql-client-17 >/dev/null
fi
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

echo "== 1/5 Estrutura do esquema public"
"$PG/pg_dump" "$PROD_DB_URL" --schema-only --schema=public --no-owner --no-privileges -f "$TMP/estrutura.sql" || exit 1
"$PG/psql" "$TESTE_DB_URL" -q -v ON_ERROR_STOP=0 -f "$TMP/estrutura.sql" 2> "$TMP/erros-estrutura.txt"
echo "   avisos/erros: $(grep -c ERROR "$TMP/erros-estrutura.txt") (normal: 'already exists' do que o Supabase já cria)"
grep ERROR "$TMP/erros-estrutura.txt" | grep -v "already exists" | head -20

echo "== 2/5 Dados de referência (apoio_* e plano_contas)"
TABS=$("$PG/psql" "$PROD_DB_URL" -At -c "SELECT string_agg('--table=public.' || quote_ident(tablename), ' ') FROM pg_tables WHERE schemaname='public' AND (tablename LIKE 'apoio\_%' OR tablename = 'plano_contas')")
echo "   tabelas: ${TABS//--table=public./}"
# shellcheck disable=SC2086
"$PG/pg_dump" "$PROD_DB_URL" --data-only --no-owner --no-privileges $TABS -f "$TMP/referencia.sql" || exit 1
"$PG/psql" "$TESTE_DB_URL" -q -v ON_ERROR_STOP=0 -c "SET session_replication_role = replica;" -f "$TMP/referencia.sql" 2> "$TMP/erros-ref.txt"
grep ERROR "$TMP/erros-ref.txt" | head -10

echo "== 3/5 Buckets do Storage (só a configuração, sem arquivos)"
"$PG/psql" "$PROD_DB_URL" -At -c "SELECT format('INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (%L, %L, %L, %s, %s) ON CONFLICT (id) DO NOTHING;', id, name, public, coalesce(file_size_limit::text, 'NULL'), coalesce(quote_literal(allowed_mime_types::text) || '::text[]', 'NULL')) FROM storage.buckets" > "$TMP/buckets.sql"
"$PG/psql" "$TESTE_DB_URL" -q -f "$TMP/buckets.sql"
echo "   $(wc -l < "$TMP/buckets.sql") bucket(s)"

echo "== 4/5 Regras de acesso do Storage"
"$PG/psql" "$PROD_DB_URL" -At -c "SELECT format('DROP POLICY IF EXISTS %I ON storage.objects; CREATE POLICY %I ON storage.objects AS %s FOR %s TO %s%s%s;', policyname, policyname, permissive, cmd, array_to_string(roles, ', '), CASE WHEN qual IS NOT NULL THEN ' USING (' || qual || ')' ELSE '' END, CASE WHEN with_check IS NOT NULL THEN ' WITH CHECK (' || with_check || ')' ELSE '' END) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects'" > "$TMP/storage-policies.sql"
"$PG/psql" "$TESTE_DB_URL" -q -v ON_ERROR_STOP=0 -f "$TMP/storage-policies.sql" 2> "$TMP/erros-pol.txt"
echo "   $(wc -l < "$TMP/storage-policies.sql") regra(s); erros: $(grep -c ERROR "$TMP/erros-pol.txt")"

echo "== 5/5 Conferência"
"$PG/psql" "$TESTE_DB_URL" -At -c "SELECT 'tabelas public: ' || count(*) FROM pg_tables WHERE schemaname='public' UNION ALL SELECT 'funções public: ' || count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' UNION ALL SELECT 'regras (RLS): ' || count(*) FROM pg_policies UNION ALL SELECT 'linhas apoio_ncm: ' || (SELECT count(*) FROM apoio_ncm)"

cat <<FIM

Pronto. Próximos passos (uma vez):
  1) Publicar as Edge Functions no projeto de testes:
       supabase login
       for f in supabase/functions/*/; do supabase functions deploy "\$(basename "\$f")" --project-ref $TESTE_REF --no-verify-jwt; done
     (ANTHROPIC_API_KEY só se for testar o assistente de IA:
       supabase secrets set ANTHROPIC_API_KEY=... --project-ref $TESTE_REF)
  2) Criar a conta de teste pelo próprio sistema apontando para o projeto de testes
     (ver tests/README.md, seção "Projeto Supabase só para testes").
FIM
