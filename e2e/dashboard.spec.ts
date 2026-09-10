import { test, expect } from "@playwright/test";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.test",
  app_metadata: {},
  user_metadata: { name: "Pessoa de teste" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00Z",
};
const date = new Date().toISOString().slice(0, 10);
const rows: Record<string, unknown[]> = {
  accounts: [
    {
      id: "account-1",
      name: "Conta principal",
      institution: "Banco de teste",
      type: "checking",
      balance: 18420.55,
      open_finance: true,
      last_sync_at: null,
      metadata: {},
      record_origin: "open_finance",
    },
  ],
  transactions: [
    {
      id: "transaction-1",
      account_id: "account-1",
      description: "Receita de teste",
      merchant: "",
      category: "Salário",
      type: "income",
      amount: 5000,
      occurred_at: date,
      status: "settled",
      is_recurring: false,
      archived_at: null,
      record_origin: "manual",
      accounts: { name: "Conta principal" },
    },
  ],
  investment_positions: [
    {
      id: "position-1",
      ticker: "TESTE",
      name: "Posição de teste",
      asset_class: "fixed_income",
      quantity: 1,
      average_price: 1000,
      current_price: 1200,
      institution: "Banco de teste",
      source: "manual",
      record_origin: "manual",
      fgc_eligible: null,
    },
  ],
  goals: [
    {
      id: "goal-1",
      title: "Reserva",
      target_amount: 10000,
      current_amount: 6000,
      deadline: "2027-12-01",
      record_origin: "manual",
    },
  ],
  payables: [
    {
      id: "bill-1",
      description: "Conta de teste",
      amount: 300,
      due_date: date,
      status: "pending",
      category: "Moradia",
      record_origin: "manual",
    },
  ],
  budgets: [
    {
      id: "budget-1",
      category: "Moradia",
      planned: 1000,
      month: `${date.slice(0, 7)}-01`,
      record_origin: "manual",
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route("https://**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.hostname !== "example.supabase.co") return route.abort();
    if (url.pathname === "/auth/v1/user") return route.fulfill({ json: user });
    const table = url.pathname.split("/").at(-1) ?? "";
    return route.fulfill({ json: rows[table] ?? [] });
  });
  await page.addInitScript(
    ({ user }) => {
      const token = `${btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${btoa(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 }))}.fixture`;
      localStorage.setItem(
        "sb-example-auth-token",
        JSON.stringify({
          access_token: token,
          refresh_token: "fixture",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          expires_in: 3600,
          token_type: "bearer",
          user,
        }),
      );
    },
    { user },
  );
});

for (const width of [320, 768, 1440]) {
  test(`dashboard e privacidade em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
    await expect(page.getByText("R$ 19.620,55", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Há contas sem data de sincronização informada.", { exact: false }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `test-results/dashboard-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Ocultar valores" }).click();
    await expect(page.getByText("Informações financeiras ocultas.")).toBeVisible();
    await expect(page.getByText("R$ 19.620,55", { exact: true })).toHaveCount(0);
    await page.getByRole("link", { name: "Nova transação", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nova transação", exact: true })).toBeVisible();
  });
}
test("ação rápida abre criação de meta", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Criar meta", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("modo claro e navegação por teclado", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Alternar tema" }).filter({ visible: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("link", { name: "Criar meta", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("falha de consulta não vira saldo zero", async ({ page }) => {
  await page.route("**/rest/v1/accounts?*", (route) =>
    route.fulfill({ status: 500, json: { message: "Fixture failure" } }),
  );
  await page.goto("/dashboard");
  await expect(page.getByText("Não foi possível carregar estes dados.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
  await expect(page.getByText("R$ 19.620,55", { exact: true })).toHaveCount(0);
});

test("APIs recusam requisições sem autenticação", async ({ request }) => {
  for (const path of ["/api/transactions", "/api/transactions/summary", "/api/ledger/balances"]) {
    expect((await request.get(path)).status()).toBe(401);
  }
  expect((await request.post("/api/documents")).status()).toBe(401);
});
