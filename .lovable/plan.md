# Limpeza de transações da sua conta

Estado atual (verificado agora no banco):
- 163 transações suas, todas com origem "importação"
- 164 lançamentos contábeis (com suas linhas)
- 1 snapshot de saldo e 1 snapshot de patrimônio
- Conta ITAU com saldo -4.295,06

## O que será feito

Uma única operação, sem alterar código do app:

1. Remover os registros ligados às suas transações (itens de fatura, ajustes manuais, pareamentos de transferência, enriquecimentos).
2. Remover os lançamentos contábeis e suas linhas.
3. Remover as 163 transações.
4. Remover os snapshots de saldo e de patrimônio.
5. Zerar o saldo atual e o disponível da conta ITAU.

Contas, cartões, orçamentos, metas, categorias, investimentos e conexões permanecem intactos.

## Detalhes técnicos

- Escopo: `user_id = 3e9428d8-e19d-45b1-83e6-055e72e17110`.
- Tudo dentro de `BEGIN/COMMIT`.
- Como todas as transações têm `record_origin = 'import'`, o gatilho `preserve_imported_transaction` bloqueia a exclusão; o script troca `record_origin` para `manual` antes de apagar, dentro da mesma transação.
- Tabelas tocadas: `credit_card_invoice_items`, `transaction_overrides`, `transaction_pairs`, `transaction_enrichments`, `journal_lines`, `journal_entries`, `transactions`, `account_balances`, `net_worth_snapshots`, `accounts` (apenas os dois campos de saldo).
- Verificação final: contagens em zero e saldos da ITAU em 0.00.

## Aviso

A operação é irreversível.
