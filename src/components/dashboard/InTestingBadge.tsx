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
    <div className="relative rounded-2xl ring-2 ring-admin-accent">
      <InTestingBadge className="absolute -top-2.5 left-4 z-10" />
      {children}
    </div>
  );
}
