import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCallback, useEffect, useRef, useState } from "react";

export function useFinancialConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const confirm = useCallback(
    (description: string) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setMessage(description);
      }),
    [],
  );
  const finish = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setMessage(null);
  };
  useEffect(
    () => () => {
      resolver.current?.(false);
    },
    [],
  );
  const confirmation = (
    <AlertDialog
      open={message !== null}
      onOpenChange={(open) => {
        if (!open) finish(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar alteração financeira</AlertDialogTitle>
          <AlertDialogDescription>{message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => finish(false)}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => finish(true)}>Confirmar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return { confirm, confirmation };
}
