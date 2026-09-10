import { useRef, type ReactNode } from "react";

/** Native validation and Enter submission, also for forms whose footer is outside the fields. */
export function FinancialForm({ children }: { children: ReactNode }) {
  const submitting = useRef(false);
  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          event.currentTarget
            .querySelector<HTMLButtonElement>("button[data-financial-submit]")
            ?.click();
        }
      }}
      onClickCapture={(event) => {
        const button = (event.target as HTMLElement).closest("button[data-financial-submit]");
        if (button && (submitting.current || !event.currentTarget.reportValidity())) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        if (button) {
          submitting.current = true;
          // Covers repeated events before React renders the mutation's disabled state.
          queueMicrotask(() => {
            submitting.current = false;
          });
        }
      }}
    >
      {children}
    </form>
  );
}
