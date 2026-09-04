import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { extractPdfText } from "@/lib/pdf-import.server";
import { parseInvoiceText, parseStatementText } from "@/lib/document-import";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  const ownerId = formData.get("owner_id");
  if (!(file instanceof File)) return NextResponse.json({ error: "Arquivo não informado" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "O arquivo deve ter no máximo 10 MB" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf")) return NextResponse.json({ error: "Apenas PDF é aceito neste endpoint" }, { status: 400 });
  if (kind !== "statement" && kind !== "credit_invoice") return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  if (typeof ownerId !== "string" || !ownerId) return NextResponse.json({ error: "Conta ou cartão não informado" }, { status: 400 });

  try {
    const extraction = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    const rows = kind === "statement"
      ? parseStatementText(extraction.text, ownerId)
      : parseInvoiceText(extraction.text, ownerId);
    return NextResponse.json({ fileName: file.name, ...extraction, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler o PDF";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
