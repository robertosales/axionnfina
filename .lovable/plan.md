# Melhoria visual do Axionn Finance

## Direção aprovada

Evoluir o produto inteiro a partir da direção **Modern slate dashboard**, preservando a identidade do Axionn Finance:

- fundo grafite profundo e superfícies grafite elevadas;
- violeta como cor principal da marca e das ações;
- verde, amarelo e vermelho reservados a estados financeiros;
- títulos e valores em **Space Grotesk**; textos e controles em **DM Sans**;
- menu lateral estável, conteúdo arejado e cartões mais compactos;
- bordas finas, sombras discretas e cantos menores, próximos de 8 px;
- nenhuma cópia de marca, conteúdo ou elementos proprietários do site de referência.

## O que será melhorado

### 1. Base visual e consistência

- Revisar os tokens de fundo, superfícies, bordas, texto, violeta, estados financeiros e elevação nos temas escuro e claro.
- Trocar a tipografia global e ajustar hierarquia de títulos, rótulos, números e textos auxiliares.
- Reduzir o excesso de arredondamento e sombra, aumentando a separação por contraste e bordas.
- Uniformizar espaçamentos, alturas de controles, foco visível e transições discretas.

### 2. Estrutura principal

- Refinar o menu lateral com seleção violeta mais nítida, grupos mais legíveis e menor ruído visual.
- Tornar o cabeçalho superior mais compacto e integrado ao conteúdo.
- Melhorar busca, perfil, alternância de tema e botão de novo lançamento sem mudar suas funções.
- Preservar o comportamento recolhível no desktop e a navegação inferior no celular.

### 3. Componentes compartilhados

- Atualizar cartões, botões, campos, seletores, abas, diálogos, tabelas e etiquetas para a nova linguagem.
- Criar uma hierarquia consistente entre cartão principal, cartão de apoio, linha de lista e aviso.
- Destacar valores financeiros e facilitar a leitura de receitas, despesas, alertas e estados vazios.
- Aplicar estados de interação discretos e acessíveis, sem animações contínuas.

### 4. Visão geral

- Manter a organização já aprovada: quatro indicadores, patrimônio, insights, próximo passo e duas colunas inferiores.
- Dar aos indicadores formato mais compacto e leitura mais rápida, com cor semântica sem dominar o cartão.
- Reforçar o patrimônio como área principal, com gráfico mais limpo e controles de período melhor integrados.
- Tratar os insights do agente com violeta de marca, distinguindo-os de alertas comuns.
- Refinar fluxo de caixa, próximas contas, orçamento, transações, saúde financeira, metas e investimentos com a mesma linguagem visual.

### 5. Telas financeiras

- **Transações e lançamentos:** filtros mais organizados, tabela/lista mais legível e formulário com seleção clara entre gasto, receita e transferência.
- **Contas e carteira:** saldos, origem e sincronização com melhor hierarquia; instituições em linhas compactas.
- **Orçamento e metas:** progresso e limites com barras mais precisas e cores semânticas consistentes.
- **Investimentos e Radar:** organizar blocos densos, abas e comparações; manter o violeta para inteligência e as cores de risco para decisões.
- **Relatórios, contas, impostos e configurações:** aplicar a mesma estrutura de cabeçalho, conteúdo, formulários e estados.
- **Agente e insights:** preservar o destaque da IA sem transformar toda a interface em uma única cor.

### 6. Adaptação para celular

- Reorganizar cartões em uma coluna, mantendo valores e ações sem cortes.
- Compactar cabeçalhos, filtros e formulários sem reduzir áreas de toque.
- Garantir que tabelas extensas tenham uma apresentação móvel legível.
- Manter a criação de lançamento rápida e visível, inspirada na clareza da referência móvel.

## Arquivos principais

- `src/styles.css`: paleta, tipografia, raios, bordas, sombras e estados globais.
- `src/routes/__root.tsx`: carregamento das novas fontes.
- `src/components/layout/AppShell.tsx`: menu, cabeçalho e navegação móvel.
- `src/components/ui/card.tsx`, `button.tsx`, `input.tsx`, `select.tsx`, `tabs.tsx`, `dialog.tsx`, `data-table.tsx` e `textarea.tsx`: base visual reutilizável.
- Componentes em `src/components/finance/`: cartões, gráficos, listas, indicadores e formulários financeiros.
- Telas em `src/routes/_authenticated/`: aplicação consistente da nova linguagem, sem alterar rotas ou regras.

## Limites

- Não alterar banco, autenticação, integrações, cálculos, consultas, nomes de dados ou regras financeiras.
- Não remover informações ou funcionalidades existentes.
- Não transformar a interface em cópia do Minhas Economias.
- Não substituir o violeta da marca por verde; verde continuará indicando resultado favorável ou confirmação.
- As imagens enviadas serão referência visual, não conteúdo incorporado ao produto.

## Ordem de execução

1. Aplicar tokens, fontes e componentes-base.
2. Refinar menu, cabeçalho e navegação móvel.
3. Implementar a Visão geral como padrão visual de referência.
4. Propagar o padrão pelas telas financeiras e formulários.
5. Revisar temas claro e escuro, desktop e celular.
6. Validar navegação, diálogos, formulários, tabelas, gráficos e ausência de regressões.

## Critérios de aceite

- A interface tem contraste e organização semelhantes às referências, mas identidade própria em grafite e violeta.
- Títulos, números, estados e ações são distinguíveis em poucos segundos.
- Todos os fluxos atuais continuam funcionando sem mudança de dados.
- Nenhum texto, botão ou gráfico se sobrepõe ou fica cortado em desktop e celular.
- Temas claro e escuro preservam contraste acessível.
- O projeto conclui a verificação técnica sem erros e as telas principais são conferidas visualmente nos dois formatos.
