import { JournalEntryInput, JournalLineInput, LedgerBalances } from "./types";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/integrations/supabase/types";

export class LedgerService {
  private supabase = createClient();

  async createJournalEntry(input: JournalEntryInput): Promise<string> {
    const lines = input.lines.map((l) => ({
      ledger_account_id: l.ledger_account_id,
      entry_type: l.entry_type,
      amount: l.amount,
      currency: l.currency || "BRL",
      description: l.description || null,
      sort_order: l.sort_order || 0,
    }));

    const totalDebit = lines
      .filter((l) => l.entry_type === "debit")
      .reduce((sum, l) => sum + l.amount, 0);
    const totalCredit = lines
      .filter((l) => l.entry_type === "credit")
      .reduce((sum, l) => sum + l.amount, 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry must balance: debits ${totalDebit}, credits ${totalCredit}`);
    }

    const args: Database["public"]["Functions"]["create_journal_entry"]["Args"] = {
      p_entry_date: input.entry_date.toISOString().slice(0, 10),
      p_description: input.description,
      p_lines: lines as Json,
      p_reference_type: input.reference_type || "manual",
      p_source: input.source || "manual",
      p_metadata: (input.metadata || {}) as Json,
    };
    if (input.reference_id) args.p_reference_id = input.reference_id;

    const { data, error } = await this.supabase.rpc("create_journal_entry", args);

    if (error) {
      throw new Error(`Failed to create journal entry: ${error.message}`);
    }

    return data as string;
  }

  async createTransactionJournalEntry(
    transactionId: string,
    description: string,
    debitAccountId: string,
    creditAccountId: string,
    amount: number,
    currency = "BRL",
    entryDate: Date,
    referenceType = "transaction",
  ): Promise<string> {
    const debitLedgerAccount = await this.getLedgerAccountByFinancialAccount(debitAccountId);
    const creditLedgerAccount = await this.getLedgerAccountByFinancialAccount(creditAccountId);

    if (!debitLedgerAccount || !creditLedgerAccount) {
      throw new Error("Could not find ledger accounts for financial accounts");
    }

    return this.createJournalEntry({
      entry_date: entryDate,
      description,
      reference_type: referenceType,
      reference_id: transactionId,
      source: "auto",
      lines: [
        {
          ledger_account_id: debitLedgerAccount.id,
          entry_type: "debit",
          amount,
          currency,
          description: `Débito: ${description}`,
          sort_order: 1,
        },
        {
          ledger_account_id: creditLedgerAccount.id,
          entry_type: "credit",
          amount,
          currency,
          description: `Crédito: ${description}`,
          sort_order: 2,
        },
      ],
    });
  }

  async createIncomeExpenseJournalEntry(
    transactionId: string,
    description: string,
    financialAccountId: string,
    amount: number,
    currency: string,
    entryDate: Date,
  ): Promise<string> {
    const financialLedgerAccount = await this.getLedgerAccountByFinancialAccount(financialAccountId);
    const offsetLedgerAccount = await this.getSystemLedgerAccount(amount > 0 ? "revenue" : "expense");

    if (!financialLedgerAccount || !offsetLedgerAccount) {
      throw new Error("Could not find ledger accounts for transaction");
    }

    const absoluteAmount = Math.abs(amount);
    const isIncome = amount > 0;
    return this.createJournalEntry({
      entry_date: entryDate,
      description,
      reference_type: "transaction",
      reference_id: transactionId,
      source: "auto",
      lines: [
        {
          ledger_account_id: isIncome ? financialLedgerAccount.id : offsetLedgerAccount.id,
          entry_type: "debit",
          amount: absoluteAmount,
          currency,
          description,
          sort_order: 1,
        },
        {
          ledger_account_id: isIncome ? offsetLedgerAccount.id : financialLedgerAccount.id,
          entry_type: "credit",
          amount: absoluteAmount,
          currency,
          description,
          sort_order: 2,
        },
      ],
    });
  }

  async createTransferJournalEntry(
    pairId: string,
    description: string,
    fromAccountId: string,
    toAccountId: string,
    amount: number,
    currency: string,
    entryDate: Date,
  ): Promise<string> {
    const fromLedger = await this.getLedgerAccountByFinancialAccount(fromAccountId);
    const toLedger = await this.getLedgerAccountByFinancialAccount(toAccountId);

    if (!fromLedger || !toLedger) {
      throw new Error("Could not find ledger accounts for transfer");
    }

    return this.createJournalEntry({
      entry_date: entryDate,
      description: `Transferência: ${description}`,
      reference_type: "transfer",
      reference_id: pairId,
      source: "auto",
      lines: [
        {
          ledger_account_id: fromLedger.id,
          entry_type: "credit",
          amount,
          currency,
          description: `Saída: ${description}`,
          sort_order: 1,
        },
        {
          ledger_account_id: toLedger.id,
          entry_type: "debit",
          amount,
          currency,
          description: `Entrada: ${description}`,
          sort_order: 2,
        },
      ],
    });
  }

  private async getLedgerAccountByFinancialAccount(
    accountId: string,
  ): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from("ledger_accounts")
      .select("id")
      .eq("account_id", accountId)
      .eq("is_active", true)
      .maybeSingle();

    return data;
  }

  private async getSystemLedgerAccount(type: "revenue" | "expense"): Promise<{ id: string } | null> {
    const { data } = await this.supabase
      .from("ledger_accounts")
      .select("id")
      .eq("type", type)
      .eq("is_system", true)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    return data;
  }

  async getLedgerBalances(asOfDate = new Date()): Promise<LedgerBalances> {
    const { data, error } = await this.supabase.rpc("get_ledger_balances", {
      p_as_of_date: asOfDate.toISOString().slice(0, 10),
    });

    if (error) {
      throw new Error(`Failed to get ledger balances: ${error.message}`);
    }

    return data as unknown as LedgerBalances;
  }

  async getAccountBalance(ledgerAccountId: string, asOfDate = new Date()): Promise<number> {
    const { data, error } = await this.supabase
      .from("journal_lines")
      .select(
        `
        entry_type,
        amount,
        journal_entries!inner(entry_date, status)
      `,
      )
      .eq("ledger_account_id", ledgerAccountId)
      .eq("journal_entries.status", "posted")
      .lte("journal_entries.entry_date", asOfDate.toISOString().slice(0, 10));

    if (error) {
      throw new Error(`Failed to get account balance: ${error.message}`);
    }

    let balance = 0;
    for (const line of data || []) {
      if (line.entry_type === "debit") {
        balance += line.amount;
      } else {
        balance -= line.amount;
      }
    }

    return balance;
  }

  async reverseJournalEntry(entryId: string, reason: string): Promise<string> {
    const { data: entry } = await this.supabase
      .from("journal_entries")
      .select("id, entry_date, description, reference_type, reference_id, metadata")
      .eq("id", entryId)
      .eq("status", "posted")
      .maybeSingle();

    if (!entry) {
      throw new Error("Journal entry not found or already reversed");
    }

    const { data: lines } = await this.supabase
      .from("journal_lines")
      .select("ledger_account_id, entry_type, amount, currency, description, sort_order")
      .eq("journal_entry_id", entryId)
      .order("sort_order");

    const reversedLines: JournalLineInput[] = (lines || []).map((l) => ({
      ledger_account_id: l.ledger_account_id,
      entry_type: l.entry_type === "debit" ? "credit" : "debit",
      amount: l.amount,
      currency: l.currency,
      description: `Estorno: ${l.description || entry.description}`,
      sort_order: l.sort_order,
    }));

    const { data: reversedId, error } = await this.supabase.rpc("create_journal_entry", {
      p_entry_date: new Date().toISOString().slice(0, 10),
      p_description: `Estorno: ${entry.description} - ${reason}`,
      p_lines: reversedLines as unknown as Json,
      p_reference_type: "reversal",
      p_reference_id: entryId,
      p_source: "manual",
      p_metadata: { original_entry_id: entryId, reason },
    });

    if (error || !reversedId) {
      throw new Error(`Failed to reverse journal entry: ${error?.message ?? "empty response"}`);
    }

    const previousMetadata =
      entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? entry.metadata
        : {};
    await this.supabase
      .from("journal_entries")
      .update({
        status: "reversed",
        metadata: {
          ...previousMetadata,
          reversed_by: reversedId,
          reversed_at: new Date().toISOString(),
        },
      })
      .eq("id", entryId);

    return reversedId;
  }
}

export const ledgerService = new LedgerService();
