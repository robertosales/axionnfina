import { describe, expect, it } from "vitest";

import {
  formatBRL,
  formatPercent,
  formatShortDate,
  formatLongDate,
  daysUntil,
  initials,
} from "@/lib/format";

describe("formatBRL", () => {
  it("formata valor positivo em Reais", () => {
    expect(formatBRL(1234.56)).toBe("R$\u00a01.234,56");
  });

  it("formata valor negativo", () => {
    expect(formatBRL(-50)).toBe("-R$\u00a050,00");
  });

  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$\u00a00,00");
  });

  it("formata valor compacto", () => {
    const result = formatBRL(12400, true);
    expect(result).toContain("mil");
  });
});

describe("formatPercent", () => {
  it("formata percentual positivo com sinal", () => {
    expect(formatPercent(5.2)).toBe("+5,20%");
  });

  it("formata percentual negativo", () => {
    expect(formatPercent(-3.1)).toBe("-3,10%");
  });

  it("formata zero sem sinal", () => {
    expect(formatPercent(0)).toBe("0,00%");
  });
});

describe("daysUntil", () => {
  it("retorna dias até data futura", () => {
    expect(daysUntil("2026-09-10", new Date(2026, 7, 31, 23, 30))).toBe(10);
  });

  it("retorna negativo para data passada", () => {
    expect(daysUntil("2026-08-26", new Date(2026, 7, 31, 0, 30))).toBe(-5);
  });

  it("retorna zero para hoje", () => {
    expect(daysUntil("2026-08-31", new Date(2026, 7, 31, 23, 59))).toBe(0);
  });
});

describe("initials", () => {
  it("retorna iniciais de um nome", () => {
    expect(initials("João Silva")).toBe("JS");
  });

  it("retorna primeira letra de nome único", () => {
    expect(initials("Maria")).toBe("M");
  });

  it("retorna apenas duas iniciais", () => {
    expect(initials("Ana Maria Silva")).toBe("AM");
  });

  it("lida com strings vazias", () => {
    expect(initials("")).toBe("");
  });
});

describe("formatShortDate", () => {
  it("formata data no formato curto", () => {
    const result = formatShortDate("2026-08-15");
    expect(result).toMatch(/^15 de ago\.$/);
  });
});

describe("formatLongDate", () => {
  it("formata data no formato longo", () => {
    const result = formatLongDate("2026-08-15");
    expect(result).toContain("agosto");
  });
});
