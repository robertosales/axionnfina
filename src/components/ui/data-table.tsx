/**
 * DataTable — Tabela genérica com TanStack Table v8, virtualização,
 * sorting, filtering, inline editing e selection.
 */
import {
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type RowSelectionState,
  type Updater,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  Copy,
  MoreHorizontal,
  Search,
  X,
} from "lucide-react";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Props                                                               */
/* ------------------------------------------------------------------ */

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** Altura de cada linha em pixels. */
  rowHeight?: number;
  /** Altura máxima da tabela. */
  maxHeight?: number;
  /** Habilitar filtering global. */
  enableFiltering?: boolean;
  /** Placeholder do input de busca. */
  filterPlaceholder?: string;
  /** Habilitar selection de linhas. */
  enableSelection?: boolean;
  /** Callback quando selection muda. */
  onSelectionChange?: (rows: TData[]) => void;
  /** Callback quando linha é clicada. */
  onRowClick?: (row: TData) => void;
  /** Estado externo de sorting. */
  sorting?: SortingState;
  /** Callback de sorting externo. */
  onSortingChange?: (sorting: SortingState) => void;
  /** Total de linhas (para paginação server-side). */
  totalRows?: number;
  /** Callback de paginação. */
  onPageChange?: (page: number) => void;
  /** Página atual. */
  page?: number;
  /** Tamanho da página. */
  pageSize?: number;
  /** Renderizar toolbar customizada. */
  toolbar?: ReactNode;
  /** Renderizar row expandida. */
  renderSubComponent?: (row: { original: TData }) => ReactNode;
  /** Empty state. */
  emptyState?: ReactNode;
  /** Loading state. */
  isLoading?: boolean;
  /** Classes extras no container. */
  className?: string;
};

/* ------------------------------------------------------------------ */
/* Componente principal                                                */
/* ------------------------------------------------------------------ */

export function DataTable<TData, TValue>({
  columns,
  data,
  rowHeight = 52,
  maxHeight = 600,
  enableFiltering = true,
  filterPlaceholder = "Buscar…",
  enableSelection = false,
  onSelectionChange,
  onRowClick,
  sorting: externalSorting,
  onSortingChange: externalSortingChange,
  totalRows,
  onPageChange,
  page,
  pageSize = 50,
  toolbar,
  renderSubComponent,
  emptyState,
  isLoading = false,
  className,
}: DataTableProps<TData, TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const currentSorting = externalSorting ?? sorting;

  const handleSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const newSorting =
        typeof updater === "function" ? updater(currentSorting) : updater;
      if (externalSortingChange) {
        externalSortingChange(newSorting);
      } else {
        setSorting(newSorting);
      }
    },
    [currentSorting, externalSortingChange],
  );

  const handleRowSelectionChange = useCallback(
    (updater: Updater<RowSelectionState>) => {
      const newRowSelection =
        typeof updater === "function" ? updater(rowSelection) : updater;
      setRowSelection(newRowSelection);
      if (onSelectionChange) {
        const selectedRows = table
          .getSelectedRowModel()
          .rows.map((r) => r.original);
        onSelectionChange(selectedRows);
      }
    },
    [rowSelection, onSelectionChange],
  );

  const tableColumns = useMemo(() => {
    if (!enableSelection) return columns;
    return [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Selecionar todas"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Selecionar linha"
          />
        ),
        size: 40,
        enableSorting: false,
        enableHiding: false,
      } as ColumnDef<TData, TValue>,
      ...columns,
    ];
  }, [columns, enableSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting: currentSorting,
      rowSelection,
      globalFilter,
    },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: handleRowSelectionChange,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableRowSelection: enableSelection,
  });

  const { rows } = table.getRowModel();

  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  const toggleRowExpanded = useCallback((rowId: string) => {
    setExpandedRows((prev) => ({ ...prev, [rowId]: !prev[rowId] }));
  }, []);

  return (
    <div className={cn("rounded-xl border border-border/60 shadow-elevation-1", className)}>
      {/* Toolbar */}
      {(enableFiltering || toolbar) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-border/60 px-4 py-3">
          {enableFiltering && (
            <div className="relative min-w-56 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder={filterPlaceholder}
                className="pl-9"
                aria-label="Filtrar tabela"
              />
              {globalFilter && (
                <button
                  type="button"
                  onClick={() => setGlobalFilter("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          )}
          {toolbar}
        </div>
      )}

      {/* Table header */}
      <div className="border-b border-border/60">
        {table.getHeaderGroups().map((headerGroup) => (
          <div key={headerGroup.id} className="flex items-center px-4">
            {headerGroup.headers.map((header) => {
              const canSort = header.column.getCanSort();
              return (
                <div
                  key={header.id}
                  style={{ width: header.getSize() }}
                  className={cn(
                    "flex items-center gap-1 px-3 py-2.5 text-xs font-medium text-muted-foreground",
                    canSort && "cursor-pointer select-none hover:text-foreground",
                  )}
                  onClick={header.column.getToggleSortingHandler()}
                >
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                  {canSort && (
                    <span className="ml-0.5">
                      {header.column.getIsSorted() === "asc" ? (
                        <ArrowUp className="size-3" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ArrowDown className="size-3" />
                      ) : (
                        <ArrowUpDown className="size-3 opacity-40" />
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Virtualized body */}
      <div
        ref={parentRef}
        style={{ maxHeight }}
        className="overflow-auto"
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Carregando…
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            {emptyState ?? "Nenhum resultado encontrado."}
          </div>
        ) : (
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index]!;
              const isExpanded = expandedRows[row.id];
              return (
                <div
                  key={row.id}
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="absolute left-0 top-0 flex w-full items-center border-b border-border/30 px-4 hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="flex items-center truncate px-3 py-1"
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </div>
                  ))}
                  {renderSubComponent && (
                    <button
                      type="button"
                      onClick={() => toggleRowExpanded(row.id)}
                      className="ml-auto shrink-0 p-1 text-muted-foreground hover:text-foreground"
                      aria-label={isExpanded ? "Recolher" : "Expandir"}
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Expanded rows (outside virtualizer for simplicity) */}
      {renderSubComponent && Object.entries(expandedRows).filter(([, v]) => v).length > 0 && (
        <div className="border-t border-border/60">
          {rows
            .filter((row) => expandedRows[row.id])
            .map((row) => (
              <div
                key={`expanded-${row.id}`}
                className="border-b border-border/30 bg-muted/20 px-4 py-3"
              >
                {renderSubComponent(row)}
              </div>
            ))}
        </div>
      )}

      {/* Footer */}
      {totalRows !== undefined && onPageChange && (
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>
            {rows.length} de {totalRows} linhas
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange((page ?? 1) - 1)}
              disabled={(page ?? 1) <= 1}
            >
              Anterior
            </Button>
            <span>
              Página {page ?? 1} de {Math.ceil(totalRows / pageSize)}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange((page ?? 1) + 1)}
              disabled={(page ?? 1) >= Math.ceil(totalRows / pageSize)}
            >
              Próxima
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column helpers                                                      */
/* ------------------------------------------------------------------ */

/** Helper para criar colunas com sorting desc */
export function sortableHeader<TData>(
  label: string,
  className?: string,
): ColumnDef<TData, unknown>["header"] {
  return ({ column }) => (
    <span className={cn("flex items-center gap-1", className)}>
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="size-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </span>
  );
}

/** Botão de copiar para clipboard */
export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [value]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="focus-ring rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
      title="Copiar"
    >
      {copied ? (
        <Check className="size-3.5 text-success" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </button>
  );
}
