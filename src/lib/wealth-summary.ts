import type { Account } from "./mock-data";

/** Account balances are authoritative; positions may describe the same investment accounts. */
export function wealthSummary(accounts: Account[], positionTotal: number) {
  const investmentAccounts = accounts.filter((account) => account.type === "INVESTMENT");
  const accountTotal = accounts.reduce((sum, account) => sum + account.balance, 0);
  return {
    netWorth: accountTotal + (investmentAccounts.length === 0 ? positionTotal : 0),
    usesInvestmentAccounts: investmentAccounts.length > 0,
    liquidity: accounts
      .filter((account) => account.type === "CHECKING" || account.type === "SAVINGS")
      .reduce((sum, account) => sum + account.balance, 0),
    debts: accounts
      .filter((account) => account.balance < 0)
      .reduce((sum, account) => sum - account.balance, 0),
  };
}

export function snapshotChange(
  series: { date: string; value: number }[],
  monthsAgo: number,
  now = new Date(),
) {
  const reference = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const key = `${reference.getFullYear()}-${String(reference.getMonth() + 1).padStart(2, "0")}`;
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const previous = series.find((point) => point.date.slice(0, 7) === key);
  const current = series.find((point) => point.date.slice(0, 7) === currentKey);
  return previous && current && previous.value !== 0
    ? ((current.value - previous.value) / Math.abs(previous.value)) * 100
    : null;
}

export function syncFreshness(accounts: Account[], now = Date.now()) {
  const connected = accounts.filter((account) => account.openFinance);
  const unknown = connected.filter(
    (account) => !account.lastSyncedAt || !Number.isFinite(Date.parse(account.lastSyncedAt)),
  );
  const dates = connected.flatMap((account) =>
    account.lastSyncedAt && Number.isFinite(Date.parse(account.lastSyncedAt))
      ? [Date.parse(account.lastSyncedAt)]
      : [],
  );
  const oldest = dates.length ? Math.min(...dates) : null;
  return {
    connected: connected.length,
    unknown: unknown.length,
    oldest,
    stale: oldest !== null && now - oldest > 86_400_000,
  };
}
