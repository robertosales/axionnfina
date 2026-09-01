# Radar de Investimentos

O Radar apresenta um ranking educacional de títulos públicos compatíveis com as preferências e o contexto financeiro do usuário. Ele não envia ordens e não substitui o suitability da instituição financeira.

## Fontes

- Tesouro Transparente: CSV diário de preços e taxas dos títulos ofertados pelo Tesouro Direto.
- Banco Central do Brasil (SGS): série 1178 para Selic efetiva anualizada e série 433 para IPCA mensal.

O servidor lê somente o bloco mais recente do CSV do Tesouro e cancela o restante do download. O resultado de mercado permanece em cache por seis horas. Se uma atualização falhar, dados anteriores podem ser exibidos como desatualizados; indicadores ausentes nunca são inventados.

## Personalização

O perfil considera tolerância a risco, horizonte, liquidez e objetivo. O contexto calculado usa:

- saldo positivo de contas correntes e poupanças;
- média das despesas dos últimos 90 dias;
- prazo da meta ativa mais próxima.

Cada título recebe pontos separados por risco, prazo, liquidez, objetivo, estrutura de pagamentos e, quando aplicável, cobertura da reserva. A interface expõe todas essas evidências e alertas de marcação a mercado.

## Simulador de aporte

O simulador transforma as oportunidades elegíveis em uma distribuição de até três títulos. As projeções usam cenários cauteloso, de referência e favorável, com IR regressivo aproximado e custódia ponderada. A estimativa considera a isenção geral de custódia do Tesouro Selic até R$ 10 mil e as regras de vencimento de RendA+ e Educa+, mas não substitui o cálculo da instituição. Cada versão pode ser salva, editada, arquivada, restaurada ou excluída.

## Acompanhamento e alertas

Um plano salvo pode ser comparado com as posições atuais da carteira. O motor associa ativos por nome ou ticker, mede o desvio total e sugere como distribuir o próximo aporte entre alocações abaixo da meta. Ativos não reconhecidos ficam destacados; nenhuma venda ou ordem é executada automaticamente.

As preferências controlam a nota mínima do Radar, a variação relevante de pontuação e o desvio mínimo do plano. Cada avaliação cria no máximo um registro por usuário, plano e dia, evitando alertas duplicados. Os alertas aparecem em Insights e seguem o mesmo ciclo de arquivamento dos demais registros.

### Agendamento diário

Configure `INVESTMENT_RADAR_CRON_SECRET` apenas no servidor e agende uma requisição `POST` para `/api/investment-radar-daily` com o cabeçalho `Authorization: Bearer <segredo>`. A rota também aceita o token de sessão de um usuário para o botão **Atualizar análise**, mas nesse modo processa somente o próprio usuário.

```text
POST https://seu-dominio/api/investment-radar-daily
Authorization: Bearer $INVESTMENT_RADAR_CRON_SECRET
```

O agendador precisa ter tempo suficiente para consultar as fontes oficiais e processar a base em lotes. A resposta informa quantos usuários foram processados e quais falharam, sem interromper o lote por uma falha individual.

## Limites atuais

O primeiro provedor contém apenas títulos públicos. CDBs, LCIs, LCAs e fundos só devem entrar quando houver uma fonte autorizada que forneça taxa, vencimento, liquidez, custos e emissor de forma verificável.
