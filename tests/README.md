# Testes automáticos (Marpex)

Testes de ponta a ponta com Playwright, rodando contra o Supabase real com uma
**conta de teste** (nunca use a conta de produção da empresa). Todo teste
apaga os dados que criou.

## Rodar no seu computador / Codespace

```bash
cd tests
npm install
npm run instalar          # baixa o Chromium (só na 1ª vez)
MARPEX_CPF=000.000.000-00 MARPEX_SENHA=suaSenha npm test
```

- Sobe um servidor local na porta 8947 (se já não houver um) servindo a raiz do projeto.
- `npm test -- proforma` roda só os testes cujo arquivo contém "proforma".

## No GitHub (automático a cada push)

O workflow `.github/workflows/testes.yml` roda tudo a cada envio para o `main`.
Cadastre em **Settings › Secrets and variables › Actions**:

- `MARPEX_CPF` — CPF da conta de teste
- `MARPEX_SENHA` — senha da conta de teste

## Projeto Supabase só para testes (recomendado)

Sem configuração, os testes rodam no **banco de produção** (com a conta de teste).
Com um projeto separado, nada de teste encosta nos dados reais.

1. **Criar o projeto** no Supabase (região São Paulo). Numa organização
   gratuita separada ele não custa nada (projeto parado 1 semana pausa e é só
   reativar); dentro da organização Pro, é cobrado à parte.
2. **Copiar a estrutura da produção** (tabelas, funções, regras, buckets e os
   dados de referência `apoio_*`/`plano_contas` — nenhum dado de cliente):
   ```bash
   export PROD_DB_URL='postgresql://postgres.mvgbgjqkxsptbndgoskw:SENHA_PROD@aws-1-sa-east-1.pooler.supabase.com:5432/postgres'
   export TESTE_DB_URL='postgresql://postgres.REF_TESTE:SENHA_TESTE@...pooler.supabase.com:5432/postgres'
   export TESTE_REF='REF_TESTE'
   bash tests/preparar-projeto-testes.sh
   ```
   O script termina mostrando como publicar as Edge Functions no projeto de testes.
3. **Apontar os testes para ele** (a troca é feita só nas páginas servidas aos
   testes; o sistema publicado não muda):
   ```bash
   export MARPEX_TESTE_SUPABASE_REF='REF_TESTE'
   export MARPEX_TESTE_SUPABASE_ANON='chave anon do projeto de testes'   # Settings → API
   ```
4. **Criar a conta de teste nele**: com as variáveis do passo 3 definidas, suba
   o servidor (`python3 -m http.server 8947` na raiz) e abra o cadastro pelo
   Playwright ou peça ao Claude para criar a conta no projeto de testes. Use
   esse CPF/senha em `MARPEX_CPF`/`MARPEX_SENHA`.
