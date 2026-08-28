const encoder = new TextEncoder();

async function digest(value: string): Promise<Uint8Array> {
  const result = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return new Uint8Array(result);
}

/** Compara o segredo configurado no header customizado sem early return por byte. */
export async function verifyWebhookSecret(
  provided: string | null,
  expected: string | null,
): Promise<boolean> {
  if (!provided || !expected) return false;

  const [providedHash, expectedHash] = await Promise.all([digest(provided), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < expectedHash.length; index += 1) {
    difference |= providedHash[index]! ^ expectedHash[index]!;
  }
  return difference === 0;
}

export function readWebhookSecret(headers: Headers): string | null {
  const customHeader = headers.get("x-axionn-webhook-secret");
  if (customHeader) return customHeader;

  const authorization = headers.get("authorization");
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : null;
}
