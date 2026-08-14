import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Visual markers for surfaces that only platform super admins can see.
 * Presentation only — gating is decided by the caller.
 */
export function SuperAdminBadge({
  label = "Super Admin View",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-admin-accent/40 bg-admin-accent/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-admin-accent",
        className,
      )}
      title="Only platform super admins can see this"
    >
      <ShieldCheck className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Compact inline variant for single controls or table rows. */
export function SuperAdminChip({ className }: { className?: string }) {
  return <SuperAdminBadge label="Super admin" className={cn("normal-case", className)} />;
}

/** Wraps a block in a tinted, clearly-marked container. */
export function SuperAdminSection({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-admin-accent/30 bg-admin-accent/[0.04] p-1.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 px-3 py-1.5">
        <div className="text-sm font-medium text-muted-foreground">{title}</div>
        <SuperAdminBadge />
      </div>
      {children}
    </section>
  );
}
