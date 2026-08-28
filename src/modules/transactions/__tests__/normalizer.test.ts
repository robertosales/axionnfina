import { transactionNormalizer } from '../normalizer';
import { ExternalTransaction } from '../types';

describe('TransactionNormalizer', () => {
  const baseExternal: ExternalTransaction = {
    id: 'ext-1',
    connection_id: 'conn-1',
    account_id: 'acc-1',
    provider: 'pluggy',
    external_id: 'txn-123',
    external_account_id: 'acc-ext-1',
    amount: -150.75,
    currency: 'BRL',
    description: 'UBER *VIAGEM 15/01 SAO PAULO BR',
    merchant_name: 'UBER',
    mcc: '4121',
    posted_at: '2024-01-15T10:30:00Z',
    authorized_at: '2024-01-15T10:25:00Z',
    status: 'settled',
    raw_data: { original: 'data' },
    created_at: '2024-01-15T10:30:00Z',
  };

  it('normalizes amount to 2 decimal places', () => {
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      amount: -150.756,
    });
    expect(result.amount).toBe(-150.76);
  });

  it('cleans description', () => {
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      description: '  UBER   *VIAGEM    15/01  ',
    });
    expect(result.description).toBe('UBER *VIAGEM 15/01');
  });

  it('extracts merchant from merchant_name', () => {
    const result = transactionNormalizer.normalize(baseExternal);
    expect(result.merchant_name).toBe('UBER');
  });

  it('extracts merchant from description when merchant_name is null', () => {
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      merchant_name: null,
      description: 'IFODD PEDIDO 12345 SAO PAULO BR',
    });
    expect(result.merchant_name).toBe('IFODD PEDIDO 12345');
  });

  it('parses dates correctly', () => {
    const result = transactionNormalizer.normalize(baseExternal);
    expect(result.posted_at).toEqual(new Date('2024-01-15T10:30:00Z'));
    expect(result.authorized_at).toEqual(new Date('2024-01-15T10:25:00Z'));
  });

  it('handles missing authorized_at', () => {
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      authorized_at: null,
    });
    expect(result.authorized_at).toBeNull();
  });

  it('preserves MCC', () => {
    const result = transactionNormalizer.normalize(baseExternal);
    expect(result.mcc).toBe('4121');
  });

  it('preserves raw_data', () => {
    const result = transactionNormalizer.normalize(baseExternal);
    expect(result.raw_data).toEqual({ original: 'data' });
  });

  it('handles special characters in description', () => {
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      description: 'PAGAMENTO PIX PARA JOÃO SILVA 🏦',
    });
    expect(result.description).not.toContain('🏦');
  });

  it('truncates long descriptions', () => {
    const longDesc = 'A'.repeat(250);
    const result = transactionNormalizer.normalize({
      ...baseExternal,
      description: longDesc,
    });
    expect(result.description.length).toBeLessThanOrEqual(200);
  });
});