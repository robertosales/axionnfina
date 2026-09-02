import { Link } from "@tanstack/react-router";
import { Building2, Check, FileSpreadsheet, PencilLine, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useImportInvestmentPositions } from "@/lib/finance-data";
import { parseInvestmentCsv, type CsvInvestmentRow } from "@/lib/investment-import";
import { formatBRL } from "@/lib/format";

export function PortfolioOnboardingCard({ onManual }: { onManual: () => void }) {
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

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card shadow-elevation-1">
        <div className="border-b border-border/60 p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Monte sua carteira
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Escolha o jeito mais fácil para você
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você sempre confere os dados antes de um arquivo ser salvo. Conexões podem ser revogadas
            quando quiser.
          </p>
          <div className="mt-4 grid grid-cols-4 gap-1 text-[10px] text-muted-foreground sm:text-xs">
            {["Origem", "Leitura", "Conferência", "Carteira"].map((step, index) => (
              <div key={step} className="flex items-center gap-1">
                <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="truncate">{step}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 p-5 sm:p-6 lg:grid-cols-3">
          <div className="rounded-xl border border-success/30 bg-success/5 p-4">
            <Building2 className="size-5 text-success" aria-hidden />
            <h3 className="mt-3 font-semibold">Conectar instituição</h3>
            <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
              Importa e atualiza posições automaticamente quando a instituição oferece o produto.
            </p>
            <Button asChild className="mt-4 h-11 w-full">
              <Link to="/wallet/connect">Conectar banco ou corretora</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <FileSpreadsheet className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-semibold">Importar planilha</h3>
            <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
              Aceita CSV com ativo, nome, classe, quantidade, preços e instituição.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(event) => void readFile(event.target.files?.[0])}
            />
            <Button
              variant="outline"
              className="mt-4 h-11 w-full"
              onClick={() => inputRef.current?.click()}
            >
              <Upload aria-hidden />
              Selecionar CSV
            </Button>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <PencilLine className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 font-semibold">Informar manualmente</h3>
            <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">
              Use o modo simplificado se você souber apenas o nome e o valor atual.
            </p>
            <Button variant="outline" className="mt-4 h-11 w-full" onClick={onManual}>
              Cadastrar com ajuda
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle>Confira antes de importar</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full">
              {valid.length} pronta(s)
            </Badge>
            <Badge variant="outline" className="rounded-full border-warning/40 text-warning">
              {rows.length - valid.length} para corrigir
            </Badge>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full min-w-[38rem] text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="p-3">Linha</th>
                  <th>Ativo</th>
                  <th>Classe</th>
                  <th>Valor atual</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {rows.map((row) => (
                  <tr key={row.rowNumber}>
                    <td className="p-3">{row.rowNumber}</td>
                    <td className="font-medium">
                      {row.ticker || "—"}
                      <span className="block font-normal text-muted-foreground">{row.name}</span>
                    </td>
                    <td>{row.assetClass}</td>
                    <td>{formatBRL(row.marketValue)}</td>
                    <td>
                      {row.valid ? (
                        <span className="inline-flex items-center gap-1 text-success">
                          <Check className="size-3" />
                          Pronta
                        </span>
                      ) : (
                        <span className="text-warning">{row.errors.join(", ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground">
            Linhas com erro não serão importadas. Repetir o mesmo arquivo atualiza as posições, sem
            duplicá-las.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="h-11"
              disabled={valid.length === 0 || importer.isPending}
              onClick={() =>
                importer.mutate(
                  { fileName, rows },
                  {
                    onSuccess: (result) => {
                      toast.success(`${result.imported} posição(ões) importadas`);
                      setReviewOpen(false);
                    },
                    onError: (error) => toast.error(error.message),
                  },
                )
              }
            >
              {importer.isPending ? "Importando…" : `Importar ${valid.length} posição(ões)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
