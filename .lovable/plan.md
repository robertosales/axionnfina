# Remover as transações da conta Itaú

## O que foi verificado

- Existe uma conta chamada "ITAU" (Itaú Unibanco), do tipo conta corrente, com saldo -4.176,61 e **169 transações**.
- As outras contas (Mercado Pago e Nubank) não têm transações e não serão tocadas.
- Nenhum item de fatura de cartão está ligado a essas transações.
- Existem 4 registros de histórico de saldo dessa conta.

## O que o script faz

1. Apaga as 169 transações vinculadas à conta Itaú (e, em cascata, os complementos ligados a elas: enriquecimentos, ajustes manuais e pares de transferência).
2. Apaga o histórico de saldo dessa conta.
3. Zera o saldo da conta Itaú (saldo, saldo disponível e saldo atual), mantendo o limite de cheque especial cadastrado.
4. Mantém a conta, as demais contas e todo o resto do sistema intactos.

Tudo roda em uma única transação: se qualquer etapa falhar, nada é aplicado.

## Detalhes técnicos

Script (executado via ferramenta de dados, escopo restrito ao `account_id` do Itaú):

```sql
begin;

delete from public.transactions
where account_id = 'c2121d0a-7942-41d5-8396-fa5416372f3f';

delete from public.account_balances
where account_id = 'c2121d0a-7942-41d5-8396-fa5416372f3f';

update public.accounts
set balance = 0,
    available_balance = 0,
    current_balance = 0,
    updated_at = now()
where id = 'c2121d0a-7942-41d5-8396-fa5416372f3f';

commit;
```

Cascatas automáticas já existentes: `transaction_enrichments`, `transaction_overrides`, `transaction_pairs`. Itens de fatura de cartão apenas perderiam a referência (`set null`), mas hoje não há nenhum.

Depois da execução, faço uma conferência lendo as contagens (transações = 0, saldo = 0) e confirmo o resultado.

## Confirmação necessária

Esta ação é definitiva e não tem desfazer. Aprove o plano para eu executar.
