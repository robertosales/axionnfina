import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { Tag, Tags } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { CategoryManager } from "@/components/finance/organization/CategoryManager";
import { TagManager } from "@/components/finance/organization/TagManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const searchSchema = z.object({
  tab: z.enum(["categories", "tags"]).catch("categories"),
});

export const Route = createFileRoute("/_authenticated/categories")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Categorias e Tags — Axionn Finance" },
      { name: "description", content: "Organize suas receitas, despesas e transferências por categorias e gerencie as tags dos lançamentos." },
      { property: "og:title", content: "Categorias e Tags — Axionn Finance" },
      { property: "og:description", content: "Categorias e tags para organizar seus lançamentos financeiros." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Categorias e Tags</h1>
      </header>
      <Tabs value={tab} onValueChange={(value) => {
        if (value === "categories" || value === "tags") {
          void navigate({ search: { tab: value } });
        }
      }}>
        <TabsList className="mb-4 grid w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="categories" className="gap-2"><Tags className="size-4" aria-hidden />Categorias</TabsTrigger>
          <TabsTrigger value="tags" className="gap-2"><Tag className="size-4" aria-hidden />Tags</TabsTrigger>
        </TabsList>
        <TabsContent value="categories"><CategoryManager /></TabsContent>
        <TabsContent value="tags"><TagManager /></TabsContent>
      </Tabs>
    </AppShell>
  );
}