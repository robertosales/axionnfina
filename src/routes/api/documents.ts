import { createFileRoute } from "@tanstack/react-router";

import { authenticateApi } from "@/lib/api-auth.server";
import { extractPdfText } from "@/lib/pdf-import.server";
import { parseInvoiceText, parseStatementText } from "@/lib/document-import";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

async function POST(request: Request) {
  const auth = await authenticateApi(request);
  if (!auth) return Response.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = formData.get("kind");
  const ownerId = formData.get("owner_id");
  if (!(file instanceof File))
    return Response.json({ error: "Arquivo não informado" }, { status: 400 });
  if (file.size > MAX_FILE_SIZE)
    return Response.json({ error: "O arquivo deve ter no máximo 10 MB" }, { status: 400 });
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return Response.json({ error: "Apenas PDF é aceito neste endpoint" }, { status: 400 });
  if (kind !== "statement" && kind !== "credit_invoice")
    return Response.json({ error: "Tipo de documento inválido" }, { status: 400 });
  if (typeof ownerId !== "string" || !ownerId)
    return Response.json({ error: "Conta ou cartão não informado" }, { status: 400 });

  const table = kind === "statement" ? "accounts" : "credit_cards";
  const { data: owner, error: ownerError } = await auth.client
    .from(table)
    .select("id")
    .eq("id", ownerId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (ownerError || !owner) return Response.json({ error: "Access denied" }, { status: 404 });
  try {
    const extraction = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
    const rows =
      kind === "statement"
        ? parseStatementText(extraction.text, ownerId)
        : parseInvoiceText(extraction.text, ownerId);
    return Response.json({ fileName: file.name, ...extraction, rows });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível ler o PDF";
    return Response.json({ error: message }, { status: 422 });
  }
}

export const Route = createFileRoute("/api/documents")({
  server: { handlers: { POST: ({ request }) => POST(request) } },
});
