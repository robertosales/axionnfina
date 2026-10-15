# Categorias e Tags fora de Configurações

## Proposta

Criar uma página **Categorias e Tags**, com duas abas, acessível pelo grupo **Vida financeira**, imediatamente após **Transações**.

Categorias pertencem à organização cotidiana das finanças, não às preferências do sistema. Reunir categorias e tags mantém essa organização em um único lugar, sem aumentar o número de itens do menu.

## Situação verificada

- Configurações contém o cadastro de categorias, com criação, renomeação e arquivamento; as categorias do sistema não oferecem edição ou arquivamento.
- A página Tags oferece pesquisa, quantidade de lançamentos, soma dos valores, renomeação, mesclagem e exclusão da tag sem apagar os lançamentos.
- O menu já possui Tags no grupo Vida financeira.

## O que será alterado

1. **Página Categorias e Tags**
   - Abrir inicialmente na aba **Categorias**.
   - Transferir o gerenciamento atual de categorias para essa aba, preservando os tipos Receita, Despesa e Transferência e as restrições das categorias do sistema.
   - Disponibilizar **Tags** na segunda aba, mantendo pesquisa, valores, contagens, ações e confirmações atuais.
   - Manter o padrão visual do projeto, com estados de carregamento, erro e ausência de dados.

2. **Navegação**
   - Substituir o item Tags por **Categorias e Tags**, próximo de Transações, tanto no menu lateral quanto no menu do celular.
   - Incluir acesso pela busca global, encontrável pelos termos Categorias e Tags.
   - Manter os acessos antigos a Tags funcionando e abrindo diretamente a aba Tags.

3. **Configurações**
   - Remover apenas a seção de categorias e o código exclusivo dela.
   - Preservar contas bancárias, integrações, consentimentos e privacidade, sem reorganizações adicionais.

## Escopo preservado

- Nenhuma alteração no banco, nas regras de categorização automática, nos cálculos ou na importação de extratos.
- Categorias e tags existentes permanecem intactas e continuam disponíveis em transações, orçamentos e relatórios.
- Não adicionar subcategorias, cores, ícones personalizados ou novas regras de exclusão nesta entrega.

## Detalhes técnicos

- Criar a página autenticada `/categories`, com a aba selecionada na URL (`tab=categories` ou `tab=tags`).
- Extrair os gerenciamentos de categorias e tags em componentes independentes, usando as consultas e operações existentes; compartilhar um único AppShell.
- Preservar `/tags` como redirecionamento para `/categories?tab=tags`.
- Atualizar AppShell e CommandPalette; definir título e metadados próprios para a nova página.
- Registrar a decisão de organização no AGENTS.md durante a implementação.

## Validação

- Conferir navegação, alternância das abas, recarregamento e acesso pelo endereço antigo de Tags.
- Em sessão autenticada, criar e renomear uma categoria de teste, verificar sua disponibilidade em Transações e arquivá-la.
- Verificar as operações de tags com lançamentos de teste, sem modificar os lançamentos reais do usuário.
- Confirmar que Configurações mantém suas demais seções e não exibe o gerenciamento de categorias.
- Verificar apresentação em computador e celular e ausência de erros de compilação e execução.