import { NormalizedTransaction, ExternalTransaction } from './types';

export class TransactionNormalizer {
  normalize(external: ExternalTransaction): NormalizedTransaction {
    return {
      amount: this.normalizeAmount(external.amount, external.currency),
      currency: external.currency || 'BRL',
      description: this.cleanDescription(external.description),
      merchant_name: this.extractMerchant(external.merchant_name, external.description),
      posted_at: new Date(external.posted_at),
      authorized_at: external.authorized_at ? new Date(external.authorized_at) : null,
      status: external.status,
      mcc: external.mcc || null,
      raw_data: external.raw_data || {},
    };
  }

  private normalizeAmount(amount: number, currency: string): number {
    if (currency === 'BRL') {
      return Math.round(amount * 100) / 100;
    }
    return amount;
  }

  private cleanDescription(description: string): string {
    return description
      .replace(/\s+/g, ' ')
      .replace(/[^\p{L}\p{N}\s.,*\-/()]/gu, '')
      .trim()
      .slice(0, 200);
  }

  private extractMerchant(
    merchantName: string | null,
    description: string
  ): string | null {
    if (merchantName?.trim()) {
      return this.cleanDescription(merchantName).slice(0, 100);
    }

    const patterns = [
      /^(.+?\d+)(?:\s+[A-Z]{2,})+\s+BR$/i,
      /^([A-Z0-9\s.]+?)\s+\d{2}\/\d{2}/,
      /^([A-Z0-9\s.]+?)\s+BR\s+/i,
      /^([A-Z0-9\s.]+?)\s+\d{4}/,
      /^([A-Z]{3,}\s*[A-Z]*)/,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match?.[1]?.trim()) {
        return this.cleanDescription(match[1]).slice(0, 100);
      }
    }

    return null;
  }
}

export const transactionNormalizer = new TransactionNormalizer();
