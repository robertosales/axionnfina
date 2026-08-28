# Axionn Finance

# 🎯 OBJETIVO: Criar "Axionn Finance" — Agente Financeiro Pessoal Multi-Agente
**Stack**: Next.js 14 (App Router) + TypeScript Strict + Tailwind CSS + shadcn/ui (New York style) + Supabase (PostgreSQL 16, pgvector, RLS, Realtime, Edge Functions Deno, Vault) + Vercel AI SDK (Streaming) + Open Finance Brasil (FAPI 1.0) + Arquitetura Multi-Agente (Planner + Specialists + Memory).

**Regra de Ouro**: **Separação estrita de camadas**. O Lovable gerará:
1.  `apps/web` (Frontend Next.js)
2.  `supabase/` (Migrations, Edge Functions, Config)
3.  `packages/shared` (Types Zod, Domain Entities, API Contracts) — *simulado via pasta `src/shared` no projeto Next.js*
4.  `docs/adr` (Decisões de Arquitetura)

**Não gere**: Workers Temporal (Node), Certificados mTLS, Infra K8s. Gere **interfaces/tipos** para eles e **Edge Functions** que os acionam.

---

## 1. 🎨 DESIGN SYSTEM & LAYOUT (MODERNO, RIGOROSO, ACESSÍVEL)

### 1.1 Tokens de Design (Tailwind Config)
- **Cores**: Slate/Stone base. **Semantic Tokens** obrigatórios: `primary` (Indigo 600), `success` (Emerald 600), `warning` (Amber 500), `danger` (Rose 600), `income` (Teal 500), `expense` (Rose 500), `transfer` (Gray 500), `investment` (Violet 500).
- **Dark Mode First**: `class` strategy. Cores OKLCH para consistência perceptual.
- **Tipografia**: `Inter` (UI) + `JetBrains Mono` (Valores/Code). `text-balance` em headlines.
- **Espaçamento**: Scale 4px. `container` max-w-7xl (1280px) centered.
- **Sombras**: `shadow-elevation-1` a `4` (design system próprio).
- **Border Radius**: `rounded-xl` (cards), `rounded-2xl` (modais), `rounded-full` (pills/badges).
- **Animação**: `motion-safe` only. `transition-[color,box-shadow,transform]` 150ms ease-out. Framer Motion apenas para: **Sidebar collapse, Modal enter/exit, Toast, Chat streaming cursor**.

### 1.2 Layout Principal (App Router: `app/(dashboard)/layout.tsx`)
- **Server Component** root.
- **Header Fixo (h-16)**: Logo, Busca Global (Cmd+K), Notificações (Badge Realtime), Avatar Menu (Trocar Perfil, Config, Sair).
- **Sidebar Colapsível (w-64 → w-20)**: `navigation` landmark. Itens: Dashboard, Transações, Orçamento, Investimentos, Impostos, Contas a Pagar/Receber, Metas, Insights, Configurações, **Agente IA (Destaque)**.
- **Main Area**: `padding: 1.5rem` (lg: `2.5rem`). `min-h-[calc(100vh-4rem)]`.
- **Command Palette (Cmd+K)**: `cmdk` library. Ações: Nova Transação, Novo Pix, Sync Bancos, Perguntar ao Agente, Criar Meta.

### 1.3 Componentes Base (shadcn/ui + Custom) — **Gere TODOS em `components/ui/`**
- `DataTable` (TanStack Table v8): Server-side sorting/filtering/pagination, row selection, inline editing (categoria, tags), virtualização (`@tanstack/react-virtual`), copy-to-clipboard coluna.
- `KPICard`: Valor principal, variação % (sparkline micro), tooltip breakdown, loading skeleton.
- `ChartCard` (Recharts/Tremor): Area (Cashflow), BarStacked (Orçamento vs Real), Donut (Alocação), Sankey (Fluxo Contas→Categorias), Waterfall (DRE Pessoal). **ResponsiveContainer**.
- `AccountCard`: Saldo, Tipo (ícone), Instituição, Último sync, Ações (Sync, Detalhes, Arquivar).
- `TransactionRow`: Expandível (detalhes: parcelas, raw_data, transfer pair), badge categoria (cor semântica), merchant avatar (fallback inicial), status dot.
- `BudgetProgressBar`: Gradient fill, threshold markers (80% warn, 100% danger), rollover indicator.
- `GoalTracker`: Circular progress (SVG), D-Date, Projeção Monte Carlo (P10/P50/P90), Contribuição sugerida.
- `AgentChatInterface`: **Streaming** (Vercel AI SDK `useChat`), Renderização de *Tool Calls* como "Cards de Ação" (Confirmar Pix, Ver Gráfico, Aprovar DARF), Histórico persistido (Supabase Realtime), Sugestões de follow-up.
- `EmptyState`, `ErrorBoundary`, `LoadingSkeleton` (shadcn defaults).

---

## 2. 🗄️ BANCO DE DADOS (SUPABASE POSTGRESQL 16) — **GERAR `supabase/migrations/001_initial_schema.sql`**

**Requisitos Não Negociáveis**:
- **RLS EM TUDO**: `auth.uid() = user_id`. `FOR ALL USING ... WITH CHECK ...`.
- **Particionamento**: `transactions` por `RANGE (transaction_date)` mensal (`pg_partman`). `financial_events` por `RANGE (occurred_at)` semanal.
- **Vetores**: `pgvector` HNSW index (`m=16, ef_construction=64`) em `agent_memories.embedding` (1536 dims `text-embedding-3-small`).
- **Materialized Views**: `mv_account_balances`, `mv_monthly_cashflow`, `mv_budget_health`, `mv_net_worth_history`. `UNIQUE INDEX` para `REFRESH CONCURRENTLY`.
- **Triggers**: `updated_at` (plpgsql), `notify_financial_event` (pg_notify para Realtime/Projections).
- **Extensions**: `uuid-ossp`, `pgvector`, `pg_partman`, `pg_cron`, `pg_stat_statements`.
- **Seed Data**: `institutions` (Bancos/Corretoras BR + logos SVGs), `mcc_codes` (ISO 18245), `tax_brackets_irpf` (2024/2025), `transaction_categories` (Hierarquia: Receita/Despesa Fixa/Variável/Investimento/Imposto/Transferência).

**Tabelas Obrigatórias (DDL Completo com Comentários)**:
`financial_profiles`, `institutions`, `accounts`, `transactions` (particionada), `financial_events` (particionada, Event Store), `budgets`, `budget_items`, `goals`, `investment_positions`, `payables`, `receivables`, `agent_memories`, `openfinance_consents`, `openfinance_tokens` (criptografados via Vault), `audit_logs`.

**Funções RPC Críticas (Postgres)**:
- `match_agent_memories(query_embedding vector(1536), filter_user_id uuid, filter_types text[], threshold float, count int)` → `SETOF agent_memories`.
- `get_cashflow_projection(user_id, horizon_days int, scenarios text[])` → `SETOF cashflow_projection` (SQL set-based, sem PL/pgSQL pesado).
- `calculate_irpf_monthly(user_id, year int, month int)` → `jsonb` (Resumo: Ações swing/daytrade, FII, Dividendos, DARF due).
- `upsert_transaction_idempotent(p_idempotency_key text, p_data jsonb)` → `transaction_id` (ON CONFLICT DO UPDATE).

---

## 3. ⚙️ EDGE FUNCTIONS (DENO/TS) — **GERAR EM `supabase/functions/`**

**Shared (`_shared/`)**:
- `cors.ts`, `supabaseClient.ts` (Admin + User), `vault.ts` (encrypt/decrypt), `logger.ts` (structured JSON), `zodSchemas.ts`, `openfinanceClient.ts` (FAPI, mTLS fetch wrapper, PAR, PKCE, Client Assertion JWT), `temporalClient.ts` (stub para `startWorkflow`).

### 3.1 `openfinance/callback` (POST/GET)
- Recebe `code`, `state`, `iss` do banco.
- Valida `state` (CSRF) → Recupera `code_verifier` (PKCE) do `openfinance_consents` (status `PENDING`).
- **Client Assertion JWT** (RS256, `kid` do certificado, `aud` = token endpoint do `iss`).
- Troca `code` por `access_token`, `refresh_token`, `id_token` (mTLS fetch).
- Valida `id_token` (JWKS do Diretório Open Finance).
- Armazena tokens **criptografados** (`vault.encrypt`) em `openfinance_tokens`.
- Atualiza `openfinance_consents` → `AUTHORISED`, `consent_id`, `expires_at`.
- **Dispara Temporal Workflow**: `temporalClient.startWorkflow('FullBankSync', { userId, institutionId, consentId })`.
- Redireciona frontend `/settings/integrations?status=success`.

### 3.2 `openfinance/webhook` (POST)
- Verifica assinatura `X-JWS-Signature` (JWKS do Diretório).
- Eventos: `CONSENT_REVOKED`, `AUTHORISATION_REVOKED`, `TOKEN_REVOKED`.
- Marca consentimento `REVOKED`, revoga tokens, **apaga dados sensíveis** (LGPD Art. 18) → `DELETE FROM transactions WHERE account_id IN (...)`.

### 3.3 `transactions/sync` (POST) — **Protegido por RLS + Service Role Key (Server-only)**
- Input: `{ institutionId, accountId?, since? }`.
- Chama `openfinanceClient.getTransactions(...)` com paginação (100/page).
- **Batch Categorização**: Envia 50 txns para `llm/categorize` (ver 3.5).
- `upsert_transaction_idempotent` (RPC) para cada.
- Atualiza `last_synced_at` na `accounts`.
- `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_account_balances, mv_monthly_cashflow`.
- Retorna `{ synced: number, categorized: number, errors: [] }`.

### 3.4 `bills/parse-boleto` (POST multipart/form-data)
- Recebe PDF/Imagem.
- OCR: `pdf-parse` + Regex Linha Digitável / Código de Barras + **Fallback LLM Vision (GPT-4o-mini)** para PDFs complexos.
- Valida dígito verificador (Módulo 10/11).
- Extrai: `amount`, `dueDate`, `payerName`, `payerTaxId`, `barcode`, `pixKey` (se QR Code).
- Cria `payable` rascunho (status `PENDING_CONFIRMATION`).
- Retorna dados parseados para UI confirmar.

### 3.5 `llm/categorize` (POST) — **Streaming SSE**
- Input: `{ transactions: [{id, description, amount, merchantName, mcc}], userContext: { categories, recentMerchants } }`.
- **Prompt Engineering Rigoroso**:
  - System: "Você é um classificador fiscal brasileiro. Use SOMENTE categorias da lista fornecida. Retorne JSON array: `{id, category, subcategory, confidence, reasoning}`. Regra: MCC 5812 → 'DINING_OUT'. Mercado Livre → 'SHOPPING_ONLINE' salvo se MCC 5411 → 'GROCERIES'. Pix 'Recebido de [Nome]' → 'TRANSFER_IN' se valor > 0. Cartão: 'CREDIT_CARD_GENERAL' se não identificar merchant."
  - Few-shot: 15 exemplos curados (merchants BR: iFood, Uber, Mercado Pago, Nubank, Magalu, Amazon, Shopee, farmácias, postos).
  - Temperature: 0.0. `response_format: { type: "json_object" }`.
- Retorna stream de objetos categorizados. Frontend aplica optimistic update.

### 3.6 `agent/chat` (POST) — **Vercel AI SDK `streamData` + `streamObject`**
- **Orchestrator Pattern**:
  1.  `classifyIntent` (Tool: `get_user_context` → profile, accounts summary, budgets health, goals, upcoming bills).
  2.  `plan` (Tool: `think` → retorna `PlanStep[]`: `{agent: 'TransactionAgent', task: 'find_anomalies', args: {...}}`).
  3.  `route` (Loop: executa step → observa resultado → próximo step ou `finish`).
  4.  `reflect` (Critic Agent: "A resposta resolveu? Há alucinação financeira? Compliance LGPD/IRPF?").
- **Tools Disponíveis (Function Calling)**:
  - `query_transactions` (filters, dateRange, groupBy, limit) → RPC `get_transactions_aggregated`.
  - `get_budget_health` → `mv_budget_health`.
  - `project_cashflow` → RPC `get_cashflow_projection`.
  - `suggest_rebalance` → chama Worker Temporal `RebalanceWorkflow` (async), retorna `workflowId`.
  - `calculate_tax_preview` → RPC `calculate_irpf_monthly`.
  - `schedule_pix_payment` → valida saldo → cria `payable` + `pix_schedule` → retorna `confirmationToken` (user deve confirmar no chat).
  - `create_goal` / `update_goal_contribution`.
  - `search_memories` (RPC `match_agent_memories`).
  - `upsert_memory` (salva preferência: "Usuário prefere reserva emergência 6 meses").
- **Memória**: `agent_memories` (pgvector). Recupera top-k semântico + últimos 5 episódios (chat history).
- **Guardrails**: Bloqueia `TRANSFER` sem `confirmationToken`. Bloqueia sugestão de evasão fiscal. Alerta se `risk > profile`.

---

## 4. 🤖 FRONTEND — NEXT.JS 14 APP ROUTER (TYPESCRIPT STRICT)

### 4.1 Estrutura de Pastas (Gere Tudo)
```text
src/
├── app/
│   ├── (auth)/login/page.tsx          # Server Component, Supabase SSR Auth
│   ├── (auth)/callback/route.ts       # Exchange code for session
│   ├── (dashboard)/
│   │   ├── layout.tsx                 # RSC: Header, Sidebar, Providers
│   │   ├── page.tsx                   # Dashboard Principal (RSC + Suspense boundaries)
│   │   ├── transactions/
│   │   │   ├── page.tsx               # RSC: DataTable + Server Actions (categorize, split, transfer)
│   │   │   └── components/TransactionTable.tsx (Client)
│   │   ├── budget/page.tsx
│   │   ├── investments/page.tsx
│   │   ├── taxes/page.tsx
│   │   ├── bills/page.tsx
│   │   ├── goals/page.tsx
│   │   ├── insights/page.tsx
│   │   ├── settings/
│   │   │   ├── page.tsx
│   │   │   ├── integrations/page.tsx  # Open Finance Connect Flow
│   │   │   └── agent/page.tsx         # Persona, Memory Management
│   │   └── agent/page.tsx             # **Chat Interface (Client Component)**
│   └── api/                           # Next.js API Routes (Proxy para Edge Functions se necessário)
├── components/
│   ├── ui/                            # shadcn/ui + Custom (DataTable, ChartCard, KPICard, etc)
│   ├── finance/                       # Domain Components (AccountCard, TransactionRow, BudgetBar, GoalRing)
│   ├── agent/                         # ChatInterface, MessageBubble, ToolCallCard, PlanVisualizer
│   ├── layout/                        # Header, Sidebar, CommandPalette, NotificationToast
│   └── providers/                     # QueryProvider, SupabaseProvider, ThemeProvider, Toaster
├── hooks/
│   ├── useAccounts.ts                 # useQuery + Realtime subscription (mv_account_balances)
│   ├── useTransactions.ts             # InfiniteQuery + Optimistic Mutations
│   ├── useBudgets.ts
│   ├── useInvestments.ts
│   ├── useAgentChat.ts                # Wrapper useChat (AI SDK) + ToolCall handlers
│   └── useRealtime.ts                 # Generic Supabase Realtime hook
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser Client (createBrowserClient)
│   │   ├── server.ts                  # Server Client (createServerClient - cookies)
│   │   ├── middleware.ts              # Auth Middleware (update session)
│   │   └── types.ts                   # **Generated** `supabase gen types` (commitado)
│   ├── validations/                   # Zod Schemas (mirror of shared/domain)
│   ├── utils.ts                       # cn, formatBRL, formatDate, parseRRULE
│   └── constants.ts                   # Categories, MCC Map, Tax Rates
├── actions/
│   ├── transactions.ts                # Server Actions (categorize, createManual, pairTransfer)
│   ├── budgets.ts
│   ├── bills.ts
│   └── goals.ts
└── middleware.ts                      # Supabase Auth Middleware (refresh session)
```

### 4.2 Detalhes Críticos de Implementação Frontend

**Dashboard (`page.tsx`)**:
- **RSC** que faz `Promise.all` de: `getKPIs()` (Net Worth, Liquidez, Savings Rate, Próximo Vencimento), `getCashflowSparkline()`, `getBudgetAlerts()`, `getUpcomingBills()`, `getAgentInsights()`.
- Cada KPI/Chart em `<Suspense fallback={<KPICardSkeleton />}>`. **Streaming SSR**.

**Transações (`transactions/page.tsx`)**:
- `TanStack Table` com `useServerSidePagination` (Server Action `getTransactionsPaginated`).
- **Inline Edit**: Clicar em Categoria → `Combobox` (shadcn) → `onChange` → `optimisticUpdate` (React Query) → Server Action `categorizeTransaction` → Invalidate `['transactions', 'budgets']`.
- **Detalhe Expandível**: `row.getCanExpand()` → `subComponent` mostra: Parcelas, Transfer Pair Link, Raw JSON (collapsible), Ações (Dividir, Recategorizar, Excluir, Marcar Recorrente).

**Agente (`agent/page.tsx`)**:
- `useChat` (AI SDK) com `experimental_prepareRequestBody` para injetar `userContext` (resumo financeiro).
- **ToolCall Rendering**:
  - `query_transactions` → Renderiza `DataTable` miniatura dentro da bolha.
  - `project_cashflow` → Renderiza `ChartCard` (Area Chart) interativo.
  - `schedule_pix_payment` → Renderiza **Card de Confirmação** (Valor, Destino, Conta Origem, Botões: "Confirmar & Agendar" / "Cancelar"). `onConfirm` → chama `submitToolResult({ confirmationToken })`.
- **Memória**: Sidebar lateral ("Contexto do Agente") mostra: Perfil Financeiro, Metas Ativas, Alertas Orçamento, Preferências Aprendidas (lidas de `agent_memories` via RPC).

**Integrações (`settings/integrations/page.tsx`)**:
- Lista `institutions` (Seed) com badge `openfinance_participant`.
- Botão "Conectar" → `GET /functions/v1/openfinance/authorize?institution_id=...` → Redireciona `authUrl`.
- Estado do Consentimento: `PENDING` (spinner), `AUTHORISED` (verde, último sync), `REVOKED` (vermelho, botão "Remover Dados"), `EXPIRED` (amarelo, botão "Renovar").
- **Webhook Status**: Mostra se `openfinance/webhook` recebeu eventos recentes.

---

## 5. 🔐 SEGURANÇA & LGPD — **IMPLEMENTAÇÃO OBRIGATÓRIA NO CÓDIGO**

1.  **RLS**: Política padrão `USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)` em **TODAS** tabelas `user_*`. Tabelas mestres (`institutions`, `mcc_codes`) `SELECT` público (anon), `INSERT/UPDATE` apenas `service_role`.
2.  **Vault**: `openfinance_tokens.encrypted_access_token`, `encrypted_refresh_token`. **Nunca** em coluna `text`. Edge Function `vault.ts`: `encrypt(data, keyName: 'openfinance_keys')`, `decrypt(...)`.
3.  **mTLS**: `openfinanceClient.ts` usa `Deno.createHttpClient({ cert: Deno.readTextFileSync(certPath), key: Deno.readTextFileSync(keyPath), ca: Deno.readTextFileSync(caPath) })`. **No Lovable**: Simule com `fetch` normal, mas **estruture o cliente** para aceitar `cert/key/ca` via env vars.
4.  **Consentimento Granular**: Tabela `openfinance_consents` com `scopes TEXT[]`. UI mostra toggles por escopo (`accounts`, `transactions`, `credit_cards`, `investments`, `pix`, `payment_initiation`). Salva `consent_id` retornado no `id_token`.
5.  **LGPD - Direito ao Esquecimento**: Server Action `deleteMyData()` → Chama Edge Function `admin/delete-user-data` (Service Role) → `DELETE FROM ... WHERE user_id = $1` (Cascade via FK) → `auth.admin.deleteUser(uid)`. Log em `audit_logs`.
6.  **Auditoria**: Trigger `audit_trigger` em tabelas sensíveis (`transactions`, `payables`, `goals`, `agent_memories`) → Insere em `audit_logs (user_id, table_name, operation, old_data, new_data, changed_at, ip_address)`.
7.  **Rate Limiting**: Edge Functions `import { rateLimit } from 'npm:@epic-web/rate-limit'` (Memory store Deno). `10 req/min` para `/agent/chat`, `30 req/min` para `/transactions/sync`.
8.  **CSP/Headers**: `next.config.js` `headers()` → `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openfinancebrasil.org.br; frame-ancestors 'none';`.

---

## 6. 🧪 TESTES & QUALIDADE (Gere Configs)

- `vitest.config.ts`: Unit (Utils, Zod Schemas, Tax Calculations), Integration (Server Actions com `supabase` mock).
- `playwright.config.ts`: E2E Critical Paths: Login → Connect Bank (Mock) → Sync → Categorize → Chat Agent "Quanto gastei com Uber?" → Ver Gráfico → Agendar Pix.
- `eslint.config.js`: `plugin:@next/next`, `plugin:tailwindcss`, `plugin:zod`, `plugin:security` (detecta `dangerouslySetInnerHTML`, `eval`).
- `prettier.config.js`: `plugins: [prettier-plugin-tailwindcss, prettier-plugin-sql]`.
- `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitReturns: true`.

---

## 7. 📦 ENTREGÁVEIS ESPECÍFICOS DO LOVABLE (O QUE ESPERO VER NO CHAT)

Por favor, **gere os arquivos abaixo na ordem**. Use `file:` blocks. Não resuma. Código completo, tipado, comentado.

### Fase 1: Fundação & Banco
1.  `package.json` (Root + Workspaces simulation via `pnpm` scripts)
2.  `tailwind.config.ts` (Design Tokens OKLCH, Dark Mode, Animações)
3.  `supabase/migrations/001_initial_schema.sql` (DDL Completo, RLS, Partman, pgvector, MVs, RPCs, Seeds)
4.  `supabase/migrations/002_rls_policies.sql` (Políticas granulares por tabela)
5.  `supabase/config.toml` (Config: `db.major_version = 16`, `edge_functions.import_map`, `functions.verify_jwt = true`)
6.  `src/lib/supabase/types.ts` (Types gerados — simule o output)

### Fase 2: Shared Kernel & UI Kit
7.  `src/shared/domain/` (Enums: `TransactionType`, `AccountType`, `Category`, `GoalType`; Interfaces: `Account`, `Transaction`, `Budget`, `Goal`, `InvestmentPosition`, `Payable`, `Receivable`, `AgentMemory`, `OpenFinanceConsent`; Zod Schemas para todos)
8.  `src/shared/api/` (Zod Schemas para Request/Response de Edge Functions: `SyncRequest`, `CategorizeRequest`, `ChatRequest`, `ToolCall`, `PlanStep`)
9.  `components/ui/` (Gere: `data-table.tsx`, `chart-card.tsx`, `kpi-card.tsx`, `account-card.tsx`, `transaction-row.tsx`, `budget-progress.tsx`, `goal-tracker.tsx`, `agent-chat.tsx`, `command-palette.tsx`, `sidebar.tsx`, `header.tsx`)

### Fase 3: Edge Functions (Supabase)
10. `supabase/functions/_shared/` (`cors.ts`, `supabaseClient.ts`, `vault.ts`, `logger.ts`, `openfinanceClient.ts`, `temporalClient.ts`)
11. `supabase/functions/openfinance/callback/index.ts`
12. `supabase/functions/openfinance/webhook/index.ts`
13. `supabase/functions/transactions/sync/index.ts`
14. `supabase/functions/bills/parse-boleto/index.ts`
14. `supabase/functions/llm/categorize/index.ts`
15. `supabase/functions/agent/chat/index.ts` (Orchestrator + Tools + Streaming)

### Fase 4: Frontend Core (Next.js App Router)
16. `src/middleware.ts` (Supabase Auth SSR)
17. `src/lib/supabase/client.ts` & `server.ts`
18. `src/app/providers.tsx` (QueryClient, SupabaseProvider, Theme, Toaster)
19. `src/app/(auth)/login/page.tsx`
20. `src/app/(dashboard)/layout.tsx` (Header, Sidebar, Realtime Providers)
21. `src/app/(dashboard)/page.tsx` (Dashboard RSC com Suspense Boundaries)
22. `src/app/(dashboard)/transactions/page.tsx` + `components/TransactionTable.tsx`
23. `src/app/(dashboard)/agent/page.tsx` (Chat Interface Completo com Tool Rendering)
24. `src/app/(dashboard)/settings/integrations/page.tsx` (Open Finance Flow UI)

### Fase 5: Config & Docs
25. `next.config.mjs` (Headers CSP, Images Domains, TranspilePackages)
26. `.env.example` (Todas as variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `OPENFINANCE_CERT_PATH`, `OPENAI_API_KEY`, `TEMPORAL_ADDRESS`, `VAULT_ENCRYPTION_KEY`)
27. `docs/adr/001-monorepo-structure.md`, `002-supabase-rls.md`, `003-openfinance-integration.md`, `004-agent-architecture.md`, `005-security-lgpd.md`
28. `README.md` (Setup, Dev Local, Deploy, Arquitetura, Decisões)

---

## 8. 🚫 O QUE NÃO PEDIR AO LOVABLE (FAZER LOCALMENTE DEPOIS)
- `docker-compose.yml` (Temporal, Postgres Local, MinIO, Grafana)
- `packages/workers/` (Temporal Workers: `FullBankSyncWorkflow`, `TaxCalculationWorkflow`, `RebalanceWorkflow`, `ProjectionWorkflow` — **Código Node/TS puro, não roda no sandbox**).
- Certificados mTLS `.pem` / `.key` (Arquivos binários).
- `supabase/functions/_shared/temporalClient.ts` implementação real (apenas interface).
- Load Tests (k6), Pen Test scripts.

---

## 9. 🎯 CRITÉRIOS DE ACEITE (DEFINITION OF DONE PARA O LOVABLE)

1.  `pnpm install && pnpm dev` sobe sem erros TypeScript (`tsc --noEmit`).
2.  `supabase db reset` (local) aplica migrations sem erro, seed popula `institutions` (10+ bancos BR), `categories` (hierarquia 3 níveis), `mcc_codes` (50+).
3.  Login → Dashboard carrega: 4 KPIs (Net Worth, Liquidez, Savings Rate, Próximo Vencimento) + Gráfico Cashflow 6m + Alertas Orçamento + Próximas Contas (dados mockados via `msw` ou seed).
4.  Página Transações: Tabela virtualizada 10k linhas (mock), filtro coluna, sort, paginação server-side (simulada), inline edit categoria → otimistic update → toast success.
5.  Settings → Integrações: Lista bancos, botão "Conectar" abre modal com escopos (checkboxes), simula redirect callback → mostra "Conectado com Sucesso".
6.  Agente Chat: Digita "Gastei 200 no iFood ontem" → Tool `create_manual_transaction` → Confirmação no chat → Transação aparece na tabela (Realtime).
7.  Agente Chat: "Qual meu fluxo de caixa próximo mês?" → Tool `project_cashflow` → Renderiza `ChartCard` interativo na bolha de resposta.
8.  Agente Chat: "Agende Pix de 500 para conta Inter amanhã" → Tool `schedule_pix_payment` → Renderiza **Card de Confirmação** → Clica "Confirmar" → Cria `payable` + `pix_schedule` → Toast "Agendado".
9.  Dark Mode toggle persiste (localStorage + cookie), transição suave.
10. `pnpm lint` e `pnpm test:unit` passam.

---

**INSTRUÇÃO FINAL**: Comece pela **Fase 1**. Gere **um arquivo por bloco de código** (ou agrupe arquivos pequenos relacionados). Use `typescript` blocks. Seja verboso nos comentários JSDoc nas funções complexas (RPCs, Edge Functions, Orchestrator). **Não use `any`**. Use `type` em vez de `interface` para unions/intersections. `const` assertions em enums/literais.

**VAMOS CONSTRUIR.** 🚀

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://axionnfina.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/36010296-a4ab-41b9-9065-420be38be488).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
