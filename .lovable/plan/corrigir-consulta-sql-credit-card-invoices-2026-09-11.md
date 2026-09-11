# Corrigir consulta SQL — credit_card_invoices

## Causa do erro

A tabela `credit_card_invoices` não tem a coluna `credit_card_id`. O nome correto da coluna de ligação com o cartão é `card_id`.

Colunas reais confirmadas no banco:

- `credit_card_invoices`: `id`, `user_id`, `card_id`, `reference_month`, `due_date`, `file_name`, `file_type`, `status`, `total_amount`, `created_at`
- `credit_card_invoice_items`: `id`, `invoice_id`, `user_id`, `purchase_date`, `description`, `amount`, `installment`, `external_id`, `category_id`, `transaction_id`

## Correção

Trocar o JOIN de:

```sql
JOIN public.credit_cards c ON c.id = i.credit_card_id
```

para:

```sql
JOIN public.credit_cards c ON c.id = i.card_id
```

## Script corrigido (exemplo de consulta de faturas com cartão)

```sql
SELECT
  i.id,
  i.reference_month,
  i.due_date,
  i.status,
  i.total_amount,
  c.name AS card_name,
  c.brand,
  c.last4
FROM public.credit_card_invoices i
JOIN public.credit_cards c ON c.id = i.card_id
WHERE i.user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'
ORDER BY i.reference_month DESC;
```

## Observação

- Se o objetivo for **excluir** faturas/itens ligados às transações (como no script de limpeza anterior), a remoção de itens usa `transaction_id` em `credit_card_invoice_items` e a remoção das faturas usa `user_id` — nenhuma das duas precisa da coluna inexistente.

## Detalhes técnicos

- Nenhuma migration é necessária: o schema está correto, o erro é apenas no nome da coluna usado na query.
- Nenhum arquivo da aplicação será alterado.
