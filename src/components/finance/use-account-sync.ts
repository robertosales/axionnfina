import { useSyncAccount } from "@/lib/finance-data";
import { toast } from "sonner";

export function useAccountSync() {
  const syncAccount = useSyncAccount();

  const sync = (accountId: string) => {
    syncAccount.mutate(accountId, {
      onError: () => toast.error("Não foi possível sincronizar. Verifique a conexão."),
      onSuccess: () => toast.success("Sincronização solicitada."),
    });
  };

  return {
    sync,
    isPending: syncAccount.isPending,
  };
}
