import type { Project } from "@/shared/finance-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requireUserId, rowNum, rowStr, untypedDb, type DbRow } from "./common";

function toProject(row: DbRow): Project {
  return {
    id: rowStr(row, "id"),
    name: rowStr(row, "name"),
    description: rowStr(row, "description"),
    target: rowNum(row, "target"),
    current: rowNum(row, "current"),
    category: rowStr(row, "category", "Outros"),
    startDate: rowStr(row, "start_date"),
    endDate: rowStr(row, "end_date"),
    status: (rowStr(row, "status", "active") as Project["status"]) ?? "active",
    archivedAt: typeof row["archived_at"] === "string" ? row["archived_at"] : null,
  };
}

export function useProjects(showArchived = false) {
  return useQuery({
    queryKey: ["projects", showArchived],
    queryFn: async (): Promise<Project[]> => {
      try {
        let request = untypedDb().from("projects").select("*").order("end_date", { ascending: true });
        request = showArchived
          ? request.not("archived_at", "is", null)
          : request.is("archived_at", null);
        const { data, error } = await request;
        if (error) return [];
        return ((data ?? []) as DbRow[]).map(toProject);
      } catch {
        return [];
      }
    },
  });
}

export function useUpsertProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      description: string;
      target: number;
      category: string;
      startDate: string;
      endDate: string;
    }) => {
      const userId = await requireUserId();
      const payload = {
        user_id: userId,
        name: input.name.trim(),
        description: input.description.trim(),
        target: input.target,
        current: 0,
        category: input.category,
        start_date: input.startDate,
        end_date: input.endDate,
        status: "active",
      };
      const { error } = input.id
        ? await untypedDb().from("projects").update(payload).eq("id", input.id)
        : await untypedDb().from("projects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProjectProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; amount: number }) => {
      const { data: rows, error: fetchError } = await untypedDb()
        .from("projects")
        .select("current, target")
        .eq("id", input.id)
        .limit(1);
      if (fetchError) throw fetchError;
      const project = (rows ?? [])[0] as DbRow | undefined;
      if (!project) throw new Error("Projeto não encontrado");
      const newCurrent = rowNum(project, "current") + input.amount;
      const status = newCurrent >= rowNum(project, "target") ? "completed" : "active";
      const { error } = await untypedDb()
        .from("projects")
        .update({ current: newCurrent, status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await untypedDb()
        .from("projects")
        .update({ archived_at: new Date().toISOString(), status: "archived" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
