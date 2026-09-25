// Domain types
export * from './types';
export * from './normalizer';
export * from './balance';

// Application services (com injeção de dependência)
export { TransactionService, createTransactionService } from '@/application/transactions';
export type { TransactionServiceConfig, DeduplicationResult } from '@/application/transactions';

// Legacy exports (manter compatibilidade)
export { DeduplicationEngine, deduplicationEngine } from './deduplication';
export { CategorizationEngine, categorizationEngine } from './categorization';
