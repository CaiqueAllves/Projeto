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
