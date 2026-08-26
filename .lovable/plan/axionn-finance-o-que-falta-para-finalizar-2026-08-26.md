# Axionn Finance — o que falta para finalizar

## Onde estamos

Já pronto: design system OKLCH dark-first, AppShell + sidebar + ⌘K, componentes financeiros (KPI, Chart, Account, Transaction, Budget, Goal), login e-mail/senha + Google, rotas protegidas, e banco real com perfis, contas, transações, orçamentos, metas e insights (isolamento por usuário).

Ainda mockado ou ausente: agente de IA (respostas fixas), investimentos, impostos, contas a pagar/receber, fluxo de caixa, alocação, histórico de patrimônio, Open Finance, memória do agente, auditoria/LGPD e testes.

Observação de stack: o projeto roda em TanStack Start (React + Vite), não Next.js App Router. A lógica de servidor vai em server functions, no lugar de Edge Functions Deno; workers Temporal e mTLS ficam como interfaces simuladas, conforme o próprio objetivo prevê.

## Etapa 1 — Completar o banco

Novas tabelas com as mesmas regras de isolamento por usuário já usadas:
- `institutions` e `transaction_categories` (dados mestres, leitura pública, com carga inicial: 12 bancos/corretoras BR e hierarquia de categorias).
- `investment_positions` (ativo, classe, quantidade, preço médio, preço atual).
- `payables` / `receivables` (descrição, valor, vencimento, status, recorrência, código de barras).
- `tax_events` (operações de ações/FII/dividendos por mês, base para DARF).
- `net_worth_snapshots` (histórico mensal de patrimônio).
- `agent_conversations` e `agent_messages` (histórico do chat persistido).
- `agent_memories` com embeddings (pgvector + índice HNSW) e função de busca semântica.
- `openfinance_consents` (instituição, escopos, status, expiração) e `openfinance_tokens` (valores cifrados).
- `audit_logs` + gatilho de auditoria nas tabelas sensíveis.

Funções no banco: projeção de fluxo de caixa, resumo de IRPF mensal, upsert idempotente de transação e busca de memórias.

## Etapa 2 — Camada compartilhada e dados reais nas páginas

- `src/shared/domain` e `src/shared/api`: enums, entidades e schemas Zod usados por UI e servidor (sem `any`, `type` em vez de `interface`).
- Ampliar `src/lib/finance-data.ts` com hooks para investimentos, contas a pagar/receber, impostos, fluxo de caixa, alocação e patrimônio.
- Trocar os mocks restantes nas páginas Investimentos, Impostos, Contas, Insights e Dashboard.
- Realtime: saldos, transações e mensagens do agente atualizam sozinhos.
- Ampliar o "popular com dados de exemplo" para cobrir as novas tabelas.

## Etapa 3 — CRUD e ações

- Nova transação, edição inline de categoria com atualização otimista, dividir, marcar recorrente, excluir.
- Criar/editar orçamento por categoria e mês; criar/editar metas com contribuição sugerida.
- Cadastro e baixa de contas a pagar/receber; upload de boleto com leitura de linha digitável (validação de dígito verificador; leitura por IA quando o texto não for reconhecido).
- Tabela de transações com ordenação, filtros, paginação e virtualização.

## Etapa 4 — Agente de IA real

- Server function de chat com streaming usando a IA nativa da plataforma (sem chave externa).
- Orquestração: classificar intenção → planejar → executar ferramentas → revisar resposta.
- Ferramentas: consultar transações, saúde do orçamento, projetar fluxo de caixa, prévia de imposto, criar transação manual, criar/atualizar meta, agendar Pix (exige confirmação explícita no chat), buscar e salvar memórias.
- Renderização de tool calls como cards: mini tabela, gráfico interativo e card de confirmação de Pix.
- Categorização automática de transações por IA em lote, com regras brasileiras (MCC, iFood, Pix recebido etc.).
- Guardrails: nenhuma transferência sem confirmação, sem sugestão de evasão fiscal, alerta de risco acima do perfil.
- Limite de uso por usuário (10 msg/min no chat, 30/min em sincronização).

## Etapa 5 — Open Finance (simulado) e privacidade

- Tela de Integrações: lista de instituições, seleção granular de escopos, conectar/renovar/revogar, status do consentimento e último sync.
- Fluxo de autorização e callback simulados em endpoints públicos, estruturados para receber certificados reais depois (PAR, PKCE, client assertion como interface).
- Webhook de revogação: marca consentimento revogado e apaga os dados vinculados.
- Sincronização de transações com paginação e idempotência, contra um provedor simulado.
- Exclusão total da conta e dos dados (direito ao esquecimento), com registro em auditoria.
- Cabeçalhos de segurança (CSP e afins) na resposta do app.

## Etapa 6 — Qualidade e documentação

- Testes unitários (formatação, schemas Zod, cálculo de imposto, dígito verificador de boleto).
- Teste ponta a ponta do caminho crítico: login → conectar banco simulado → sincronizar → categorizar → perguntar ao agente → agendar Pix.
- `docs/adr` com as cinco decisões de arquitetura e README de setup/arquitetura.

## Notas técnicas

- Server functions (`createServerFn`) para lógica interna; rotas `src/routes/api/public/*` para webhook e callback, com verificação de assinatura.
- Chaves de serviço só no servidor; tokens de Open Finance cifrados, nunca em texto puro.
- Toda tabela nova nasce com permissões explícitas e políticas por `auth.uid()`; tabelas mestres com leitura pública e escrita restrita.
- Embeddings e chat via gateway de IA da plataforma, sem chave do usuário.

## Ordem de entrega

Etapas 1–2 primeiro (banco + dados reais em todas as páginas), depois 3 (CRUD), 4 (agente), 5 (Open Finance/LGPD) e 6 (testes/docs). Cada etapa é entregue funcionando antes de passar para a próxima.
