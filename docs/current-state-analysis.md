# Axionn Finance — revisão arquitetural das Fases 2, 3 e 4

Data da revisão: 2026-08-28

## Resumo executivo

O produto possui uma boa direção de domínio (carteira multi-contas, adapter de
Open Finance, normalização, deduplicação e ledger), mas a Fase 4 foi integrada
sem fechar três contratos fundamentais: ordem das migrations, identidade do
usuário durante deploy e compatibilidade entre o schema legado e o novo schema.
Isso impedia o banco de evoluir e deixava partes novas fora do caminho realmente
usado pela interface.

As migrations com falha foram corrigidas e os fluxos principais de edição de
contas e transações foram completados. O build de produção passa. A validação
integral das migrations ainda deve ser executada em um banco local limpo ou no
pipeline, pois Docker não está disponível nesta máquina e o CLI não possui token
para uma simulação contra o projeto vinculado.

## Achados críticos corrigidos

### 1. Ordem inválida da coluna `transactions.category_id`

`20260829000000_evolve_transaction_categories.sql` executava um backfill sobre
`category_id`, mas a coluna só era criada em
`20260829000001_transactions_phase4.sql`.

Correção: a coluna agora é criada antes do backfill, com `IF NOT EXISTS`. A
migration seguinte mantém a declaração idempotente.

### 2. Seed dependente de `auth.uid()` durante migration

Uma migration não representa uma requisição autenticada. Portanto,
`auth.uid()` retorna `NULL`, violando `ledger_accounts.user_id NOT NULL`.

Correção: foi criada `seed_default_ledger_accounts(p_user_id)`, com backfill
explícito a partir de `auth.users` e trigger para novos usuários.

### 3. Contas financeiras sem conta correspondente no ledger

`pair_transfer` procurava uma `ledger_account` ligada a cada conta financeira,
mas nenhum fluxo criava esse vínculo.

Correção: trigger e backfill agora criam/atualizam uma conta contábil por conta
financeira, inclusive ao arquivar ou alterar o tipo da conta.

### 4. Detecção e pareamento de transferências impossíveis

O código comparava diretamente débito negativo com crédito positivo. Assim,
uma transferência válida nunca passava na validação nem aparecia como candidata.

Correção: comparações e lançamentos agora usam valores absolutos, preservando a
regra débito negativo/crédito positivo.

### 5. Edição de conta criava uma nova conta

A tela guardava `editId`, mas não o enviava ao serviço. O RPC só reconhecia
contas por `external_id`, ausente em contas manuais.

Correção: edições enviam o ID e fazem `UPDATE` protegido por RLS. Erros dos RPCs
agora são propagados à UI em vez de serem convertidos silenciosamente em sucesso.

### 6. Transações não possuíam edição completa

A UI permitia criar, excluir e alterar apenas a categoria.

Correção: a mesma caixa de diálogo agora edita descrição, valor, tipo, categoria,
estabelecimento, conta e data.

### 7. Dois modelos de transação divergentes

A UI usa `category`, `merchant` e `occurred_at`; a Fase 4 introduziu
`category_id`, `merchant_name` e `posted_at`. Dados importados poderiam existir
no banco e aparecer incorretamente na interface.

Correção: trigger de compatibilidade mantém os dois contratos sincronizados até
a remoção planejada do schema legado.

### 8. Dependência inconsistente do TanStack Table

`package.json` exigia 8.21.3, enquanto `package-lock.json` e `node_modules`
continham 9.2.3. A API usada pelo componente pertence à versão 8 e o build
falhava.

Correção: lockfile e instalação foram alinhados com 8.21.3.

## Riscos ainda abertos

### P0 — antes de aplicar em produção

- Executar todas as migrations do zero em PostgreSQL/Supabase local e também
  sobre uma cópia anonimizada do banco atual.
- Confirmar se as duas migrations com erro deixaram objetos parciais no ambiente.
  Se foram executadas pelo SQL Editor sem transação explícita, pode ser necessário
  reconciliar objetos antes de reexecutar.
- Regenerar `src/integrations/supabase/types.ts` depois que a Fase 4 estiver
  aplicada. Os tipos atuais não contêm tabelas, colunas e RPCs novos, gerando
  erros no typecheck dos módulos de categorização, sync e ledger.
- Adicionar testes de RLS/IDOR para todas as novas tabelas e RPCs, sobretudo
  journal entries, external transactions e regras de categorização.

### P1 — estabilização funcional

- Migrar a UI para usar somente `category_id`, `merchant_name` e `posted_at` e,
  depois de uma janela de compatibilidade, remover os campos legados.
- Substituir exclusão física de transações importadas por ocultação/ajuste do
  usuário; caso contrário, a sincronização pode recriar o lançamento excluído.
- Definir política explícita para edição de dados Open Finance: manter valor/data
  de origem imutáveis e persistir ajustes do usuário em uma camada de override.
- Reescrever ou remover as rotas em `src/app/api`: elas usam convenções de
  Next.js em um projeto TanStack Start e não fazem parte do roteamento ativo.
- Incluir o typecheck no pipeline de build. Hoje o bundle passa mesmo com tipos
  desatualizados em módulos ainda não importados pela aplicação.

### P2 — evolução arquitetural

- Consolidar serviços de conta duplicados (`finance-data.ts` e
  `account-service.ts`) em um único módulo de domínio.
- Tornar criação/edição de transação uma operação atômica que atualize transação,
  enrichment, saldo e journal entry na mesma transação de banco.
- Implementar reversão contábil em vez de editar ou excluir lançamentos já
  contabilizados.
- Adicionar constraints: valores de journal positivos, confiança entre 0 e 1,
  tipos contábeis válidos e unicidade de uma conta ledger ativa por conta
  financeira.
- Executar processamento pesado de webhook/sync fora do request, com fila,
  idempotência e dead-letter/retry.

## Plano de ação recomendado

### Etapa 1 — banco reproduzível (P0)

1. Instalar/iniciar Docker Desktop.
2. Rodar `supabase start` e `supabase db reset`.
3. Rodar `supabase db lint --level warning`.
4. Criar fixtures para dois usuários e validar isolamento RLS.
5. Simular upgrade com dados existentes e comparar contagens/saldos antes e
   depois.

Critério de saída: banco criado do zero sem erro, upgrade repetível e nenhum
dado órfão.

### Etapa 2 — contratos e tipos (P0)

1. Aplicar migrations no ambiente de desenvolvimento.
2. Regenerar tipos Supabase.
3. Corrigir o typecheck dos módulos novos sem casts genéricos.
4. Remover/quarentenar código Next.js e implementar APIs no padrão TanStack
   Start quando forem necessárias.

Critério de saída: `tsc --noEmit`, build e testes da Fase 4 passando no CI.

### Etapa 3 — CRUD financeiro consistente (P1)

1. Testar E2E: criar, editar, arquivar e definir conta principal.
2. Testar E2E: criar, editar, recategorizar e excluir/ocultar transação manual.
3. Implementar override para transações importadas.
4. Reconciliar saldo e ledger após cada mutação.

Critério de saída: toda mutação é auditável, idempotente e não quebra saldos.

### Etapa 4 — Open Finance operacional (P1)

1. Concluir POC do provider em sandbox.
2. Validar assinatura e replay de webhooks.
3. Executar sync incremental com retry e métricas.
4. Testar conectar, sincronizar, renovar, revogar e desconectar.

Critério de saída: uma conexão real de sandbox percorre o fluxo completo sem
duplicar transações.

### Etapa 5 — hardening e observabilidade (P1)

1. Testes de autorização, RLS, IDOR, webhook spoofing e replay.
2. Logs estruturados com correlation ID, sem tokens ou dados sensíveis.
3. Alertas para falha de sync, divergência de ledger e duplicidade.
4. Runbook de rollback e reconciliação.

Critério de saída: incidentes são detectáveis, diagnosticáveis e recuperáveis.

## Validações executadas nesta revisão

- Build de produção: aprovado.
- Testes focados de normalização e deduplicação: 12 aprovados.
- Suite completa: 55 testes aprovados em 7 arquivos. Os 12 testes focados da
  Fase 4 também passam isoladamente.
- Banco local: não executado por ausência do Docker Desktop.
- Dry-run remoto: não executado por ausência de `SUPABASE_ACCESS_TOKEN` no CLI.
