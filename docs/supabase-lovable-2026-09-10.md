# Execução pelo Lovable — Supabase

## Resultado confirmado pelo usuário

O usuário também confirmou a execução de migration pelo Lovable com `Query succeeded`. A regeneração dos tipos e a execução completa em banco vazio continuam sem confirmação.

Após o reparo do ledger, o usuário retornou:

```text
PASS: RLS, IDOR, balances, journal reversal, imported overrides
```

Os cenários do teste SQL estão aprovados no ambiente utilizado. Não é necessário repetir o reparo nem o teste sem novas alterações. O script atualizado executa `ROLLBACK` antes de emitir esse resultado. Essa evidência não confirma, por si só, replay completo em banco vazio, histórico de migrations, tipos regenerados ou integração com o provedor real.

Próxima solicitação ao Lovable:

> Regenere `src/integrations/supabase/types.ts` a partir do schema público atual e sincronize o arquivo com o repositório. Confira o registro das migrations `20260910100000`, `20260910110000`, `20260910120000` e `20260910130000`, sem reaplicar SQL já executado. Informe também se é possível validar a cadeia completa em um banco de testes vazio, sem resetar o banco existente.

## Correção para `Ledger accounts missing`

O teste executado pelo usuário encontrou ausência da conta contábil financeira ou da contrapartida. A migration original pressupunha a inicialização por triggers anteriores.

1. Se a sessão SQL ainda estiver com a transação do teste abortada, execute `ROLLBACK;`.
2. Execute somente [supabase-corrigir-ledger-2026-09-10.sql](supabase-corrigir-ledger-2026-09-10.sql), correspondente à nova migration `20260910130000_ensure_transaction_ledger_accounts.sql`. Não reaplique o pacote inicial.
3. Execute novamente o [teste atualizado](../supabase/tests/data_trust.sql) inteiro e envie o resultado.

O reparo cria contas contábeis ausentes dentro da transação do lançamento e mantém contas desativadas como estão. Não altera saldos existentes nem reaplica lançamentos históricos. O teste agora remove deliberadamente essas contas dos usuários fictícios para cobrir a falha. O usuário confirmou a aprovação desse teste pelo Lovable.

O Supabase é administrado pelo usuário pelo Lovable. Nenhum comando deste roteiro foi executado no banco por este agente.

Se os arquivos locais ainda não estiverem no Lovable, anexe ou cole o conteúdo de [supabase-aplicar-2026-09-10.sql](supabase-aplicar-2026-09-10.sql). Ele reúne as quatro migrations em uma transação. Use esse pacote **ou** as migrations individuais, uma única vez, e peça ao Lovable para registrar as versões aplicadas. Os testes ficam em [data_trust.sql](../supabase/tests/data_trust.sql) e são executados separadamente.

## Mensagem para colar no Lovable

> Aplique as migrations novas deste projeto, nesta ordem, registrando cada versão no histórico normal de migrations:
>
> 1. `supabase/migrations/20260910100000_data_trust.sql`
> 2. `supabase/migrations/20260910110000_atomic_transaction_ledger.sql`
> 3. `supabase/migrations/20260910120000_wealth_snapshots.sql`
> 4. `supabase/migrations/20260910130000_ensure_transaction_ledger_accounts.sql`
>
> Confira antes se as migrations até `20260904120000` já estão aplicadas. Não reaplique migrations antigas. Não zere o banco existente.
>
> Em uma branch/banco de testes isolado, execute `supabase/tests/data_trust.sql`. O script cria dois usuários fictícios, verifica RLS e IDOR nos dois sentidos, testa correções de importados e reversão de saldo/ledger e termina com ROLLBACK. Envie o resultado completo. Se houver erro, execute ROLLBACK antes de qualquer outro comando e envie o erro, sem ignorá-lo.
>
> Regenere `src/integrations/supabase/types.ts` a partir do schema público atualizado. Execute também toda a cadeia de migrations em um banco de testes vazio e envie o resultado. Não execute reset no banco existente.
>
> Atenção: havia dois arquivos com a versão `20260904000000`. O arquivo `production_hardening` foi renomeado localmente para `20260904000001`. Compare o histórico remoto com os objetos da migration antes de reconciliar essa versão; não exclua versões nem reaplique alterações de saldo para resolver a divergência.

## O que muda

- Correções de categoria, descrição e estabelecimento de transações importadas ficam em `transaction_overrides`. O valor, a conta e a data permanecem os do documento/provedor.
- Transações importadas devem ser arquivadas; exclusão física é bloqueada.
- `investment_goal_links` vincula uma posição a uma meta do mesmo usuário. O vínculo não soma automaticamente o patrimônio ao progresso da meta.
- Transações manuais e importações de documentos passam a gerar lançamentos contábeis na mesma transação do banco. Edições/arquivamentos revertem a contribuição anterior. Os lançamentos anteriores permanecem registrados como revertidos.
- Transações Open Finance não são somadas ao saldo já informado pelo banco. Uma nova sincronização obtém o saldo atual do provedor; saldos históricos potencialmente duplicados não são corrigidos por estimativa.
- `account_reconciliation` permite comparar saldo informado e movimentação contabilizada. A diferença inclui saldo inicial e registros históricos que ainda não têm ledger; não deve ser corrigida automaticamente.
- Novas alterações em contas/posições registram o mês atual em `net_worth_snapshots`. Meses anteriores não são inventados. Havendo contas de investimento, seus saldos são usados em vez de somar novamente as posições.

## Resultado necessário para encerrar a validação

- As quatro versões aplicadas sem erro.
- Confirmado: resultado `PASS` do teste SQL, emitido após o rollback previsto no script.
- Resultado da execução de toda a cadeia em banco vazio.
- Tipos regenerados enviados ao repositório pelo Lovable.
- Uma sincronização de teste com repetição: saldo não deve mudar pela simples reimportação; correções de categoria devem permanecer.

Os tipos das novas tabelas/RPC foram descritos localmente para o typecheck. Isso não substitui a regeneração pelo banco.

## Validação funcional após aplicar

1. Criar uma transação manual, editar seu valor e arquivar: verificar saldo e lançamentos.
2. Importar documento; alterar categoria/descrição; reimportar e conferir correções e duplicidade.
3. Conectar/sincronizar banco; conferir a data de sincronização e repetir a operação.
4. Vincular investimento a uma meta e recarregar a página.
5. Conferir o histórico patrimonial após alterar uma conta ou posição.

Enquanto as migrations não estiverem aplicadas, consultas de correções e vínculos podem apresentar estado de erro. Aplique o banco antes de publicar esta versão da interface.
