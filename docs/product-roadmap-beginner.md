# AxionnFina — roadmap orientado a iniciantes

## Visão do produto

O AxionnFina deve conduzir uma pessoa da organização financeira ao primeiro investimento sem exigir conhecimento prévio. A jornada principal é:

`Organizar → Economizar → Proteger → Investir → Acompanhar`

O sistema calcula com regras determinísticas e usa IA apenas para compreender perguntas e explicar resultados. Nenhuma ordem, pagamento ou investimento é executado sem confirmação e integração autorizada.

## Fase 0 — IA sustentável e privada

Status: implementada no código; ativação em produção depende da configuração das credenciais do Cloudflare Workers AI.

- Tornar o provedor de IA configurável no servidor.
- Usar Cloudflare Workers AI como padrão, dentro da franquia disponível.
- Não fazer fallback automático para um provedor pago.
- Manter o Lovable AI apenas como rollback explícito por configuração.
- Limitar mensagens, tamanho do contexto, etapas e saída do modelo.
- Enviar resultados financeiros agregados sempre que o detalhe não for necessário.
- Aplicar limite de requisições por usuário e tratar esgotamento de cota sem quebrar o restante do produto.
- Exibir ao usuário que cálculos são feitos pelo AxionnFina e a IA apenas explica os resultados.

Critério de saída: o chat funciona com `AI_PROVIDER=cloudflare`, não consome Lovable AI e falha de forma controlada quando a configuração ou cota estiver indisponível.

## Fase 1 — Seu próximo passo financeiro

Status: primeira entrega implementada no Dashboard.

- Criar um motor de prontidão financeira baseado em renda, gastos, contas, dívidas, liquidez, reserva e metas.
- Priorizar organização, redução de gastos, quitação de dívida e reserva antes de investimentos de maior prazo.
- Calcular uma sobra mensal conservadora e explicar sua composição.
- Apresentar uma única ação prioritária no Dashboard.
- Informar confiança da análise conforme quantidade, atualidade e qualidade dos dados.

Entregue na primeira versão:

- Motor determinístico com prioridade para contas atrasadas, histórico insuficiente, fluxo negativo, dívida de cartão, reserva, metas e investimentos.
- Reserva inicial calculada com base conservadora de três meses da média de despesas, sempre explicada como ajustável.
- Uma ação principal no Dashboard, com justificativa, valor sugerido quando aplicável e indicador de confiança.
- Jornada visual `Organizar → Economizar → Proteger → Investir → Acompanhar` e estados responsivos.
- Testes unitários cobrindo os sete caminhos de decisão.

Próximo incremento da fase:

- Permitir que o usuário ajuste a quantidade desejada de meses da reserva.
- Registrar a ação aceita ou ignorada para medir evolução sem executar movimentações automaticamente.

Critério de saída: todo usuário recebe um próximo passo compreensível e justificável, mesmo sem investimentos cadastrados.

## Fase 2 — Plano automático de economia

Status: implementada no código; a migration `20260901050000_savings_plans.sql` precisa ser aplicada antes da publicação.

- Detectar assinaturas, recorrências, aumentos por categoria e gastos fora do padrão.
- Transformar oportunidades em metas mensais acompanháveis.
- Persistir insights financeiros gerais com idempotência diária ou semanal.
- Medir economia realizada, sem tratar toda redução como automaticamente sustentável.

Entregue:

- Detecção determinística de assinaturas, pagamentos recorrentes, categorias em alta e gastos individuais fora do padrão.
- Análise sempre baseada no último mês completo, evitando conclusões com o mês atual ainda parcial.
- Persistência idempotente por chave de oportunidade, com RLS e separação dos insights de investimento.
- Detecção diária no servidor, incorporada ao agendamento protegido já usado pelo Radar.
- Fluxo `Detectado → Aceito → Em acompanhamento → Concluído`, sem cancelamentos ou movimentações automáticas.
- Registro mensal confirmado pelo usuário; somente essa confirmação conta como economia realizada.
- Painel responsivo em Insights com meta mensal aceita, economia confirmada, evidências e estados de carregamento, vazio e erro.
- Correção do agrupamento mensal do detector anterior de anomalias.

Próximo incremento:

- Adicionar lembretes configuráveis para planos sem registro mensal.

Critério de saída: o usuário consegue sair de um insight para uma ação e acompanhar o resultado.

## Fase 3 — Carteira automática

- Conectar o suporte de investimentos do provedor ao fluxo Open Finance realmente usado pelo app.
- Normalizar e persistir posições, saldos, vencimentos e movimentações com idempotência.
- Oferecer importação por CSV/PDF com revisão antes de salvar.
- Manter cadastro manual simplificado somente como alternativa.

Critério de saída: uma carteira conectada aparece sem exigir ticker, preço médio ou metadados técnicos do iniciante.

## Fase 4 — Primeiro investimento guiado

- Coletar objetivo, prazo, necessidade de liquidez, tolerância a oscilações e conhecimento.
- Verificar reserva e compromissos antes de apresentar produtos.
- Mostrar no máximo três caminhos educacionais com motivo, risco, liquidez, custos e fonte.
- Manter detalhes técnicos em uma segunda camada da interface.
- Usar linguagem de adequação educacional, sujeita a revisão regulatória, sem prometer o “melhor investimento”.

Critério de saída: um iniciante entende por que uma opção apareceu e o que pode dar errado antes de decidir.

## Fase 5 — Comparação ampliada

- Manter Tesouro Direto e indicadores em fontes oficiais.
- Integrar ofertas privadas somente por fonte autorizada, verificável e datada.
- Comparar custos, tributação, liquidez, risco e cobertura sem inventar cotações.
- Avaliar parceria ou enquadramento regulatório antes de recomendações individualizadas comerciais.

Critério de saída: toda opção comparada possui origem, data, escopo e limitações visíveis.

## Fase 6 — Confiança e produção

- Remover dados demonstrativos residuais dos fluxos reais.
- Corrigir o score de saúde financeira e suas métricas.
- Validar RLS, importação sem duplicidade e jornada E2E com dois usuários.
- Adicionar observabilidade, limites de custo, runbooks e testes responsivos autenticados.

Critério de saída: dados reais são distinguíveis de exemplos, cálculos são auditáveis e falhas são recuperáveis.
