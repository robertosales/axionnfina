import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type TableMeta,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, Copy } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { toast } from "sonner";

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  rowHeight?: number;
  maxHeight?: number;
  enableFiltering?: boolean;
  filterPlaceholder?: string;
  toolbar?: ReactNode;
  renderSubComponent?: (row: { original: TData }) => ReactNode;
  emptyState?: ReactNode;
  isLoading?: boolean;
  className?: string;
  pageSize?: number;
  meta?: TableMeta<TData>;
  getRowId?: (row: TData) => string;
};

/** Paginação mant?m o DOM pequeno, preservando semântica e navegação nativa. */
export function DataTable<TData, TValue>({
  columns,
  data,
  maxHeight = 600,
  enableFiltering = true,
  filterPlaceholder = "Buscar…",
  toolbar,
  renderSubComponent,
  emptyState,
  isLoading,
  className,
  pageSize = 50,
  meta,
  getRowId,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const table = useReactTable({
    data,
    columns,
    ...(meta ? { meta } : {}),
    ...(getRowId ? { getRowId } : {}),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  });
  return (
    <div className={cn("min-w-0 rounded-xl border border-border/60 shadow-elevation-1", className)}>
      {(enableFiltering || toolbar) && (
        <div className="flex flex-wrap gap-3 border-b p-3">
          {enableFiltering && (
            <Input
              aria-label="Filtrar tabela"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={filterPlaceholder}
            />
          )}
          {toolbar}
        </div>
      )}
      <div
        className="overflow-auto"
        style={{ maxHeight }}
        tabIndex={0}
        role="region"
        aria-label="Tabela de transações, role para consultar todas as colunas"
      >
        <table className="w-full min-w-[800px] text-left text-sm">
          <caption className="sr-only">Transações financeiras</caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {table.getHeaderGroups()[0]?.headers.map((header) => (
                <th
                  key={header.id}
                  scope="col"
                  aria-sort={
                    header.column.getIsSorted() === "asc"
                      ? "ascending"
                      : header.column.getIsSorted() === "desc"
                        ? "descending"
                        : undefined
                  }
                  className={cn(
                    "px-3 py-3 text-xs font-medium text-muted-foreground",
                    header.id === "amount" && "text-right",
                  )}
                >
                  {header.column.getCanSort() ? (
                    <button
                      type="button"
                      className="focus-ring inline-flex items-center gap-1 rounded"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3" />
                      )}
                    </button>
                  ) : (
                    flexRender(header.column.columnDef.header, header.getContext())
                  )}
                </th>
              ))}
              {renderSubComponent && (
                <th scope="col">
                  <span className="sr-only">Detalhes</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-6" role="status">
                  Carregando…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="p-6">
                  {emptyState ?? "Nenhum resultado encontrado."}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-t hover:bg-muted/30">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={cn(
                          "px-3 py-3",
                          cell.column.id === "amount" && "whitespace-nowrap text-right",
                        )}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                    {renderSubComponent && (
                      <td className="pr-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-expanded={expanded === row.id}
                          aria-label={`Detalhes da transação ${row.index + 1}`}
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                        >
                          {expanded === row.id ? "Recolher" : "Detalhes"}
                        </Button>
                      </td>
                    )}
                  </tr>
                  {renderSubComponent && expanded === row.id && (
                    <tr>
                      <td colSpan={columns.length + 1} className="border-t bg-muted/20 p-4">
                        {renderSubComponent(row)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t p-3 text-xs">
        <span role="status">
          {table.getFilteredRowModel().rows.length} registros · Página{" "}
          {table.getState().pagination.pageIndex + 1} de {Math.max(1, table.getPageCount())}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            Próxima
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label="Copiar estabelecimento"
      className="focus-ring rounded p-1"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          toast.error("Não foi possível copiar.");
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  );
}
