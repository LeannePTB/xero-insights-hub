import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getLoanMismatchDetail } from "@/lib/loan-consolidation.functions";
import { buildXeroTransactionLink } from "@/lib/xero/loan-account-link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, ExternalLink, AlertTriangle } from "lucide-react";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}

const KIND_LABEL: Record<string, string> = {
  missing_counterparty: "Not mirrored",
  missing_this_file: "Extra here",
  amount: "Amount differs",
  date: "Timing only",
};

export function MismatchDetailDialog({
  open,
  onOpenChange,
  clientId,
  rowId,
  asAt,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  rowId: string | null;
  asAt: string;
}) {
  const fetchDetail = useServerFn(getLoanMismatchDetail);
  const detailQ = useQuery({
    queryKey: ["loan-mismatch", clientId, rowId, asAt],
    queryFn: () =>
      fetchDetail({ data: { clientId, rowId: rowId!, asAt } }),
    enabled: open && !!rowId,
  });

  const d = detailQ.data;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Loan mismatch breakdown</DialogTitle>
          <DialogDescription>
            {d
              ? `As at ${dateLabel(d.asAt)} — net out of balance ${fmt(d.net)}`
              : "Analysing the two loan accounts…"}
          </DialogDescription>
        </DialogHeader>

        {detailQ.isLoading && (
          <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Pulling transactions from Xero…
          </div>
        )}

        {!detailQ.isLoading && detailQ.isError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <div className="mb-1 flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" /> Couldn't load the breakdown
            </div>
            {String(detailQ.error instanceof Error ? detailQ.error.message : detailQ.error)}
          </div>
        )}

        {d && !detailQ.isError && (
          <div className="space-y-5">
            {/* Summary of both sides */}
            <div className="grid gap-3 sm:grid-cols-2">
              <SideCard side={d.account} prefix="This file" />
              <SideCard side={d.counterparty} prefix="Counterparty" />
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <Stat label="Net" value={fmt(d.net)} tone={Math.abs(d.net) <= 0.01 ? "ok" : "bad"} />
              <Stat label="Explained" value={fmt(d.explained)} />
              <Stat label="Unexplained" value={fmt(d.unexplained)} tone={Math.abs(d.unexplained) <= 0.01 ? "ok" : "bad"} />
            </div>

            {d.differences.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Every transaction on one side is mirrored on the other. The balance difference is
                explained by the values above.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {d.differences.length} item{d.differences.length === 1 ? "" : "s"} to review
                </p>
                {d.differences.map((diff) => (
                  <div
                    key={diff.id}
                    className="rounded-lg border border-border bg-muted/40 p-3 text-sm"
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge variant="outline" className="shrink-0">
                        {KIND_LABEL[diff.kind] ?? diff.kind}
                      </Badge>
                      <span
                        className={
                          Math.abs(diff.impact) <= 0.01
                            ? "text-xs text-muted-foreground"
                            : "font-semibold " + (diff.impact < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive")
                        }
                      >
                        {Math.abs(diff.impact) <= 0.01 ? "no effect" : fmt(diff.impact)}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{diff.note}</p>
                    <div className="mt-2 space-y-1">
                      {diff.a && <LineRow side={diff.a} label="Here" />}
                      {diff.b && <LineRow side={diff.b} label="There" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LineRow({ side, label }: { side: any; label: string }) {
  const href = buildXeroTransactionLink({
    shortCode: side.shortCode,
    accountId: side.accountId,
    sourceType: side.sourceType,
    sourceId: side.sourceId,
  });
  const desc = side.description ?? side.reference ?? "Transaction";
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <div className="min-w-0">
        <span className="mr-2 font-medium uppercase text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">
          {dateLabel(side.date)} · {desc}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span className="font-medium">{fmt(side.amount)}</span>
        {href && (
          <a href={href} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

function SideCard({ side, prefix }: { side: any; prefix: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{prefix}</span>
        {side.error && <Badge variant="destructive">{side.error}</Badge>}
      </div>
      <p className="truncate font-medium">
        {side.accountCode ? `${side.accountCode} · ` : ""}
        {side.accountName || "Unknown"}
      </p>
      <p className="text-xs text-muted-foreground">{side.tenantName}</p>
      <p className="mt-1 text-lg font-semibold">{side.error ? "—" : fmt(side.balance)}</p>
      <p className="text-xs text-muted-foreground">
        {side.lineCount} transaction{side.lineCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "bad" }) {
  const color =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "bad"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={"text-lg font-semibold " + color}>{value}</p>
    </div>
  );
}
