# Clareza dos KPIs na Visão geral

Melhorar os rótulos e adicionar explicações curtas aos 4 cards de indicadores do topo, sem alterar cálculos, rotas, banco ou integrações.

## Problema observado

Os nomes atuais usam jargão financeiro e deixam o usuário leigo sem entender o que cada card representa:

- **Dívidas nas contas** → soa como empréstimos, mas é o saldo negativo total (contas no vermelho + cartões).
- **Liquidez imediata** → termo técnico; não fica claro que é dinheiro disponível para usar agora.
- **Taxa de poupança** → parece taxa de juros; na verdade é a sobra do mês em percentual.
- **Próximo vencimento** → é aceitável, mas pode ser mais direto (próxima conta a pagar).

## Solução proposta

Oferecer duas camadas de clareza:

1. **Rótulos mais simples** nos cards.
2. **Descrição/legenda curta** (tooltip ou subtítulo) explicando o indicador.

### Novos rótulos sugeridos

```text
Dívidas nas contas        →  Quanto você deve
Liquidez imediata         →  Dinheiro disponível
Taxa de poupança          →  Sobra do mês
Próximo vencimento        →  Próxima conta a pagar
```

### Explicações sugeridas

- **Quanto você deve**: "Soma dos saldos negativos e cartões de crédito. Zero é o ideal."
- **Dinheiro disponível**: "Dinheiro em conta corrente/poupança que você pode usar hoje, sem contar investimentos."
- **Sobra do mês**: "Percentual da renda que sobrou depois das despesas deste mês. Quanto maior, melhor."
- **Próxima conta a pagar**: "Valor e data da conta em aberto mais próxima do vencimento."

## O que será alterado

1. **`src/components/finance/KPICard.tsx`**
   - Adicionar prop opcional `description?: string`.
   - Exibir a descrição como tooltip (ícone de informação ao lado do rótulo) ou como subtítulo discreto abaixo do rótulo.
   - Preservar todos os comportamentos atuais: `tone`, `sparkline`, `hint`, `change`, ícones.

2. **`src/routes/_authenticated/dashboard.tsx`**
   - Trocar os 4 textos do `label` dos `KPICard` pelos novos rótulos.
   - Passar a `description` correspondente em cada KPI.
   - Não alterar valores, cálculos, hooks, condições de tom semântico nem chamadas de API.

## O que NÃO será alterado

- Nenhuma lógica de cálculo (valores continuam os mesmos).
- Nenhuma rota, autenticação, banco de dados, Open Finance ou sidebar.
- Nenhum outro componente fora dos dois arquivos acima.

## Critério de aceite

- Os 4 KPIs exibem rótulos em linguagem simples.
- Cada KPI mostra uma explicação curta acessível ao usuário.
- O typecheck e o build continuam passando.
- Nenhum dado ou comportamento financeiro muda.
