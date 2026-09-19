# Plano: Dashboard AxionnFina no Estilo Mobills

## Contexto

O dashboard atual do AxionnFina (src/routes/_authenticated/dashboard.tsx, 824 linhas) tem 6 zonas em coluna unica: hero patrimonial, KPIs, insights IA, proximo passo, duas colunas de detalhes, bastidores.

O dashboard do Mobills usa layout de grade (grid 2 colunas desktop) com cards de resumo no topo, graficos de categorias e secoes verticais. O objetivo e reestruturar o dashboard para seguir o padrao visual do Mobills.

## Comparativo: Mobills vs AxionnFina Atual

| Secao Mobills | AxionnFina Atual | Acao |
|---|---|---|
| 4 cards resumo (Saldo, Receitas, Despesas, Cartao) | Hero patrimonial + 4 KPIs separados | Reestruturar em 4 cards compactos |
| Meu Desempenho link | Nao existe | Criar link estilizado |
| Primeiros passos (onboarding) | FinancialNextStepCard | Adaptar existente |
| Receitas por categoria (donut) | Nao existe | Criar novo componente |
| Despesas por categoria (donut) | Nao existe (so AllocationSection investimentos) | Criar novo componente |
| Balanco R-D 6 meses (line chart) | CashflowSection (bar chart) | Adaptar para line chart |
| Receitas x Despesas (bar chart) | CashflowChart (ja e bar) | Manter existente |
| Frequencia de gastos (barras por dia) | Nao existe | Criar novo componente |
| Balanco mensal (chart + lista) | Nao existe | Criar novo componente |
| Pendencias e alertas | Alertas espalhados | Consolidar em card unico |
| Cartoes de credito | Nao existe no dashboard | Criar secao |
| Economia mensal (gauge) | savingsRate no KPICard | Criar componente dedicado |
| Minhas contas (lista saldos) | AccountCard Zona 6 (colapsada) | Exibir sem colapsar |
| Perfil (avatar + email) | Apenas greeting texto | Criar card perfil |
| Objetivos | Sua proxima conquista | Adaptar estilo Mobills |

## Layout Geral - Nova Estrutura (2 colunas desktop)

```
+-----------------------------------------------------------+
|  Dashboard                                     [usuario]  |
+-----------------------------------------------------------+
| [Saldo atual] [Receitas] [Despesas] [Cartao] | [Perfil]  |
+-----------------------------------------------------------+
| Meu Desempenho                                           |
+-----------------------------------------------------------+
| Primeiros passos              | Minhas contas             |
+-----------------------------------------------------------+
| Receitas por categoria        | Balanco R-D 6 meses       |
+-----------------------------------------------------------+
| Despesas por categoria        | Receitas x Despesas       |
+-----------------------------------------------------------+
| Frequencia de gastos          | Balanco mensal            |
+-----------------------------------------------------------+
| Pendencias e alertas          | Economia mensal           |
+-----------------------------------------------------------+
| Objetivos                     | Cartoes de credito        |
+-----------------------------------------------------------+
```

## Componentes a Criar

### 4.1 SummaryCards (novo)
**Arquivo**: src/components/finance/dashboard/SummaryCards.tsx

Substitui hero patrimonial + KPI strip. 4 cards em grid (grid-cols-2 lg:grid-cols-4):

1. Saldo atual - icone azul (Wallet), valor = liquidity
2. Receitas - icone verde (ArrowUpRight), valor = monthlyIncome
3. Despesas - icone vermelho (ArrowDownRight), valor = monthlyExpenses
4. Cartao de credito - icone roxo (CreditCard), soma saldos tipo CREDIT_CARD

Cada card: fundo bg-card, borda sutil, icone circular colorido a esquerda, valor a direita.
Dados ja disponiveis no dashboard.tsx via useAccounts, useCashflow.

### 4.2 PerfilCard (novo)
**Arquivo**: src/components/finance/dashboard/PerfilCard.tsx

Card com avatar do usuario (useSessionUser), nome, email, e badge de status.
Exibido na coluna direita ao lado dos SummaryCards.

### 4.3 ExpenseCategoryCard (novo)
**Arquivo**: src/components/finance/dashboard/ExpenseCategoryCard.tsx

Donut chart de despesas por categoria:
- PieChart + Pie do recharts (ja usado em AllocationSection)
- Centro: total formatado em BRL
- Lista abaixo: categoria, valor, percentual
- Cores: paleta chart-1 ate chart-5
- Estado vazio: mensagem amigavel
- Dados: derivar de useTransactions(null) filtrando kind="expense" e agrupando por category

### 4.4 IncomeCategoryCard (novo)
**Arquivo**: src/components/finance/dashboard/IncomeCategoryCard.tsx

Mesma estrutura do ExpenseCategoryCard mas para kind="income".

### 4.5 BalanceLineChart (novo)
**Arquivo**: src/components/finance/dashboard/BalanceLineChart.tsx

Line chart do saldo (receitas - despesas) em 6 meses:
- LineChart + Line do recharts
- Eixo X: meses, Eixo Y: valores BRL
- Linha roxa com area preenchida (estilo Mobills)
- Dados: derivar de useCashflow(6) usando campo saldo

### 4.6 SpendingFrequencyCard (novo)
**Arquivo**: src/components/finance/dashboard/SpendingFrequencyCard.tsx

Barras verticais representando gastos por dia do mes atual:
- BarChart do recharts com 30 barras
- Cor: roxo para dias com gastos, transparente para dias sem
- Tooltip mostrando data e valor
- Filtro "Ultimos 7 dias" / "Mes completo"
- Dados: derivar de useTransactions(null) filtrando despesas do mes atual por dia

### 4.7 MonthlyBalanceCard (novo)
**Arquivo**: src/components/finance/dashboard/MonthlyBalanceCard.tsx

Combo chart + lista diaria:
- AreaChart com linha do saldo acumulado ao longo do mes
- Lista ao lado com saldo por dia
- Dados: derivar de useTransactions(null) acumulando saldo diario

### 4.8 PendingAlertsCard (novo)
**Arquivo**: src/components/finance/dashboard/PendingAlertsCard.tsx

Consolida alertas espalhados:
- Total de despesas pendentes (valor)
- Total de receitas pendentes (valor)
- Contas vencidas (count)
- Budget estourado (count)
- Dados: derivar de usePayables, useBudgets, useTransactions

### 4.9 CreditCardSection (novo)
**Arquivo**: src/components/finance/dashboard/CreditCardSection.tsx

Lista de cartoes de credito com saldo:
- Filtrar accounts tipo CREDIT_CARD
- Mostrar nome, saldo (limite usado), icone
- Link "VER MAIS" para /bills

### 4.10 MonthlySavingsCard (novo)
**Arquivo**: src/components/finance/dashboard/MonthlySavingsCard.tsx

Gauge circular mostrando percentual de economia:
- SVG ring (reutilizar logica do HealthScore)
- Centro: percentual + mensagem motivacional
- Dados: savingsRate ja calculado no dashboard.tsx

### 4.11 MinhasContasCard (novo)
**Arquivo**: src/components/finance/dashboard/MinhasContasCard.tsx

Lista compacta de contas com saldo:
- Usar AccountAvatar + nome + saldo
- Sem colapsar (diferente da Zona 6 atual)
- Link "VER MAIS" para /wallet/accounts
- Dados: useAccounts()

### 4.12 ObjetivosCard (novo)
**Arquivo**: src/components/finance/dashboard/ObjetivosCard.tsx

Lista de metas com progresso:
- Nome da meta, barra de progresso, valor atual/target
- Dados: useGoals()

## Reestruturacao do dashboard.tsx

O arquivo dashboard.tsx (824 linhas) sera reestruturado:

### Remover
- Zona 1 (Hero patrimonial completo com AreaChart) - substituido por SummaryCards
- Zona 2 (4 KPICard separados) - substituido por SummaryCards
- Zona 3 (Insights do agente) - movido para Cmd+K ou pagina dedicada
- Zona 4 (FinancialNextStepCard) - adaptado como "Primeiros passos"
- Zona 5 coluna lateral (HealthScore, AllocationSection, Anomalias) - redistribuido
- Zona 6 (details colapsado) - substituido por MinhasContasCard

### Adicionar
- Layout grid 2 colunas (lg:grid-cols-3 no container, col-span-2 + col-span-1)
- SummaryCards no topo (full width)
- PerfilCard na coluna direita do topo
- MeuDesempenho link
- Grid de cards nas 2 colunas conforme layout acima

### Manter
- useRealtimeAccounts, useRealtimeTransactions
- useAnomalyDetection, useMoneyAge
- Todas as queries de dados existentes
- Logica de calculo (savingsRate, healthScore, etc.)
- Funcionalidade hidden (ocultar valores)
- showEmptyCta para estado vazio

## Dados Necessarios (ja disponiveis)

Todos os dados ja estao disponiveis no dashboard.tsx via hooks existentes:
- useAccounts() - contas e saldos
- useCashflow(6) - fluxo de caixa mensal
- useTransactions(null) - transacoes para categorias e frequencia
- usePayables() - contas a pagar
- useBudgets() - orcamento por categoria
- useGoals() - metas financeiras
- useInvestments() - alocacao de investimentos
- useSessionUser() - dados do usuario
- wealthSummary() - patrimonio liquido, liquidez, dividas

Nenhuma nova query ou chamada de API necessaria.

## Arquivos a Criar

| Arquivo | Descricao |
|---|---|
| src/components/finance/dashboard/SummaryCards.tsx | 4 cards de resumo no topo |
| src/components/finance/dashboard/PerfilCard.tsx | Card de perfil do usuario |
| src/components/finance/dashboard/ExpenseCategoryCard.tsx | Donut de despesas por categoria |
| src/components/finance/dashboard/IncomeCategoryCard.tsx | Donut de receitas por categoria |
| src/components/finance/dashboard/BalanceLineChart.tsx | Line chart balanco R-D |
| src/components/finance/dashboard/SpendingFrequencyCard.tsx | Frequencia de gastos por dia |
| src/components/finance/dashboard/MonthlyBalanceCard.tsx | Balanco mensal acumulado |
| src/components/finance/dashboard/PendingAlertsCard.tsx | Pendencias e alertas consolidados |
| src/components/finance/dashboard/CreditCardSection.tsx | Secao de cartoes de credito |
| src/components/finance/dashboard/MonthlySavingsCard.tsx | Gauge de economia mensal |
| src/components/finance/dashboard/MinhasContasCard.tsx | Lista de contas com saldos |
| src/components/finance/dashboard/ObjetivosCard.tsx | Metas com progresso |

## Arquivos a Alterar

| Arquivo | Mudanca |
|---|---|
| src/routes/_authenticated/dashboard.tsx | Reestruturar layout para grid 2 colunas, importar novos componentes |

## Preservado

- Todas as queries e hooks existentes
- Logica de calculo financeiro
- Funcionalidade hidden (ocultar valores)
- showEmptyCta para estado vazio
- Realtime subscriptions
- Nenhuma chamada de API nova
- Nenhuma regra de negocio alterada

## Risco

- **Medio**: Mudanca substancial no layout do dashboard, mas sem alteracao de dados ou logica
- Todos os dados ja existem, apenas a apresentacao muda
- Componentes novos sao puramente visuais (recharts + CSS)
