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
    expect(formatPercent(5.2)).toBe("+5,2%");
  });

  it("formata percentual negativo", () => {
    expect(formatPercent(-3.1)).toBe("-3,1%");
  });

  it("formata zero sem sinal", () => {
    expect(formatPercent(0)).toBe("0,0%");
  });
});

describe("daysUntil", () => {
  it("retorna dias até data futura", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const result = daysUntil(future.toISOString().slice(0, 10));
    expect(result).toBe(10);
  });

  it("retorna negativo para data passada", () => {
    const past = new Date();
    past.setDate(past.getDate() - 5);
    const result = daysUntil(past.toISOString().slice(0, 10));
    expect(result).toBe(-5);
  });

  it("retorna zero para hoje", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(daysUntil(today)).toBe(0);
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
    expect(result).toMatch(/\d{2}\.\s/);
  });
});

describe("formatLongDate", () => {
  it("formata data no formato longo", () => {
    const result = formatLongDate("2026-08-15");
    expect(result).toContain("agosto");
  });
});
