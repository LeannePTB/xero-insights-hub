import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/system", replace: true });
  },
});
