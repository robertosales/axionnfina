---
name: axionnfina-financial-frontend
description: Projetar, revisar, implementar e refatorar o frontend do AxionnFina, sistema financeiro, com foco em precisão monetária, segurança operacional, clareza, rastreabilidade, acessibilidade, responsividade e consistência. Usar ao trabalhar em dashboards, receitas, despesas, contas a pagar/receber, lançamentos, conciliações, categorias, centros de custo, relatórios, tabelas, filtros, gráficos, formulários, modais, status financeiros e demais fluxos de interface do AxionnFina.
---
# AxionnFina Financial Frontend
Atuar como engenheiro frontend sênior de produto financeiro.
Priorizar: **correção financeira > segurança operacional > clareza > consistência > acessibilidade > desempenho > estética**.
Nunca sacrificar precisão ou segurança por aparência.

## 1. Inspecionar antes de codificar
Antes de alterar qualquer tela:
- detectar framework, roteamento e gerenciador de pacotes;
- identificar design system, tokens e componentes compartilhados;
- localizar API client, hooks, schemas, validações e formatadores;
- identificar a fonte real dos dados;
- verificar autenticação, autorização e permissões relacionadas;
- localizar testes e scripts disponíveis;
- entender os padrões já usados nas telas financeiras.
Reutilizar componentes e convenções existentes antes de criar novos. Não duplicar componentes.
Não inventar arquitetura, endpoint, campo, status, permissão, métrica ou regra de negócio.
Não adicionar dependência sem necessidade clara.

## 2. Preservar o domínio
Modificar somente frontend nesta skill. Não alterar backend para resolver problema puramente visual. Não alterar banco de dados, migrations, regras de negócio ou cálculos financeiros. Não alterar contratos de API sem autorização explícita.
Não alterar sem solicitação explícita:
- regras de negócio e cálculos financeiros;
- banco de dados e migrations;
- contratos de API;
- autenticação, autorização e políticas;
- integrações, webhooks e conciliações automáticas.
Se o frontend depender de uma dessas alterações, explicar a dependência antes de implementá-la.

## 3. Tratar dinheiro como dado crítico
Não introduzir cálculo monetário inseguro com ponto flutuante.
Evitar `parseFloat`, `Number` ou aritmética direta com `number` quando houver risco de precisão.
Preferir a estratégia já adotada:
- cálculo no backend;
- Decimal;
- centavos inteiros;
- biblioteca de precisão existente;
- utilitário centralizado.
Não criar uma segunda estratégia monetária.
Para BRL, reutilizar o formatador existente. Se não houver:
```ts
new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})
```
Exibir de forma consistente:
```text
R$ 1.234,56
-R$ 1.234,56
R$ 0,00
```
Não concatenar manualmente `"R$ " + valor`.

## 4. Datas, horas e percentuais
Usar padrão brasileiro quando compatível:
```text
10/09/2026
10/09/2026 às 14:35
12,50%
```
Não alterar timezone implicitamente.
Não converter vencimento para UTC sem entender o contrato da API.
Não misturar padrões `pt-BR` e `en-US`.

## 5. Organizar a informação financeira
Dar prioridade visual ao que muda decisão.
Quando existirem no produto, priorizar:
- saldo atual e projetado;
- receitas e despesas;
- resultado do período;
- contas a pagar e receber;
- vencidos e próximos vencimentos;
- fluxo de caixa;
- inadimplência;
- categorias e centros de custo.
Não inventar indicadores.
Todo indicador deve deixar claro o período.
Não mostrar variação percentual sem informar a base de comparação.

## 6. Dashboard
Organizar preferencialmente:
1. resumo financeiro;
2. evolução;
3. pendências e exceções;
4. detalhamento.
Evitar excesso de cards e repetição do mesmo número.
Preferir comparações: atual vs. anterior, realizado vs. previsto, recebido vs. pendente, pago vs. vencido.
Não criar gráfico apenas para preencher espaço ou por estética. Todo gráfico deve responder a uma pergunta financeira concreta.

## 7. Tabelas
Preferir tabela quando o usuário precisar comparar, conferir, filtrar ou operar registros.
Para valores:
- alinhar à direita;
- preservar casas decimais;
- usar formatação uniforme;
- usar `font-variant-numeric: tabular-nums` quando suportado.
Para datas, ordenar pelo valor real, não pela string formatada.
Para status, usar texto + indicador visual e nunca depender apenas de cor.
Usar somente estados existentes no domínio.

## 8. Busca e filtros
Em telas de volume relevante, considerar:
- busca, período e status;
- categoria, conta, tipo e centro de custo;
- ordenação e paginação.
Mostrar filtros ativos e oferecer ação clara para limpá-los.
Não ocultar resultados sem deixar claro o filtro aplicado.

## 9. Formulários
Prevenir erro antes do envio.
Usar labels explícitos, validação próxima ao campo, obrigatoriedade clara e feedback de processamento.
Usar máscaras somente quando ajudarem.
Não usar placeholder como substituto de label.
Não apagar os dados preenchidos quando o servidor falhar.
Não tratar `0`, `null`, `undefined` e vazio como equivalentes sem verificar o domínio.

## 10. Proteger ações financeiras críticas
Considerar críticas ações de:
- exclusão, cancelamento e estorno;
- baixa ou marcação como pago;
- alteração de valor ou vencimento;
- conciliação/desconciliação;
- alteração de conta;
- operação em massa.
Implementar confirmação contextual na interface para todas as ações críticas acima. Essa confirmação pertence ao fluxo do produto, não é um pedido de permissão ao usuário para editar código já autorizado.
Mostrar, quando disponível: ação, descrição, valor, conta, data e consequência.
Preferir:
```text
Marcar R$ 8.450,00 como pago em 10/09/2026?
```
Evitar:
```text
Tem certeza?
```

## 11. Impedir duplicidade
Durante gravação:
- desabilitar o botão;
- mostrar processamento;
- impedir cliques repetidos;
- evitar chamadas duplicadas óbvias.
Não considerar isso substituto da idempotência no backend.
Se a API já usar idempotency key, respeitar o contrato existente.

## 12. Evitar optimistic update em operações críticas
Preferir confirmação do servidor para:
- pagamentos e baixas;
- estornos e exclusões;
- conciliações;
- alterações de saldo;
- operações em massa.
Usar optimistic update somente em ação de baixo risco ou com rollback robusto já existente.

## 13. Tratar todos os estados da interface
Toda tela relevante deve considerar:
- loading;
- success;
- empty;
- error;
- sem permissão;
- dados parciais, quando aplicável.
Não deixar área vazia sem explicação.
Usar skeleton quando representar bem a estrutura final.
Evitar spinner global para atualização pequena e local.

## 14. Dar feedback preciso
Toda ação deve produzir resultado observável.
Preferir:
```text
Lançamento criado com sucesso.
Pagamento registrado.
Não foi possível salvar a alteração.
Nenhum lançamento encontrado para este período.
```
Não exibir stack trace, SQL, payload interno ou mensagem técnica sensível ao usuário.

## 15. Segurança no frontend
Nunca:
- colocar secrets no frontend;
- registrar tokens em logs;
- colocar tokens em query string;
- expor payload sensível;
- armazenar credenciais em `localStorage`;
- desabilitar proteção de backend;
- confiar somente em validação do cliente.
Mascarar dados sensíveis quando o fluxo permitir:
```text
CPF: ***.***.***-12
Conta: ****1234
Cartão: •••• 4321
```
Não mascarar arbitrariamente dados que o usuário precise ver integralmente.

## 16. Permissões e auditoria
O frontend pode ocultar/desabilitar ações conforme permissões recebidas, mas o backend continua sendo a autoridade.
Não criar autorização hardcoded.
Preservar rastreabilidade e, quando disponíveis, exibir:
- criado por e alterado por;
- criação e última alteração;
- origem, status e histórico;
- identificador do registro.
Não inventar histórico nem remover dados de auditoria existentes.

## 17. Design visual
Transmitir clareza, confiança, estabilidade e precisão.
Preferir interface limpa e sóbria.
Evitar:
- neon e glassmorphism excessivo;
- gradientes decorativos;
- sombras pesadas;
- gráficos 3D;
- animações gratuitas;
- excesso de cards;
- ícones sem função.
Preservar a identidade visual atual do AxionnFina. Não redesenhar o sistema inteiro para corrigir uma tela.
Não redefinir paleta global sem solicitação.

## 18. Cores semânticas
Usar cores de forma consistente para positivo, negativo, atenção e conclusão.
Não assumir verde/vermelho sem verificar o design system.
Cor nunca deve ser o único indicador de estado: combinar com texto, ícone ou outro sinal acessível.

## 19. Responsividade
Projetar e validar desktop e mobile deliberadamente.
Em telas pequenas:
- preservar valores importantes;
- não truncar números críticos;
- reduzir informação secundária;
- manter ações essenciais acessíveis.
Não transformar automaticamente toda tabela em cards.
Se comparação entre colunas for essencial, scroll horizontal controlado pode ser melhor que ocultar dados.

## 20. Acessibilidade
Buscar boas práticas equivalentes a WCAG AA:
- contraste;
- foco visível;
- navegação por teclado;
- labels e HTML semântico;
- `aria-*` quando necessário;
- erros associados aos campos;
- ícones acionáveis com nome acessível.
Não depender somente de hover.

## 21. Gráficos
Escolher pelo objetivo:
- linha: evolução temporal;
- barra: comparação;
- barra empilhada: composição;
- donut/pizza: poucas categorias e baixa necessidade de comparação precisa.
Evitar 3D, escalas enganosas, categorias demais e eixo temporal inconsistente.
Formatar corretamente valores e datas em tooltips.
Oferecer alternativa textual/tabular quando necessário para acessibilidade.

## 22. Contas a pagar e receber
Priorizar vencimento, valor, contraparte, status, conta e recorrência.
Em baixa de pagamento, distinguir:
- valor original;
- valor pago;
- diferença;
- juros;
- multa;
- desconto;
- data do pagamento.

## 23. Recorrência
Ao editar lançamento recorrente, deixar explícito:
```text
Somente este lançamento
Este e os próximos
Toda a série
```
Não alterar toda a série sem confirmação explícita.

## 24. Conciliação
Quando houver conciliação, mostrar:
- registro interno e movimento externo;
- valor, data e diferença;
- status e ação proposta.
Distinguir os estados de conciliação que existirem no contrato recebido, sem inventar status.
Nunca marcar como conciliado apenas por similaridade visual no frontend.

## 25. Importação e exportação
Em importação, quando existir:
- mostrar prévia;
- indicar erros por linha;
- separar válidos e inválidos;
- permitir revisão;
- sinalizar duplicidade quando suportada.
Não criar parser financeiro novo no frontend se essa lógica já existir no backend.
Em exportação:
- respeitar filtros;
- preservar precisão e datas;
- evitar campos sensíveis desnecessários.
Não assumir que a página atual da tabela representa todo o dataset.

## 26. Erros de API
Quando possível, distinguir validação, não autenticado, sem permissão, não encontrado, conflito, indisponibilidade, timeout e erro inesperado.
Nunca exibir SQL, stack trace, segredo, token ou nome interno de infraestrutura.

## 27. Componentização
Preferir:
- componentes por responsabilidade;
- hooks focados;
- funções puras;
- formatadores centralizados;
- uma fonte de verdade para estado financeiro.
Evitar:
- componentes gigantes;
- abstração prematura;
- estado duplicado;
- `useEffect` desnecessário;
- `any` para contornar tipagem;
- `@ts-ignore` sem justificativa.
Não generalizar componente usado uma única vez sem benefício real.

## 28. Performance e dependências
Otimizar com evidência.
Priorizar paginação, lazy loading, cache conforme padrão existente, evitar refetch desnecessário e virtualização somente para listas grandes.
Não usar `useMemo`/`useCallback` indiscriminadamente.
Antes de adicionar pacote:
1. verificar se o projeto já resolve a necessidade;
2. verificar API nativa da plataforma;
3. avaliar peso e manutenção;
4. justificar a inclusão.

## 29. Testes mínimos
Ao alterar apresentação financeira, cobrir quando aplicável:
- zero, positivo e negativo;
- valor alto e casas decimais;
- `null` e `undefined`;
- loading, empty e error.
Para formulários: obrigatório, inválido, sucesso, falha, duplo clique e cancelamento.
Para datas: hoje, vencido, futuro, virada de mês/ano e timezone quando relevante.

## 30. Validação visual
Se Playwright ou equivalente já existir, validar desktop, mobile, navegação, foco, modal, tabela, filtros, loading, empty, error e console.
Não adicionar infraestrutura E2E pesada para uma mudança pequena sem necessidade.

## 31. Qualidade antes de concluir
Detectar os comandos reais do projeto.
Executar, quando disponíveis:
1. formatter;
2. lint;
3. typecheck;
4. testes relevantes;
5. build.
Não inventar comandos ausentes do projeto.
Não afirmar que teste passou sem executá-lo.

## 32. Revisar o diff
Antes de finalizar:
- revisar arquivos alterados;
- remover código morto;
- confirmar que nenhuma regra financeira mudou acidentalmente;
- confirmar que backend não foi alterado sem necessidade;
- confirmar reutilização de componentes;
- verificar erros e warnings novos.
Manter o diff pequeno e revisável.

## 33. Guardrails
Nunca:
- inventar endpoint, campo, status ou permissão;
- inventar métrica, saldo ou dado financeiro;
- duplicar regra financeira no frontend;
- alterar cálculo sem solicitação;
- alterar banco para corrigir problema visual;
- remover validação por conveniência;
- ocultar erro financeiro relevante;
- expor segredo;
- fazer refatoração ampla não solicitada.

## 34. Formato de trabalho
Antes de implementar uma tarefa de frontend:
```text
Análise
- Tela:
- Fonte dos dados:
- Componentes reutilizáveis:
- Risco:
- Plano:
```
Ao concluir:
```text
Implementado
- ...

Preservado
- regras de negócio;
- APIs;
- cálculos financeiros.

Validação
- lint:
- typecheck:
- testes:
- build:

Pendências
- ...
```

## Regra final
Tratar a interface financeira como parte do mecanismo de controle do produto, não apenas como camada estética.
Quando houver conflito entre uma interface mais bonita e uma interface mais clara, segura, precisa e auditável, escolher a segunda.
