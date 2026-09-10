import { Input } from "@/components/ui/input";
import { useId, useState, type ComponentProps } from "react";

export function ValidatedInput(props: ComponentProps<typeof Input>) {
  const id = useId();
  const [error, setError] = useState("");
  return (
    <div className="min-w-0">
      <Input
        {...props}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? id : props["aria-describedby"]}
        onInvalid={(event) => {
          setError(event.currentTarget.validationMessage);
          props.onInvalid?.(event);
        }}
        onChange={(event) => {
          if (error)
            setError(
              event.currentTarget.validity.valid ? "" : event.currentTarget.validationMessage,
            );
          props.onChange?.(event);
        }}
        onBlur={(event) => {
          setError(event.currentTarget.validity.valid ? "" : event.currentTarget.validationMessage);
          props.onBlur?.(event);
        }}
      />
      {error && (
        <p id={id} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
