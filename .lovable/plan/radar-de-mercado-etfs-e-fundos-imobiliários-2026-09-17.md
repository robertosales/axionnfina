# Radar de Mercado: ETFs e fundos imobiliários

## Ponto de partida

O Google Finanças não disponibiliza acesso para aplicativos (só a função dentro do Google Planilhas), então ele não pode alimentar o Radar. A fonte escolhida é a **brapi.dev**, que entrega cotações de ETFs e fundos imobiliários da B3, tem plano gratuito com chave e é feita para o mercado brasileiro. O Yahoo fica como reserva automática caso a fonte principal falhe.

O Radar continua sendo material educacional. Nada de ordens, nada de "compre isto". A tela deixa claro, em todos os cartões, que somos um apoio para quem está começando e não uma corretora.

## O que o usuário vai ver

### 1. Como está o mercado hoje
Uma faixa no topo do Radar com, na data mais recente disponível:
- Ibovespa: pontos e variação do dia
- Dólar
- Selic e IPCA em 12 meses (já existem hoje)
- Frase curta em linguagem simples, do tipo "Mercado em queda leve hoje; oscilações diárias são normais e não devem guiar decisões de longo prazo"

Cada número mostra data e fonte. Se algum dado não vier, aparece como indisponível — nunca é inventado.

### 2. Ranking educacional de ETFs e fundos imobiliários
Uma lista curada e fixa de ETFs de índice (ex.: BOVA11, IVVB11, SMAL11, IMAB11) e de fundos imobiliários mais líquidos, cada um com cotação atual, variação de 12 meses e, nos fundos, o rendimento distribuído.

O ranking usa o mesmo formato do Radar atual: nota, selo de aderência e lista de evidências visíveis, cruzando o perfil já cadastrado (tolerância a risco, horizonte, liquidez e objetivo) com características do ativo.

Regras de proteção ao iniciante:
- Perfil conservador sem reserva de emergência formada recebe um aviso no topo e a renda variável aparece bloqueada para estudo, com o motivo explicado.
- Fundos imobiliários só entram com destaque a partir de horizonte médio/longo.
- Todo ativo mostra alertas de risco: oscilação, sem garantia do FGC, imposto sobre o ganho.

### 3. Comparação e explicação
Cada cartão abre com uma explicação em linguagem simples: o que o ativo é, o que pode dar errado, quanto custa (taxa do fundo, corretagem, imposto) e para que tipo de objetivo costuma servir. Ao lado, a comparação com a renda fixa equivalente do Radar atual, para o usuário enxergar o que está trocando ao assumir mais risco.

## Detalhes técnicos

- Nova chave de servidor `BRAPI_TOKEN`, pedida ao usuário na hora da implementação.
- `src/lib/market-equities.server.ts`: busca cotações na brapi (lista fixa de tickers, uma chamada em lote), cache de 30 minutos, recuo para Yahoo em caso de falha, e registro no `sourceHealth` já existente.
- `src/lib/market-equities.ts`: tipos e a lista curada de ETFs/FIIs, pura e testável.
- `src/lib/equity-ranking.ts`: pontuação por risco, horizonte, liquidez, objetivo e custos, no mesmo modelo de `investment-radar.ts`, com testes em `equity-ranking.test.ts`.
- `src/routes/api/investment-radar.ts`: passa a devolver também `marketOverview` e `equityOpportunities`, sem quebrar o formato atual.
- `src/components/finance/MarketOverviewStrip.tsx` e `EquityOpportunityCard.tsx`, montados dentro de `InvestmentRadarPanel.tsx` em uma aba nova "Renda variável", mantendo intacta a aba de renda fixa.
- Sem migrations nem mudança de schema nesta etapa.

## Fora do escopo

Ações individuais, recomendação de compra e venda, execução de ordens, carteiras automáticas e cotação em tempo real (os dados têm atraso típico do plano gratuito, e isso fica escrito na tela).
