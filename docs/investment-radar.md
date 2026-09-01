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

O valor usado na mesa privada e a validade da conferência também ficam salvos nas preferências. Uma oferta vencida continua visível para revisão, mas perde a elegibilidade e não gera insight diário. O histórico registra separadamente o primeiro título público e a primeira oferta privada, permitindo detectar mudança de líder sem repetir o mesmo alerta.

Posições de renda fixa podem guardar produto, instituição, conglomerado, vencimento e elegibilidade ao FGC. A faixa de cobertura soma o valor atual dos produtos elegíveis por conglomerado e pode acrescentar o aporte simulado da mesa privada. O estado muda para atenção a partir de 80% de R$ 250 mil e para excedido acima da referência. Posições sem conglomerado ficam fora da soma e são apresentadas como pendência cadastral.

### Agendamento diário

Configure `INVESTMENT_RADAR_CRON_SECRET` apenas no servidor e agende uma requisição `POST` para `/api/investment-radar-daily` com o cabeçalho `Authorization: Bearer <segredo>`. A rota também aceita o token de sessão de um usuário para o botão **Atualizar análise**, mas nesse modo processa somente o próprio usuário.

```text
POST https://seu-dominio/api/investment-radar-daily
Authorization: Bearer $INVESTMENT_RADAR_CRON_SECRET
```

O agendador precisa ter tempo suficiente para consultar as fontes oficiais e processar a base em lotes. A resposta informa quantos usuários foram processados e quais falharam, sem interromper o lote por uma falha individual.

## Ofertas privadas

A mesa comparadora aceita ofertas de CDB, LCI e LCA conferidas pelo usuário. Cada registro guarda instituição, conglomerado, taxa, índice de referência, liquidez, vencimento, aplicação mínima, origem e data da conferência. O ranking compara retorno líquido estimado, compatibilidade de prazo, liquidez e proteção, sem tratar taxas digitadas como cotações oficiais.

- CDB usa a tabela regressiva de IR sobre o rendimento: 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 dias.
- LCI e LCA são tratadas como isentas para pessoa física conforme as regras consultadas para o exercício de 2026.
- A interface alerta quando o valor comparado supera R$ 250 mil. O limite deve considerar o total de produtos elegíveis por instituição ou conglomerado, além do teto global vigente do FGC.

Fontes de referência: [Receita Federal — Perguntas e respostas IRPF 2026](https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/dirpf/p-r-irpf-2026-v1-00-2026-04-23.pdf) e [FGC — Sobre a garantia](https://fgc.org.br/sobre-garantia-fgc).

Os schemas dessa área estão em `20260901010000_private_fixed_income_offers.sql`, `20260901020000_private_offer_monitoring.sql` e `20260901030000_investment_position_fgc_metadata.sql`; devem ser aplicados nessa ordem pelo Lovable. Não executar alterações remotas com a CLI do Supabase neste projeto.

## Limites atuais

O provedor automático contém apenas títulos públicos. CDBs, LCIs e LCAs entram somente como ofertas conferidas e datadas pelo usuário; não existe coleta automática dessas taxas nesta fase. Fundos só devem entrar quando houver fonte autorizada que forneça carteira, taxa, liquidez, custos e administrador de forma verificável.
