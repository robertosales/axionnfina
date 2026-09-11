export type PdfExtractionResult = {
  pages: number;
  text: string;
  scanned: boolean;
};

/**
 * pdfjs (via pdf-parse) touches browser globals at module init, which crashes
 * the Worker runtime. Keep the import lazy and provide minimal shims.
 */
async function loadParser() {
  const globals = globalThis as Record<string, unknown>;
  if (typeof globals["DOMMatrix"] === "undefined") {
    class DOMMatrixShim {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
    }
    globals["DOMMatrix"] = DOMMatrixShim;
  }
  if (typeof globals["ImageData"] === "undefined") {
    class ImageDataShim {}
    globals["ImageData"] = ImageDataShim;
  }
  if (typeof globals["Path2D"] === "undefined") {
    class Path2DShim {}
    globals["Path2D"] = Path2DShim;
  }
  // The Worker runtime cannot dynamically import pdf.worker.mjs at runtime, so
  // bundle it and expose it as the main-thread worker handler pdfjs looks for.
  if (typeof globals["pdfjsWorker"] === "undefined") {
    globals["pdfjsWorker"] = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
  }
  const mod = await import("pdf-parse");
  return mod.PDFParse;
}

export async function extractPdfText(bytes: Uint8Array): Promise<PdfExtractionResult> {
  if (bytes.byteLength === 0) throw new Error("O PDF está vazio.");
  if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");

  const PDFParse = await loadParser();
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
