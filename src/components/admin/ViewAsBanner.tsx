import { Eye } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

/**
 * Sticky banner shown while an admin previews the app as an organisation owner
 * or as a client viewer. Presentation only — no permissions are changed.
 */
export function ViewAsBanner({ label, note }: { label: string; note?: string }) {
  return (
    <div className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500/15 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2 text-sm">
          <Eye className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <span className="truncate font-medium">Preview: {label}</span>
          {note && <span className="hidden truncate text-muted-foreground sm:inline">· {note}</span>}
        </div>
        <Button size="sm" variant="outline" asChild>
          <Link to="/admin">Exit preview</Link>
        </Button>
      </div>
    </div>
  );
}
