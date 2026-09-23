# Central de Inteligência Financeira e DRE Pessoal

## Objetivo

Transformar `/reports` em uma central moderna de análise financeira, mantendo o relatório atual durante a evolução e permitindo responder, com poucos cliques:

- para onde o dinheiro foi;
- se o patrimônio está crescendo;
- quanto da renda está sendo poupado;
- quanto do orçamento está comprometido com crédito;
- quais mudanças merecem atenção no período.

A apresentação seguirá o padrão já aprovado do Axionn Finance: grafite/slate, violeta para destaque e verde, amarelo e vermelho somente para estados financeiros.

## Situação atual confirmada

A página atual oferece apenas período de 3, 6 ou 12 meses, gráfico de receitas e despesas, tabela mensal e exportação CSV.

O sistema já possui dados aproveitáveis para:

- categorias, subcategorias e meio de pagamento dos lançamentos;
- saldos históricos das contas;
- histórico de cofrinhos e investimentos;
- snapshots mensais de patrimônio;
- orçamentos por categoria;
- faturas e itens de cartão;
- transações de receita e despesa.

As principais lacunas são: histórico exato do limite de cheque especial, parcelas estruturadas de cartão, geração de relatório pela IA e exportação em PDF.

## Estrutura da nova página

### Navegação e filtros universais

No topo da página:

- abas: **Visão consolidada**, **Despesas e categorias**, **Patrimônio líquido** e **Crédito e meios**;
- períodos rápidos: este mês, mês anterior, últimos 3 meses, ano vigente e personalizado;
- filtro por instituição e por conta;
- indicação clara do intervalo analisado e da última atualização;
- filtros refletidos em todos os indicadores, gráficos, tabelas, briefing e exportações.

Os filtros ficarão na URL para permitir atualizar, voltar ou compartilhar a mesma visão sem perder a seleção.

### 1. Visão consolidada

- KPIs de receitas, despesas, resultado, taxa de poupança e patrimônio líquido;
- comparativo com o período anterior equivalente;
- gráfico mensal de receitas, despesas e resultado;
- medidor da taxa de poupança com faixas: abaixo de 10%, 10%–20% e acima de 20%;
- linha histórica da taxa de poupança;
- comparação entre orçamento planejado e gasto realizado;
- card executivo do agente com três conclusões objetivas, sempre sustentadas pelos dados exibidos.

### 2. Despesas e categorias

- donut hierárquico por categoria e subcategoria;
- clique em uma categoria abre seus lançamentos filtrados, sem sair do contexto do relatório;
- barras horizontais comparando o período atual com o anterior e com a média dos três períodos anteriores;
- variação percentual com semântica financeira: aumento de despesa em vermelho, redução em verde e ausência de base como “sem comparação”;
- tabela dos dez maiores lançamentos, com data, descrição, conta, categoria, meio e valor;
- estados “Sem categoria” e “Meio não identificado” quando o dado não estiver disponível, sem inventar classificações.

### 3. Patrimônio líquido

- área empilhada de ativos: contas, cofrinhos/metas e investimentos;
- área de passivos: faturas abertas e cheque especial em uso;
- linha destacada de patrimônio líquido;
- seleção de 12 ou 24 meses;
- detalhamento de cada ponto por origem do valor;
- fluxo de destinação da sobra: conta corrente, cofrinhos/metas e investimentos;
- dados ausentes ou períodos anteriores ao início dos snapshots serão identificados como incompletos, não interpolados como valores reais.

### 4. Crédito e meios de pagamento

- composição de gastos por Pix, débito, crédito à vista, crédito parcelado e não identificado;
- comprometimento da renda com faturas abertas e futuras, com alertas em 30% e 50%;
- evolução das faturas por mês e cartão;
- parcelas em andamento, total já pago e valor futuro, quando os dados estruturados estiverem disponíveis;
- dias com saldo negativo, maior uso do cheque especial e percentual do limite consumido;
- estimativa de juros apenas quando houver taxa cadastrada, sempre rotulada como estimativa.

## Card executivo do agente

Criar um resumo estruturado para o relatório, separado do chat livre. O agente receberá somente métricas já calculadas e devolverá até três observações em linguagem simples.

Regras:

- nunca fabricar valores;
- citar o período e a métrica que sustentam cada observação;
- distinguir fato, comparação e orientação educacional;
- não oferecer recomendação de investimento ou movimentação automática;
- mostrar uma versão determinística baseada em regras quando a IA estiver indisponível;
- permitir atualizar o briefing sob demanda, sem bloquear os gráficos.

## Exportações

- manter o CSV atual e ampliá-lo para respeitar filtros e aba selecionada;
- adicionar **Exportar DRE em PDF** com capa, período, KPIs, receitas, despesas, resultado, categorias, patrimônio, crédito e briefing;
- gerar o PDF no navegador com biblioteca compatível, carregada somente quando solicitada;
- não incluir dados ocultos por filtros;
- incluir data de geração, fontes e aviso de que o documento é informativo;
- oferecer versão limpa para impressão e prestação de contas familiar/contábil.

## Plano de implementação

### Fase 1 — Base analítica e Visão consolidada

1. Criar contratos tipados para filtros, séries, KPIs, comparativos e detalhamentos.
2. Criar consultas agregadas protegidas por usuário para evitar baixar todo o histórico no navegador.
3. Manter as regras atuais: excluir transferências, investimentos, pendências e arquivados do fluxo operacional quando aplicável.
4. Construir filtros universais e sincronização com a URL.
5. Entregar a Visão consolidada, taxa de poupança, orçamento versus realizado e CSV filtrado.
6. Preservar o gráfico e a tabela atuais dentro da nova estrutura até sua substituição validada.

### Fase 2 — Despesas e categorias

1. Expor categoria, subcategoria e meio de pagamento nos contratos de transação.
2. Criar agregações por categoria, subcategoria, conta e meio.
3. Implementar donut com detalhamento, comparativo mensal e maiores lançamentos.
4. Adicionar painel lateral de lançamentos filtrados e ligação para a tela completa de Transações.
5. Garantir leitura por tabela alternativa e navegação por teclado para todos os gráficos.

### Fase 3 — Patrimônio líquido

1. Consolidar snapshots de contas, cofrinhos, investimentos e passivos.
2. Implementar gráfico de ativos, passivos e patrimônio líquido em 12/24 meses.
3. Calcular a destinação mensal da sobra usando movimentos efetivamente registrados.
4. Exibir cobertura e qualidade dos dados por período para não apresentar séries incompletas como definitivas.

### Fase 4 — Crédito e meios

1. Consolidar faturas abertas/futuras, itens de fatura e renda confirmada.
2. Implementar comprometimento da renda e composição por meio de pagamento.
3. Estruturar número da parcela e total de parcelas para análises confiáveis.
4. Passar a registrar o limite vigente nos snapshots de saldo.
5. Adicionar taxa opcional de cheque especial por conta para estimativa de juros.
6. Não retroagir números exatos quando o histórico anterior não existir; marcar períodos antigos como estimados ou indisponíveis.

### Fase 5 — Agente e PDF

1. Criar serviço protegido que monte um pacote de métricas do relatório.
2. Gerar o briefing estruturado com validação de formato e fallback por regras.
3. Criar documento PDF com resumo executivo e tabelas essenciais.
4. Validar visualmente todas as páginas do PDF antes da entrega.

## Alterações de dados necessárias

Uma migration será preparada para:

- adicionar campos estruturados de parcela aos itens de fatura;
- registrar o limite vigente junto aos snapshots de saldo;
- armazenar, na conta, uma taxa opcional para estimativa de juros do cheque especial;
- atualizar funções de importação/snapshot relacionadas;
- manter permissões e políticas restritas ao proprietário dos dados.

A migration não tentará reconstruir valores históricos que o sistema nunca registrou. Ela só será considerada validada depois da execução e conferência no Lovable Cloud.

## Organização técnica

- Criar um módulo de domínio de relatórios com cálculos puros e testes para taxa de poupança, comparativos, patrimônio, comprometimento de renda e cheque especial.
- Usar funções protegidas para agregações extensas e consultas do usuário autenticado.
- Carregar os dados por aba para evitar custo e lentidão desnecessários.
- Manter Recharts e os componentes do design system já usados pelo projeto.
- Dividir a página em componentes pequenos por eixo temático, sem alterar dados ou cálculos de outras telas.
- Atualizar os metadados próprios da rota de Relatórios.

## Validação e critérios de aceite

- Todos os filtros afetam KPIs, gráficos, tabelas, briefing e exportação de forma consistente.
- Totais de receitas, despesas e resultado conferem com os lançamentos confirmados do mesmo período.
- Transferências não são contadas como receita ou despesa.
- A soma das categorias confere com o total de despesas filtrado.
- Patrimônio líquido confere com ativos menos passivos para cada ponto disponível.
- Comprometimento de faturas usa apenas renda confirmada e informa quando não há base suficiente.
- Nenhum dado ausente é substituído por valor inventado.
- Gráficos possuem alternativa textual/tabular, contraste adequado e navegação por teclado.
- Desktop e celular não apresentam cortes, sobreposições ou rolagem horizontal indevida.
- CSV e PDF refletem exatamente os filtros ativos.
- Testes cobrem cálculos financeiros, períodos, estados sem dados e comparativos sem base anterior.
- Fluxo autenticado completo é validado com dados reais do usuário antes da conclusão.

## Entrega recomendada

As fases devem ser liberadas progressivamente. A primeira entrega útil será **Visão consolidada + Despesas e categorias**, seguida por **Patrimônio**, depois **Crédito**, e por fim **Agente + PDF**. Assim, a página ganha valor rapidamente sem apresentar históricos de crédito como exatos antes de o sistema começar a registrá-los corretamente.
