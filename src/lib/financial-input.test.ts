import { describe, expect, it } from "vitest";
import { localDateInput, parseFinancialInput } from "./financial-input";

describe("entrada financeira", () => {
  it.each([
    ["1.570,50", 1570.5],
    ["1570,50", 1570.5],
    ["1570.50", 1570.5],
    ["0", 0],
    ["-12,34", -12.34],
    ["R$ 1.234,56", 1234.56],
    ["-R$ 1.234,56", -1234.56],
    ["R$\u00a06.000,00", 6000],
  ])("interpreta %s sem perder centavos", (input, expected) =>
    expect(parseFinancialInput(input)).toBe(expected),
  );
  it.each([
    "",
    " ",
    "abc",
    "1.234",
    "1,234",
    "1.2.3",
    "Infinity",
    "1e3",
    "1.23,45",
    "9007199254740991",
  ])("rejeita %s sem converter para zero", (input) =>
    expect(Number.isNaN(parseFinancialInput(input))).toBe(true),
  );
  it("preserva precisão de quantidade quando explicitamente solicitada", () =>
    expect(parseFinancialInput("0,12345678", 8)).toBe(0.12345678));
  it("usa os componentes da data local na virada de mês", () =>
    expect(localDateInput(new Date(2026, 8, 30, 23, 59))).toBe("2026-09-30"));
});
