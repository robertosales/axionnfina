# Reorganização visual da tela inicial

Reorganizar apenas o layout e a hierarquia da Home (Visão geral). Nenhuma consulta, cálculo ou integração muda: os mesmos dados, nos mesmos hooks, apenas em outra ordem e com zonas visuais claras.

## Nova ordem da página

```text
Cabeçalho (Olá, nome) + Ocultar valores + ações rápidas
──────────────── zona 1 ────────────────
4 KPIs  (com cor semântica verde / amarelo / vermelho)
──────────────── zona 2 ────────────────
Patrimônio líquido + gráfico de evolução  (bloco hero, largura total)
──────────────── zona 3 ────────────────
Insights do agente (IA)  — destaque violeta da marca
──────────────── zona 4 ────────────────
"Seu próximo passo"  → completo só sem dados; senão card compacto
──────────────── zona 5 ────────────────
Coluna principal (2/3)          |  Coluna lateral (1/3)
  Fluxo de caixa                |    Saúde financeira (score)
  Próximas contas               |    Sua próxima conquista
  Saúde do orçamento            |    Alocação de investimentos
  Transações recentes           |    Detecção de anomalias
──────────────── zona 6 (recolhida por padrão) ────────────────
Contas e origem dos dados + detalhe de investimentos (expansível)
```

## Detalhes por item

1. **KPIs**: cada card recebe um tom conforme o valor — dívidas altas em vermelho, liquidez positiva em verde, taxa de poupança positiva em verde / negativa em vermelho, próximo vencimento em vermelho se atrasado, amarelo se vence em até 7 dias, neutro (cinza) nos demais casos — incluindo quando não há nenhuma conta em aberto ("Sem contas abertas"), que fica cinza, nunca vermelho. As regras usam valores já calculados hoje na tela; nenhum cálculo novo de indicador.
2. **Patrimônio líquido**: mesmo conteúdo (valor, variação mês/ano, gráfico, tabela, aviso de sincronização), agora em largura total logo abaixo dos KPIs. Score de saúde e "próxima conquista" saem daqui e vão para a coluna lateral.
3. **Insights do agente**: sobe para logo abaixo do patrimônio, com borda e ícone na cor violeta da marca, largura total. Deixa de dividir linha com "Detecção de anomalias".
4. **Seu próximo passo**: quando não há contas nem transações, aparece como está hoje. Com dados reais, vira um card estreito e discreto com uma linha de texto e link, dispensável.
5. **Duas colunas**: a partir da zona 5, grade de 3 colunas — 2 para a coluna principal, 1 para a lateral. Em telas menores tudo empilha.
6. **Estado vazio unificado**: quando não há contas nem transações, um único aviso no topo da página com o botão "Conectar contas"; os cards individuais deixam de repetir "Ainda não há dados para este período" nesse cenário.

Zonas separadas por espaçamento maior e um leve fundo alternado nas faixas de destaque (patrimônio e insights).

## Arquivos tocados

- `src/routes/_authenticated/dashboard.tsx` — reordenação das seções, nova grade de duas colunas, tons semânticos nos KPIs, aviso único de estado vazio, destaque violeta no bloco de insights.
- `src/components/finance/KPICard.tsx` — apenas suporte visual para o tom semântico (o componente já aceita `tone`; ajuste na cor do valor/borda).
- `src/components/finance/DashboardCharts.tsx` — separar fluxo de caixa e alocação para que cada um possa ir para uma coluna diferente (mesmas props e dados).
- `src/components/finance/FinancialNextStepCard.tsx` — variante compacta para quando já há dados.

Sem mudanças em rotas, autenticação, banco, Open Finance, sidebar ou lógica de cálculo.
