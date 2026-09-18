import { useRef, useState } from "react";
import { toast } from "sonner";
import { useImportInvestmentPositions } from "@/lib/finance-data";
import { parseInvestmentCsv, type CsvInvestmentRow } from "@/lib/investment-import";

export function usePortfolioImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<CsvInvestmentRow[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const importer = useImportInvestmentPositions();
  const valid = rows.filter((row) => row.valid);

  const readFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Nesta versão, selecione um arquivo CSV.");
      return;
    }
    const parsed = parseInvestmentCsv(await file.text());
    if (parsed.length === 0) {
      toast.error("O arquivo não contém linhas de investimentos.");
      return;
    }
    setFileName(file.name);
    setRows(parsed);
    setReviewOpen(true);
  };

  const importRows = () => {
    importer.mutate(
      { fileName, rows },
      {
        onSuccess: (result) => {
          toast.success(`${result.imported} posição(ões) importadas`);
          setReviewOpen(false);
        },
        onError: () =>
          toast.error(
            "Não foi possível concluir a operação. Confira os dados e tente novamente.",
          ),
      },
    );
  };

  return {
    inputRef,
    fileName,
    rows,
    reviewOpen,
    setReviewOpen,
    valid,
    importer,
    readFile,
    importRows,
  };
}
