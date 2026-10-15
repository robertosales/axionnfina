import { useState } from "react";
import { Archive, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { DataState } from "@/components/finance/DataState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useTransactionCategories,
  useCreateTransactionCategory,
  useArchiveTransactionCategory,
  useUpdateTransactionCategoryDefinition,
} from "@/lib/finance-data";

export function CategoryManager() {
  const categoriesQuery = useTransactionCategories();
  const createCategory = useCreateTransactionCategory();
  const archiveCategory = useArchiveTransactionCategory();
  const updateCategory = useUpdateTransactionCategoryDefinition();
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categoryKind, setCategoryKind] = useState<"income" | "expense" | "transfer">("expense");
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");

  const saveCategory = () => {
    createCategory.mutate(
      { label: categoryLabel, kind: categoryKind },
      {
        onSuccess: () => {
          toast.success("Categoria criada");
          setCategoryLabel("");
        },
        onError: (error) =>
          toast.error("Não foi possível concluir a operação. Confira os dados e tente novamente."),
      },
    );
  };

  return (
    <section aria-label="Gerenciar categorias">
      <div className="mt-5 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_150px_auto]">
        <div className="space-y-2">
          <Label htmlFor="category-label">Nome da categoria</Label>
          <Input
            id="category-label"
            value={categoryLabel}
            onChange={(event) => setCategoryLabel(event.target.value)}
            placeholder="Nova categoria"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category-kind">Tipo</Label>
          <Select
            value={categoryKind}
            onValueChange={(value) => {
              if (value === "income" || value === "expense" || value === "transfer")
                setCategoryKind(value);
            }}
          >
            <SelectTrigger id="category-kind" aria-label="Tipo da categoria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Despesa</SelectItem>
              <SelectItem value="income">Receita</SelectItem>
              <SelectItem value="transfer">Transferência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={saveCategory} disabled={createCategory.isPending || !categoryLabel.trim()}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
      <DataState
        loading={categoriesQuery.isLoading}
        error={categoriesQuery.error}
        empty={!categoriesQuery.data?.length}
        onRetry={() => void categoriesQuery.refetch()}
      >
        <div className="mt-5 overflow-hidden rounded-lg border border-border/60">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 bg-muted px-4 py-3 text-xs font-semibold">
            <span>Nome e tipo</span>
            <span>Ações</span>
          </div>
          {(categoriesQuery.data ?? []).map((category) => (
            <div key={category.id} className="border-t border-border/60">
              <div className="flex items-center justify-between gap-3 px-4 py-4 hover:bg-muted/30">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{category.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.kind === "income"
                      ? "Receita"
                      : category.kind === "expense"
                        ? "Despesa"
                        : category.kind === "transfer"
                          ? "Transferência"
                          : "Sistema"}
                  </p>
                </div>
                {!category.isSystem && (
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      title="Editar categoria"
                      aria-label={`Editar categoria ${category.label}`}
                      onClick={() => {
                        setEditingCategoryId(category.id);
                        setEditingCategoryLabel(category.label);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-10"
                      title="Arquivar categoria"
                      aria-label={`Arquivar categoria ${category.label}`}
                      onClick={() =>
                        archiveCategory.mutate(category.id, {
                          onSuccess: () => toast.success("Categoria arquivada"),
                          onError: (error) =>
                            toast.error(
                              "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                            ),
                        })
                      }
                    >
                      <Archive className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
              {editingCategoryId === category.id && (
                <div className="flex flex-wrap gap-2 bg-muted/20 p-4">
                  <Input
                    value={editingCategoryLabel}
                    onChange={(event) => setEditingCategoryLabel(event.target.value)}
                    aria-label="Novo nome da categoria"
                  />
                  <Button
                    size="sm"
                    onClick={() =>
                      updateCategory.mutate(
                        { id: category.id, label: editingCategoryLabel },
                        {
                          onSuccess: () => {
                            setEditingCategoryId(null);
                            toast.success("Categoria atualizada");
                          },
                          onError: (error) =>
                            toast.error(
                              "Não foi possível concluir a operação. Confira os dados e tente novamente.",
                            ),
                        },
                      )
                    }
                  >
                    Salvar
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </DataState>
    </section>
  );
}
