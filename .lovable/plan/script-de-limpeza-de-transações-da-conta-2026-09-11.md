# Script de limpeza de transações da conta

## Contexto

A limpeza já foi executada em 11/09/2026 para o usuário `3e9428d8-e19d-45b1-83e6-055e72e17110`. O script original não ficou versionado no repositório; abaixo está a reconstrução fiel do que foi aplicado, baseada no plano aprovado e no schema público do banco.

## O que o script apaga

1. Itens de fatura e lançamentos importados ligados às contas do usuário.
2. Registros filhos das transações: correções, pareamentos, enriquecimentos e etiquetas.
3. Histórico contábil (`journal_lines` / `journal_entries`) vinculado às transações.
4. As próprias transações.
5. Fotos de saldo (`account_balances`) e snapshots de patrimônio (`net_worth_snapshots`).
6. Zera `current_balance` e `available_balance` da conta "ITAU".

Tudo roda dentro de uma única transação: ou apaga tudo, ou nada é alterado.

## Script SQL reconstruído

```sql
BEGIN;

-- 1. Remove itens de fatura ligados a faturas de cartões do usuário
DELETE FROM public.credit_card_invoice_items
WHERE invoice_id IN (
  SELECT i.id
  FROM public.credit_card_invoices i
  JOIN public.credit_cards c ON c.id = i.credit_card_id
  JOIN public.accounts a ON a.id = c.account_id
  WHERE a.user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

-- 2. Remove lançamentos importados de extratos/Open Finance das contas do usuário
DELETE FROM public.external_transactions
WHERE account_id IN (
  SELECT id FROM public.accounts WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

-- 3. Remove registros filhos das transações do usuário
DELETE FROM public.transaction_overrides
WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

DELETE FROM public.transaction_pairs
WHERE debit_transaction_id IN (
  SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
) OR credit_transaction_id IN (
  SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

DELETE FROM public.transaction_enrichments
WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

DELETE FROM public.transaction_tags
WHERE transaction_id IN (
  SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
);

-- 4. Remove o histórico contábil gerado pelas transações
DELETE FROM public.journal_lines
WHERE journal_entry_id IN (
  SELECT id FROM public.journal_entries
  WHERE reference_type = 'transaction'
    AND reference_id IN (
      SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
    )
);

DELETE FROM public.journal_entries
WHERE reference_type = 'transaction'
  AND reference_id IN (
    SELECT id FROM public.transactions WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
  );

-- 5. Remove as transações
DELETE FROM public.transactions
WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110';

-- 6. Remove fotos de saldo e snapshots de patrimônio
DELETE FROM public.account_balances
WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110';

DELETE FROM public.net_worth_snapshots
WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110';

-- 7. Zera o saldo da conta ITAU
UPDATE public.accounts
SET current_balance = 0,
    available_balance = 0
WHERE user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
  AND name = 'ITAU';

COMMIT;
```

## Observações importantes

- O `user_id` está fixo no script. Para reaproveitar em outro usuário, substitua o UUID.
- A ordem das exclusões respeita as dependências entre tabelas: filhas primeiro, depois `journal_lines`/`journal_entries`, depois `transactions`, depois snapshots e, por fim, o `UPDATE` em `accounts`.
- O gatilho `sync_transaction_journal` reverte os lançamentos contábeis no `DELETE` de `transactions`; por isso também removemos explicitamente as entradas do diário para garantir limpeza completa.
- A ação é irreversível. Só execute após backup ou quando a intenção for realmente apagar todo o histórico financeiro do usuário.
