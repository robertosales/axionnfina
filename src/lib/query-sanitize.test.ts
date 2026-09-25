import { describe, it, expect } from "vitest";
import { sanitizeLikePattern, safeIlikePattern } from "./query-sanitize";

describe("query-sanitize", () => {
  describe("sanitizeLikePattern", () => {
    it("escapa caracteres % (wildcard)", () => {
      expect(sanitizeLikePattern("foo%bar")).toBe("foo\\%bar");
    });

    it("escapa caracteres _ (wildcard)", () => {
      expect(sanitizeLikePattern("foo_bar")).toBe("foo\\_bar");
    });

    it("escapa caracteres \\ (escape)", () => {
      expect(sanitizeLikePattern("foo\\bar")).toBe("foo\\\\bar");
    });

    it("escapa múltiplos caracteres especiais", () => {
      expect(sanitizeLikePattern("foo%_bar")).toBe("foo\\%\\_bar");
    });

    it("não altera strings sem caracteres especiais", () => {
      expect(sanitizeLikePattern("foobar")).toBe("foobar");
    });

    it("trata string vazia", () => {
      expect(sanitizeLikePattern("")).toBe("");
    });

    it("escapa caracteres especiais em sequência", () => {
      expect(sanitizeLikePattern("%_%")).toBe("\\%\\_\\%");
    });
  });

  describe("safeIlikePattern", () => {
    it("envolve resultado entre %%", () => {
      expect(safeIlikePattern("test")).toBe("%test%");
    });

    it("sanitiza e envolve entre %%", () => {
      expect(safeIlikePattern("foo%bar")).toBe("%foo\\%bar%");
    });

    it("limita tamanho padrão (50 chars)", () => {
      const longString = "a".repeat(100);
      const result = safeIlikePattern(longString);
      // 50 chars sanitizados + 2 %% = 52
      expect(result.length).toBeLessThanOrEqual(52);
    });

    it("respeita tamanho customizado", () => {
      const longString = "a".repeat(100);
      const result = safeIlikePattern(longString, 10);
      // 10 chars sanitizados + 2 %% = 12
      expect(result.length).toBeLessThanOrEqual(12);
    });

    it("remove espaços em branco", () => {
      expect(safeIlikePattern("  test  ")).toBe("%test%");
    });

    it("trata string vazia", () => {
      expect(safeIlikePattern("")).toBe("%%");
    });

    it("limita e sanitiza corretamente", () => {
      const input = "test%with%wildcards_and_long_string";
      const result = safeIlikePattern(input, 10);
      // "test%with%" sanitizado = "test\%with\%" (10 chars) + %% = %test\%with\%%  expect(result).toBe("%test\\%with\\%%");
    });
  });
});
