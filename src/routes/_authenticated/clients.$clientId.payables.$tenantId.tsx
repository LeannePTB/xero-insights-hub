import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPayablesList } from "@/lib/xero/payables.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, RefreshCw, Wallet, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clients/$clientId/payables/$tenantId")({
  head: () => ({ meta: [{ title: "Payables — Traction Advisory" }] }),
  component: PayablesPage,
});

function fmt(n: number, ccy = "AUD") {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy, maximumFractionDigits: 2 }).format(n);
}

function PayablesPage() {
  const { clientId, tenantId } = Route.useParams();
  const fetchList = useServerFn(getPayablesList);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["xero-ap-list", tenantId],
    queryFn: () => fetchList({ data: { tenantId } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
          <Link to="/clients/$clientId" params={{ clientId }}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to dashboard
          </Link>
        </Button>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold sm:text-3xl flex items-center gap-2">
              <Wallet className="h-6 w-6 text-primary" /> All Payables
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Unpaid supplier bills · as of {data?.asOf ?? "—"} · {data?.invoices.length ?? 0} bills
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="mt-6 rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : error ? (
            <div className="m-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{(error as Error).message}</div>
          ) : !data?.invoices.length ? (
            <div className="p-10 text-center text-sm text-muted-foreground">No outstanding bills.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Supplier</th>
                    <th className="px-4 py-3 text-left font-semibold">Invoice #</th>
                    <th className="px-4 py-3 text-left font-semibold">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Due</th>
                    <th className="px-4 py-3 text-right font-semibold">Days overdue</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount due</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.invoiceId} className="border-t border-border/60">
                      <td className="px-4 py-2.5">{inv.contact}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {inv.deepLink ? (
                          <a
                            href={inv.deepLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline"
                            title="Open in Xero"
                          >
                            {inv.invoiceNumber || "—"}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          inv.invoiceNumber || "—"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.reference || "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.date ?? "—"}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{inv.dueDate ?? "—"}</td>
                      <td className={`px-4 py-2.5 text-right ${inv.daysOverdue > 0 ? "text-rose-600 font-medium" : "text-muted-foreground"}`}>
                        {inv.daysOverdue > 0 ? inv.daysOverdue : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium">{fmt(inv.amountDue, inv.currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
