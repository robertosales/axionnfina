import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tags")({
  beforeLoad: () => {
    throw redirect({ to: "/categories", search: { tab: "tags" }, replace: true, statusCode: 301 });
  },
  head: () => ({
    meta: [
      { title: "Tags dos lançamentos — Axionn Finance" },
      {
        name: "description",
        content: "Gerencie as tags dos seus lançamentos financeiros no Axionn Finance.",
      },
      { property: "og:title", content: "Tags dos lançamentos — Axionn Finance" },
      {
        property: "og:description",
        content: "Renomeie, mescle e organize as tags dos seus lançamentos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});
