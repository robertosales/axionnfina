import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/wallet/connect")({
  head: () => ({ meta: [{ title: "Conectar Banco — Axionn Finance" }] }),
  component: () => <Navigate to="/wallet/accounts" />,
});
