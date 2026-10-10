import type { PillarStatus } from "@/lib/health.functions";

const STYLES: Record<PillarStatus, string> = {
  good: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  watch: "bg-info/10 text-info bg-info/10 text-info",
  bad: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300",
  neutral: "bg-muted text-muted-foreground",
  not_in_xero: "bg-info/10 text-info bg-info/10 text-info",
};

export function StatusPill({ status, children }: { status: PillarStatus; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium leading-5 ${STYLES[status]}`}>
      {children}
    </span>
  );
}
