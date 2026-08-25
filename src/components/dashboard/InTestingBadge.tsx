import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Marks a card that is still being built. Cards in testing reach a client's
 * dashboard through the organisation's "Widgets in testing" opt-in, and their
 * figures must never be mistaken for a finished feature.
 */
export function InTestingBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full bg-admin-accent px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-admin-accent-foreground shadow-sm",
        className,
      )}
      title="This card is still in testing — its figures may change or be withdrawn"
    >
      <FlaskConical className="h-3 w-3" />
      In testing
    </span>
  );
}

/** Wraps a dashboard card so the "In testing" state is impossible to miss. */
export function InTestingCard({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl ring-2 ring-admin-accent">
      <div className="flex items-center gap-1 bg-admin-accent px-4 py-1 pr-12 text-[11px] font-bold uppercase tracking-wide text-admin-accent-foreground">
        <FlaskConical className="h-3 w-3" />
        In testing
      </div>
      <div className="[&>*]:rounded-t-none [&>*]:border-t-0">{children}</div>
    </div>
  );
}

