import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/security")({
  staticData: { sitemap: false },
  beforeLoad: () => {
    throw redirect({ to: "/system/security", replace: true });
  },
});
