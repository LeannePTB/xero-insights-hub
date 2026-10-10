import { createFileRoute, redirect } from "@tanstack/react-router";

/** Renamed "Platform staff"; kept so old links keep working. */
export const Route = createFileRoute("/_authenticated/settings/advisors")({
  beforeLoad: () => {
    throw redirect({ to: "/system/staff", replace: true });
  },
});
