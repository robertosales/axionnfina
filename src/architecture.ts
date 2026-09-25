/**
 * @axionnfina/architecture - Guia de Arquitetura
 *
 * ## Visão Geral
 *
 * O AxionnFina segue uma arquitetura em camadas com separação clara de responsabilidades:
 *
 * ```
 * ┌─────────────────────────────────────────────────────┐
 * │                   PRESENTATION                       │
 * │  (React Components, Hooks, Routes)                   │
 * ├─────────────────────────────────────────────────────┤
 * │                   APPLICATION                        │
 * │  (Use Cases, Services, Orchestration)                │
 * ├─────────────────────────────────────────────────────┤
 * │                     DOMAIN                           │
 * │  (Entities, Enums, Schemas, Algorithms)              │
 * ├─────────────────────────────────────────────────────┤
 * │                  INFRASTRUCTURE                      │
 * │  (Supabase, Pluggy, AI Provider, Observability)      │
 * └─────────────────────────────────────────────────────┘
 * ```
 *
 * ## Camadas
 *
 * ### Domain (`src/domain/`)
 * Regras de negócio puras. Zero dependências de infraestrutura.
 *
 * - `src/shared/domain/` - Enums, entities, schemas Zod
 * - `src/domain/finance/` - Algoritmos financeiros
 * - `src/domain/investment/` - Algoritmos de investimento
 *
 * ### Application (`src/application/`)
 * Casos de uso e orquestração. Usa injeção de dependência.
 *
 * - `src/application/transactions/` - Serviço de transações
 *
 * ### Infrastructure (`src/infrastructure/`)
 * Implementações concretas de infraestrutura.
 *
 * - `src/integrations/supabase/` - Clientes Supabase
 * - `src/providers/openfinance/` - Adaptadores Open Finance
 * - `src/lib/*.server.ts` - Serviços server-side
 *
 * ### Presentation (`src/presentation/`)
 * UI - Componentes, hooks e rotas React.
 *
 * - `src/components/` - Componentes UI
 * - `src/hooks/` - Hooks customizados
 * - `src/routes/` - Rotas TanStack Router
 *
 * ## Regras de Importação
 *
 * ```
 * Domain     ← não importa nada (exceto zod)
 * Application ← importa de Domain
 * Infrastructure ← importa de Domain
 * Presentation ← importa de qualquer camada
 * ```
 *
 * ## Exemplo de Uso
 *
 * ```typescript
 * // Domain (puro)
 * import { formatCurrency } from "@/domain/finance";
 *
 * // Application (com injeção de dependência)
 * import { TransactionService } from "@/application/transactions";
 * const service = new TransactionService({ supabase: client });
 *
 * // Infrastructure (clientes)
 * import { supabase } from "@/infrastructure";
 *
 * // Presentation (hooks)
 * import { useAccounts } from "@/presentation";
 * ```
 *
 * ## Migração
 *
 * Para migrar código existente:
 * 1. Identifique se é domain puro (sem dependências externas)
 * 2. Mova para `src/domain/` se for algoritmo/regra
 * 3. Crie serviço em `src/application/` se precisar de infra
 * 4. Mantenha em `src/infrastructure/` se for cliente/adapter
 * 5. Mantenha em `src/presentation/` se for UI/hook
 */

// Re-exports para conveniência
export * from "./domain";
export * from "./application";
export * from "./infrastructure";
export * from "./presentation";
