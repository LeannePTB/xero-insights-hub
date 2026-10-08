import { Link } from "@tanstack/react-router";
import { FileText, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Segmented toggle between the two client views: the live dashboard and the
 * point-in-time monthly management reports. The active view is filled so it
 * is obvious which one you are on. Presentation only — both sides are plain
 * route links.
 */
export function ViewToggle({
  clientId,
  active,
}: {
  clientId: string;
  active: "live" | "reports";
}) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-border bg-card p-1"
      role="tablist"
      aria-label="Client view"
    >
      <Button
        variant={active === "live" ? "default" : "ghost"}
        size="sm"
        asChild
        aria-current={active === "live" ? "page" : undefined}
      >
        <Link to="/clients/$clientId" params={{ clientId }}>
          <LayoutDashboard className="mr-2 h-4 w-4" /> Live Dashboard
        </Link>
      </Button>
      <Button
        variant={active === "reports" ? "default" : "ghost"}
        size="sm"
        asChild
        aria-current={active === "reports" ? "page" : undefined}
      >
        <Link to="/clients/$clientId/reports" params={{ clientId }}>
          <FileText className="mr-2 h-4 w-4" /> Monthly management reports
        </Link>
      </Button>
    </div>
  );
}
