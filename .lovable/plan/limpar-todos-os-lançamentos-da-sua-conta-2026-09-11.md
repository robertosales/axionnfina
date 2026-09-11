# Limpar todos os lançamentos da sua conta

## Situação atual (verificada no banco)

- 49 lançamentos, todos da sua conta (14/08/2026 a 10/09/2026).
- 50 registros de histórico contábil com 100 linhas ligadas a eles.
- 7 fotos de saldo e 1 foto de patrimônio.
- Nenhuma correção manual, pareamento, enriquecimento, etiqueta, item de fatura ou lançamento importado pendente.
- Conta "ITAU" com saldo atual de -4.072,12.

## O que será feito

Um script de limpeza, executado uma única vez, que apaga tudo que pertence à sua conta:

1. Apaga os 49 lançamentos.
2. Apaga o histórico contábil ligado a eles (lançamentos e linhas do diário).
3. Apaga registros ligados caso apareçam até a execução (correções, pareamentos, enriquecimentos, etiquetas, itens de fatura, lançamentos importados).
4. Apaga as fotos de saldo e de patrimônio.
5. Zera o saldo da conta "ITAU" (saldo atual e disponível em 0).

Tudo roda em uma única operação: ou apaga tudo, ou nada é alterado.

Depois disso a lista de lançamentos, o painel e os relatórios aparecem vazios, e o saldo mostra zero. A ação é irreversível.

## Detalhes técnicos

- Script SQL executado com a ferramenta de dados (não é migration; não há mudança de estrutura).
- Escopo fixado por `user_id = '3e9428d8-e19d-45b1-83e6-055e72e17110'`.
- Ordem: tabelas filhas de `transactions` → `journal_lines`/`journal_entries` (origem `transaction`) → `transactions` → `account_balances`/`net_worth_snapshots` → `UPDATE accounts SET current_balance = 0, available_balance = 0`.
- O gatilho `sync_transaction_journal` reverte lançamentos do diário em DELETE; a limpeza direta de `journal_entries`/`journal_lines` remove também os registros revertidos.
- Nenhum arquivo de código da aplicação é alterado.
