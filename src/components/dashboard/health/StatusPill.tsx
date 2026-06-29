import type { PillarStatus } from "@/lib/health.functions";

const STYLES: Record<PillarStatus, string> = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  watch: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground",
  not_in_xero: "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300",
};

export function StatusPill({ status, children }: { status: PillarStatus; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ${STYLES[status]}`}>
      {children}
    </span>
  );
}
