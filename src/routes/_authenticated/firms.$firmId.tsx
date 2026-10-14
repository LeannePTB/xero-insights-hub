import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";

export const Route = createFileRoute("/_authenticated/firms/$firmId")({
  staticData: { sitemap: false },
  component: FirmLayout,
});

function FirmLayout() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <Outlet />
    </div>
  );
}
