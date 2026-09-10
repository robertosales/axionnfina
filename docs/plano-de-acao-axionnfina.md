# Plano de Ação — AxionFina

Data: 2026-09-10  
Branch analisada: `develop`

## Objetivo

Evoluir o AxionFina para uma experiência de finanças pessoais premium, clara e orientada a decisões, unindo controle financeiro cotidiano com acompanhamento de investimentos.

A referência visual analisada apresenta um dashboard compacto, elegante e orientado a patrimônio, metas, transações e alocação. O AxionFina já possui recursos mais avançados, como saúde financeira, anomalias, Radar de Investimentos, FGC e agente de IA. O trabalho principal é organizar esses recursos em uma experiência mais coesa.

## Princípios

- Mostrar primeiro o que exige atenção.
- Transformar dados em decisões práticas.
- Manter investimentos conectados às metas pessoais.
- Informar sempre a origem e a atualização dos dados.
- Preservar acessibilidade, privacidade e clareza.
- Usar requinte visual sem sacrificar leitura ou performance.

## Fase 0 — Preparação técnica

### Objetivo

Garantir uma base confiável antes das alterações de interface.

### Ações

- Executar todas as migrations em um banco local limpo.
- Regenerar os tipos do Supabase.
- Adicionar `tsc --noEmit` ao pipeline.
- Validar RLS e cenários de IDOR com dois usuários.
- Criar fixtures para contas, transações, investimentos e metas.
- Medir erros, tempo de carregamento e status das sincronizações.

### Critério de conclusão

Build, testes, typecheck e migrations executando sem falhas em ambiente limpo.

## Fase 1 — Reorganização da experiência

### Objetivo

Reduzir a dispersão entre telas e tornar a jornada financeira compreensível.

### Ações

- Agrupar a navegação em:
  - Visão geral
  - Vida financeira
  - Investimentos
  - Planejamento
  - Sistema
- Manter o Dashboard como ponto central do produto.
- Criar ações rápidas para:
  - Nova transação
  - Importar documento
  - Conectar banco
  - Criar meta
  - Perguntar ao agente
- Promover o componente “Seu próximo passo” a elemento central do dashboard.
- Padronizar nomes de Carteira, Investimentos, Contas, Metas e Insights.

### Critério de conclusão

O usuário encontra as principais tarefas sem precisar abrir o agente ou usar a busca.

## Fase 2 — Novo Dashboard: Cockpit Patrimonial

### Objetivo

Permitir que o usuário entenda sua situação financeira em poucos segundos.

### Estrutura proposta

#### Resumo patrimonial

- Patrimônio líquido em destaque.
- Variação mensal e anual.
- Gráfico de evolução dos últimos 6 ou 12 meses.
- Controle para ocultar valores sensíveis.
- Data da última atualização.

#### Decisões importantes

- Próximo passo recomendado.
- Contas próximas do vencimento.
- Anomalias detectadas.
- Meta mais próxima de ser atingida.
- Uma ação principal contextual.

#### Visão financeira

- Fluxo de caixa mensal.
- Taxa de poupança.
- Orçamento versus realizado.
- Liquidez disponível.
- Dívidas ou faturas em aberto.

#### Camada de investimentos

- Alocação por classe.
- Rentabilidade.
- Exposição ao FGC.
- Próximos vencimentos.
- Relação entre carteira e metas.

### Layout sugerido

```text
[Patrimônio + evolução                 ][Saúde financeira / meta]

[Próxima decisão       ][Vencimentos][Anomalias]

[Fluxo de caixa grande                 ][Alocação da carteira]

[Orçamento              ][Transações recentes][Insights do agente]
```

### Critério de conclusão

A tela inicial responde claramente:

1. Quanto tenho?
2. Como estou?
3. O que merece atenção?
4. Qual é o próximo movimento?

## Fase 3 — Refinamento visual

### Objetivo

Aproximar o AxionFina da linguagem premium da referência sem copiar elementos decorativos inadequados.

### Ações

- Disponibilizar um modo claro premium.
- Manter o dark mode completo.
- Usar azul profundo, branco, grafite, verde e âmbar como base.
- Reservar gradientes para patrimônio, Radar e metas.
- Padronizar cards, bordas, sombras e espaçamentos.
- Melhorar a tipografia dos valores financeiros.
- Reduzir ruído visual nos gráficos.
- Padronizar estados de loading, vazio, erro e dados desatualizados.
- Evitar textos pequenos demais e excesso de cards na mesma área.

### Diretriz

A imagem de referência contém elementos que parecem controles de captura ou rede social. Eles não devem fazer parte da interface financeira real.

### Critério de conclusão

A interface é consistente, legível e funcional em desktop e mobile, com claro contraste entre informação principal e secundária.

## Fase 4 — Investimentos como camada patrimonial

### Objetivo

Unir finanças pessoais e investimentos em uma narrativa única.

### Ações

- Mostrar um resumo de investimentos no dashboard.
- Relacionar posições a metas.
- Exibir rentabilidade líquida e evolução patrimonial.
- Mostrar concentração por classe, instituição e conglomerado.
- Destacar vencimentos próximos.
- Integrar FGC e liquidez à leitura principal.
- Apresentar o Radar como recomendação educacional.
- Separar visualmente:
  - Situação atual
  - Riscos
  - Oportunidades
  - Próxima ação

### Adaptação ao contexto brasileiro

- PIX, cartões, boletos e contas recorrentes.
- CDI, IPCA, Selic, Tesouro Direto, CDB, LCI/LCA, fundos e ações.
- Rentabilidade líquida estimada.
- Cobertura e concentração no FGC.
- Metas de reserva, imóvel, aposentadoria, educação e liberdade financeira.

### Critério de conclusão

O usuário entende por que possui cada investimento e qual objetivo ele atende.

## Fase 5 — Open Finance e confiança nos dados

### Objetivo

Tornar a origem, a atualidade e a confiabilidade de cada informação visíveis.

### Ações

Cada conta ou indicador deve informar:

- Instituição de origem.
- Última sincronização.
- Status da conexão.
- Origem manual, importada ou sincronizada.
- Dados em cache ou possivelmente desatualizados.
- Ação para sincronizar novamente.
- Ação para renovar ou revogar consentimento.

Também será necessário:

- Evitar exclusão física de transações sincronizadas.
- Criar overrides para alterações feitas pelo usuário.
- Registrar divergências entre saldo, transação e ledger.
- Adicionar retry e observabilidade às sincronizações.

### Critério de conclusão

O usuário sempre sabe de onde veio o dado e quão atual ele está.

## Fase 6 — Mobile e acessibilidade

### Ações

- Criar navegação inferior com Início, Carteira, Investimentos, Metas e Agente.
- Transformar blocos extensos em seções recolhíveis.
- Garantir contraste adequado.
- Não depender apenas de cor para indicar receita, despesa ou risco.
- Melhorar navegação por teclado.
- Adicionar labels e estados acessíveis aos gráficos.
- Validar larguras de 320px, 768px e desktop.
- Garantir que textos e valores não sejam cortados em cards.

### Critério de conclusão

Os fluxos principais funcionam sem perda de contexto em dispositivos móveis.

## Fase 7 — Qualidade técnica e segurança

### Ações

- Consolidar `finance-data.ts` e `account-service.ts`.
- Tornar mutações de transação atômicas.
- Reconciliar saldo e ledger após alterações.
- Adicionar constraints para valores, confiança e tipos contábeis.
- Revisar rotas API que seguem convenções de Next.js.
- Adicionar testes para:
  - RLS e IDOR.
  - Open Finance.
  - Duplicidade de transações.
  - Alterações em transações importadas.
  - Reversão contábil.
  - Divergência de saldos.

## Ordem recomendada de execução

1. Preparação técnica e validação do banco.
2. Reorganização da navegação.
3. Novo dashboard patrimonial.
4. Refinamento visual e modo claro.
5. Integração de investimentos ao dashboard.
6. Transparência e confiabilidade do Open Finance.
7. Mobile, acessibilidade e testes finais.

## Primeira entrega recomendada

A primeira entrega deve conter:

- Nova hierarquia do dashboard.
- Patrimônio líquido em destaque.
- Próximo passo financeiro.
- Fluxo de caixa.
- Alocação de investimentos.
- Contas próximas do vencimento.
- Ações rápidas.
- Status de atualização dos dados.

Essa entrega já aproxima o AxionFina da referência visual e melhora sua utilidade sem exigir a reconstrução completa do sistema.

## Indicadores de sucesso

- Redução do tempo até a primeira ação do usuário.
- Aumento do uso de ações rápidas.
- Menor abandono na conexão de contas.
- Menor quantidade de transações sem categoria.
- Maior acompanhamento de metas.
- Menor número de divergências de saldo.
- Dashboard utilizável em desktop e mobile.
