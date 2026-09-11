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
    if (url.pathname === "/rest/v1/rpc/get_wallet_summary")
      return route.fulfill({
        json: {
          totals: {
            total_accounts: 1,
            checking_count: 1,
            savings_count: 0,
            credit_count: 0,
            investment_count: 0,
            total_balance: 18420.55,
            liquid_balance: 18420.55,
            investment_balance: 0,
            total_credit_limit: 0,
            total_available_credit: 0,
          },
          by_institution: [
            { name: "Banco de teste", logo_color: null, account_count: 1, balance: 18420.55 },
          ],
          accounts: [
            {
              id: "account-1",
              name: "Conta principal",
              institution_name: "Banco de teste",
              logo_color: null,
              type: "checking",
              balance: 18420.55,
              available_balance: 18420.55,
              is_primary: true,
              is_manual: true,
              open_finance: false,
              card_last_four: null,
              card_brand: null,
              last_sync_at: null,
              currency: "BRL",
              record_origin: "manual",
            },
          ],
        },
      });
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

for (const width of [320, 768, 1440, 1920]) {
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
  await expect(page.getByLabel("Valor", { exact: true })).toHaveValue(/R\$\s1\.570,50/);
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
    for (const path of [
      "transactions",
      "bills",
      "budget",
      "goals",
      "reports",
      "reconciliation",
      "settings",
      "investments",
      "wallet/accounts",
      "wallet",
      "taxes",
    ]) {
      await page.goto(`/${path}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByText("Carregando dados…", { exact: true })).toHaveCount(0);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path,
      ).toBe(true);
      await page.screenshot({
        path: `test-results/${path.replaceAll("/", "-")}-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test("menu recolhido persiste ao navegar e recarregar, com acesso por teclado", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Recolher menu", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Expandir menu", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  const sidebar = page.getByRole("complementary", { name: "Menu lateral" });
  await expect(sidebar).toHaveCSS("width", "80px");
  await page.screenshot({ path: "test-results/sidebar-collapsed.png", fullPage: true });
  await sidebar.getByRole("link", { name: "Relatórios", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Relatórios", exact: true })).toBeVisible();
  await expect(sidebar).toHaveCSS("width", "80px");
  await page.reload();
  await expect(sidebar).toHaveCSS("width", "80px");
  await page.getByRole("button", { name: "Expandir menu", exact: true }).click();
  await expect(sidebar).toHaveCSS("width", "264px");
});

test("novo lançamento na lateral reabre formulário e preserva preenchimento ao redimensionar", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Novo lançamento", exact: true }).click();
  await page.getByLabel("Descrição", { exact: true }).fill("Rascunho preservado");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue("Rascunho preservado");
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  await page.getByRole("button", { name: "Abrir menu", exact: true }).click();
  await page
    .getByRole("button", { name: "Novo lançamento", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { name: "Nova transação", exact: true })).toBeVisible();
  await expect(page.getByLabel("Descrição", { exact: true })).toHaveValue("");
});

test("relatório mantém período, valores e exportação com o gráfico", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto("/reports");
  await page.getByLabel("Período", { exact: true }).selectOption("3");
  const table = page.getByRole("table");
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.locator("tbody tr").last()).toContainText("R$ 5.000,00");
  await expect(page.getByRole("img", { name: /Receitas e despesas por mês/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar relatório" }).click();
  const stream = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const csv = Buffer.concat(chunks).toString("utf8");
  expect(csv.trim().split("\r\n")).toHaveLength(4);
  expect(csv).toContain("5000,00;0,00;5000,00");
  await expect(page.getByRole("link", { name: "Novo lançamento", exact: true })).toHaveText(
    "Novo lançamento",
  );
  await page.screenshot({
    path: "test-results/reports-wide.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Alternar tema" }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await expect(
    page.getByRole("button", { name: "Buscar ou perguntar ao agente…", exact: true }),
  ).toHaveCSS("background-color", /^(oklch\(1 0 0\)|rgb\(255, 255, 255\))$/);
  await page.screenshot({
    path: "test-results/reports-light.png",
    fullPage: true,
    animations: "disabled",
  });
});

test("filtros ativos são visíveis e limpeza restaura a listagem", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByLabel("Buscar transações").fill("Sem correspondência");
  await expect(page.getByLabel("Filtros ativos")).toContainText("Sem correspondência");
  await expect(page.getByText("Nenhum resultado encontrado.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByLabel("Filtros ativos")).toHaveCount(0);
  await expect(page.getByText("Receita de teste", { exact: true })).toBeVisible();
});

for (const width of [320, 1440]) {
  test(`saldo recebe moeda automaticamente e salva centavos em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const writes: Record<string, unknown>[] = [];
    await page.route("**/rest/v1/accounts?*", (route) => {
      if (route.request().method() === "POST") {
        writes.push(route.request().postDataJSON());
        return route.fulfill({ json: { id: "new-account" } });
      }
      return route.fulfill({ json: rows["accounts"] });
    });
    await page.goto("/wallet/accounts");
    await page.getByRole("button", { name: "Nova Conta", exact: true }).click();
    await page.getByLabel("Nome", { exact: true }).fill("Visa Infinit");
    const balance = page.getByLabel("Saldo", { exact: true });
    await balance.fill("6000,00");
    await balance.press("Tab");
    await expect(balance).toHaveValue(/R\$\s6\.000,00/);
    await page.screenshot({ path: `test-results/account-currency-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "Salvar", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ balance: 6000, current_balance: 6000 });
  });
}

test("situação confirma, cancela, filtra e impede gravações duplicadas", async ({ page }) => {
  let status = "pending";
  const writes: Record<string, unknown>[] = [];
  await page.route("**/rest/v1/transactions?*", async (route) => {
    if (route.request().method() === "PATCH") {
      const payload = route.request().postDataJSON();
      expect(new URL(route.request().url()).searchParams.get("status")).toBe(`eq.${status}`);
      writes.push(payload);
      await new Promise((resolve) => setTimeout(resolve, 250));
      status = payload.status;
      return route.fulfill({ json: { id: "transaction-1" } });
    }
    return route.fulfill({ json: [{ ...(rows["transactions"]![0] as object), status }] });
  });
  await page.goto("/transactions");
  await page.getByLabel("Situação", { exact: true }).selectOption("pending");
  await page.getByRole("button", { name: "Confirmar transação", exact: true }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("Receita de teste");
  await expect(dialog).toContainText("R$ 5.000,00");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmar transação", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).evaluate((button) => {
    button.click();
    button.click();
  });
  await expect(page.getByText("Transação confirmada", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0]).toEqual({ status: "settled" });
  await expect(page.getByText("Nenhum resultado encontrado.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(page.getByRole("table")).toContainText("Confirmada");
  await page.getByRole("button", { name: "Marcar como pendente", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar", exact: true }).click();
  await expect(page.getByText("Transação marcada como pendente", { exact: true })).toBeVisible();
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual({ status: "pending" });
  await page.screenshot({ path: "test-results/transaction-status.png", fullPage: true });
});

test("erro de confirmação preserva pendência e status bancários não oferecem alteração", async ({
  page,
}) => {
  await page.route("**/rest/v1/transactions?*", (route) => {
    if (route.request().method() === "PATCH")
      return route.fulfill({ status: 409, json: { message: "internal fixture" } });
    return route.fulfill({
      json: [
        { ...(rows["transactions"]![0] as object), status: "pending" },
        {
          ...(rows["transactions"]![0] as object),
          id: "bank",
          description: "Pendente no banco",
          status: "pending",
          record_origin: "open_finance",
        },
        {
          ...(rows["transactions"]![0] as object),
          id: "reversed",
          description: "Compra estornada",
          status: "reversed",
        },
      ],
    });
  });
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: "Confirmar transação", exact: true })).toHaveCount(
    1,
  );
  await expect(page.getByRole("table")).toContainText("Estornada");
  await expect(page.getByRole("table")).toContainText("Informada pela instituição");
  await page.getByRole("button", { name: "Confirmar transação", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(
    page.getByText("Não foi possível alterar a situação. Atualize a lista e tente novamente."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Confirmar transação", exact: true }),
  ).toBeEnabled();
  await expect(page.getByText("internal fixture")).toHaveCount(0);
});

for (const width of [320, 1440]) {
  test(`fatura reconhece conta de crédito sem cadastro separado em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const account = {
      id: "00000000-0000-4000-8000-000000000099",
      user_id: user.id,
      name: "Visa Infinit",
      institution: "Itaú Unibanco",
      type: "credit",
    };
    let card: Record<string, unknown> | null = null;
    let cardWrites = 0;
    const reviews: Record<string, unknown>[] = [];
    let confirmations = 0;
    await page.route("**/rest/v1/accounts?*", (route) =>
      route.fulfill({
        json: route.request().headers()["accept"]?.includes("vnd.pgrst.object")
          ? account
          : [account],
      }),
    );
    await page.route("**/rest/v1/credit_cards?*", (route) => {
      if (route.request().method() === "POST") {
        cardWrites++;
        card = route.request().postDataJSON();
        expect(route.request().headers()["prefer"]).toContain("resolution=ignore-duplicates");
        return route.fulfill({ json: null });
      }
      return route.fulfill({
        json: route.request().headers()["accept"]?.includes("vnd.pgrst.object")
          ? card
          : card
            ? [card]
            : [],
      });
    });
    await page.route("**/rest/v1/rpc/create_credit_invoice_review", (route) => {
      reviews.push(route.request().postDataJSON());
      return route.fulfill({ json: "invoice-1" });
    });
    await page.route("**/rest/v1/rpc/confirm_credit_invoice", (route) => {
      confirmations++;
      return confirmations === 1
        ? route.fulfill({ status: 500, json: { message: "fixture" } })
        : route.fulfill({ json: 1 });
    });
    await page.goto("/wallet/imports");
    await page.getByLabel("Cartão", { exact: true }).click();
    await page.getByRole("option", { name: "Visa Infinit · Itaú Unibanco", exact: true }).click();
    expect(cardWrites).toBe(0);
    await page.getByLabel("Vencimento", { exact: true }).fill("2026-09-20");
    await page.getByLabel("Arquivo da fatura").setInputFiles({
      name: "fatura.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("data;estabelecimento;valor;parcela\n04/09/2026;Loja;100,00;2/6"),
    });
    await expect(page.getByRole("table")).toContainText("Loja");
    expect(cardWrites).toBe(1);
    expect(card).toMatchObject({
      id: account.id,
      account_id: account.id,
      last_four: "",
      brand: "other",
    });
    await page.screenshot({ path: `test-results/invoice-preview-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole("button", { name: "Confirmar importação da fatura", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Cancelar", exact: true })
      .click();
    expect(reviews).toHaveLength(0);
    await page.getByRole("button", { name: "Confirmar importação da fatura", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await expect(
      page.getByText(
        "Não foi possível concluir a importação. Sua prévia foi mantida para tentar novamente.",
      ),
    ).toBeVisible();
    expect(reviews[0]).toMatchObject({
      p_card_id: account.id,
      p_file_type: "csv",
      p_due_date: "2026-09-20",
      p_items: [{ amount: -100 }],
    });
    await expect(page.getByRole("table")).toContainText("Loja");
    await page.getByRole("button", { name: "Confirmar importação da fatura", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Confirmar", exact: true })
      .click();
    await expect(page.getByText("1 lançamento(s) criado(s).", { exact: true })).toBeVisible();
    expect(reviews).toHaveLength(1);
    expect(confirmations).toBe(2);
  });
}

test("importação diferencia ausência de cartão e falha de consulta", async ({ page }) => {
  await page.route("**/rest/v1/accounts?*", (route) => route.fulfill({ json: [] }));
  await page.goto("/wallet/imports");
  await expect(page.getByText("Nenhum cartão cadastrado.", { exact: false })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cadastrar cartão", exact: true })).toBeVisible();
  await page.route("**/rest/v1/credit_cards?*", (route) =>
    route.fulfill({ status: 403, json: { code: "42501", message: "fixture" } }),
  );
  await page.reload();
  await expect(page.getByText("Você não tem permissão para consultar estes dados.")).toBeVisible();
  await expect(page.getByText("Nenhum cartão cadastrado.", { exact: false })).toHaveCount(0);
});

test("extrato exige selecionar conta antes de ler e troca de conta limpa a prévia", async ({
  page,
}) => {
  await page.route("**/rest/v1/accounts?*", (route) =>
    route.fulfill({
      json: [
        ...rows["accounts"]!,
        {
          ...(rows["accounts"]![0] as object),
          id: "credit-account",
          type: "credit",
          name: "Visa Infinit",
        },
      ],
    }),
  );
  await page.goto("/transactions?import=true");
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Selecionar CSV, XML ou PDF" })).toBeDisabled();
  await page.getByLabel("Conta do extrato", { exact: true }).click();
  await page.getByRole("option", { name: "Visa Infinit", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "extrato.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("data;descricao;valor\n04/09/2026;Compra de teste;-100,00"),
  });
  await expect(dialog.getByRole("table")).toContainText("Compra de teste");
  await page.getByLabel("Conta do extrato", { exact: true }).click();
  await page.getByRole("option", { name: "Conta principal", exact: true }).click();
  await expect(dialog.getByRole("table")).not.toContainText("Compra de teste");
  await expect(
    dialog.getByRole("button", { name: "Confirmar importação", exact: true }),
  ).toBeDisabled();
});

test("fatura PDF usa cartão vinculado e preserva tipo do arquivo", async ({ page }) => {
  const account = {
    id: "credit-account",
    name: "Visa Infinit",
    institution: "Itaú",
    type: "credit",
  };
  const card = { id: "existing-card", account_id: account.id, last_four: "4321", brand: "visa" };
  let writes = 0;
  let review: unknown;
  await page.route("**/rest/v1/accounts?*", (route) => route.fulfill({ json: [account] }));
  await page.route("**/rest/v1/credit_cards?*", (route) => {
    if (route.request().method() === "POST") writes++;
    return route.fulfill({ json: [card] });
  });
  await page.route("**/api/documents", (route) => {
    expect(route.request().postData()).toContain("existing-card");
    expect(route.request().postData()).toContain("credit_invoice");
    return route.fulfill({
      json: {
        rows: [
          {
            rowNumber: 1,
            date: "2026-09-04",
            description: "Compra PDF",
            amount: -99.9,
            installment: "",
            externalId: "pdf-key",
            valid: true,
            errors: [],
          },
        ],
      },
    });
  });
  await page.route("**/rest/v1/rpc/create_credit_invoice_review", (route) => {
    review = route.request().postDataJSON();
    return route.fulfill({ json: "invoice-pdf" });
  });
  await page.route("**/rest/v1/rpc/confirm_credit_invoice", (route) => route.fulfill({ json: 1 }));
  await page.goto("/wallet/imports");
  await page.getByLabel("Cartão", { exact: true }).click();
  await page.getByRole("option", { name: "Visa Infinit · Itaú · •••• 4321", exact: true }).click();
  await page.getByLabel("Vencimento", { exact: true }).fill("2026-09-20");
  await page.getByLabel("Arquivo da fatura").setInputFiles({
    name: "fatura.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-fixture"),
  });
  await expect(page.getByRole("table")).toContainText("Compra PDF");
  await page.getByRole("button", { name: "Confirmar importação da fatura", exact: true }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirmar", exact: true })
    .click();
  await expect(page.getByText("1 lançamento(s) criado(s).", { exact: true })).toBeVisible();
  expect(writes).toBe(0);
  expect(review).toMatchObject({
    p_card_id: "existing-card",
    p_file_type: "pdf",
    p_file_name: "fatura.pdf",
  });
});
