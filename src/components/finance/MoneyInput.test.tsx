import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";
import { MoneyInput } from "./MoneyInput";
import { parseFinancialInput } from "@/lib/financial-input";

function Form({ initial = "", decimals = 2 }: { initial?: string; decimals?: number }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <MoneyInput
        aria-label="Saldo"
        value={value}
        decimals={decimals}
        onChange={(event) => setValue(event.target.value)}
      />
      <output data-testid="parsed">{String(parseFinancialInput(value, decimals))}</output>
    </>
  );
}
it.each([
  ["6000,00", "R$ 6.000,00", "6000"],
  ["0", "R$ 0,00", "0"],
  ["-12,34", "-R$ 12,34", "-12.34"],
  ["9876543.21", "R$ 9.876.543,21", "9876543.21"],
])("formata %s ao sair e preserva o valor salvo", (input, formatted, parsed) => {
  render(<Form />);
  const field = screen.getByLabelText("Saldo");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: input } });
  fireEvent.blur(field);
  expect((field as HTMLInputElement).value.replaceAll("\u00a0", " ")).toBe(formatted);
  expect(screen.getByTestId("parsed")).toHaveTextContent(parsed);
  fireEvent.focus(field);
  expect(field).toHaveValue(input);
});
it("não transforma vazio em zero e mantém erros sem arredondar", () => {
  render(<Form initial="6000" />);
  const field = screen.getByLabelText("Saldo");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: "" } });
  fireEvent.blur(field);
  expect(field).toHaveValue("");
  expect(field).toHaveAttribute("aria-invalid", "true");
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: "1,234" } });
  fireEvent.blur(field);
  expect(field).toHaveValue("1,234");
  expect(field).toHaveAttribute("aria-invalid", "true");
});
it("preserva oito casas de quantidade sem máscara de moeda", () => {
  render(<Form initial="0,12345678" decimals={8} />);
  expect(screen.getByLabelText("Saldo")).toHaveValue("0,12345678");
  expect(screen.getByTestId("parsed")).toHaveTextContent("0.12345678");
});
