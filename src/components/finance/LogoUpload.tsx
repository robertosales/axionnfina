import { useCallback, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface LogoUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  fallbackText?: string;
  className?: string;
}

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_SIZE_BYTES = 512 * 1024;

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 45%, 50%)`;
}

export function LogoUpload({ value, onChange, fallbackText = "BK", className }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      setError(null);

      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Formato não suportado. Use PNG, JPG ou SVG.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        setError("Arquivo muito grande. Máximo de 512 KB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [onChange],
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setError(null);
      if (inputRef.current) inputRef.current.value = "";
    },
    [onChange],
  );

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <button
        type="button"
        className="group relative size-20 overflow-hidden rounded-full border-2 border-dashed border-border bg-muted/40 transition-colors hover:border-primary/50 hover:bg-muted/60"
        onClick={() => inputRef.current?.click()}
      >
        {value ? (
          <>
            <img
              src={value}
              alt="Logo"
              className="size-full object-cover"
            />
            <span
              className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100"
              onClick={handleRemove}
            >
              <X className="size-3" />
            </span>
          </>
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-1">
            <div
              className="grid size-10 place-items-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: hashColor(fallbackText) }}
            >
              {getInitials(fallbackText)}
            </div>
            <ImagePlus className="size-3 text-muted-foreground" />
          </div>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {error && <p className="text-[11px] text-danger">{error}</p>}
    </div>
  );
}
