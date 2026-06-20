export function BasisBadge({ basis }: { basis: "accrual" | "cash" | string | null | undefined }) {
  if (!basis) return null;
  return (
    <span
      className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground"
      title="Reporting basis"
    >
      {basis}
    </span>
  );
}
