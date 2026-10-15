import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ mutate: vi.fn(), confirm: vi.fn() }));
vi.mock("@/lib/finance-data", () => ({
  useTransactions: () => ({ data: [{ id: "test", tags: ["casa", "mensal"], amount: -20 }], isLoading: false, isError: false, refetch: vi.fn() }),
  aggregateTags: () => [{ tag: "casa", count: 1, total: -20 }, { tag: "mensal", count: 1, total: -20 }],
  useBulkRenameTag: () => ({ mutate: mocks.mutate, isPending: false }),
}));
vi.mock("@/components/finance/use-financial-confirmation", () => ({
  useFinancialConfirmation: () => ({ confirm: mocks.confirm, confirmation: null }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { TagManager } from "./TagManager";

describe("TagManager", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.confirm.mockResolvedValue(true); });
  afterEach(cleanup);

  it("filtra as tags sem modificar os lançamentos", () => {
    render(<TagManager />);
    fireEvent.change(screen.getByLabelText("Pesquisar tag"), { target: { value: "casa" } });
    expect(screen.getByText("casa")).toBeInTheDocument();
    expect(screen.queryByText("mensal")).not.toBeInTheDocument();
    expect(mocks.mutate).not.toHaveBeenCalled();
  });

  it("renomeia somente após confirmação", async () => {
    render(<TagManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "Renomear" })[0] as HTMLElement);
    fireEvent.change(screen.getByLabelText("Novo nome"), { target: { value: "moradia" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^Renomear$/ }));
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ from: "casa", to: "moradia" }), expect.any(Object)));
    expect(mocks.confirm).toHaveBeenCalled();
  });

  it("remove apenas a tag com confirmação e preserva os lançamentos", async () => {
    render(<TagManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0] as HTMLElement);
    await waitFor(() => expect(mocks.mutate).toHaveBeenCalledWith(expect.objectContaining({ from: "casa", to: null }), expect.any(Object)));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.stringContaining("Os lançamentos são mantidos"));
  });

  it("não altera tags quando a confirmação é cancelada", async () => {
    mocks.confirm.mockResolvedValue(false);
    render(<TagManager />);
    fireEvent.click(screen.getAllByRole("button", { name: "Excluir" })[0] as HTMLElement);
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.mutate).not.toHaveBeenCalled();
  });
});