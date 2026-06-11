import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Loader2, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { searchClientTransactions, type SearchHit } from "@/lib/xero/search.functions";

function fmt(n: number, ccy: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

const TYPE_TONE: Record<SearchHit["type"], string> = {
  Invoice: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  Bill: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  CreditNote: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  Prepayment: "bg-violet-500/10 text-violet-700 dark:text-violet-400",
  Overpayment: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
};

export function TransactionSearch({ clientId }: { clientId: string }) {
  const fetchSearch = useServerFn(searchClientTransactions);
  const [q, setQ] = useState("");

  const mut = useMutation({
    mutationFn: (query: string) => fetchSearch({ data: { clientId, query } }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const query = q.trim();
    if (!query) return;
    mut.mutate(query);
  }

  const hits = mut.data?.hits ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-[var(--shadow-soft)]">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search invoices, bills, credits, prepayments, overpayments across all Xero orgs…"
            className="pl-9"
            maxLength={200}
          />
        </div>
        <Button type="submit" disabled={mut.isPending || !q.trim()}>
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
        </Button>
      </form>

      {mut.error && (
        <div className="mt-3 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {(mut.error as Error).message}
        </div>
      )}

      {mut.data && (
        <div className="mt-4">
          {hits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No matches found.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-muted-foreground">
                {hits.length} match{hits.length === 1 ? "" : "es"}{hits.length === 200 ? " (showing first 200)" : ""}
              </p>
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border/60">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Type</th>
                      <th className="px-3 py-2 text-left font-semibold">Org</th>
                      <th className="px-3 py-2 text-left font-semibold">Contact</th>
                      <th className="px-3 py-2 text-left font-semibold">Number / Ref</th>
                      <th className="px-3 py-2 text-left font-semibold">Date</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2 text-right font-semibold">Outstanding</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {hits.map((h) => (
                      <tr key={`${h.type}-${h.id}`} className="border-t border-border/60 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_TONE[h.type]}`}>
                            {h.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{h.tenantName}</td>
                        <td className="px-3 py-2">{h.contact}</td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{h.number || "—"}</div>
                          {h.reference && <div className="text-xs text-muted-foreground">{h.reference}</div>}
                        </td>
                        <td className="px-3 py-2 text-xs">{h.date ?? "—"}</td>
                        <td className="px-3 py-2 text-xs">{h.status}</td>
                        <td className="px-3 py-2 text-right">{fmt(h.total, h.currency)}</td>
                        <td className="px-3 py-2 text-right">{fmt(h.amountDue, h.currency)}</td>
                        <td className="px-3 py-2">
                          {h.deepLink && (
                            <a
                              href={h.deepLink}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-primary hover:underline"
                              title="Open in Xero"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
