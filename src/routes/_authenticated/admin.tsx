import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Legacy /admin area — every child now redirects to /system. */
export const Route = createFileRoute("/_authenticated/admin")({
  component: () => <Outlet />,
});
