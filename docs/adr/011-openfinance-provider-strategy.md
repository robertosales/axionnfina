# ADR-011: Open Finance Provider Strategy

## Status

Accepted

## Context

O Axionn Finance precisa integrar com instituições financeiras brasileiras via Open Finance para importar contas, saldos, transações e investimentos.

Existem duas abordagens principais:

1. **Participação direta** — Registrar-se como participante no ecossistema Open Finance Brasil
2. **Provider intermediário** — Utilizar um fornecedor que já opera dentro do ecossistema

## Decision

Utilizar um **provider intermediário** (Pluggy ou Belvo) para a primeira versão, mantendo uma abstração `OpenFinanceProvider` que permita trocar providers ou migrar para participação direta no futuro.

## Rationale

### Participação direta exige:

- Instituição elegível/autorizada
- Participação no Diretório Open Finance
- Gestão de identidade organizacional
- Aplicações registradas
- Certificados digitais (mTLS, JWS)
- Autenticação FAPI
- Certificação de segurança
- Certificação funcional
- Operação regulatória contínua
- Monitoramento e compliance

### Provider intermediário oferece:

- Acesso imediato a múltiplas instituições
- Sandbox para desenvolvimento
- Gestão de consentimento e tokens
- Webhooks prontos
- SLA de disponibilidade
- Suporte técnico
- Conformidade regulatória por parte do provider

###trade-off:

- Dependência de terceiro
- Custo por conexão/requisição
- Limitação de funcionalidades disponíveis
- Latência adicional

## Consequences

### Positivas

- MVP entregue em semanas, não meses
- Sem custo de certificação inicial
- Sem manutenção de conformidade regulatória
- Foco no produto, não na infraestrutura

### Negativas

- Custo operacional recorrente
- Dependência da roadmap do provider
- Limitação de escopos disponíveis
- Necessidade de migrar.provider se o provider mudar

## Abstração

```typescript
interface OpenFinanceProvider {
  connectInstitution(input: ConnectInstitutionInput): Promise<ConnectInstitutionResult>;
  getAccounts(connectionId: string): Promise<ExternalAccount[]>;
  getBalances(connectionId: string): Promise<ExternalBalance[]>;
  getTransactions(input: GetTransactionsInput): Promise<ExternalTransaction[]>;
  revokeConnection(connectionId: string): Promise<void>;
  syncConnection(connectionId: string): Promise<SyncResult>;
}
```

## Futuro

Quando o Axionn atingir volume suficiente e business case para participação direta:

1. Criar `DirectOpenFinanceAdapter`
2. Implementar mTLS, JWS, FAPI
3. Obter certificação de segurança
4. Obter certificação funcional
5. Registrar no Diretório Open Finance
6. Migrar gradualmente do provider intermediário

## References

- Open Finance Brasil: https://openfinancebrasil.org.br/
- Pluggy API: https://docs.pluggy.ai/
- Belvo API: https://developers.belvo.com/
