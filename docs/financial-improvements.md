# Melhorias financeiras

## Saldo

- Receitas efetivadas usam valor positivo.
- Despesas efetivadas usam valor negativo.
- Lançamentos pendentes, cancelados, falhos e estornados não alteram saldo.
- Edição primeiro reverte o delta anterior e depois aplica o novo delta.
- Exclusão reverte o delta do lançamento.
- Transações `open_finance` não alteram novamente o saldo: o saldo sincronizado da instituição é a fonte autoritativa.
- Transferências internas reduzem a origem e aumentam o destino; o patrimônio total permanece igual.

## Categorias

Categorias do sistema são somente leitura. Categorias personalizadas pertencem ao usuário, respeitam o tipo `income` ou `expense`, têm nome único por tipo e são arquivadas quando deixam de ser usadas.

## Importações

- CSV de extrato: colunas aceitas `data/date`, `descricao/description/historico` e `valor/amount/value`.
- XML de extrato: o parser procura nós de data, descrição e valor em cada transação.
- Limite de arquivo: 10 MB para documentos; 5 MB no fluxo legado CSV.
- Toda importação mostra prévia antes da confirmação.
- Chaves de extrato usam conta, data, valor e descrição para impedir reenvio duplicado.
- Faturas usam cartão, data, valor, estabelecimento e parcela para deduplicação.
- PDF textual é validado por assinatura e tamanho, extraído server-side e convertido em linhas para prévia.
- PDFs escaneados exigem OCR server-side; não são gravados sem texto extraído.

## Integração bancária

Conexões ativas ou pendentes são únicas por usuário e instituição. Segredos e tokens ficam no provedor; a aplicação registra apenas identificadores técnicos, códigos de erro e horários para diagnóstico.

## Testes

Os testes unitários cobrem deltas de saldo, parser CSV, parser XML, parcelas de fatura e validação de PDF. A homologação deve validar persistência após novo login, reenvio do mesmo arquivo, transferências internas e telas em 320 px.
