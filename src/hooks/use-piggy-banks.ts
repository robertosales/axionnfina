import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

export interface PiggyBank {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  color: string | null;
  balance: number;
  goal_id: string | null;
  status: "active" | "archived" | "closed";
  created_at: string;
}

export interface PiggyBankMovement {
  id: string;
  piggy_bank_id: string;
  type: "deposit" | "withdrawal";
  amount: number;
  date: string;
  origin: "manual" | "recurring" | "round_up" | "transfer";
  note: string | null;
  created_at: string;
}

export interface CreatePiggyBankInput {
  name: string;
  icon?: string | null;
  color?: string | null;
  goal_id?: string | null;
}

export interface DepositInput {
  piggy_bank_id: string;
  amount: number;
  account_id: string;
  note?: string | null;
}

export interface WithdrawInput {
  piggy_bank_id: string;
  amount: number;
  account_id: string;
  note?: string | null;
}

export interface UpdatePiggyBankInput {
  piggy_bank_id: string;
  name: string;
  icon?: string | null;
  color?: string | null;
}

export interface TransferPiggyBankInput {
  from_id: string;
  to_id: string;
  amount: number;
}

// ============================================================================
// Queries
// ============================================================================

export function usePiggyBanks(showArchived = false) {
  return useQuery({
    queryKey: ["piggy-banks", showArchived],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("piggy_banks")
        .select("*")
        .eq("status", showArchived ? "archived" : "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PiggyBank[];
    },
  });
}

export function usePiggyBank(id: string | null) {
  return useQuery({
    queryKey: ["piggy-bank", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("piggy_banks")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as PiggyBank;
    },
    enabled: !!id,
  });
}

export function usePiggyBankMovements(piggyBankId: string | null) {
  return useQuery({
    queryKey: ["piggy-bank-movements", piggyBankId],
    queryFn: async () => {
      if (!piggyBankId) return [];
      const { data, error } = await supabase
        .from("piggy_bank_movements")
        .select("*")
        .eq("piggy_bank_id", piggyBankId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PiggyBankMovement[];
    },
    enabled: !!piggyBankId,
  });
}

// ============================================================================
// Mutations
// ============================================================================

export function useCreatePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePiggyBankInput) => {
      const { data, error } = await supabase.rpc("create_piggy_bank", {
        p_name: input.name,
        p_icon: input.icon ?? null,
        p_color: input.color ?? null,
        p_goal_id: input.goal_id ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho criado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao criar cofrinho");
    },
  });
}

export function useDepositToPiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DepositInput) => {
      const { error } = await supabase.rpc("deposit_to_piggy_bank", {
        p_piggy_bank_id: input.piggy_bank_id,
        p_amount: input.amount,
        p_account_id: input.account_id,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      void qc.invalidateQueries({ queryKey: ["piggy-bank-movements"] });
      void qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      void qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Aporte realizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao aportar");
    },
  });
}

export function useWithdrawFromPiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: WithdrawInput) => {
      const { error } = await supabase.rpc("withdraw_from_piggy_bank", {
        p_piggy_bank_id: input.piggy_bank_id,
        p_amount: input.amount,
        p_account_id: input.account_id,
        p_note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      void qc.invalidateQueries({ queryKey: ["piggy-bank-movements"] });
      void qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      void qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success("Resgate realizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao resgatar");
    },
  });
}

export function useArchivePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piggyBankId: string) => {
      const { error } = await supabase.rpc("archive_piggy_bank", {
        p_piggy_bank_id: piggyBankId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho arquivado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao arquivar");
    },
  });
}

export function useClosePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piggyBankId: string) => {
      const { error } = await supabase.rpc("close_piggy_bank", {
        p_piggy_bank_id: piggyBankId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho encerrado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao encerrar");
    },
  });
}

export function useUnarchivePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piggyBankId: string) => {
      const { error } = await supabase.rpc("unarchive_piggy_bank", {
        p_piggy_bank_id: piggyBankId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho restaurado");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao restaurar");
    },
  });
}

export function useUpdatePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdatePiggyBankInput) => {
      const { error } = await supabase.rpc("update_piggy_bank", {
        p_piggy_bank_id: input.piggy_bank_id,
        p_name: input.name,
        p_icon: input.icon ?? null,
        p_color: input.color ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho atualizado!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar cofrinho");
    },
  });
}

export function useDeletePiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (piggyBankId: string) => {
      const { error } = await supabase.rpc("delete_piggy_bank", {
        p_piggy_bank_id: piggyBankId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      toast.success("Cofrinho excluído");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao excluir cofrinho");
    },
  });
}

export function useTransferPiggyBank() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TransferPiggyBankInput) => {
      const { error } = await supabase.rpc("transfer_piggy_bank", {
        p_from_id: input.from_id,
        p_to_id: input.to_id,
        p_amount: input.amount,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["piggy-banks"] });
      void qc.invalidateQueries({ queryKey: ["piggy-bank-movements"] });
      void qc.invalidateQueries({ queryKey: ["wallet-summary"] });
      toast.success("Transferência realizada!");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao transferir");
    },
  });
}
