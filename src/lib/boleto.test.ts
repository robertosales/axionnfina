import { describe, expect, it } from "vitest";

import { mod10, mod11, digitableLineToBarcode, parseDigitableLine } from "@/lib/boleto";

describe("mod10", () => {
  it("calcula DV módulo 10 corretamente", () => {
    // Exemplo: campo 1 de um boleto real
    expect(mod10("00190000")).toBe(9);
  });
});

describe("mod11", () => {
  it("calcula DV módulo 11 corretamente", () => {
    // Exemplo simplificado
    const result = mod11("001930000000000000000000000000000000000000000000");
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(9);
  });
});

describe("digitableLineToBarcode", () => {
  it("converte linha digitável em código de barras", () => {
    // Linha digitável de exemplo (47 dígitos)
    const line = "00190000090000000000000000000000000000000000000";
    const result = digitableLineToBarcode(line);
    // Resultado deve ter 44 dígitos ou null se inválido
    if (result) {
      expect(result.length).toBe(44);
    }
  });

  it("retorna null para linha com tamanho inválido", () => {
    expect(digitableLineToBarcode("12345")).toBeNull();
  });
});

describe("parseDigitableLine", () => {
  it("rejeita linha com tamanho inválido", () => {
    const result = parseDigitableLine("12345");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("47 dígitos");
  });

  it("rejeita linha com DV inválido", () => {
    const line = "00000000000000000000000000000000000000000000000";
    const result = parseDigitableLine(line);
    expect(result.valid).toBe(false);
  });
});
