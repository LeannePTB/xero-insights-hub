import { ATTENTION, attentionCounts, matchesAttention, type AttentionKey } from "@/lib/overview/attention";
import { Plus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowDownWideNarrow, Loader2, Search } from "lucide-react";
import { getClientOverview, setOverviewAlert, type OverviewRow, type FeedEvent } from "@/lib/overview/overview.functions";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { OverviewVerdictBadge } from "@/components/overview/OverviewVerdictBadge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/components/PageContainer";
import { ResyncHeader, ResyncRowControl, useResyncQueue } from "@/components/overview/ResyncControls";
import { billStatus, organisationToday } from "@/components/dashboard/tax-obligations";
const statusText = (due: string, amount: number) => { const st = billStatus(due, organisationToday(), amount); return st.detail ? `${st.label} · ${st.detail}` : st.label; };


type Bucket = OverviewRow["bucket"];
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "critical", label: "In trouble" },
  { key: "warning", label: "Needs attention" },
  { key: "watch", label: "Monitor" },
  { key: "ok", label: "Good" },
  { key: "cant_assess", label: "No data" },
];

function money(n: number | null) {
  if (n === null) return "—";
  const s = `$${Math.abs(Math.round(n)).toLocaleString("en-AU")}`;
  return n < 0 ? `(${s})` : s;
}
function pct(n: number | null) {
  return n === null ? "—" : `${n.toFixed(0)}%`;
}
function dayMonth(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
function monthShort(d: string) {
  return new Date(`${d}T00:00:00`).toLocaleDateString("en-AU", { month: "short" });
}
function date(s: string | null) {
  return s ? new Date(s).toLocaleDateString("en-AU", { day: "numeric", month: "short" }) : "—";
}

export function OverviewView({ firmId, title }: { firmId?: string; title?: string }) {
  const fetchOverview = useServerFn(getClientOverview);
  const q = useQuery({ queryKey: ["client-overview", firmId ?? "all"], queryFn: () => fetchOverview({ data: firmId ? { firmId } : {} }) });
  const [filter, setFilter] = useState<Bucket | null>(null);
  const [attention, setAttention] = useState<AttentionKey | null>(null);
  const [search, setSearch] = useState("");
  const [grouped, setGrouped] = useState(false);
  const [taxSort, setTaxSort] = useState(false);
  const navigate = useNavigate();
  const rows = q.data?.rows ?? [];
  const queue = useResyncQueue();
  const resyncIds = rows.filter((r) => r.canResync).map((r) => r.clientId);
  const lastSynced = rows.reduce<string | null>((m, r) => (r.freshAsAt && (!m || r.freshAsAt > m) ? r.freshAsAt : m), null);
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of rows) c[r.bucket] = (c[r.bucket] ?? 0) + 1;
    return c;
  }, [rows]);
  const attn = useMemo(() => attentionCounts(rows), [rows]);
  const filtered = rows.filter(
    (r) =>
      (!filter || r.bucket === filter) &&
      (!attention || matchesAttention(r, attention)) &&
      (!search ||
        r.clientName.toLowerCase().includes(search.toLowerCase()) ||
        r.firmName.toLowerCase().includes(search.toLowerCase())),
  );
  const shown = taxSort ? [...filtered].sort((a, b) => (b.taxNext?.amount ?? -1) - (a.taxNext?.amount ?? -1)) : filtered;
  const groups = grouped
    ? [...new Set(shown.map((r) => r.firmName))].sort().map((name) => ({
        name,
        rows: shown.filter((r) => r.firmName === name),
      }))
    : [{ name: null as string | null, rows: shown }];

  return (
    <PageContainer as="div" width="full" className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">{title ?? "Client overview"}</h1>
          <p className="text-sm text-muted-foreground">
            Every client you look after, worst first. Figures come from the overnight Xero snapshot.
          </p>
        </div>
        <ResyncHeader clientIds={resyncIds} lastSynced={lastSynced} queue={queue} />
      </div>

      {/* Counts only: figures from different companies are never added together. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5" aria-label="Clients needing attention">
        {ATTENTION.map((a) => (
          <button
            key={a.key}
            onClick={() => setAttention(attention === a.key ? null : a.key)}
            aria-pressed={attention === a.key}
            className={`rounded-lg border p-3 text-left transition-colors ${
              attention === a.key ? "border-primary bg-primary/10" : "bg-card hover:bg-muted/50"
            }`}
          >
            <div className="text-kpi font-semibold">{attn[a.key]}</div>
            <div className="text-xs text-muted-foreground">{a.label}</div>
          </button>
        ))}
        <button
          onClick={() => { setAttention(null); setFilter(null); }}
          className="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"
        >
          <div className="text-kpi font-semibold">{rows.length}</div>
          <div className="text-xs text-muted-foreground">Active clients</div>
        </button>
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
            <div className="text-kpi font-semibold">{counts[b.key] ?? 0}</div>
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
      ) : !rows.length && firmId ? (
        <div className="rounded-lg border bg-card p-6">
          <p className="text-sm">Welcome — this organisation has no clients yet.</p>
          <Button asChild className="mt-3">
            <Link to="/firms/$firmId/add-client" params={{ firmId }}>
              <Plus className="mr-2 h-4 w-4" /> Add your first client
            </Link>
          </Button>
        </div>
      ) : !rows.length ? (
        <p className="text-sm text-muted-foreground">No clients to show.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full min-w-[72rem] text-sm">
            <thead className="bg-muted/30 text-left text-xs text-muted-foreground">
              <tr>
                <th className="sticky left-0 z-10 bg-card p-3">Client</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Cash at bank</th>
                <th className="p-3 text-right">Net cash</th>
                <th className="p-3 text-right">7-day change</th>
                <th className="p-3 text-right" aria-sort={taxSort ? "descending" : "none"}>
                  <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setTaxSort((v) => !v)}>
                    Tax &amp; super owed <ArrowDownWideNarrow className={`h-3.5 w-3.5 ${taxSort ? "text-foreground" : "opacity-50"}`} />
                  </button>
                </th>
                <th className="p-3 text-right">Net profit MTD</th>
                <th className="p-3 text-right">Debtors overdue</th>
                <th className="p-3">Last report sent</th>
                <th className="p-3">Data as at</th>
                <th className="p-3" aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <GroupRows key={g.name ?? "all"} name={g.name} rows={g.rows} onOpen={(id) => navigate({ to: "/clients/$clientId", params: { clientId: id } })} queue={queue} />
              ))}
            </tbody>
          </table>
        </div>
      )}

    </PageContainer>
  );
}

function GroupRows({ name, rows, onOpen, queue }: { name: string | null; rows: OverviewRow[]; onOpen: (id: string) => void; queue: ReturnType<typeof useResyncQueue> }) {
  return (
    <>
      {name && (
        <tr className="border-y bg-muted/30">
          <td colSpan={11} className="px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold uppercase tracking-wide">{name}</span>
              <span className="text-xs text-muted-foreground">
                {rows.length} {rows.length === 1 ? "client" : "clients"}
              </span>
            </div>
          </td>
        </tr>
      )}
      {rows.map((r) => {
        // Named per-account warning from the server; null shows nothing.
        const staleTitle = r.bankReconWarning;
        const staleMark = staleTitle ? (
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-info" aria-label={staleTitle} />
        ) : null;
        return (
        <tr key={r.clientId} className="group cursor-pointer border-t bg-card hover:bg-muted/30" onClick={() => onOpen(r.clientId)}>
          <td className="sticky left-0 z-10 min-w-[11rem] bg-card p-3 group-hover:bg-muted">
            <Link to="/clients/$clientId" params={{ clientId: r.clientId }} className="font-medium" onClick={(e) => e.stopPropagation()}>
              {r.clientName}
            </Link>
            {!name && <div className="text-xs text-muted-foreground">{r.firmName}</div>}
          </td>
          <td className="max-w-[16rem] p-3 [&>span]:mt-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <OverviewVerdictBadge verdict={r.verdict} />
            </div>
          </td>
          <td className="p-3 text-right tabular-nums" title={staleTitle ?? undefined}>
            <div className="flex items-center justify-end gap-2">
              {staleMark}
              <Sparkline values={r.cashSpark} />
              {money(r.cash)}
            </div>
            {r.cashNote && <div className="mt-0.5 whitespace-nowrap text-right text-xs font-normal text-muted-foreground" title={r.cashNote}><abbr className="no-underline" title={r.cashNote}>{r.cashNoteShort ?? r.cashNote}</abbr></div>}
          </td>
          <td
            className="p-3 text-right tabular-nums"
            title={
              staleTitle ? staleTitle : r.creditCardDebt !== null && r.creditCardDebt > 0
                  ? `Cash at bank less ${money(r.creditCardDebt)} of credit card debt.`
                  : "Cash at bank; this client has no credit card debt."
            }
          >
            <span className="inline-flex items-center justify-end gap-1">
              {staleMark}
              {money(r.netCash)}
            </span>
          </td>
          <td className={`p-3 text-right tabular-nums ${r.cashBigMove ? "font-semibold text-destructive" : ""}`} title={staleTitle ?? r.historyNote ?? undefined}>
            <span className="inline-flex items-center justify-end gap-1">
              {staleMark}
              {r.cashChange7d === null ? "—" : `${r.cashChange7d >= 0 ? "+" : ""}${money(r.cashChange7d)}`}
            </span>
          </td>
          <td className="min-w-[14rem] p-3 text-right tabular-nums" onClick={e => e.stopPropagation()}>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-auto max-w-[16rem] flex-col items-end gap-0.5 whitespace-normal py-1 text-right" aria-label={`Tax and super owed for ${r.clientName}`}>
                  <span className={r.taxNext?.overdue ? "font-semibold text-destructive" : ""}>
                    {r.taxNext ? `Next due: ${money(r.taxNext.amount)} · ${dayMonth(r.taxNext.due)} · ${statusText(r.taxNext.due, r.taxNext.amount)}` : "—"}
                  </span>
                  {(r.taxBuilding || r.superDue) && (
                    <span className="text-xs font-normal text-muted-foreground">
                      {[r.taxBuilding ? `Currently accruing · ~${money(r.taxBuilding.amount)} (${monthShort(r.taxBuilding.due)})` : null,
                        r.superDue ? `Super ${money(Math.round(r.superDue.amount))}${r.superDue.due ? ` (${dayMonth(r.superDue.due)})` : ""}` : null].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="max-w-sm text-xs">
                {r.taxItems.length ? (
                  <ul className="space-y-1">
                    {r.taxItems.map((it, i) => (
                      <li key={i} className={`flex justify-between gap-3 ${it.overdue ? "text-destructive" : ""}`}>
                        <span>{it.label}</span>
                        <span className="tabular-nums">{money(it.amount)}{it.due ? ` · due ${dayMonth(it.due)} · ${statusText(it.due, it.amount)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                ) : "Nothing known to be due yet."}
              </PopoverContent>
            </Popover>
          </td>
          <td className="p-3 text-right tabular-nums">{money(r.netProfitMtd)}</td>
          <td className="p-3 text-right tabular-nums" title="Share of invoices due in the last 90 days (or not yet due) that are more than 14 days late">
            {pct(r.debtorsOverduePct)}
            {r.debtorsOldAmount ? <div className="mt-0.5 text-xs font-normal text-muted-foreground">Old debts {money(r.debtorsOldAmount)}</div> : null}
          </td>
          <td className="p-3">{date(r.lastReportSentAt)}</td>
          <td className="p-3 text-muted-foreground">{date(r.freshAsAt)}</td>
          <td className="p-3">
            <div className="flex items-center gap-3">
            {r.canResync && <ResyncRowControl clientId={r.clientId} queue={queue} />}
            </div>
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
    <svg width="60" height="20" aria-label="Cash at bank, last 30 days" className="text-emphasis">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
