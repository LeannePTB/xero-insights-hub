import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { bankReconciledStale } from "@/lib/overview/reconciliation";
import { getClientOverview, setOverviewAlert, setClientOverviewHidden, setFirmOverviewHidden, getHiddenOverviewItems, type OverviewRow, type FeedEvent } from "@/lib/overview/overview.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ClientHealthBadge } from "@/components/dashboard/ClientHealthBadge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({
    meta: [
      { title: "Client overview — Traction Advisory" },
      { name: "description", content: "Every client you look after, worst first, with what changed recently." },
      { property: "og:title", content: "Client overview — Traction Advisory" },
      { property: "og:description", content: "Staff overview of client health across organisations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OverviewPage,
});

type Bucket = OverviewRow["bucket"];
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "critical", label: "In trouble" },
  { key: "warning", label: "Needs attention" },
  { key: "watch", label: "Watch" },
  { key: "ok", label: "All clear" },
  { key: "cant_assess", label: "Can't assess" },
];

function money(n: number | null) {
  if (n === null) return "—";
  const s = `$${Math.abs(Math.round(n)).toLocaleString("en-AU")}`;
  return n < 0 ? `(${s})` : s;
}
function pct(n: number | null) {
  return n === null ? "—" : `${n.toFixed(0)}%`;
}
function date(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—";
}

function OverviewPage() {
  const fetchOverview = useServerFn(getClientOverview);
  const q = useQuery({ queryKey: ["client-overview"], queryFn: () => fetchOverview({ data: {} }) });
  const [filter, setFilter] = useState<Bucket | null>(null);
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const hideClient = useServerFn(setClientOverviewHidden);
  const hideFirm = useServerFn(setFirmOverviewHidden);
  const fetchHidden = useServerFn(getHiddenOverviewItems);
  const hiddenQ = useQuery({ queryKey: ["overview-hidden"], queryFn: () => fetchHidden({ data: {} }) });
  const [busyHide, setBusyHide] = useState<string | null>(null);

  async function toggleHide(kind: "client" | "organisation", id: string, hidden: boolean) {
    setBusyHide(id);
    try {
      if (kind === "client") await hideClient({ data: { clientId: id, hidden } });
      else await hideFirm({ data: { firmId: id, hidden } });
      toast.success(hidden ? "Hidden from the overview" : "Back on the overview");
      await qc.invalidateQueries({ queryKey: ["client-overview"] });
      await qc.invalidateQueries({ queryKey: ["overview-hidden"] });
    } catch (e: any) {
      toast.error(e?.message ?? "That could not be updated.");
    } finally {
      setBusyHide(null);
    }
  }

  const rows = q.data?.rows ?? [];
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1;
    return c;
  }, [rows]);
  const shown = rows.filter(
    (r) =>
      (!filter || r.bucket === filter) &&
      (!search ||
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.firmName.toLowerCase().includes(search.toLowerCase())),
  );
  const groups = grouped
    ? [...new Set(shown.map((r) => r.firmName))].sort().map((name) => ({
        name,
        rows: shown.filter((r) => r.firmName === name),
      }))
    : [{ name: null as string | null, rows: shown }];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Client overview</h1>
        <p className="text-sm text-muted-foreground">
          Every client you look after, worst first. Figures come from the overnight Xero snapshot.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BUCKETS.map((b) => (
          <button
            key={b.key}
            onClick={() => setFilter(filter === b.key ? null : b.key)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              filter === b.key ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/50"
            }`}
          >
            <div className="text-2xl font-semibold">{counts[b.key] ?? 0}</div>
            <div className="text-xs text-muted-foreground">{b.label}</div>
          </button>
        ))}
      </div>

      <Feed events={q.data?.feed ?? []} cleared={q.data?.cleared ?? []} notes={q.data?.feedNotes ?? []} loading={q.isLoading} />

      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-64">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Search clients or organisations" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="group" checked={grouped} onCheckedChange={setGrouped} />
          <Label htmlFor="group">Group by organisation</Label>
        </div>
      </div>

      {q.isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading clients…
        </div>
      ) : q.isError ? (
        <p className="text-sm text-destructive">The client overview could not be loaded. Try again shortly.</p>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">No clients to show.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Client</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Cash at bank</th>
                <th className="p-3 text-right">Net cash</th>
                <th className="p-3 text-right">7-day change</th>
                <th className="p-3 text-right">Protected money</th>
                <th className="p-3 text-right">Net profit MTD</th>
                <th className="p-3 text-right">Debtors overdue</th>
                <th className="p-3">Bank reconciled to</th>
                <th className="p-3">Last report sent</th>
                <th className="p-3">Data as at</th>
                <th className="p-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.name ?? "all"} name={g.name} rows={g.rows} onOpen={(id) => navigate({ to: "/clients/$clientId", params: { clientId: id } })} onHideClient={(id) => toggleHide("client", id, true)} onHideFirm={(id) => toggleHide("organisation", id, true)} busyHide={busyHide} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(hiddenQ.data?.items.length ?? 0) > 0 && (
        <div className="rounded-lg border p-4">
          <h2 className="text-sm font-semibold">Hidden from this overview</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            These are not monitored here. Their data still refreshes and their own pages are unchanged.
          </p>
          <ul className="mt-3 space-y-2">
            {hiddenQ.data!.items.map((item) => (
              <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">{item.name}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {item.kind === "organisation" ? "Organisation" : `Client · ${item.firmName}`}
                  </span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyHide === item.id}
                  onClick={() => toggleHide(item.kind, item.id, false)}
                >
                  {busyHide === item.id ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                  Bring back
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function GroupRows({ name, rows, onOpen, onHideClient, onHideFirm, busyHide }: { name: string | null; rows: OverviewRow[]; onOpen: (id: string) => void; onHideClient: (id: string) => void; onHideFirm: (id: string) => void; busyHide: string | null }) {
  return (
    <>
      {name && (
        <tr className="border-y bg-muted/60">
          <td colSpan={12} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide">{name}</span>
              <span className="text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? "client" : "clients"}
              </span>
              <button
                type="button"
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                title="Stop monitoring this organisation on the overview"
                disabled={busyHide === rows[0]?.firmId}
                onClick={() => rows[0] && onHideFirm(rows[0].firmId)}
              >
                <EyeOff className="h-3.5 w-3.5" /> Hide organisation
              </button>
            </div>
          </td>
        </tr>
      )}
      {rows.map((r) => {
        const staleBank = r.freshAsAt !== null && bankReconciledStale(r.bankReconciledTo, r.freshAsAt);
        const staleTitle =
          r.bankReconciledTo === null
            ? "The bank reconciliation date is not available yet — these figures may not reflect the real position."
            : `Bank not reconciled since ${date(r.bankReconciledTo)} — these figures may not reflect the real position.`;
        const staleMark = staleBank ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label={staleTitle} />
        ) : null;
        return (
        <tr key={r.clientId} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => onOpen(r.clientId)}>
          <td className="p-3">
            <Link to="/clients/$clientId" params={{ clientId: r.clientId }} className="font-medium" onClick={(e) => e.stopPropagation()}>
              {r.clientName}
            </Link>
            {!name && <div className="text-xs text-muted-foreground">{r.firmName}</div>}
          </td>
          <td className="max-w-[16rem] p-3 [&>span]:mt-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <ClientHealthBadge verdict={r.verdict} />
            </div>
          </td>
          <td className="p-3 text-right tabular-nums" title={staleBank ? staleTitle : undefined}>
            <div className="flex items-center justify-end gap-2">
              {staleMark}
              <Sparkline values={r.cashSpark} />
              {money(r.cash)}
            </div>
          </td>
          <td
            className="p-3 text-right tabular-nums"
            title={
              staleBank
                ? staleTitle
                : r.creditCardDebt !== null && r.creditCardDebt > 0
                  ? `Cash at bank less ${money(r.creditCardDebt)} of credit card debt.`
                  : "Cash at bank; this client has no credit card debt."
            }
          >
            <span className="inline-flex items-center justify-end gap-1">
              {staleMark}
              {money(r.netCash)}
            </span>
          </td>
          <td className={`p-3 text-right tabular-nums ${r.cashBigMove ? "font-semibold text-destructive" : ""}`} title={staleBank ? staleTitle : (r.historyNote ?? undefined)}>
            <span className="inline-flex items-center justify-end gap-1">
              {staleMark}
              {r.cashChange7d === null ? "—" : `${r.cashChange7d >= 0 ? "+" : ""}${money(r.cashChange7d)}`}
            </span>
          </td>
          <td className="p-3 text-right tabular-nums" title={staleBank ? staleTitle : undefined}>
            <span className="inline-flex items-center justify-end gap-1">
              {staleMark}
              {pct(r.protectedPctOfCash)}
            </span>
          </td>
          <td className="p-3 text-right tabular-nums">{money(r.netProfitMtd)}</td>
          <td className="p-3 text-right tabular-nums">{pct(r.debtorsOverduePct)}</td>
          <td className="p-3" title={r.bankReconciledTo === null ? "Reconciliation date not available in the stored figures yet." : undefined}>{r.bankReconciledTo === null ? "—" : date(r.bankReconciledTo)}</td>
          <td className="p-3">{date(r.lastReportSentAt)}</td>
          <td className="p-3 text-muted-foreground">{date(r.freshAsAt)}</td>
          <td className="p-3">
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="Stop monitoring this client on the overview"
              disabled={busyHide === r.clientId}
              onClick={(e) => {
                e.stopPropagation();
                onHideClient(r.clientId);
              }}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
          </td>
        </tr>
        );
      })}
    </>
  );
}

function Feed({ events, cleared, notes, loading }: { events: FeedEvent[]; cleared: FeedEvent[]; notes: string[]; loading: boolean }) {
  const setAlert = useServerFn(setOverviewAlert);
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  async function act(e: FeedEvent, action: "acknowledge" | "snooze" | "clear") {
    const k = `${e.clientId}:${e.eventKey}`;
    setBusy(k);
    try {
      await setAlert({ data: { clientId: e.clientId, eventKey: e.eventKey, action, severity: e.severity, snoozeDays: action === "snooze" ? 7 : undefined } });
      await qc.invalidateQueries({ queryKey: ["client-overview"] });
    } catch {
      toast.error("That alert could not be updated.");
    } finally {
      setBusy(null);
    }
  }
  if (loading) return null;
  return (
    <section className="rounded-lg border bg-card p-4">
      <h2 className="text-sm font-semibold">What changed — last 7 days</h2>
      {!events.length ? (
        <p className="mt-2 text-sm text-muted-foreground">Nothing new in the last 7 days.</p>
      ) : (
        <ul className="mt-3 divide-y">
          {events.map((e) => (
            <li key={`${e.clientId}:${e.eventKey}`} className="flex flex-wrap items-baseline gap-x-3 py-2 text-sm">
              <Link to="/clients/$clientId" params={{ clientId: e.clientId }} className="font-medium">
                {e.clientName}
              </Link>
              <span className="text-xs text-muted-foreground">{e.firmName}</span>
              {e.href ? (
                <a href={e.href} className="flex-1 underline-offset-2 hover:underline">
                  {e.headline}
                </a>
              ) : (
                <span className="flex-1">{e.headline}</span>
              )}
              {(e.before || e.after) && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {e.before ?? "—"} → {e.after ?? "—"}
                </span>
              )}
              <span className="text-xs text-muted-foreground">{date(e.date)}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => act(e, "acknowledge")}>Acknowledge</Button>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(e, "snooze")}>Snooze 7 days</Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {cleared.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground">Cleared ({cleared.length})</summary>
          <ul className="mt-2 divide-y">
            {cleared.map((e) => (
              <li key={`${e.clientId}:${e.eventKey}`} className="flex flex-wrap items-baseline gap-x-3 py-2 text-muted-foreground">
                <span className="font-medium text-foreground">{e.clientName}</span>
                <span className="flex-1">{e.headline}</span>
                <span className="text-xs">
                  {e.cleared?.how === "snoozed"
                    ? `Snoozed by ${e.cleared.by} until ${date(e.cleared.until ?? null)}`
                    : `Acknowledged by ${e.cleared?.by} on ${date(e.cleared?.at ?? null)}`}
                </span>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => act(e, "clear")}>Un-acknowledge</Button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
          {notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </section>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 60},${18 - ((v - min) / span) * 16}`).join(" ");
  return (
    <svg width="60" height="20" aria-label="Cash at bank, last 30 days" className="text-primary">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
