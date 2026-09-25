/**
 * Utilitários para sanitização de queries de busca.
 * Previne bypass via wildcards em queries ILIKE/ILIKE.
 */

/**
 * Escapa caracteres especiais de LIKE/ILIKE para uso seguro em queries.
 * Caracteres perigosos: % (qualquer sequência), _ (qualquer caractere), \ (escape).
 *
 * @example
 * sanitizeLikePattern("foo%bar") // "foo\\%bar"
 * sanitizeLikePattern("foo_bar") // "foo\\_bar"
 */
export function sanitizeLikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Sanitiza e limita o tamanho de um padrão de busca para queries ILIKE.
 * Útil para buscas de texto em transações.
 *
 * @param query - Texto do usuário
 * @param maxLength - Tamanho máximo (padrão: 50)
 * @returns Padrão sanitizado entre %%
 */
export function safeIlikePattern(query: string, maxLength = 50): string {
  const sanitized = sanitizeLikePattern(query.slice(0, maxLength).trim());
  return `%${sanitized}%`;
}
