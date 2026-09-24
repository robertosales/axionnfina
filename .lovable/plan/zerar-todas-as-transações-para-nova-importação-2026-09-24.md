# Zerar todas as transações para nova importação

## Situação atual (verificada agora)

- 339 transações no banco, todas da sua conta e todas na conta "ITAU" (soma -R$ 5.359,82 — parece duplicado da importação anterior).
- 512 registros de histórico contábil, 2 fotos de saldo, 1 foto de patrimônio.
- Nubank e Mercado Pago sem transações.
- Nenhum ajuste manual, pareamento, etiqueta ou item de fatura ligado.

## O que será feito (uma única operação: tudo ou nada)

1. Apagar as 339 transações.
2. Apagar o histórico contábil gerado por elas.
3. Apagar as fotos de saldo e de patrimônio.
4. Zerar o saldo da conta ITAU, mantendo o limite de R$ 10.000,00.
5. Conferir: transações = 0 e saldo = R$ 0,00.

Contas, cartões, categorias, metas, orçamentos e investimentos ficam intactos. A ação é irreversível.

Dica para a nova importação: lance primeiro o saldo inicial do período do extrato e depois importe, para o saldo bater com o banco.

## Detalhes técnicos

```sql
begin;
update public.transactions set record_origin='manual'
  where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110' and record_origin<>'manual';
delete from public.journal_lines where journal_entry_id in
  (select id from public.journal_entries where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110');
delete from public.journal_entries where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110';
delete from public.transactions where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110';
delete from public.journal_lines where journal_entry_id in
  (select id from public.journal_entries where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110');
delete from public.journal_entries where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110';
delete from public.account_balances where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110';
delete from public.net_worth_snapshots where user_id='3e9428d8-e19d-45b1-83e6-055e72e17110';
update public.accounts set balance=0, current_balance=0, available_balance=credit_limit
  where id='c2121d0a-7942-41d5-8396-fa5416372f3f';
commit;
```

- A troca de `record_origin` contorna o gatilho que protege importados; a segunda limpeza do diário remove estornos gerados pelo gatilho no DELETE.
- Executado pela ferramenta de dados; nenhum código do app é alterado.
