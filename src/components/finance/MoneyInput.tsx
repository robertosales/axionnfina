import { Input } from "@/components/ui/input";
import { parseFinancialInput } from "@/lib/financial-input";
import { useId, useState, type ComponentProps } from "react";

export function MoneyInput({
  value,
  onChange,
  onBlur,
  required = true,
  min,
  decimals = 2,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { decimals?: number }) {
  const errorId = useId();
  const [touched, setTouched] = useState(false);
  const text = String(value ?? "");
  const parsed = parseFinancialInput(text, decimals);
  const invalid =
    (!text.trim() && required) ||
    (Boolean(text.trim()) &&
      (!Number.isFinite(parsed) || (min !== undefined && parsed < Number(min))));
  const message = !text.trim()
    ? "Informe o valor."
    : `Informe um valor válido${min !== undefined ? `, a partir de ${min}` : ""}. Ex.: 1.234,56`;
  return (
    <div className="min-w-0">
      <Input
        {...props}
        type="text"
        inputMode="decimal"
        required={required}
        value={value}
        aria-invalid={(touched && invalid) || undefined}
        aria-describedby={touched && invalid ? errorId : props["aria-describedby"]}
        ref={(node) => {
          node?.setCustomValidity(invalid ? message : "");
        }}
        onInvalid={() => setTouched(true)}
        onChange={(event) => {
          onChange?.(event);
        }}
        onBlur={(event) => {
          setTouched(true);
          onBlur?.(event);
        }}
      />
      {touched && invalid && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-danger">
          {message}
        </p>
      )}
    </div>
  );
}
