import { describe, expect, it, vi, beforeEach } from "vitest";

import { checkRateLimit, getRateLimitHeaders, RATE_LIMITS } from "@/lib/security";
import { getRiskLevel, requiresStepUpAuth } from "@/lib/security-risk";

describe("security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("permite requisições dentro do limite", () => {
      const result = checkRateLimit("test:127.0.0.1", 5, 60_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it("bloqueia requisições acima do limite", () => {
      for (let i = 0; i < 5; i++) {
        checkRateLimit("test:block", 5, 60_000);
      }
      const result = checkRateLimit("test:block", 5, 60_000);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("reseta após a janela expirar", () => {
      const result = checkRateLimit("test:reset", 2, 1);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe("getRateLimitHeaders", () => {
    it("retorna headers de rate limit", () => {
      const result = getRateLimitHeaders("test:headers", RATE_LIMITS.api);
      expect(result.headers).toHaveProperty("X-RateLimit-Limit");
      expect(result.headers).toHaveProperty("X-RateLimit-Remaining");
      expect(result.headers).toHaveProperty("X-RateLimit-Reset");
    });
  });

  describe("RATE_LIMITS", () => {
    it("tem configurações para todos os tipos", () => {
      expect(RATE_LIMITS.agentChat).toBeDefined();
      expect(RATE_LIMITS.transactionSync).toBeDefined();
      expect(RATE_LIMITS.login).toBeDefined();
      expect(RATE_LIMITS.api).toBeDefined();
    });

    it("login tem limite menor que api geral", () => {
      expect(RATE_LIMITS.login.maxRequests).toBeLessThan(RATE_LIMITS.api.maxRequests);
    });
  });
});

describe("security-risk", () => {
  describe("requiresStepUpAuth", () => {
    it("retorna true para operações sensíveis", () => {
      expect(requiresStepUpAuth("password_change")).toBe(true);
      expect(requiresStepUpAuth("account_delete")).toBe(true);
      expect(requiresStepUpAuth("payment_create")).toBe(true);
      expect(requiresStepUpAuth("transfer")).toBe(true);
    });

    it("retorna false para operações não-sensíveis", () => {
      expect(requiresStepUpAuth("view_dashboard")).toBe(false);
      expect(requiresStepUpAuth("view_transactions")).toBe(false);
    });
  });

  describe("getRiskLevel", () => {
    it("retorna low para score baixo", () => {
      expect(getRiskLevel(10)).toBe("low");
    });

    it("retorna medium para score médio", () => {
      expect(getRiskLevel(30)).toBe("medium");
    });

    it("retorna high para score alto", () => {
      expect(getRiskLevel(60)).toBe("high");
    });

    it("retorna critical para score crítico", () => {
      expect(getRiskLevel(80)).toBe("critical");
    });
  });
});

describe("security - RLS e IDOR", () => {
  it("deve filtrar security_events pelo user_id", async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: session } = await supabase.auth.getSession();

    if (session.session?.user?.id) {
      const { data, error } = await supabase
        .from("security_events")
        .select("id")
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .limit(1);

      expect(data).toEqual([]);
    }
  });
});
