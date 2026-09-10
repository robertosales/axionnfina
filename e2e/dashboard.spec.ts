import { expect, test } from "@playwright/test";

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
  account_reconciliation: [
    {
      account_id: "account-1",
      reported_balance: 18420.55,
      journal_movement_balance: 5000,
      difference_including_opening_balance: 13420.55,
    },
  ],
  transaction_categories: [
    {
      id: "category-1",
      label: "Outras despesas",
      name: "Outras despesas",
      kind: "expense",
      is_system: true,
      archived_at: null,
    },
  ],
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

for (const width of [320, 1440]) {
  test(`cadastro financeiro preserva centavos e impede duplicidade em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const payloads: unknown[] = [];
    await page.route("**/rest/v1/rpc/create_manual_transaction", async (route) => {
      payloads.push(route.request().postDataJSON());
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ json: null });
    });
    await page.goto("/transactions");
    await page.getByRole("button", { name: "Nova transação", exact: true }).click();
    await page.getByLabel("Descrição", { exact: true }).fill("Financiamento de teste");
    await page.getByLabel("Valor", { exact: true }).fill("1.570,50");
    await page.getByRole("button", { name: "Registrar", exact: true }).evaluate((button) => {
      button.click();
      button.click();
    });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(payloads).toHaveLength(1);
    expect(payloads[0]).toMatchObject({
      p_data: { description: "Financiamento de teste", amount: -1570.5 },
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("erro de gravação preserva dados e rejeita entrada monetária inválida", async ({ page }) => {
  let requests = 0;
  await page.route("**/rest/v1/rpc/create_manual_transaction", async (route) => {
    requests++;
    await route.fulfill({ status: 400, json: { message: "internal fixture failure" } });
  });
  await page.goto("/transactions?new=true");
  await page.getByLabel("Descrição", { exact: true }).fill("Manter preenchimento");
  await page.getByLabel("Valor", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(page.getByLabel("Valor", { exact: true })).toHaveAttribute("aria-invalid", "true");
  expect(requests).toBe(0);
  await page.getByLabel("Valor", { exact: true }).fill("1570,50");
  await page.getByRole("button", { name: "Registrar", exact: true }).click();
  await expect(
    page.getByText("Não foi possível concluir a operação. Confira os dados e tente novamente."),
  ).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue("Manter preenchimento");
  await expect(page.getByLabel("Valor", { exact: true })).toHaveValue("1570,50");
  await expect(page.getByText("internal fixture failure")).toHaveCount(0);
});

test("baixa exige confirmação contextual e permite cancelar", async ({ page }) => {
  let writes = 0;
  await page.route("**/rest/v1/payables?*", async (route) => {
    if (route.request().method() === "PATCH") {
      writes++;
      return route.fulfill({ json: null });
    }
    return route.fulfill({ json: rows["payables"] });
  });
  await page.goto("/bills");
  await page.getByRole("button", { name: "Marcar como paga", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("R$ 300,00");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Marcar como paga", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect.poll(() => writes).toBe(1);
});

test("consulta mais de 200 registros e alinha busca, total e exportação", async ({ page }) => {
  const transactions = Array.from({ length: 501 }, (_, index) => ({
    ...(rows["transactions"]![0] as object),
    id: `tx-${index}`,
    description: index === 500 ? "Registro antigo exclusivo" : `Receita ${index}`,
    amount: 10,
  }));
  await page.route("**/rest/v1/transactions?*", (route) => {
    const url = new URL(route.request().url());
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const limit = Number(url.searchParams.get("limit") ?? 500);
    return route.fulfill({ json: transactions.slice(offset, offset + limit) });
  });
  await page.goto("/transactions");
  await expect(page.getByText("501 lançamentos", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByText("Página 2 de 11", { exact: false })).toBeVisible();
  await page.getByLabel("Buscar transações").fill("Registro antigo exclusivo");
  await expect(page.getByText("1 lançamentos", { exact: false })).toBeVisible();
  await expect(page.getByText("Registro antigo exclusivo", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar", exact: true }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv).toContain("Registro antigo exclusivo");
  expect(csv).not.toContain("Receita 0");
});

for (const path of [
  "/transactions",
  "/bills",
  "/budget",
  "/goals",
  "/taxes",
  "/reports",
  "/reconciliation",
]) {
  test(`erro de dados fica explícito em ${path}`, async ({ page }) => {
    await page.route("**/rest/v1/**", (route) =>
      route.fulfill({ status: 500, json: { message: "fixture" } }),
    );
    await page.goto(path);
    await expect(page.getByText("Não foi possível carregar estes dados.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Tentar novamente" }).first()).toBeVisible();
  });
}

test("tabela permite ordenação por teclado e edição de categoria", async ({ page }) => {
  const edits: unknown[] = [];
  await page.route("**/rest/v1/rpc/edit_transaction", (route) => {
    edits.push(route.request().postDataJSON());
    return route.fulfill({ json: null });
  });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Data", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("columnheader", { name: "Data", exact: true })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await page.getByRole("button", { name: "Salário", exact: true }).click();
  await page.getByLabel("Editar categoria").fill("Outra categoria");
  await page.keyboard.press("Enter");
  await expect.poll(() => edits.length).toBe(1);
});

for (const width of [320, 1440]) {
  test(`telas financeiras sem overflow em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ["transactions", "bills", "budget", "goals", "reports", "reconciliation"]) {
      await page.goto(`/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Carregando dados…", { exact: true })).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path,
      ).toBe(true);
      await page.screenshot({ path: `test-results/${path}-${width}.png`, fullPage: true });
    }
  });
}
