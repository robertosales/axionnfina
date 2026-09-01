# Open Finance — configuração

O fluxo usa o Pluggy Connect no navegador e mantém as credenciais da aplicação somente no servidor.

## Variáveis obrigatórias

- `PLUGGY_CLIENT_ID` e `PLUGGY_CLIENT_SECRET`: credenciais da aplicação Pluggy.
- `PLUGGY_WEBHOOK_SECRET`: segredo aleatório usado no header do webhook.
- `APP_URL`: URL HTTPS pública da aplicação, sem barra final.
- `OPEN_FINANCE_ENABLED=true`.
- `SUPABASE_SERVICE_ROLE_KEY`: necessária para processar webhooks sem sessão de usuário.

Na primeira conexão, o backend registra ou atualiza na Pluggy um webhook global `all` apontando para
`/api/webhooks/openfinance/pluggy`, com o segredo em `x-axionn-webhook-secret`.

## Banco

Aplicar `supabase/migrations/20260830000000_openfinance_e2e.sql`. Ela permite atualização idempotente
da cópia bruta em `external_transactions` e adiciona o índice usado para localizar o Item Pluggy.

## Fluxo

1. O usuário escolhe a instituição e autoriza no widget oficial.
2. O Item retornado é validado pelo `clientUserId` e vinculado ao usuário.
3. Todas as contas são persistidas e cada conta é paginada pelo endpoint `/v2/transactions`.
4. Cada movimentação é armazenada em `external_transactions` e normalizada em `transactions`.
5. Webhooks atualizam, inserem ou removem movimentações; o usuário também pode sincronizar ou revogar manualmente.

## Teste em conta trial

A tela inclui o conector sandbox `Pluggy Bank`. Use as credenciais oficiais de teste:

- usuário: `user-ok`
- senha: `password-ok`
- MFA, quando solicitado: `123456`

Contas Pluggy em trial não podem criar Items de instituições reais.
