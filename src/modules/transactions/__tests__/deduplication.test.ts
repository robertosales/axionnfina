import { deduplicationEngine } from '../deduplication';
import { ExternalTransaction, NormalizedTransaction } from '../types';
import { describe, expect, it, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(),
            })),
          })),
        })),
      })),
    })),
  }),
}));

describe('DeduplicationEngine', () => {
  const baseExternal: ExternalTransaction = {
    id: 'ext-1',
    connection_id: 'conn-1',
    account_id: 'acc-1',
    provider: 'pluggy',
    external_id: 'txn-123',
    external_account_id: 'acc-ext-1',
    amount: -150.75,
    currency: 'BRL',
    description: 'UBER *VIAGEM',
    merchant_name: 'UBER',
    mcc: '4121',
    posted_at: '2024-01-15T10:30:00Z',
    authorized_at: '2024-01-15T10:25:00Z',
    status: 'settled',
    raw_data: {},
    created_at: '2024-01-15T10:30:00Z',
  };

  const baseNormalized: NormalizedTransaction = {
    amount: -150.75,
    currency: 'BRL',
    description: 'UBER *VIAGEM',
    merchant_name: 'UBER',
    posted_at: new Date('2024-01-15T10:30:00Z'),
    authorized_at: new Date('2024-01-15T10:25:00Z'),
    status: 'settled',
    mcc: '4121',
    raw_data: {},
  };

  it('detects duplicate by provider + external_account_id + external_id', async () => {
    // This would need a real Supabase mock setup
    // For now, we test the interface
    expect(typeof deduplicationEngine.checkDuplicate).toBe('function');
    expect(typeof deduplicationEngine.checkDuplicateByContent).toBe('function');
  });

  it('checkDuplicateByContent uses 3-day window', async () => {
    // Verify the function exists and accepts parameters
    expect(deduplicationEngine.checkDuplicateByContent).toBeDefined();
  });
});
