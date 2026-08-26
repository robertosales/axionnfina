/**
 * Leitura de boleto bancário a partir da linha digitável (47 dígitos).
 *
 * A linha digitável de um boleto de cobrança tem 5 campos. Deles extraímos:
 *  - fator de vencimento (posições 34-37 do código de barras) → data
 *  - valor (posições 38-47 do código de barras, em centavos)
 * Os dígitos verificadores dos campos 1 a 3 usam módulo 10; o DV geral do
 * código de barras usa módulo 11.
 */

export type BoletoParseResult = {
  valid: boolean;
  amount: number;
  dueDate: string | null;
  barcode: string;
  error?: string;
};

/** Base do fator de vencimento definida pela FEBRABAN: 07/10/1997. */
const FACTOR_BASE = Date.UTC(1997, 9, 7);

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Dígito verificador módulo 10 (campos 1 a 3 da linha digitável). */
export function mod10(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i -= 1) {
    const product = Number(block[i]) * weight;
    sum += product > 9 ? product - 9 : product;
    weight = weight === 2 ? 1 : 2;
  }
  return (10 - (sum % 10)) % 10;
}

/** Dígito verificador módulo 11 (DV geral do código de barras). */
export function mod11(block: string): number {
  let sum = 0;
  let weight = 2;
  for (let i = block.length - 1; i >= 0; i -= 1) {
    sum += Number(block[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const rest = sum % 11;
  const dv = 11 - rest;
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/** Converte a linha digitável (47 dígitos) no código de barras (44 dígitos). */
export function digitableLineToBarcode(line: string): string | null {
  const digits = onlyDigits(line);
  if (digits.length !== 47) return null;
  const bank = digits.slice(0, 4);
  const currency = digits.slice(4, 5);
  const field1 = digits.slice(5, 9);
  const field2 = digits.slice(10, 20);
  const field3 = digits.slice(21, 31);
  const dv = digits.slice(32, 33);
  const factorAndValue = digits.slice(33, 47);
  return `${bank}${currency}${dv}${factorAndValue}${field1}${field2}${field3}`;
}

export function parseDigitableLine(line: string): BoletoParseResult {
  const digits = onlyDigits(line);
  const empty: BoletoParseResult = { valid: false, amount: 0, dueDate: null, barcode: "" };

  if (digits.length !== 47) {
    return { ...empty, error: "A linha digitável deve ter 47 dígitos." };
  }

  const blocks = [
    { data: digits.slice(0, 9), dv: Number(digits[9]) },
    { data: digits.slice(10, 20), dv: Number(digits[20]) },
    { data: digits.slice(21, 31), dv: Number(digits[31]) },
  ];
  for (const block of blocks) {
    if (mod10(block.data) !== block.dv) {
      return { ...empty, error: "Dígito verificador inválido." };
    }
  }

  const barcode = digitableLineToBarcode(digits);
  if (!barcode) return { ...empty, error: "Não foi possível montar o código de barras." };

  const generalDv = Number(barcode[4]);
  const barcodeWithoutDv = `${barcode.slice(0, 4)}${barcode.slice(5)}`;
  if (mod11(barcodeWithoutDv) !== generalDv) {
    return { ...empty, barcode, error: "Código de barras inconsistente." };
  }

  const factor = Number(digits.slice(33, 37));
  const amount = Number(digits.slice(37, 47)) / 100;
  const dueDate =
    factor > 0 ? new Date(FACTOR_BASE + factor * 86400000).toISOString().slice(0, 10) : null;

  return { valid: true, amount, dueDate, barcode };
}
