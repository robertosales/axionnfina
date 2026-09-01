import { describe, expect, it } from "vitest";

import { buildMaturityLadder } from "./investment-maturity";

const position = (id: string, maturityDate: string, marketValue = 1000) => ({
  id,
  ticker: id,
  name: id,
  marketValue,
  maturityDate,
});

describe("buildMaturityLadder", () => {
  it("distribui vencimentos nas janelas sem sobreposição", () => {
    const ladder = buildMaturityLadder(
      [
        position("vencido", "2026-08-31"),
        position("30", "2026-10-01"),
        position("90", "2026-11-30"),
        position("180", "2027-02-28"),
        position("longo", "2027-03-01"),
      ],
      "2026-09-01",
    );
    expect(ladder.buckets.map((bucket) => bucket.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it("identifica o próximo vencimento e respeita a antecedência do alerta", () => {
    const ladder = buildMaturityLadder(
      [position("A", "2026-09-20"), position("B", "2026-10-20")],
      "2026-09-01",
      20,
    );
    expect(ladder.nextMaturity?.id).toBe("A");
    expect(ladder.items[0]?.status).toBe("upcoming");
    expect(ladder.items[1]?.status).toBe("future");
  });

  it("ignora posições sem vencimento cadastrado", () => {
    const ladder = buildMaturityLadder(
      [{ id: "A", ticker: "A", name: "A", marketValue: 1000, maturityDate: null }],
      "2026-09-01",
    );
    expect(ladder.items).toHaveLength(0);
  });
});
