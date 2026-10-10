import { createFileRoute, Outlet } from "@tanstack/react-router";

/** Organisation settings: each section is its own page in the side menu. */
export const Route = createFileRoute("/_authenticated/firms/$firmId/settings")({
  component: () => <Outlet />,
});
