import { PDFParse } from "pdf-parse";

export type PdfExtractionResult = {
  pages: number;
  text: string;
  scanned: boolean;
};

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtractionResult> {
  if (bytes.byteLength === 0) throw new Error("O PDF está vazio.");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");

  const parser = new PDFParse({ data: bytes });
  try {
    const result = await parser.getText();
    const text = result.text.replace(/\s+\n/g, "\n").trim();
    if (!text) {
      throw new Error(
        "Este PDF não contém texto selecionável. É necessário OCR para documentos escaneados.",
      );
    }
    return { pages: result.total, text, scanned: false };
  } finally {
    await parser.destroy();
  }
}
