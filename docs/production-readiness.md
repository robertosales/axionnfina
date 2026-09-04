# AxionnFina — produção, segurança e recuperação

Este documento é o runbook operacional da Fase 6. Ele não substitui backup, observabilidade e
procedimentos da infraestrutura onde o aplicativo for publicado.

## Ordem de publicação

1. Criar um backup verificável do banco e registrar a migration atualmente aplicada.
2. Aplicar `20260904000000_production_hardening.sql`.
3. Regenerar os tipos Supabase e confirmar que não há diferença sem revisão.
4. Configurar todos os secrets listados em `.env.example`; nenhum secret pode usar prefixo `VITE_`.
5. Publicar a aplicação e consultar `GET /api/health`.
6. Executar o roteiro de isolamento com dois usuários abaixo.
7. Testar conexão, sincronização e revogação Pluggy em sandbox.
8. Liberar usuários gradualmente e acompanhar taxa de erros, latência e falhas de sincronização.

`/api/health` nunca retorna valores de configuração. O estado `degraded` ou HTTP 503 impede que uma
publicação seja considerada pronta.

## Validação de isolamento com dois usuários

Use duas contas exclusivas de homologação, A e B. Não use contas pessoais.

1. A cria uma conta, transação, meta, plano de economia, posição, oferta privada e avaliação guiada.
2. B cria registros equivalentes.
3. Com a sessão de A, tente selecionar, atualizar, arquivar e excluir cada ID pertencente a B.
4. Repita de B contra A.
5. Todas as leituras devem retornar zero linhas e todas as mutações devem afetar zero linhas ou falhar.
6. Reimporte o mesmo CSV duas vezes para A. A segunda execução deve atualizar a posição equivalente,
   sem aumentar a quantidade de posições.
7. Confirme que nenhuma resposta, log ou mensagem de erro contém token, cookie, número de conta ou
   dados do outro usuário.

Registre data, ambiente, executor, IDs sintéticos utilizados e resultado. Falha de isolamento bloqueia
a publicação.

## Indicadores e alertas mínimos

- HTTP 5xx por rota e versão publicada.
- Latência p50, p95 e p99.
- Respostas 429 do chat por minuto e por dia.
- Falhas e duração das sincronizações Open Finance.
- Webhooks rejeitados, duplicados e com replay.
- Divergência entre saldo financeiro e ledger.
- Erros do cron de Radar e plano de economia.

Cada resposta inclui `x-request-id`. Pesquise esse valor nos logs estruturados para reconstruir uma
falha sem registrar tokens ou payloads financeiros brutos.

## Resposta a incidentes

### Sincronização duplicada ou saldo divergente

1. Pause o processamento do conector afetado.
2. Preserve eventos brutos e logs; não apague lançamentos.
3. Identifique a primeira divergência pelas chaves externas e de idempotência.
4. Reprocesse em homologação e compare contagens e saldos.
5. Corrija por reversão ou reconciliação auditável.

### Suspeita de acesso entre usuários

1. Bloqueie imediatamente a rota ou operação afetada.
2. Preserve logs e eventos de segurança.
3. Revogue sessões potencialmente expostas.
4. Identifique tabelas, usuários, intervalo e campos envolvidos.
5. Só reative depois de teste de RLS com dois usuários.

### Custo ou cota de IA

1. Reduza `AI_DAILY_REQUEST_LIMIT` dentro da faixa de 1 a 1000.
2. Não habilite fallback pago automaticamente.
3. Verifique respostas 429 e consumo no provedor.
4. O restante do produto deve permanecer disponível quando a IA estiver pausada.

## Rollback

Prefira corrigir com uma migration aditiva. Não reescreva histórico já publicado. Se a aplicação nova
falhar, publique novamente a última versão estável mantendo a migration aditiva: a tabela de uso de IA
é isolada e não altera registros financeiros. Caso seja indispensável revertê-la, primeiro interrompa o
chat e preserve `ai_daily_usage` para auditoria.
