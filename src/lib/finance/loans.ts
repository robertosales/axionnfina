import type { Loan } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireUserId, rowNum, rowStr, untypedDb, type DbRow } from "./common";

function toLoan(row: DbRow): Loan {
  return {
    id: rowStr(row, "id"),
    name: rowStr(row, "name"),
    principal: rowNum(row, "principal"),
    interestRate: rowNum(row, "interest_rate"),
    installment: rowNum(row, "installment"),
    remaining: rowNum(row, "remaining", rowNum(row, "principal")),
    dueDate: rowStr(row, "due_date"),
    status: (rowStr(row, "status", "active") as Loan["status"]) ?? "active",
    totalPaid: rowNum(row, "total_paid"),
    createdAt: rowStr(row, "created_at"),
    archivedAt: typeof row["archived_at"] === "string" ? row["archived_at"] : null,
  };
}

export function useLoans(showArchived = false) {
  return useQuery({
    queryKey: ["loans", showArchived],
    queryFn: async (): Promise<Loan[]> => {
      try {
        let request = untypedDb()
          .from("loans")
          .select("*")
          .order("due_date", { ascending: true });
        request = showArchived
          ? request.not("archived_at", "is", null)
          : request.is("archived_at", null);
        const { data, error } = await request;
        if (error) return [];
        return ((data ?? []) as DbRow[]).map(toLoan);
      } catch {
        return [];
      }
    },
  });
}

export function useUpsertLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      principal: number;
      interestRate: number;
      installment: number;
      dueDate: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        name: input.name.trim(),
        principal: input.principal,
        interest_rate: input.interestRate,
        installment: input.installment,
        due_date: input.dueDate,
        remaining: input.principal,
        total_paid: 0,
        status: "active",
      };
      const { error } = input.id
        ? await untypedDb().from("loans").update(payload).eq("id", input.id)
        : await untypedDb().from("loans").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useSettleLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount: number }) => {
      const { data: rows, error: fetchError } = await untypedDb()
        .from("loans")
        .select("remaining, total_paid, status")
        .eq("id", input.id)
        .limit(1);
      if (fetchError) throw fetchError;
      const loan = (rows ?? [])[0] as DbRow | undefined;
      if (!loan) throw new Error("Empréstimo não encontrado");
      const newRemaining = Math.max(0, rowNum(loan, "remaining") - input.amount);
      const newTotalPaid = rowNum(loan, "total_paid") + input.amount;
      const status = newRemaining <= 0 ? "paid" : rowStr(loan, "status", "active");
      const { error } = await untypedDb()
        .from("loans")
        .update({ remaining: newRemaining, total_paid: newTotalPaid, status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function useArchiveLoan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedDb()
        .from("loans")
        .update({ archived_at: new Date().toISOString(), status: "paid" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["loans"] });
    },
  });
}

export function calculateLoanInterest(
  principal: number,
  rate: number,
  months: number,
): number {
  const monthlyRate = rate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) / (Math.pow(1 + monthlyRate, months) - 1);
}

export function calculateEarlyPayoff(
  remaining: number,
  rate: number,
  installmentsRemaining: number,
): { discountedTotal: number; savings: number } {
  const monthlyRate = rate / 100 / 12;
  let totalWithoutDiscount = 0;
  for (let i = 0; i < installmentsRemaining; i++) {
    totalWithoutDiscount += remaining * monthlyRate * Math.pow(1 + monthlyRate, installmentsRemaining - i) / (Math.pow(1 + monthlyRate, installmentsRemaining - i) - 1);
  }
  const discount = rate > 0 ? 0.1 : 0;
  const discountedTotal = totalWithoutDiscount * (1 - discount);
  return { discountedTotal, savings: totalWithoutDiscount - discountedTotal };
}
