# Plano de Melhorias — AxionnFina

> STATUS (2026-09-25): Fases 1–5 e 7 implementadas no código. Fase 6 (polling
> Open Finance) é configuração server-side — instruções abaixo para executar
> pelo Lovable. Migration SQL preparada em
> `supabase/migrations/20260926000000_improvements_notifications_loans_projects.sql`
> — **NÃO validada**: aguardar retorno da execução no Supabase antes de
> considerar RLS/tipos como concluídos.

## Como ativar (via Lovable)

1. Execute a migration `20260926000000_improvements_notifications_loans_projects.sql`
   pelo Lovable (cria `notifications`, `loans`, `projects` + coluna
   `transactions.tags`, com RLS por `user_id`).
2. Regenere os tipos do Supabase (`integrations/supabase/types.ts`).
3. Fase 6 — sincronização Open Finance com maior frequência:
   - Configurar `pg_cron` (ou Edge Function agendada) chamando a sincronização
     Pluggy a cada 4h (6x/dia, padrão Organizze);
   - Manter o webhook `api/webhooks/openfinance/$provider` como gatilho
     em tempo real;
   - Opcional: notificação push via `notifications` quando novos lançamentos
     chegarem (hook `useUpsertNotification` já pronto no frontend).
4. Retorne o resultado da execução para validação (sem isso, RLS e tipos
   seguem pendentes).

## O que foi implementado

- Fase 1: `src/lib/finance/budget.ts` (alertas orçamento/contas),
  `src/lib/finance/notifications.ts`, sino com dropdown no `AppShell`,
  alertas nas páginas Orçamento, Contas e Agente, tools `alertas_orcamento` e
  `alertas_contas` no `/api/chat`.
- Fase 2: `tags` em `Transaction`, coluna + filtro + edição na página
  Transações, busca textual inclui tags, CSV exporta tags.
- Fase 3: `GET /api/agent-health`, `GET /api/agent-tools` (schema aberto das
  12 tools para ChatGPT/Claude/Manus).
- Fase 4: páginas `/loans` e `/emprestimos` → `/projects` com CRUD, baixa de
  parcela, aporte em projeto e simulação de quitação; itens no menu.
- Fase 5: `FundComparator` integrado à página Investimentos.
- Fase 7: botão Exportar Carnê-Leão (CSV) na página Impostos. OCR de
  comprovantes já coberto por `/api/documents` + importação de extrato.
- Testes: `src/test/improvements.test.ts` (10 testes).

## Adendo UI/UX (comparativo Meu Dinheiro, 2026-09-25)

Implementado (somente frontend, sem backend novo; Regras de preenchimento
ficou de fora por exigir tabela nova):
- Catálogo de Relatórios (`reports.tsx`): busca + chips (Todos, Patrimônio e
  Orçamento, Controle das Contas, Detalhamento) + 14 cards que navegam para
  tabs/rotas existentes.
- Contas com abas (`bills.tsx`): "A pagar e receber" / "Pagas e recebidas",
  com `?aba=pagas` para deep-link do catálogo.
- Sidebar com grupos expansíveis (`AppShell.tsx`), preferência persistida,
  modo ícone preservado; novos itens Tags e Extrato.
- Gestão de Tags (`tags.tsx` + `lib/finance/tags.ts`): agregação, renomear,
  mesclar, excluir via `edit_transaction` (mesmo caminho da edição unitária).
- Extrato por conta (`wallet/statement.tsx`): conta + período + busca,
  totais e CSV. Sem saldo corrido (evita duplicar regra financeira).
- Testes: `aggregateTags` (+2, total 12 em `improvements.test.ts`).

---

Com base na análise de Meu Dinheiro, Organizze e Minhas Economias, seguinte plano prioriza implementações. Todas as tarefas estão mapeadas para arquivos e padrões existentes no codebase.

---

## FASE 1 — Alertas e Notificações (Sprint 1)

**Justificativa**: Gap crítico vs. todos os concorrentes. Orçamento com alertas e lembretes é feature básica em 100% dos concorrentes.

### 1.1 Notificações proativas de orçamento
**Arquivos envolvidos:**
- `src/lib/finance/budget.ts` — adicionar função `checkBudgetAlerts()`
- `src/components/finance/BudgetProgress.tsx` — adicionar alerta visual
- `src/routes/_authenticated/budget.tsx` — exibir alertas na página
- `src/routes/_authenticated/agent.tsx` — exibir alertas no painel lateral do agente

**Tarefas:**
- [ ] Criar função `checkBudgetAlerts()` em `src/lib/finance/budget.ts` que verifica itens com `spent/planned >= 0.8` e `>= 1.0`
- [ ] Adicionar hook `useBudgetAlerts()` que chama a função periodicamente (a cada 60s)
- [ ] Atualizar `BudgetProgress.tsx` para exibir badge de alerta quando atingir threshold
- [ ] Adicionar card de alertas no `budget.tsx` acima da lista de categorias
- [ ] No `agent.tsx`, adicionar seção "Alertas de orçamento" com badge de perigo no painel lateral

**Tipo:** React component + utility function
**Esforço:** Baixo (2-3 dias)
**Dependências:** Nenhuma

### 1.2 Alertas de contas a vencer
**Arquivos envolvidos:**
- `src/routes/_authenticated/bills.tsx`
- `src/components/finance/DataState.tsx`

**Tarefas:**
- [ ] Adicionar indicador visual de urgência (icone, cor) na lista de contas baseado em `daysUntil(dueDate)`
- [ ] Adicionar seção "Contas vencendo" no dashboard (index.tsx)
- [ ] No agente, adicionar tool `alertas_contas` que retorna contas próximas ao vencimento

**Tip:** Usar o padrão `daysUntil` que já existe em `src/lib/format.ts`

### 1.3 Sistema de notificações persistentes
**Arquivos envolvidos:**
- `src/lib/finance/notifications.ts` (NOVO)
- `src/components/ui/alert.tsx` (existente)
- `src/routes/_authenticated/agent.tsx`

**Tarefas:**
- [ ] Criar schema de notificações: `{ id, type, message, read, created_at, action_url }`
- [ ] Criar hook `useNotifications()` com CRUD
- [ ] Adicionar sino de notificações no header do AppShell
- [ ] Notificações aparecem no agente como card na sidebar

---

## FASE 2 — Tags e Categorização Avançada (Sprint 2)

**Justificativa**: Meu Dinheiro e Minhas Economias possuem tags para melhor organização. AxionnFina só tem categorias hierárquicas planas.

### 2.1 Campo tags na transação
**Arquivos envolvidos:**
- `src/shared/finance-types.ts` — adicionar `tags?: string[]` no tipo `Transaction`
- `src/lib/finance/transactions.ts` — atualizar hooks para suportar tags
- `src/routes/_authenticated/transactions.tsx` — adicionar campo tags no form e coluna na tabela
- `src/components/finance/FinancialForm.tsx` — adicionar input de tags

**Tarefas:**
- [ ] Adicionar `tags: string[]` ao tipo `Transaction` em `finance-types.ts`
- [ ] Atualizar `createTransaction`, `updateTransaction` hooks para suportar tags
- [ ] Adicionar campo tags no `FinancialForm.tsx` (multi-input com chip estilo TagsInput)
- [ ] Adicionar coluna "Tags" na tabela de transações
- [ ] Adicionar filtro por tag nos filtros avançados da transação

### 2.2 Categorias automáticas por tag
**Arquivos envolvidos:**
- `src/lib/ai-provider.server.ts` — adicionar tool de categorização automática
- `src/routes/api/chat.ts` — adicionar tool `categorizar_por_tag`

**Tarefas:**
- [ ] Adicionar tool no agente que sugere tags automaticamente baseado em descrição/merchant
- [ ] Quando usuário cria transação, sugerir tags automaticamente via IA
- [ ] Salvar preferência de categorização por tag no `agent_memories`

---

## FASE 3 — Agente como API Aberta (Sprint 3)

**Justificativa**: Organizze lançou integração com ChatGPT, Claude, Manus. É tendência imediata e diferencial competitivo.

### 3.1 Expor agente como MCP server
**Arquivos envolvidos:**
- `src/routes/api/chat.ts` — já tem todos os tools
- `src/infrastructure/index.ts`
- Novo arquivo: `src/server/mcp.ts`

**Tarefas:**
- [ ] Criar endpoint `/api/agent/health` para verificar disponibilidade
- [ ] Documentar todos os tools do agente (resumo_financeiro, buscar_transacoes, status_orcamento, projecao_fluxo_caixa, metas, create_goal, calculate_tax_preview, schedule_pix_payment, upsert_memory, search_memories)
- [ ] Adicionar endpoint `/api/agent/chat` com API key auth alternativa (para ferramentas externas)
- [ ] Criar JSON Schema de todos os tools para integração externa

### 3.2 Ferramenta de insights automáticos
**Arquivos envolvidos:**
- `src/routes/api/chat.ts`
- `src/lib/finance/summary.ts`

**Tarefas:**
- [ ] Adicionar tool `insights_automaticas` que verifica padrões (gasto excessivo em categoria, saldo baixo, transações recorrentes inesperadas)
- [ ] Adicionar tool `comparar_mes` que compara gastos mês a mês
- [ ] Adicionar tool `recomendacoes_orcamento` que sugere ajustes no orçamento

---

## FASE 4 — Gestão de Dívidas e Projetos (Sprint 4)

**Justificativa**: Minhas Economias tem gestão completa de empréstimos e financiamentos. Meu Dinheiro tem controle de projetos. Ambos são gaps grandes.

### 4.1 Gestão de empréstimos
**Arquivos envolvidos:**
- `src/lib/finance/loans.ts` (NOVO)
- `src/components/finance/LoanCard.tsx` (NOVO)
- `src/routes/_authenticated/loans.tsx` (NOVO)
- `src/shared/finance-types.ts` — adicionar tipo `Loan`
- `src/routes/_authenticated/bills.tsx` — integrar com contas existentes

**Tarefas:**
- [ ] Criar tipo `Loan`: `{ id, name, principal, interestRate, installment, remaining, dueDate, status }`
- [ ] Criar CRUD completo de empréstimos com Supabase
- [ ] Criar componente `LoanCard.tsx` com cálculo de saldo devedor e juros
- [ ] Criar rota `_authenticated/loans.tsx`
- [ ] Adicionar tool `emprestimos` no agente
- [ ] Adicionar simulação de quitação antecipada

### 4.2 Projetos pessoais
**Arquivos envolvidos:**
- `src/shared/finance-types.ts` — adicionar tipo `Project`
- `src/lib/finance/projects.ts` (NOVO)
- `src/components/finance/ProjectCard.tsx` (NOVO)
- `src/routes/_authenticated/projects.tsx` (NOVO)

**Tarefas:**
- [ ] Criar tipo `Project`: `{ id, name, description, target, current, category, startDate, endDate, status }`
- [ ] Criar CRUD de projetos
- [ ] Projetos são como metas com tracking de gastos associados
- [ ] Adicionar tool `projetos` no agente para consultar progresso

---

## FASE 5 — Comparador de Fundos e Dashboard (Sprint 5)

**Justificativa**: Minhas Economias tem comparador de fundos DI, Renda Fixa, Multimercado. Gap competitivo relevante para a base de investimentos.

### 5.1 Comparador de fundos
**Arquivos envolvidos:**
- `src/routes/api/investment-radar.ts` — já existe
- `src/lib/investment-radar-user.server.ts` — já existe
- `src/components/finance/FundComparator.tsx` (NOVO)
- `src/routes/_authenticated/investments.tsx` — adicionar aba comparador

**Tarefas:**
- [ ] Criar componente `FundComparator.tsx` com tabela comparativa de rentabilidade
- [ ] Integrar com dados do investment-radar existente
- [ ] Adicionar filtro por tipo (DI, Renda Fixa, Multimercado, Ações)
- [ ] Adicionar no agente tool `comparar_fundos`

### 5.2 Dashboard aprimorado
**Arquivos envolvidos:**
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/finance/DashboardCharts.tsx`

**Tarefas:**
- [ ] Adicionar widgets de alertas no dashboard
- [ ] Adicionar mini-gráfico de tendência (7d, 30d, 90d)
- [ ] Adicionar seção "Receber" para próximos pagamentos
- [ ] Adicionar KPIs de taxa de poupança e patrimônio

---

## FASE 6 — Open Finance e Automação (Sprint 6)

**Justificativa**: Organizze identifica novos lançamentos até 6x por dia. Meu Dinheiro sincroniza automaticamente com 12+ bancos. AxionnFina tem Pluggy mas precisa de polling mais frequente.

### 6.1 Polling automático aprimorado
**Arquivos envolvidos:**
- `src/providers/openfinance/PluggyAdapter.ts`
- `src/lib/finance/accounts.ts`
- `src/routes/api/`

**Tarefas:**
- [ ] Configurar intervalo de polling mais frequente para nova transação
- [ ] Criar endpoint `api/account/sync` para sincronização on-demand
- [ ] Adicionar notificação push quando novo lançamento chega
- [ ] Adicionar auto-categorização para transações Open Finance baseado em merchant

### 6.2 Importação de notificações bancárias
**Arquivos envolvidos:**
- `src/routes/_authenticated/transactions.tsx` — já tem import CSV/XML/PDF
- Novo componente de importação de SMS

**Tarefas:**
- [ ] Adicionar campo para upload de SMS bancários
- [ ] Parser de SMS para extrair descrição, valor, data
- [ ] Auto-categorização baseada em padrão do SMS
- [ ] Criar tool `importar_sms` no agente

---

## FASE 7 — Exportação Fiscal e Recibos (Sprint 7)

### 7.1 Carnê-Leão automático
**Arquivos envolvidos:**
- `src/lib/finance/taxes.ts`
- `src/routes/_authenticated/taxes.tsx`
- `src/routes/api/user-data-export.ts`

**Tarefas:**
- [ ] Gerar arquivo `.csv` no formato Carnê-Leão
- [ ] Incluir todas as fontes de renda (salário, investimentos, aluguel)
- [ ] Calcular DARF estimada
- [ ] Exportar com um clique

### 7.2 Recebo/Comprovante
**Arquivos envolvidos:**
- `src/routes/api/documents.ts` — já existe OCR
- `src/routes/_authenticated/transactions.tsx` — já tem upload de PDF

**Tarefas:**
- [ ] Adicionar upload de imagem de comprovante via mobile
- [ ] OCR para extrair valor, data, estabelecimento
- [ ] Auto-preencher transação com dados do comprovante

---

## Resumo de Prioridades e Esforço

| Fase | Feature | Esforço | Impacto | Sprint |
|---|---|---|---|---|
| 1 | Alertas de orçamento + contas | Baixo | 🔥🔥🔥 | 1 |
| 1 | Alertas de vencimento | Baixo | 🔥🔥🔥 | 1 |
| 1 | Sistema de notificações | Médio | 🔥🔥 | 1 |
| 2 | Tags em transações | Baixo | 🔥🔥 | 2 |
| 2 | Categorização automática por IA | Médio | 🔥🔥 | 2 |
| 3 | Agente como API aberta | Médio | 🔥🔥🔥 | 3 |
| 3 | Insights automáticos no agente | Baixo | 🔥🔥 | 3 |
| 4 | Gestão de empréstimos | Alto | 🔥🔥 | 4 |
| 4 | Projetos pessoais | Médio | 🔥🔥 | 4 |
| 5 | Comparador de fundos | Médio | 🔥🔥 | 5 |
| 5 | Dashboard aprimorado | Baixo | 🔥🔥 | 5 |
| 6 | Polling Open Finance | Médio | 🔥🔥 | 6 |
| 6 | Importação SMS bancário | Alto | 🔥🔥 | 6 |
| 7 | Carnê-Leão | Médio | 🔥 | 7 |
| 7 | Recebo/Comprovante OCR | Médio | 🔥 | 7 |

---

## Padrões de Implementação

Todos os novos recursos devem seguir os padrões existentes do AxionnFina:

1. **Tipos**: Definir em `src/shared/finance-types.ts`
2. **Hooks**: Criar em `src/lib/finance/` e re-exportar em `src/presentation/hooks/finance/`
3. **Rota**: Criar em `src/routes/_authenticated/` com `createFileRoute`
4. **API**: Endpoint server-side em `src/routes/api/` com autenticação via `createUserClient` ou `authenticateApi`
5. **Agent Tools**: Adicionar em `src/routes/api/chat.ts` dentro do objeto `tools`
6. **Componentes**: Seguir padrão de componentes em `src/components/finance/`
7. **Estilo**: Usar shadcn/ui components (`Card`, `Badge`, `Button`, `Dialog`, `Input`, etc.)
8. **Segurança**: RLS no Supabase, rate limiting no API, step-up auth para ações sensíveis
9. **Testes**: Adicionar testes em `src/test/` seguindo padrão existente
10. **i18n**: Usar `pt-BR` para datas, `formatBRL` para moedas
