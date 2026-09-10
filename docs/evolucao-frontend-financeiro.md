# Evolução do frontend financeiro

## Entrega

- Entrada monetária compartilhada: formato brasileiro, rejeição de entrada inválida, zero explícito e erros associados ao campo. Datas de cadastro usam calendário local.
- Formulários financeiros com validação nativa, envio por Enter, proteção de eventos repetidos e preservação dos dados após falha.
- Confirmação contextual de edições financeiras e da baixa de contas. A baixa é apresentada como registro, sem sugerir transferência bancária.
- Transações consultadas em lotes, com paginação visual. Busca, conta, categoria, tipo e período usam a mesma seleção para total e exportação.
- Tabela semântica, ordenação por teclado, detalhes junto à linha, valores alinhados à direita, datas completas e tipos traduzidos.
- Importação com processamento e falha explícitos; CSV com campos escapados e proteção contra fórmulas em texto.
- Estados de consulta nas telas principais, distinguindo falha, carregamento e ausência de dados.
- Navegação para contas a pagar e receber, relatórios e conferência de saldos.
- Relatório mensal baseado no fluxo de caixa existente, com período e exportação.
- Conferência de saldos baseada exclusivamente na view existente `account_reconciliation`.
- Hooks separados em `src/lib/finance/`, mantendo `finance-data.ts` como fachada compatível. Tipos de produção em `src/shared/finance-types.ts`. Gráficos do dashboard extraídos em componente próprio.

## Limites e dependências da expansão

### Conferência e conciliação

A view existente compara saldo informado com movimentos contábeis. Sua diferença inclui saldo inicial; não é um status de conciliação. A interface não marca registros como conciliados nem associa movimentos por similaridade.

A implementação da view consta de `supabase/migrations/20260910110000_atomic_transaction_ledger.sql`. A execução dessa migration e as políticas de acesso não foram validadas no Supabase nesta entrega.

Se a tela retornar erro, solicitar pelo Lovable: verificar se essa migration já foi aplicada e se o usuário autenticado pode consultar a view; devolver o resultado da verificação. Não executar novamente a migration sem conferir o histórico. Não são necessárias credenciais para o trabalho local.

Para conciliação transacional futura, é necessário confirmar o contrato real de movimentos externos, seus identificadores, associação com lançamentos internos, permissões, histórico e operações de conciliar/desconciliar. Só então implementar ações contextuais na interface.

### Centros de custo

Não há contrato de centros de custo nos tipos e rotas inspecionados. O próximo incremento deve definir pelo Lovable: entidade e vínculo com lançamentos, isolamento por usuário, ciclo de vida, histórico e tratamento dos registros sem centro de custo. Depois da execução e retorno dos tipos, adicionar seletor ao formulário, filtro e agrupamento aos relatórios. Não foram criados campos fictícios nem armazenamento paralelo no navegador.

### Precisão e contratos

Os contratos continuam usando números e os cálculos de negócio existentes foram preservados. O parser valida a entrada; não constitui migração do domínio para Decimal. Qualquer mudança de representação monetária deve abranger backend, persistência e contratos em uma tarefa própria.

### Validação

Os testes E2E usam respostas controladas; não validam execução contra o Supabase de produção. A suíte unitária completa apresentou duas falhas preexistentes em `ai-provider.server.test.ts`: expectativas de Cloudflare divergem do comportamento Lovable/fallback já versionado. Esses arquivos não foram alterados nesta entrega.

Resultados locais em 10/09/2026:

- Prettier aplicado aos arquivos alterados.
- TypeScript e build de produção concluídos com sucesso.
- ESLint: zero erros e seis avisos preexistentes de Fast Refresh nos componentes de UI.
- Playwright: 22 testes passaram, incluindo desktop/mobile, cadastro, bloqueio de envio repetido, falha de gravação, confirmação/cancelamento da baixa, paginação, exportação e erros de consulta.
- Vitest completo: 153 testes passaram e dois testes preexistentes do provedor de IA falharam, conforme descrito acima.
- Verificação final direcionada a entrada monetária, datas, CSV e importadores: 44 testes passaram.
- Capturas de Transações, Contas e Relatórios revisadas visualmente; testes de largura incluem também Metas, Orçamento e Conferência de saldos.

A sincronização Git é informada no encerramento da tarefa.
