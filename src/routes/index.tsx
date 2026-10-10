import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Sign in — Traction Advisory" },
    { name: "description", content: "Sign in to your Traction Advisory workspace." },
    { property: "og:title", content: "Sign in — Traction Advisory" },
    { property: "og:description", content: "Sign in to your Traction Advisory workspace." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
