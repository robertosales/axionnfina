# Módulo de Transações - Fase 4

## Visão Geral

Implementa o pipeline completo de transações: ingestão → normalização → deduplicação → categorização → ledger (partida dobrada).

## Estrutura

```
src/modules/transactions/
├── types.ts              # Tipos TypeScript
├── normalizer.ts         # Normalização de transações externas
├── deduplication.ts      # Deduplicação (idempotência)
├── categorization.ts     # Pipeline de categorização
├── ledger.ts             # Serviço de ledger (partida dobrada)
├── sync-service.ts       # Orquestrador do pipeline
├── index.ts              # Exports públicos
└── __tests__/            # Testes unitários
```

## Pipeline de Processamento

```
External Transaction (Provider)
         │
         ▼
┌───────────────────────┐
│   Deduplication       │ ← Chave: provider + external_account_id + external_id
│   (idempotência)      │
└───────────────────────┘
         │
         ▼
┌───────────────────────┐
│   Normalizer          │ ← Limpeza, extração de merchant, parsing de datas
└───────────────────────┘
         │
         ▼
┌───────────────────────┐
│   Categorization      │ ← MCC → Merchant Rules → User Rules → History → LLM
│   (pipeline)          │
└───────────────────────┘
         │
         ▼
┌───────────────────────┐
│   Ledger (Journal)    │ ← Partida dobrada: débito + crédito = 0
└───────────────────────┘
```

## Categorização (Pipeline)

1. **MCC** (confidence ≥ 0.7): Mapeamento direto de códigos MCC
2. **Merchant Rules** (confidence ≥ 0.8): Regex patterns para merchants conhecidos
3. **User Rules** (confidence ≥ 0.9): Regras customizadas do usuário
4. **History** (confidence ≥ 0.75): Padrão histórico do mesmo merchant
5. **LLM** (confidence ≥ 0.5): Fallback futuro com IA
6. **Unclassified**: Fallback final

## Ledger (Partida Dobrada)

Cada transação gera um `journal_entry` com `journal_lines` balanceadas:

```sql
-- Exemplo: Gasto de R$ 100 no cartão
Débito: 5.1.2 Despesas - Alimentação    R$ 100
Crédito: 2.1.1 Cartões de Crédito       R$ 100
```

Transferências entre contas próprias:
```sql
Débito: 1.1.2 Conta Corrente Itaú       R$ 500
Crédito: 1.1.2 Conta Corrente BTG       R$ 500
```

## Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `external_transactions` | Raw do provider (idempotência) |
| `transactions` | Normalizadas para UI |
| `transaction_enrichments` | Auditoria de categorização |
| `transaction_categories` | Catálogo hierárquico (sistema + usuário) |
| `transaction_tags` | Tags livres do usuário |
| `transaction_pairs` | Transferências pareadas |
| `ledger_accounts` | Plano de contas |
| `journal_entries` | Cabeçalho do lançamento |
| `journal_lines` | Linhas (débito/crédito) |

## RPCs Principais

- `create_journal_entry` - Cria lançamento balanceado
- `get_ledger_balances` - Balanço por tipo de conta
- `create_transaction_from_external` - Normaliza transação externa
- `pair_transfer` - Pareia transferência + cria journal entry
- `get_transactions_summary` - Resumo para dashboard
- `detect_transfer_candidates` - Detecta transferências automaticamente

## API Endpoints

- `POST /api/transactions?action=create` - Criar transação manual
- `POST /api/transactions?action=pair-transfer` - Parear transferência
- `POST /api/transactions?action=categorize` - Categorizar manualmente
- `GET /api/transactions` - Listar transações (filtros)
- `GET /api/transactions/summary` - Resumo para dashboard
- `GET /api/ledger/balances` - Balanço do ledger

## Webhook Open Finance

`supabase/functions/openfinance-webhook` - Processa eventos do Pluggy:
- `item_updated` / `item_login_succeeded` → Trigger sync
- `transactions_updated` → Trigger sync
- `accounts_updated` → Trigger sync
- `investments_updated` → Trigger sync
- `consent_revoked` → Revoga conexão

## Migração

Arquivo: `supabase/migrations/20260829000000_transactions_phase4.sql`

Inclui:
- Todas as tabelas com RLS
- Seed de categorias padrão (hierárquicas)
- Seed de MCC mappings (50+ códigos)
- Seed de plano de contas padrão
- RPCs para operações atômicas
- Índices otimizados

## Próximos Passos (Fase 5)

1. Dashboard financeiro com dados do ledger
2. Orçamento vs Realizado
3. Cashflow projection
4. Relatórios fiscais