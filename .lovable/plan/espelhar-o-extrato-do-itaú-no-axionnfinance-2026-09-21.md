# Espelhar o extrato do Itaú no AxionnFinance

## O que o extrato traz

- Conta Itaú, agência 3932, conta 003869-2, período de 23/06/2026 a 21/09/2026.
- 169 lançamentos (fora as linhas de "saldo do dia"), somando -4.176,61.
- Saldo em conta hoje: **-1.183,21**; limite usado 1.183,21; limite disponível 8.816,79; **limite total 10.000,00**.

Detalhe importante: a soma dos lançamentos (-4.176,61) é exatamente o saldo que estava no sistema antes da limpeza. Ou seja, faltava o **saldo anterior** ao início do período. Para o saldo bater com o banco, é preciso registrar um saldo inicial de **+2.993,40** em 23/06/2026 (-1.183,21 − (−4.176,61)).

## Solução proposta

1. **Saldo inicial**: criar um lançamento "Saldo anterior (extrato Itaú 23/06/2026)" de +2.993,40 em 23/06/2026, marcado como ajuste de abertura.
2. **Lançamentos**: carregar os 169 lançamentos do extrato na conta Itaú, com data, descrição e valor originais (positivo = entrada, negativo = saída), origem "importação" e identificador único por linha para evitar duplicidade em futuras importações.
3. **Limite**: gravar o limite de cheque especial de 10.000,00 na conta Itaú, aproveitando o recurso de limite já implementado. Assim a tela passa a mostrar: saldo -1.183,21, "usando 1.183,21 do limite", restam 8.816,79 — espelho exato do banco.
4. **Saldo da conta**: recalcular e fixar em -1.183,21 (saldo, saldo disponível e saldo atual).
5. **Conferência final**: comparar totais do sistema com o extrato (quantidade de lançamentos, soma e saldo) e mostrar o resultado.

## Para os próximos extratos

A tela de importação já lê PDF de extrato e esse layout do Itaú é reconhecido linha a linha (as linhas de "saldo do dia" são ignoradas). Como melhoria pontual, junto desta carga eu ajusto o interpretador para:

- reconhecer o cabeçalho de saldo do Itaú e sugerir o saldo final do extrato para conferência;
- avisar quando a soma dos lançamentos não bater com o saldo do extrato, indicando que falta saldo anterior — foi exatamente o que aconteceu antes.

## Seleção múltipla e exclusão em lote (novo)

Na tela de Transações, incluir uma caixa de seleção em cada linha e uma no cabeçalho ("selecionar tudo o que está na tela"). Ao marcar itens, aparece uma barra com "X selecionadas" e os botões **Arquivar** e **Excluir**, mais "limpar seleção".

- Excluir pede confirmação, dizendo quantas serão apagadas e que a ação é definitiva.
- Transações importadas hoje só podem ser arquivadas. Para atender ao pedido, a exclusão em lote também aceitará importadas, com aviso claro de que elas podem voltar em uma nova sincronização/importação.
- Depois da exclusão, os saldos das contas envolvidas são atualizados automaticamente (o sistema já faz esse ajuste por lançamento).

## Detalhes técnicos

- Carga por SQL restrita a `account_id = c2121d0a-…` e ao usuário dono: `insert into public.transactions` com `record_origin = 'import'`, `status = 'settled'`, `external_id` no formato `pdf:statement:<conta>:<data>:<valor>:<descrição>`.
- Categoria: todos entram sem categoria (a recategorização em massa já existe em Transações); tipo derivado do sinal do valor (`income`/`expense`).
- `accounts.credit_limit = 10000`, `balance = available_balance = current_balance = -1183.21`.
- Sem migration e sem mudança de schema. Ajustes no interpretador ficam em `src/lib/document-import.ts` (parser de texto do extrato) com testes em `document-import.test.ts`.
- Seleção em lote: coluna de seleção no `data-table` de `src/routes/_authenticated/transactions.tsx` + novos hooks `useBulkArchiveTransactions` / `useBulkDeleteTransactions` em `src/lib/finance/transactions.ts` (delete por `in (ids)`, invalidando transações, contas, carteira e orçamentos). A trava de origem importada é contornada ajustando `record_origin` para manual apenas nas linhas selecionadas, dentro da mesma operação.


## Fora do escopo

- Reconciliação com faturas de cartão e com contas a pagar/receber já cadastradas.
- Conexão automática via Open Finance com o Itaú.
