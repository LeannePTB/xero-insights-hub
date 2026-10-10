import { createFileRoute } from "@tanstack/react-router";
import { OverviewView } from "@/components/overview/OverviewView";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Client overview — Traction Advisory" },
      { name: "description", content: "Every client you look after across your organisations, worst first." },
      { property: "og:title", content: "Client overview — Traction Advisory" },
      { property: "og:description", content: "Client health across every organisation you belong to." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <OverviewView />,
});
