import { categorizationEngine } from '@/modules/transactions/categorization';

let initialized = false;

export async function initializeCategorization(): Promise<void> {
  if (initialized) return;
  try {
    await categorizationEngine.initialize();
    initialized = true;
    console.log('Categorization engine initialized');
  } catch (error) {
    console.error('Failed to initialize categorization engine:', error);
  }
}

// Initialize on module load (server-side only)
if (typeof window === 'undefined') {
  initializeCategorization();
}